/** @file 效果预览的统一音高参数；Hz 表示相对于固定参考基频的增量。 */

/** 将参考基频和 Hz 增量转换为所有引擎共用的比例及小数半音。 */
export function getPitchParameters(referenceF0, shiftHz) {
  if (!Number.isFinite(referenceF0) || referenceF0 < 80 || referenceF0 > 500) {
    throw new RangeError('参考基频必须在 80–500 Hz 之间');
  }
  if (!Number.isFinite(shiftHz) || shiftHz < 0 || shiftHz > 100) {
    throw new RangeError('变调量必须在 0–100 Hz 之间');
  }
  const ratio = (referenceF0 + shiftHz) / referenceF0;
  return { referenceF0, shiftHz, ratio, semitones: 12 * Math.log2(ratio) };
}

/** 从一帧人声估计参考 F0；无可靠周期或电平太低时返回 null。 */
export function estimateReferencePitch(samples, sampleRate) {
  if (samples.length < 2048) return null;
  let mean = 0;
  for (const value of samples) mean += value;
  mean /= samples.length;
  const centered = Float32Array.from(samples, value => value - mean);
  let energy = 0;
  for (const value of centered) energy += value * value;
  if (energy / samples.length < 0.00001) return null;
  const first = Math.floor(sampleRate / 500);
  const last = Math.ceil(sampleRate / 80);
  const correlations = new Float32Array(last + 2);
  for (let lag = first - 1; lag <= last + 1; lag++) {
    let cross = 0, left = 0, right = 0;
    for (let i = 0; i < centered.length - lag; i++) {
      const a = centered[i], b = centered[i + lag];
      cross += a * b; left += a * a; right += b * b;
    }
    correlations[lag] = cross / Math.sqrt(left * right || 1);
  }
  // 取最早的强局部峰，减少倍周期导致的八度错误。
  for (let lag = first; lag <= last; lag++) {
    const peak = correlations[lag];
    if (peak < 0.8 || peak <= correlations[lag - 1] || peak < correlations[lag + 1]) continue;
    const denominator = correlations[lag - 1] - 2 * peak + correlations[lag + 1];
    const offset = denominator ? 0.5 * (correlations[lag - 1] - correlations[lag + 1]) / denominator : 0;
    const hz = sampleRate / (lag + offset);
    if (hz >= 80 && hz <= 500) return hz;
  }
  return null;
}
