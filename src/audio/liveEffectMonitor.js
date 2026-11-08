/** @file 实时试听控制器；拥有且只释放本次会话的音轨、Worker 和 AudioContext。 */
import { estimateReferencePitch, getPitchParameters } from './pitchParameters.js';

/** 用短暂的人声校准取得固定参考基频，取消时立即解除定时器和音频连接。 */
function calibrateReference(context, source, signal) {
  return new Promise((resolve, reject) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(analyser).connect(mute).connect(context.destination);
    const samples = new Float32Array(analyser.fftSize);
    const estimates = [];
    let ticks = 0;
    const finish = (error, value) => {
      clearInterval(timer);
      signal.removeEventListener('abort', abort);
      source.disconnect(analyser);
      analyser.disconnect(); mute.disconnect();
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(new DOMException('已取消校准', 'AbortError'));
    const timer = setInterval(() => {
      ticks++;
      analyser.getFloatTimeDomainData(samples);
      const f0 = estimateReferencePitch(samples, context.sampleRate);
      if (f0) estimates.push(f0);
      // 至少覆盖半秒，避免只用一个瞬时周期决定整段的变调比例。
      if (ticks >= 6 && estimates.length >= 5) {
        const sorted = estimates.slice().sort((a, b) => a - b);
        const middle = sorted[Math.floor(sorted.length / 2)];
        const consistent = sorted.filter(value => Math.abs(value - middle) / middle < 0.12);
        if (consistent.length >= 5) { finish(null, Math.round(middle)); return; }
      }
      if (ticks >= 30) finish(new Error('未能校准基频，请发出平稳的“啊”音，或填写参考基频后重试。'));
    }, 100);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** 持续流式播放，UI 线程只接收状态，采样经 MessageChannel 在音频线程和 Worker 间传输。 */
export class LiveEffectMonitor extends EventTarget {
  constructor() {
    super();
    this.phase = 'idle'; this.token = 0; this.volume = 0.5; this.shiftHz = 50;
    this.context = null; this.stream = null; this.worker = null; this.node = null;
    this.source = null; this.gain = null; this.analyser = null;
    this.stats = null; this.config = null; this.lastError = null; this.referenceF0 = null;
  }

  /** 发布可供 React 订阅的状态事件。 */
  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  setPhase(phase) { this.phase = phase; this.emit('state', { phase }); }

  /** 用户点击后申请麦克风；迟到授权不会重新开启已取消的会话。 */
  async start({ algorithm = 'soundtouch', shiftHz = 50, referenceF0 = null } = {}) {
    if (this.phase !== 'idle') return;
    const token = ++this.token;
    this.lastError = null; this.stats = null; this.config = null;
    this.algorithm = algorithm; this.shiftHz = shiftHz; this.referenceF0 = null;
    this.abortController = new AbortController();
    this.setPhase('requesting');
    let context, stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode) throw new Error('当前浏览器不支持实时试听，请使用支持 AudioWorklet 的浏览器，并通过 HTTPS 或 localhost 打开。');
      context = new AudioContext({ latencyHint: 'interactive' });
      this.context = context;
      await context.resume();
      if (token !== this.token) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1,
        echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (token !== this.token) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      for (const track of stream.getTracks()) track.addEventListener('ended', () => {
        if (token === this.token) this.fail('麦克风已断开，请重新开启试听。');
      });
      this.source = context.createMediaStreamSource(stream);
      if (referenceF0 === null) {
        this.setPhase('calibrating');
        referenceF0 = await calibrateReference(context, this.source, this.abortController.signal);
      }
      if (token !== this.token) return;
      this.referenceF0 = referenceF0;
      const parameters = getPitchParameters(referenceF0, this.shiftHz);
      this.emit('reference', parameters);
      await context.audioWorklet.addModule(new URL('./live-io-worklet.js', import.meta.url));
      if (token !== this.token) return;
      const node = new AudioWorkletNode(context, 'live-pitch-io', { numberOfInputs: 1, numberOfOutputs: 1,
        outputChannelCount: [1], processorOptions: { semitones: parameters.semitones } });
      const worker = new Worker(new URL('./effect-worker.js', import.meta.url), { type: 'module' });
      this.node = node; this.worker = worker;
      this.gain = context.createGain(); this.gain.gain.value = this.volume;
      this.analyser = context.createAnalyser(); this.analyser.fftSize = 8192;
      this.source.connect(node).connect(this.gain).connect(this.analyser).connect(context.destination);
      this.lastGenerated = -1; this.lastAdvance = performance.now();
      node.onprocessorerror = () => { if (token === this.token) this.fail('音频线程异常，请重新开启试听。'); };
      node.port.onmessage = ({ data }) => {
        if (token !== this.token) return;
        if (data.type === 'config') { this.config = data; this.lastAdvance = performance.now(); this.emit('config', data); }
        else if (data.type === 'stats') {
          if (data.generatedFrames !== this.lastGenerated) { this.lastGenerated = data.generatedFrames; this.lastAdvance = performance.now(); }
          else if (data.capturedFrames > context.sampleRate && performance.now() - this.lastAdvance > 5000) {
            this.fail('处理线程长时间没有输出，试听已停止。请重新开启。'); return;
          }
          this.stats = data; this.setPhase(data.phase); this.emit('stats', data);
        } else if (data.type === 'error') this.fail(`实时处理失败：${data.message}`);
      };
      worker.onerror = event => { event.preventDefault(); if (token === this.token) this.fail('实时处理模块异常，请重新开启试听。'); };
      worker.onmessage = ({ data }) => { if (token === this.token && data.type === 'error') this.fail(data.message); };
      const channel = new MessageChannel();
      node.port.postMessage({ type: 'connect', port: channel.port1 }, [channel.port1]);
      worker.postMessage({ type: 'init', algorithm, sampleRate: context.sampleRate,
        semitones: parameters.semitones, epoch: 0, port: channel.port2 }, [channel.port2]);
      this.setPhase('buffering');
    } catch (error) {
      if (token !== this.token) return;
      const message = error.name === 'NotAllowedError' ? '麦克风权限未允许，请在地址栏允许后重试。'
        : error.name === 'NotFoundError' ? '没有找到麦克风。' : error.message;
      this.fail(message);
    }
  }

  /** 失败时保留错误信息，同时停止全部本次会话资源。 */
  fail(message) { this.lastError = message; this.emit('error', { message }); void this.stop(); }

  /** 使用已固定的参考基频更新变调比例；队列通过 epoch 切换丢弃旧音频。 */
  setShift(shiftHz) {
    getPitchParameters(this.referenceF0 ?? 150, shiftHz);
    if (shiftHz === this.shiftHz) return;
    this.shiftHz = shiftHz;
    if (this.node && this.referenceF0) {
      const { semitones } = getPitchParameters(this.referenceF0, shiftHz);
      this.node.port.postMessage({ type: 'pitch', semitones }); this.setPhase('reconfiguring');
    }
  }

  /** 通过 Gain 平滑更新监听音量。 */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.01);
  }

  /** 只报告队列和浏览器估计；不将它们标成端到端延迟。 */
  getDiagnostics() {
    return { phase: this.phase, algorithm: this.algorithm, referenceF0: this.referenceF0,
      shiftHz: this.shiftHz, sampleRate: this.context?.sampleRate ?? null,
      stats: this.stats, config: this.config, error: this.lastError };
  }

  /** 可重复停止；先关音轨/Worker，再短暂淡出并关闭专属上下文。 */
  async stop() {
    ++this.token;
    this.abortController?.abort(); this.abortController = null;
    const { context, stream, node, worker, source, gain, analyser } = this;
    this.context = this.stream = this.node = this.worker = this.source = this.gain = this.analyser = null;
    stream?.getTracks().forEach(track => track.stop()); worker?.terminate();
    if (node) { node.port.onmessage = null; node.onprocessorerror = null; }
    if (context?.state === 'running' && gain) gain.gain.setTargetAtTime(0, context.currentTime, 0.004);
    this.setPhase('idle');
    if (context) {
      if (gain) await new Promise(resolve => setTimeout(resolve, 20));
      node?.port.postMessage({ type: 'stop' });
      source?.disconnect(); node?.disconnect(); gain?.disconnect(); analyser?.disconnect();
      if (context.state !== 'closed') await context.close().catch(() => undefined);
    }
  }
}
