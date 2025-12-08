/**
 * @zh 计算音阶练习中每个音符的稳定时长与音准是否达标。
 * 逐拍过滤能量与清晰度不足的帧，再判断音高偏差与稳定时长。
 *
 * @param {Object} params 配置参数
 * @param {Array<Array<{ pitch: number, clarity: number, rms: number }>>} params.beatData 分拍采集的帧数据
 * @param {Array<{ beatIdx: number, offset: number }>} params.noteSteps 标记每个练习音所在的拍序与半音偏移
 * @param {number} params.baseFreq 当前轮基准频率（Hz）
 * @param {number} params.semitoneRatio 半音比值（2^(1/12)）
 * @param {number} params.tolerance 容差（cents）
 * @param {number} params.baselineRms 噪声基准 RMS
 * @param {number} params.deltaDb 能量门限相对增益（dB）
 * @param {number} params.clarityTheta 清晰度门限
 * @param {number} params.frameDuration 帧对应的时间长度（毫秒）
 * @param {number} params.stableWindowMs 要求的最短稳定时长（毫秒）
 * @param {number[]} [params.beatDurations] 每拍时值（毫秒），用于自适应判定窗口
 * @returns {{ passed: boolean, stableDurations: number[], requiredDurations: number[], failedNote?: { idx: number, freq: number, type: 'miss'|'high'|'low'|'unstable'|'invalidFrame', cents?: number, stableMs?: number, requiredMs?: number, beatIdx: number } }}
 */
import { accumulateStableWindow, gateByEnergy, gateByStability } from './pitchEval.js';

/**
 * @zh 计算数组的中位数（空数组返回 0）。
 * @param {number[]} arr 数值数组
 * @returns {number} 中位数
 */
export const calcMedian = (arr = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const evaluateNoteStability = (params) => {
  const {
    beatData,
    noteSteps,
    baseFreq,
    semitoneRatio,
    tolerance,
    baselineRms,
    deltaDb,
    clarityTheta,
    frameDuration,
    stableWindowMs,
    beatDurations = []
  } = params;

  const result = { passed: false, stableDurations: [], requiredDurations: [] };

  if (!Array.isArray(noteSteps) || noteSteps.length === 0) {
    return { ...result, failedNote: { idx: 0, freq: 0, type: 'miss', beatIdx: 0 } };
  }

  const passFrames = (frames) => frames.filter(f =>
    f.pitch > 50 &&
    f.pitch < 1200 &&
    gateByEnergy(f.rms, baselineRms, deltaDb) &&
    gateByStability(f.clarity, clarityTheta)
  );

  for (let i = 0; i < noteSteps.length; i++) {
    const step = noteSteps[i];
    const beatIdx = step.beatIdx ?? step.index ?? 0;
    const frames = Array.isArray(beatData?.[beatIdx]) ? beatData[beatIdx] : [];
    const filtered = passFrames(frames);
    const expected = baseFreq * Math.pow(semitoneRatio, step.offset ?? 0);
    const beatWindow = beatDurations[beatIdx] ?? stableWindowMs;
    const requiredMs = Math.min(stableWindowMs, beatWindow);
    result.requiredDurations.push(requiredMs);

    if (!filtered.length) {
      return { ...result, failedNote: { idx: i + 1, freq: expected, type: 'miss', beatIdx } };
    }

    const cents = 1200 * Math.log2(calcMedian(filtered.map(f => f.pitch)) / expected);
    if (cents < -tolerance) {
      return { ...result, failedNote: { idx: i + 1, freq: expected, type: 'low', cents, beatIdx } };
    }
    if (cents > tolerance) {
      return { ...result, failedNote: { idx: i + 1, freq: expected, type: 'high', cents, beatIdx } };
    }

    const localDt = frameDuration > 0
      ? frameDuration
      : (beatWindow > 0 && filtered.length > 0 ? beatWindow / filtered.length : 0);

    if (localDt <= 0) {
      return { ...result, failedNote: { idx: i + 1, freq: expected, type: 'invalidFrame', beatIdx } };
    }

    const stableMs = accumulateStableWindow(
      filtered,
      expected,
      tolerance,
      baselineRms,
      deltaDb,
      clarityTheta,
      localDt
    );

    result.stableDurations.push(stableMs);

    if (stableMs < requiredMs) {
      return {
        ...result,
        failedNote: {
          idx: i + 1,
          freq: expected,
          type: 'unstable',
          stableMs,
          requiredMs,
          beatIdx
        }
      };
    }
  }

  return { ...result, passed: true };
};
