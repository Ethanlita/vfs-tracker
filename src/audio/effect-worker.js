/** @file 实时引擎运行于 Worker；音频渲染线程只承担有界队列和采样交接。 */
import { StreamingPitchShifter } from './soundtouch/streaming-dsp.mjs';

let link = null;
let engine = null;
let epoch = 0;

/** 根据明确的算法标识创建单声道流式引擎。 */
async function createEngine(algorithm, sampleRate, semitones) {
  if (algorithm === 'soundtouch') return new StreamingPitchShifter(sampleRate, semitones, { channels: 1 });
  if (algorithm === 'rubberband') {
    const { createRubberBandStream } = await import('./rubberbandCore.js');
    return createRubberBandStream(sampleRate, semitones);
  }
  throw new Error(`算法不支持实时试听：${algorithm}`);
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'init' || link) return;
  link = data.port;
  epoch = data.epoch;
  try {
    engine = await createEngine(data.algorithm, data.sampleRate, data.semitones);
    link.onmessage = ({ data: message }) => {
      if (message.type === 'pitch') {
        try {
          epoch = message.epoch;
          engine.setPitch(message.semitones);
          link.postMessage({ type: 'ready', epoch, semitones: message.semitones, stats: engine.getStats() });
        } catch (error) { link.postMessage({ type: 'error', epoch, message: error.message }); }
      } else if (message.type === 'input') {
        if (message.epoch !== epoch) return;
        const started = performance.now();
        const frames = message.samples.length;
        try {
          const output = engine.push(message.samples);
          if (output.length) link.postMessage({ type: 'output', epoch, samples: output }, [output.buffer]);
        } catch (error) { link.postMessage({ type: 'error', epoch, message: error.message }); }
        finally { link.postMessage({ type: 'ack', epoch, frames, processingMs: performance.now() - started }); }
      } else if (message.type === 'stop') {
        engine.dispose?.();
        engine = null;
        link.close();
        link = null;
      }
    };
    link.start();
    link.postMessage({ type: 'ready', epoch, semitones: data.semitones, stats: engine.getStats() });
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
