/**
 * @file TD-PSOLA 基频标记辅助逻辑
 * @description 约束局部周期选择并保证标记检测持续向前推进。
 */

/**
 * 为自相关候选周期评分。
 *
 * 纯周期信号会在整数倍周期处产生近似相同的相关峰。加入相对预估周期的轻微惩罚，
 * 可以优先选择基频周期，避免误选二倍周期而把标记密度减半。
 *
 * @param {number} confidence 归一化自相关置信度。
 * @param {number} period 候选周期（采样点）。
 * @param {number} estimatedPeriod 外部基频对应的预估周期（采样点）。
 * @returns {number} 用于候选排序的分数。
 */
export function scorePitchPeriodCandidate(confidence, period, estimatedPeriod) {
  if (!Number.isFinite(confidence) || !Number.isFinite(period) || !Number.isFinite(estimatedPeriod)
    || period <= 0 || estimatedPeriod <= 0) return -Infinity;

  const relativeDistance = Math.abs(period - estimatedPeriod) / estimatedPeriod;
  return confidence - relativeDistance * 0.08;
}

/**
 * 选择当前浊音帧的标记位置。
 *
 * 精确定位偶尔会返回上一周期或过远的峰。此时采用预期位置继续推进，避免检测器
 * 因为反复拒绝同一候选而在数秒音频中只留下少量分析帧。
 *
 * @param {object} options 标记约束参数。
 * @param {number} options.candidate 精确定位得到的候选位置。
 * @param {number|null} options.previous 上一个标记位置；首个标记传 null。
 * @param {number} options.expected 当前预期标记位置。
 * @param {number} options.period 当前局部周期（采样点）。
 * @param {number} options.bufferLength 音频总采样点数。
 * @returns {number|null} 有效标记位置；超出音频末端时返回 null。
 */
export function resolvePitchMarkPosition({ candidate, previous, expected, period, bufferLength }) {
  if (!Number.isFinite(candidate) || !Number.isFinite(expected) || !Number.isFinite(period)
    || !Number.isFinite(bufferLength) || period <= 0 || bufferLength <= 0) return null;

  let resolved = candidate;
  if (previous !== null) {
    const minimum = previous + period * 0.4;
    const maximum = previous + period * 2;
    if (candidate <= minimum || candidate >= maximum) {
      resolved = Math.max(expected, minimum);
    }
  }

  const rounded = Math.max(0, Math.round(resolved));
  return rounded < bufferLength ? rounded : null;
}
