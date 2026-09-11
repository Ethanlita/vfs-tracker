import React, { useState, useRef, useEffect } from 'react';
import { createTemporaryAudioContext } from '../utils/audioContextManager';
import { ClientError } from '../utils/apiError';
import { ApiErrorNotice } from './ApiErrorNotice';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';

/**
 * @en A reusable audio recorder component that uses the MediaRecorder API.
 * It provides UI for starting, stopping, pausing, and resuming recording.
 * @zh 一个使用 MediaRecorder API 的可重用录音组件。
 * 它提供了开始、停止、暂停和恢复录音的用户界面。
 * @param {object} props - The component props.
 * @param {function(Blob): void} props.onRecordingComplete - Callback function that is executed when recording stops, returning the recorded audio as a Blob.
 * @param {function(): void} [props.onStartRecording] - Optional callback for when recording starts.
 * @param {function(): void} [props.onStopRecording] - Optional callback for when recording stops.
 * @param {function(): void} [props.onDiscardRecording] - Optional callback when user chooses to stop and discard the current take (不会上传/回调 Blob)。
 * @param {boolean} [props.isRecording] - Prop to externally control the recording state (e.g., disable the button).
 * @param {number} [props.maxDurationSec] - Optional maximum duration for recording in seconds. Default is 60 seconds.
 * @returns {JSX.Element} The rendered recorder component.
 */
const Recorder = ({ onRecordingComplete, onStartRecording, onStopRecording, onDiscardRecording, isRecording: propIsRecording, maxDurationSec = 60 }) => {
  const [isRecording, setIsRecording] = useState(false); // 内部真实录音状态，仅由 start/stop 控制
  const [isPaused, setIsPaused] = useState(false);
  const [levelDb, setLevelDb] = useState(null);
  const [peakDb, setPeakDb] = useState(null); // 新增：峰值
  const [isClipping, setIsClipping] = useState(false); // 新增：过载指示
  const [elapsedSec, setElapsedSec] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [conversionError, setConversionError] = useState(null);
  // 授权、采集、停止等待、转码和失败待重试都持有不可恢复的内存音频。
  usePwaUpdateBlocker(phase !== 'idle' || isRecording, '录音任务');
  const pendingRecordingRef = useRef(null);
  const phaseRef = useRef('idle');
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const closeDecodeContextRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const recordedMsRef = useRef(0);
  const intervalRef = useRef(null);
  const stopModeRef = useRef('continue'); // 'continue' | 'discard' 用于 onstop 行为分流

  const pickSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      '' // 让浏览器自己决定
    ];
    for (const mime of candidates) {
      try {
        if (!mime) return undefined; // 使用默认
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      } catch {
        // 某些旧浏览器会拒绝 MIME 能力查询，继续检查下一个候选格式。
      }
    }
    return undefined;
  };

  /** 转换为单声道48kHz WAV；解码后立即关闭临时上下文，卸载也可提前释放。 */
  const encodeWav = async (blob) => {
    // 将任意音频 Blob 转换为 16-bit PCM 单声道 48kHz WAV
    let closeDecodeContext;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (!mountedRef.current) return null;
      const temporary = createTemporaryAudioContext();
      let closing;
      // 卸载和finally共享关闭操作，不能重复调用原生close。
      closeDecodeContext = () => closing ??= temporary.close().catch(() => undefined);
      closeDecodeContextRef.current = closeDecodeContext;
      let decoded;
      try {
        decoded = await temporary.context.decodeAudioData(arrayBuffer);
      } finally {
        await closeDecodeContext();
      }
      if (!mountedRef.current) return null;
      const sampleRate = 48000; // 统一重采样到 48kHz
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
      const src = offline.createBufferSource();
      // 混合到单声道
      const monoBuffer = offline.createBuffer(1, decoded.length, decoded.sampleRate);
      const tmp = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const channelData = decoded.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          tmp[i] += channelData[i] / decoded.numberOfChannels;
        }
      }
      monoBuffer.copyToChannel(tmp, 0);
      src.buffer = monoBuffer;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();
      const pcm = rendered.getChannelData(0);
      // 写 WAV 头
      const bytesPerSample = 2;
      const blockAlign = bytesPerSample;
      const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
      const view = new DataView(buffer);
      const writeString = (off, str) => { for (let i=0;i<str.length;i++) view.setUint8(off+i, str.charCodeAt(i)); };
      let offset = 0;
      writeString(offset, 'RIFF'); offset += 4;
      view.setUint32(offset, 36 + pcm.length * bytesPerSample, true); offset += 4;
      writeString(offset, 'WAVE'); offset += 4;
      writeString(offset, 'fmt '); offset += 4;
      view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
      view.setUint16(offset, 1, true); offset += 2;   // format PCM
      view.setUint16(offset, 1, true); offset += 2;   // channels
      view.setUint32(offset, sampleRate, true); offset += 4; // sample rate
      view.setUint32(offset, sampleRate * blockAlign, true); offset += 4; // byte rate
      view.setUint16(offset, blockAlign, true); offset += 2; // block align
      view.setUint16(offset, bytesPerSample * 8, true); offset += 2; // bits per sample
      writeString(offset, 'data'); offset += 4;
      view.setUint32(offset, pcm.length * bytesPerSample, true); /* 最后一次写入后不再递增 offset 以避免 ESLint 警告 */
      // PCM samples
      let idx = 0;
      for (let i = 0; i < pcm.length; i++, idx += 2) {
        let s = Math.max(-1, Math.min(1, pcm[i]));
        view.setInt16(44 + idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      return new Blob([buffer], { type: 'audio/wav' });
    } finally {
      if (closeDecodeContext) await closeDecodeContext();
      if (closeDecodeContextRef.current === closeDecodeContext) closeDecodeContextRef.current = null;
    }
  };

  /** 处理同一份原始录音；仅转换成功才通知上层，失败保留原数据供显式重试。 */
  const processRecording = async (rawBlob, generation) => {
    phaseRef.current = 'processing';
    setPhase('processing');
    setConversionError(null);
    pendingRecordingRef.current = { rawBlob, generation };
    let finalBlob;
    try {
      // 所有输入都经过相同转换，不能仅凭MIME声明跳过格式规范化。
      finalBlob = await encodeWav(rawBlob);
    } catch (cause) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      phaseRef.current = 'failed';
      setPhase('failed');
      setConversionError(new ClientError('录音转换失败，原录音已保留。请重试转换，或放弃此段后重新录制。', {
        cause, errorCode: 'AUDIO_CONVERSION_FAILED'
      }));
      return;
    }
    if (!mountedRef.current || generation !== generationRef.current || !finalBlob) return;
    pendingRecordingRef.current = null;
    phaseRef.current = 'idle';
    setPhase('idle');
    onRecordingComplete(finalBlob);
  };

  /** 重试只使用失败的同一段音频，同步状态锁阻止重复转换。 */
  const retryConversion = () => {
    if (phaseRef.current !== 'failed' || !pendingRecordingRef.current) return;
    const { rawBlob, generation } = pendingRecordingRef.current;
    return processRecording(rawBlob, generation);
  };

  /** 用户明确放弃后释放原录音，恢复开始按钮，不调用上传回调。 */
  const discardFailedRecording = () => {
    if (phaseRef.current !== 'failed') return;
    pendingRecordingRef.current = null;
    setConversionError(null);
    phaseRef.current = 'idle';
    setPhase('idle');
    onDiscardRecording?.();
  };

  /** 启动一轮独立录音；授权和转码期间禁止重复启动。 */
  const startRecording = async () => {
    if (phaseRef.current !== 'idle' || propIsRecording) return;
    const generation = ++generationRef.current;
    phaseRef.current = 'requesting';
    setPhase('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || generation !== generationRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      // 建立实时电平分析
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      levelLoop();

      const mime = pickSupportedMimeType();
      const options = mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : { audioBitsPerSecond: 192000 };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      const recorder = mediaRecorderRef.current;


      const chunks = [];
      stopModeRef.current = 'continue'; // 每次开始录音时重置停止模式
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        phaseRef.current = 'processing';
        setPhase('processing');
        // 先释放采集资源，再转码；回调仅属于本轮，不访问后续录音引用。
        const discarded = stopModeRef.current === 'discard';
        cleanupAudio();
        if (discarded) {
            // 放弃本段：不做转码也不回调 blob，仅清理资源与通知可选回调
            phaseRef.current = 'idle';
            setPhase('idle');
            onDiscardRecording && onDiscardRecording();
        } else {
            const rawBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            await processRecording(rawBlob, generation);
        }
      };

      mediaRecorderRef.current.start();
      phaseRef.current = 'recording';
      setPhase('recording');
      recordedMsRef.current = 0;
      startTimeRef.current = performance.now();
      setElapsedSec(0);
      intervalRef.current = setInterval(() => {
        // 只累计实际录制片段；暂停时不更新进度或触发自动停止。
        if (startTimeRef.current === null || recorder.state !== 'recording') return;
        const elapsed = (recordedMsRef.current + performance.now() - startTimeRef.current) / 1000;
        setElapsedSec(Math.min(maxDurationSec, elapsed));
        if (elapsed >= maxDurationSec) {

          // 达到上限默认视为“继续”（保留本段）
          stopModeRef.current = 'continue';
          stopRecording();
        }
      }, 200);

      setIsRecording(true);
      setIsPaused(false);
      onStartRecording && onStartRecording();

    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;

      alert('无法启动录音：浏览器不支持或未授权麦克风。请检查权限或更换现代浏览器。');
      cleanupAudio();
      phaseRef.current = 'idle';
      setPhase('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      phaseRef.current = 'processing';
      setPhase('processing');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      onStopRecording && onStopRecording();

      stopLevelLoop();
    }
  };

  /** 取消尚未完成的授权，迟到音轨由原请求负责关闭。 */
  const cancelPermission = () => {
    generationRef.current += 1;
    phaseRef.current = 'idle';
    setPhase('idle');
  };

  // 停止并保留当前段（继续流程）
  const stopAndContinue = () => {
    stopModeRef.current = 'continue';
    stopRecording();
  };

  // 停止并放弃当前段（回到开始本段前状态）
  const stopAndDiscard = () => {
    if (!confirm('确定放弃当前这段录音吗？本段将不会被保存或上传。')) return;
    stopModeRef.current = 'discard';
    stopRecording();
  };

  /** 暂停时结算当前录制片段，等待时间不计入录音上限。 */
  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      recordedMsRef.current += performance.now() - startTimeRef.current;
      startTimeRef.current = null;
      setElapsedSec(Math.min(maxDurationSec, recordedMsRef.current / 1000));
      setIsPaused(true);

      stopLevelLoop();
    }
  };

  /** 恢复后开启新的计时片段，保留此前已录制的累计时长。 */
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimeRef.current = performance.now();
      setIsPaused(false);
      levelLoop();

    }
  };

  const levelLoop = () => {
    // 如果 analyser 或 stream 已被清理，停止循环
    if (!analyserRef.current || !streamRef.current) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const analyser = analyserRef.current;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    if (!buffer.length) {
      rafRef.current = requestAnimationFrame(levelLoop);
      return;
    }
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128; // -1..1
      sum += v * v;
      const av = Math.abs(v);
      if (av > peak) peak = av;
    }
    const rms = Math.sqrt(sum / buffer.length) + 1e-9;
    const db = 20 * Math.log10(rms);
    const peakDbVal = 20 * Math.log10(peak + 1e-9); // 避免 -Infinity
    setLevelDb(db.toFixed(1));
    setPeakDb(peakDbVal.toFixed(1));
    const clipping = peak >= 0.985; // 阈值
    setIsClipping(clipping);
    rafRef.current = requestAnimationFrame(levelLoop);
  };

  const stopLevelLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const cleanupAudio = () => {
    stopLevelLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setLevelDb(null);
    setPeakDb(null);
    setIsClipping(false);
    setElapsedSec(0);
    recordedMsRef.current = 0;
    startTimeRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 组件卸载时清理所有资源
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRecordingRef.current = null;
      generationRef.current += 1;
      // 即使解码Promise尚未完成，离开页面也立即释放其临时上下文。
      closeDecodeContextRef.current?.();
      // 使原生录音停止，同时切断卸载后的事件回调。
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      // 清理动画帧
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // 清理定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // 清理媒体流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      // 清理音频上下文
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
  }, []);

  const remaining = Math.max(0, maxDurationSec - elapsedSec);
  const progressPct = Math.min(100, (elapsedSec / maxDurationSec) * 100);

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* 进度与倒计时 */}
      {isRecording || isPaused ? (
        <div className="w-full max-w-sm">
          <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>已录制 {elapsedSec.toFixed(1)}s</span>
            <span>剩余 {remaining.toFixed(1)}s</span>
          </div>
        </div>
      ) : null}

      {/* 实时电平 */}
      {(isRecording && levelDb !== null) && (
        <div className="w-full max-w-sm space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>平均电平</span>
              <span>{levelDb} dBFS</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (parseFloat(levelDb) + 60) / 60 * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>峰值</span>
              <span>{peakDb ?? '--'} dBFS</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${isClipping ? 'bg-red-600' : 'bg-orange-400'} transition-all`} style={{ width: peakDb ? `${Math.min(100, (parseFloat(peakDb) + 60) / 60 * 100)}%` : '0%' }} />
            </div>
            {isClipping && <p className="mt-1 text-xs text-red-600">⚠️ 过载：请降低音量或远离麦克风</p>}
          </div>
        </div>
      )}

      {!isRecording && !isPaused && (
        <button
          onClick={startRecording}
          disabled={propIsRecording || phase !== 'idle'} // 外部录音、授权和转码期间均禁止重复启动
          className="px-6 py-3 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {phase === 'requesting' ? '等待麦克风授权...' : phase === 'processing' ? '正在处理录音...' : '开始录音'}
        </button>
      )}

      {phase === 'requesting' && (
        <button onClick={cancelPermission} className="px-4 py-2 text-gray-700 underline">取消授权等待</button>
      )}

      {conversionError && (
        <div className="w-full space-y-3">
          <ApiErrorNotice error={conversionError} onRetry={retryConversion} retryLabel="重试转换" />
          <button onClick={discardFailedRecording} className="px-4 py-2 text-red-700 border border-red-300 rounded-lg">放弃此段录音</button>
        </div>
      )}

      {isRecording && !isPaused && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={stopAndContinue}
            className="px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200"
          >
            停止录音且继续
          </button>
          <button
            onClick={pauseRecording}
            className="px-6 py-3 bg-yellow-500 text-white rounded-full shadow-lg hover:bg-yellow-600 transition-colors duration-200"
          >
            暂停
          </button>
          <button
            onClick={stopAndDiscard}
            className="px-6 py-3 bg-white text-red-600 border border-red-300 rounded-full shadow hover:bg-red-50 transition-colors duration-200"
          >
            停止录音且放弃
          </button>
        </div>
      )}

      {isPaused && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={resumeRecording}
            className="px-6 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors duration-200"
          >
            继续录音
          </button>
          <button
            onClick={stopAndContinue}
            className="px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200"
          >
            停止录音且继续
          </button>
          <button
            onClick={stopAndDiscard}
            className="px-6 py-3 bg-white text-red-600 border border-red-300 rounded-full shadow hover:bg-red-50 transition-colors duration-200"
          >
            停止录音且放弃
          </button>
        </div>
      )}

      {isRecording && !isPaused && <p className="text-gray-600">正在录音...</p>}
      {isPaused && <p className="text-gray-600">录音已暂停。</p>}
    </div>
  );
};

export default Recorder;
