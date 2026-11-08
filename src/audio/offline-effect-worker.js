/** @file 整段录音的 SoundTouch/RubberBand 处理；与实时采集不共享引擎状态。 */
import { pitchShift } from './soundtouch/dsp.mjs';

self.onmessage = async ({ data }) => {
  try {
    const { algorithm, channels, sampleRate, semitones, ratio } = data;
    const onProgress = progress => self.postMessage({ type: 'progress', progress });
    let output;
    if (algorithm === 'soundtouch') {
      output = pitchShift(channels, sampleRate, semitones, { onProgress: ({ progress }) => onProgress(progress) }).channels;
    } else if (algorithm === 'rubberband') {
      const { processRubberBandOffline } = await import('./rubberbandCore.js');
      output = await processRubberBandOffline(channels, sampleRate, ratio, onProgress);
    } else throw new Error(`未知的录音处理算法：${algorithm}`);
    self.postMessage({ type: 'result', channels: output }, output.map(channel => channel.buffer));
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
