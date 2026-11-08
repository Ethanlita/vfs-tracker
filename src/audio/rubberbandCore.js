/** @file RubberBand WASM 的唯一加载入口及离线/实时适配，不依赖 DOM 或 AudioContext。 */
import { RubberBandInterface, RubberBandOption } from 'rubberband-wasm';
import wasmUrl from 'rubberband-wasm/dist/rubberband.wasm?url';

let activeLoad;
const BLOCK = 1024;

/** 主线程与 Worker 各自复用一个 WASM 实例；失败后允许沿同一路径重试。 */
export function loadRubberBand() {
  if (!activeLoad) {
    activeLoad = (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error(`RubberBand WASM 加载失败（${response.status}）`);
      const module = await WebAssembly.compile(await response.arrayBuffer());
      return RubberBandInterface.initialize(module);
    })().catch(error => { activeLoad = null; throw error; });
  }
  return activeLoad;
}

/** 分配固定大小的通道指针及 PCM 工作区；部分失败也会释放成功分配的内存。 */
function allocateBuffers(api, count) {
  const pointers = [];
  let array = 0;
  try {
    array = api.malloc(count * 4);
    if (!array) throw new Error('RubberBand 指针分配失败');
    for (let ch = 0; ch < count; ch++) {
      const pointer = api.malloc(BLOCK * 4);
      if (!pointer) throw new Error('RubberBand PCM 分配失败');
      pointers.push(pointer);
      api.memWritePtr(array + ch * 4, pointer);
    }
    return { array, pointers, dispose() { pointers.forEach(pointer => api.free(pointer)); api.free(array); } };
  } catch (error) {
    pointers.forEach(pointer => api.free(pointer));
    if (array) api.free(array);
    throw error;
  }
}

/** 离线两遍处理，固定 timeRatio=1；输出保持原录音长度。 */
export async function processRubberBandOffline(channels, sampleRate, ratio, onProgress) {
  const api = await loadRubberBand();
  const length = channels[0].length;
  if (length === 0 || ratio === 1) return channels.map(channel => channel.slice());
  const state = api.rubberband_new(sampleRate, channels.length, RubberBandOption.RubberBandOptionProcessOffline, 1, ratio);
  if (!state) throw new Error('无法创建 RubberBand 离线引擎');
  let buffers;
  try {
    api.rubberband_set_max_process_size(state, BLOCK);
    api.rubberband_set_expected_input_duration(state, length);
    buffers = allocateBuffers(api, channels.length);
    const output = channels.map(() => new Float32Array(length));
    let written = 0;
    const retrieve = () => {
      let available;
      while ((available = api.rubberband_available(state)) > 0) {
        const received = api.rubberband_retrieve(state, buffers.array, Math.min(BLOCK, available));
        if (received <= 0) throw new Error('RubberBand 无法读取已生成的音频');
        const count = Math.min(received, Math.max(0, length - written));
        for (let ch = 0; ch < channels.length; ch++) {
          if (count) output[ch].set(api.memReadF32(buffers.pointers[ch], received).subarray(0, count), written);
        }
        written += received;
      }
    };
    for (const pass of ['study', 'process']) {
      for (let start = 0; start < length; start += BLOCK) {
        const end = Math.min(start + BLOCK, length);
        channels.forEach((channel, ch) => api.memWrite(buffers.pointers[ch], channel.subarray(start, end)));
        const final = end === length ? 1 : 0;
        if (pass === 'study') api.rubberband_study(state, buffers.array, end - start, final);
        else { api.rubberband_process(state, buffers.array, end - start, final); retrieve(); }
        onProgress?.((pass === 'study' ? 0 : 0.35) + end / length * (pass === 'study' ? 0.35 : 0.65));
      }
    }
    if (written < length) throw new Error('RubberBand 输出不完整，请重新处理');
    return output;
  } finally {
    buffers?.dispose();
    api.rubberband_delete(state);
  }
}

/** 单声道流式适配器；process/retrieve 的帧数可变，不按输入块强制裁剪或补齐。 */
export class RubberBandStream {
  constructor(api, sampleRate, semitones) {
    this.api = api;
    this.sampleRate = sampleRate;
    this.state = 0;
    this.buffers = null;
    this.setPitch(semitones);
  }

  /** 清空旧段落并按当前比例重新初始化起始补零和输出延迟补偿。 */
  setPitch(semitones) {
    if (!Number.isFinite(semitones) || semitones < -19 || semitones > 20) throw new RangeError('无效的半音参数');
    this.dispose();
    this.semitones = semitones;
    this.ratio = 2 ** (semitones / 12);
    this.inputFrames = 0;
    this.outputFrames = 0;
    const api = this.api;
    // R3 短窗提供人声质量；动态比例采用 HighConsistency。
    const options = RubberBandOption.RubberBandOptionProcessRealTime |
      RubberBandOption.RubberBandOptionEngineFiner |
      RubberBandOption.RubberBandOptionWindowShort |
      RubberBandOption.RubberBandOptionPitchHighConsistency;
    try {
      this.state = api.rubberband_new(this.sampleRate, 1, options, 1, this.ratio);
      if (!this.state) throw new Error('无法创建 RubberBand 实时引擎');
      api.rubberband_set_max_process_size(this.state, BLOCK);
      this.buffers = allocateBuffers(api, 1);
      this.startPad = api.rubberband_get_preferred_start_pad(this.state);
      this.startDelay = api.rubberband_get_start_delay(this.state);
      this.dropFrames = this.startDelay;
      // 实时模式不调用 study，也不在每块末尾传 final。
      for (let remaining = this.startPad; remaining > 0; remaining -= BLOCK) {
        this._process(new Float32Array(Math.min(BLOCK, remaining)));
      }
    } catch (error) { this.dispose(); throw error; }
    return this.getStats();
  }

  /** 写入一块并取出所有现有输出；先丢弃库声明的起始延迟。 */
  _process(input) {
    const api = this.api;
    api.memWrite(this.buffers.pointers[0], input);
    api.rubberband_process(this.state, this.buffers.array, input.length, 0);
    const parts = [];
    let available;
    while ((available = api.rubberband_available(this.state)) > 0) {
      const received = api.rubberband_retrieve(this.state, this.buffers.array, Math.min(BLOCK, available));
      if (received <= 0) throw new Error('RubberBand 实时输出读取失败');
      const drop = Math.min(this.dropFrames, received);
      this.dropFrames -= drop;
      if (received > drop) parts.push(api.memReadF32(this.buffers.pointers[0], received).slice(drop));
    }
    return parts;
  }

  /** 输入任意长度 PCM，保留跨块内部状态，返回目前真正生成的帧。 */
  push(input) {
    const parts = [];
    for (let start = 0; start < input.length; start += BLOCK) parts.push(...this._process(input.subarray(start, start + BLOCK)));
    const output = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
    let cursor = 0;
    for (const part of parts) { output.set(part, cursor); cursor += part.length; }
    this.inputFrames += input.length;
    this.outputFrames += output.length;
    return output;
  }

  /** 返回引擎信息；startDelay 是对齐补偿，不代表声学端到端延迟。 */
  getStats() {
    return { algorithm: 'rubberband', sampleRate: this.sampleRate, semitones: this.semitones,
      pitchRatio: this.ratio, inputFrames: this.inputFrames, outputFrames: this.outputFrames,
      startPadFrames: this.startPad, startDelayFrames: this.startDelay,
      samplesRequired: this.api.rubberband_get_samples_required(this.state) };
  }

  /** 释放实例和显式分配的 WASM 内存；可重复调用。 */
  dispose() {
    this.buffers?.dispose();
    this.buffers = null;
    if (this.state) this.api.rubberband_delete(this.state);
    this.state = 0;
  }
}

/** 异步加载 WASM 后创建实时适配器。 */
export async function createRubberBandStream(sampleRate, semitones) {
  return new RubberBandStream(await loadRubberBand(), sampleRate, semitones);
}
