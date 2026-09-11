/**
 * @file TD-PSOLA 合成能量匹配
 * @description 在相同的“每采样点均方能量”尺度上比较分析帧与合成输出。
 */

/**
 * 对 TD-PSOLA 输出执行一次有余量的向上能量匹配。
 *
 * 输入与输出都按完整音频的采样点数求均方能量。只除以帧数会额外引入帧长度因子；
 * 只统计窗函数覆盖区又会忽略合成间隙。两者都会让整段响度匹配失真。
 *
 * @param {Float32Array} output 待调整的合成采样，函数会原地修改。
 * @param {Float32Array} referenceSamples 完整的原始输入采样。
 * @returns {{inputMeanSquare: number, outputMeanSquare: number, inputSamples: number, outputSamples: number, outputPeak: number, scale: number}} 能量测量与实际缩放值。
 */
export function matchTdPsolaEnergy(output, referenceSamples) {
  let inputSquareSum = 0;
  for (const sample of referenceSamples) inputSquareSum += sample * sample;
  const inputMeanSquare = inputSquareSum / Math.max(1, referenceSamples.length);

  let outputSquareSum = 0;
  let outputPeak = 0;
  for (const sample of output) {
    outputSquareSum += sample * sample;
    outputPeak = Math.max(outputPeak, Math.abs(sample));
  }
  const outputMeanSquare = outputSquareSum / Math.max(1, output.length);

  let scale = 1;
  const energyRatio = outputMeanSquare > 0 ? inputMeanSquare / outputMeanSquare : 0;
  if (energyRatio > 1.2) {
    // 整体能量目标保留 10%，同时把峰值限制在 0.95 full scale，避免瞬态进入后续限幅器。
    const energyScale = Math.sqrt(energyRatio) * 0.9;
    const peakSafeScale = outputPeak > 0 ? 0.95 / outputPeak : 1;
    scale = Math.min(energyScale, peakSafeScale);
    for (let index = 0; index < output.length; index += 1) output[index] *= scale;
  }

  return {
    inputMeanSquare,
    outputMeanSquare,
    inputSamples: referenceSamples.length,
    outputSamples: output.length,
    outputPeak,
    scale,
  };
}
