/** @file 将耗时 DSP 放入一次性 Worker；完成、取消和失败均释放 Worker。 */

/** 处理 SoundTouch 或 RubberBand 录音，返回 Float32 声道数组。 */
export function processRecordedEffect(audioBuffer, algorithm, parameters, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('已取消处理', 'AbortError')); return; }
    const worker = new Worker(new URL('./offline-effect-worker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(new DOMException('已取消处理', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = event => { event.preventDefault(); finish(new Error('音频处理线程异常')); };
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') onProgress?.(data.progress);
      else if (data.type === 'error') finish(new Error(data.message));
      else if (data.type === 'result') finish(null, data.channels);
    };
    try {
      // 只转移副本，原始 AudioBuffer 保持可用于其他算法对比。
      const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, ch) => audioBuffer.getChannelData(ch).slice());
      worker.postMessage({ algorithm, channels, sampleRate: audioBuffer.sampleRate, ...parameters }, channels.map(channel => channel.buffer));
    } catch (error) { finish(error); }
  });
}
