/** @file RubberBand 录音处理入口；统一使用上层提供的参考基频和 Worker。 */
import { processRecordedEffect } from '../audio/processRecordedEffect.js';
import { getPitchParameters } from '../audio/pitchParameters.js';

/** 将录音送入离线 Worker；referenceF0 必须显式提供，避免隐含固定 150 Hz。 */
export async function processWithRubberBand(audioBuffer, pitchShiftHz, onProgress, referenceF0) {
  const parameters = getPitchParameters(referenceF0, pitchShiftHz);
  const channels = await processRecordedEffect(audioBuffer, 'rubberband', parameters, { onProgress });
  return createBuffer(channels, audioBuffer.sampleRate);
}

/** 不创建或持有额外 AudioContext。 */
function createBuffer(channels, sampleRate) {
  const buffer = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0].length, sampleRate });
  channels.forEach((channel, ch) => buffer.copyToChannel(channel, ch));
  return buffer;
}
