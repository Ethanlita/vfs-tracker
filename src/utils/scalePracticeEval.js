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

/**
 * @zh 检测"切入过早"——在示例 / 空拍阶段是否已经持续发声。
 *
 * 判定规则：把 [0, firstNoteIdx) 区间的所有帧按时间顺序串起来，
 * 找到最长一段连续通过 gate（能量、清晰度、基频范围、未削波）的"持续发声时长"，
 * 当且仅当这一段 > thresholdMs 时判定切入过早。
 *
 * 这样可以容忍：
 *   - 单帧 / 孤立误检（pitchy 偶发跳变）
 *   - 示例拍因耳机漏音被麦克风录到的短暂能量泄露
 *   - 用户清嗓子 / 麦克风咔哒声等瞬态
 *
 * @param {Object} params
 * @param {Array<Array<{ pitch:number, clarity:number, rms:number, t?:number, clipped?:boolean }>>} params.beatData 整轮的逐拍帧数据
 * @param {number} params.firstNoteIdx 第一个 note 拍的索引（< 此值的拍属于"切入前阶段"）
 * @param {number} params.baselineRms 噪声基线
 * @param {number} params.deltaDb 能量门限（dB）
 * @param {number} params.clarityTheta 清晰度阈值
 * @param {number} [params.thresholdMs=250] 触发判定所需的连续发声时长（毫秒）
 * @returns {{ early: boolean, durationMs: number }}
 */
export const detectEarlyVoicing = ({
  beatData,
  firstNoteIdx,
  baselineRms,
  deltaDb,
  clarityTheta,
  thresholdMs = 250
}) => {
  if (!Array.isArray(beatData) || firstNoteIdx <= 0) {
    return { early: false, durationMs: 0 };
  }
  const preNoteFrames = beatData.slice(0, firstNoteIdx).flat();
  let runStart = null;
  let maxMs = 0;
  for (const f of preNoteFrames) {
    // clipped 帧也算"发声"，只通过 UI 提示用户调小音量
    const pass =
      Number.isFinite(f.pitch) && f.pitch > 50 && f.pitch < 2000 &&
      gateByEnergy(f.rms, baselineRms, deltaDb) &&
      gateByStability(f.clarity, clarityTheta);
    if (pass) {
      if (typeof f.t === 'number') {
        if (runStart === null) runStart = f.t;
        const dur = f.t - runStart;
        if (dur > maxMs) maxMs = dur;
      }
    } else {
      runStart = null;
    }
  }
  return { early: maxMs > thresholdMs, durationMs: maxMs };
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

  // 注意：clipped 帧不再排除——削波只作为 UI 提示，不影响判定。
  const passFrames = (frames) => frames.filter(f =>
    f.pitch > 50 &&
    f.pitch < 2000 &&
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
    const requiredMs = Math.min(stableWindowMs, beatWindow * 0.6);
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

    // 当帧带 `t`（真实时间戳）时，accumulateStableWindow 会按时间戳计算 stable 时长，
    // dt 仅作为无时间戳时的兜底。注意此处必须传入 *未过滤* 的 frames，否则会把 gating 失败
    // 留下的间隙在过滤时压平，导致稳定时长被高估。
    const hasTimestamps = frames.some(f => typeof f?.t === 'number');
    const localDt = hasTimestamps
      ? 0
      : (frameDuration > 0
        ? frameDuration
        : (beatWindow > 0 && frames.length > 0 ? beatWindow / frames.length : 0));

    if (!hasTimestamps && localDt <= 0) {
      return { ...result, failedNote: { idx: i + 1, freq: expected, type: 'invalidFrame', beatIdx } };
    }

    const stableMs = accumulateStableWindow(
      frames,
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
