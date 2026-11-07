/**
 * 单元测试：src/utils/scalePracticeEval.js
 *
 * 覆盖整句判定（延迟估计、换音点对齐、稳定 / 走势两种判定方式）与切入过早检测。
 * 帧数据由合成「歌唱」生成：按固定 16 ms 采样间隔，在给定时间区间内输出指定半音的基频。
 */
import { describe, it, expect } from 'vitest';
import {
  detectEarlyVoicing,
  estimateGlobalLag,
  evaluatePhrase,
  resolveJudgeRegime
} from '../../../src/utils/scalePracticeEval.js';

const SEMITONE = Math.pow(2, 1 / 12);
const BASE_FREQ = 261.63;
const FRAME_MS = 16;

const baseParams = {
  baseFreq: BASE_FREQ,
  semitoneRatio: SEMITONE,
  tolerance: 75,
  baselineRms: 0.01,
  deltaDb: 0,
  clarityTheta: 0.45,
  stableWindowMs: 200
};

/**
 * 构造名义练习音区间：从 startT 起每 noteMs 一个音，首尾相接。
 * @param {number[]} offsets 半音偏移序列
 * @param {number} noteMs 每音时长
 * @param {number} [startT=1000] 第一个音的名义开始时间
 */
const makeNoteSteps = (offsets, noteMs, startT = 1000) =>
  offsets.map((offset, i) => ({ offset, startT: startT + i * noteMs, endT: startT + (i + 1) * noteMs }));

/**
 * 合成一段歌唱：segments 为 [{ from, to, offset }]（offset 为 null 表示无声），
 * 在 [0, endT) 内每 16 ms 输出一帧；不在任何区间内的帧为静音。
 */
const synthesize = (segments, endT) => {
  const frames = [];
  for (let t = 0; t < endT; t += FRAME_MS) {
    const seg = segments.find(s => t >= s.from && t < s.to);
    if (seg && seg.offset !== null) {
      frames.push({ t, pitch: BASE_FREQ * Math.pow(SEMITONE, seg.offset), clarity: 0.95, rms: 0.3 });
    } else {
      frames.push({ t, pitch: 0, clarity: 0, rms: 0.001 });
    }
  }
  return frames;
};

/**
 * 按名义区间合成「准确演唱」，可整体延迟 lagMs，并让每个音前 transitionMs 仍停留在上一个音（模拟滑音过渡）。
 */
const singSteps = (steps, { lagMs = 0, transitionMs = 0, centsOffset = {}, release = 300 } = {}) => {
  const segments = [];
  steps.forEach((step, i) => {
    const from = step.startT + lagMs;
    const prev = i > 0 ? steps[i - 1].offset : step.offset;
    const offset = step.offset + (centsOffset[i] ?? 0) / 100;
    if (transitionMs > 0 && i > 0) {
      segments.push({ from, to: from + transitionMs, offset: prev });
      segments.push({ from: from + transitionMs, to: step.endT + lagMs, offset });
    } else {
      segments.push({ from, to: step.endT + lagMs, offset });
    }
  });
  const last = steps[steps.length - 1];
  return synthesize(segments, last.endT + lagMs + release);
};

describe('resolveJudgeRegime', () => {
  it('每音 600 ms 时使用稳定判定，要求保持 200 ms', () => {
    expect(resolveJudgeRegime(600, 200)).toEqual({ regime: 'stable', requiredMs: 200 });
  });

  it('慢速时稳定要求仍固定为 200 ms，不随每音时长变长', () => {
    expect(resolveJudgeRegime(1500, 200)).toEqual({ regime: 'stable', requiredMs: 200 });
  });

  it('每音 300 ms（0.5 × 300 = 150 ms < 200 ms）时切换为走势判定', () => {
    const result = resolveJudgeRegime(300, 200);
    expect(result.regime).toBe('contour');
    expect(result.requiredMs).toBeCloseTo(90, 5);
  });

  it('走势判定的最短停留不低于 60 ms', () => {
    expect(resolveJudgeRegime(150, 200)).toEqual({ regime: 'contour', requiredMs: 60 });
  });

  it('切换点在每音 400 ms：恰好 400 ms 时仍为稳定判定，更短改为走势判定', () => {
    expect(resolveJudgeRegime(400, 200)).toEqual({ regime: 'stable', requiredMs: 200 });
    const below = resolveJudgeRegime(390, 200);
    expect(below.regime).toBe('contour');
    expect(below.requiredMs).toBeCloseTo(117, 5);
  });
});

describe('estimateGlobalLag', () => {
  const notes = [0, 2, 4, 5, 7].map((offset, i) => ({
    startT: 1000 + i * 300,
    endT: 1000 + (i + 1) * 300,
    targetCents: offset * 100
  }));
  const toVoiced = frames => frames
    .filter(f => f.pitch > 0)
    .map(f => ({ t: f.t, cents: 1200 * Math.log2(f.pitch / BASE_FREQ) }));

  it('准时演唱估计为 0 ms', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    expect(estimateGlobalLag(toVoiced(singSteps(steps)), notes)).toBe(0);
  });

  it('整体晚 200 ms 演唱时估计约 200 ms', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    const lag = estimateGlobalLag(toVoiced(singSteps(steps, { lagMs: 200 })), notes);
    expect(Math.abs(lag - 200)).toBeLessThanOrEqual(20);
  });

  it('最后一个音拖长不会把延迟估大', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    const lag = estimateGlobalLag(toVoiced(singSteps(steps, { release: 600 })), notes);
    expect(lag).toBe(0);
  });

  it('没有有声帧时返回 0', () => {
    expect(estimateGlobalLag([], notes)).toBe(0);
  });
});

describe('evaluatePhrase — 稳定判定（每音 600 ms）', () => {
  const offsets = [0, 2, 4, 5, 7];
  const steps = makeNoteSteps(offsets, 600);

  it('准时、音准的演唱通过', () => {
    const result = evaluatePhrase({ ...baseParams, frames: singSteps(steps), noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(true);
    expect(result.regime).toBe('stable');
    expect(result.lagMs).toBe(0);
    expect(result.notes).toHaveLength(5);
  });

  it('整体晚 250 ms 且每个音有 100 ms 滑音过渡仍通过（旧的按拍切窗会判为偏高/偏低）', () => {
    const frames = singSteps(steps, { lagMs: 250, transitionMs: 100 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(true);
    expect(Math.abs(result.lagMs - 250)).toBeLessThanOrEqual(110);
  });

  it('某个音唱低 150 cents 时报告该音偏低', () => {
    const frames = singSteps(steps, { centsOffset: { 3: -150 } });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(false);
    expect(result.failedNote).toMatchObject({ idx: 4, type: 'low' });
  });

  it('某个音唱高 150 cents 时报告该音偏高', () => {
    const frames = singSteps(steps, { centsOffset: { 1: 150 } });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.failedNote).toMatchObject({ idx: 2, type: 'high' });
  });

  it('目标音只唱了 150 ms 时判为保持不足', () => {
    const segments = steps.map((s, i) => ({
      from: s.startT,
      to: i === 4 ? s.startT + 150 : s.endT,
      offset: s.offset
    }));
    const frames = synthesize(segments, steps[4].endT + 400);
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.failedNote).toMatchObject({ idx: 5, type: 'unstable', requiredMs: 200 });
  });

  it('目标音连续保持约 220 ms 时通过（旧的 250 ms 要求会判为不稳定）', () => {
    const segments = steps.map((s, i) => ({
      from: s.startT,
      to: i === 4 ? s.startT + 240 : s.endT,
      offset: s.offset
    }));
    const frames = synthesize(segments, steps[4].endT + 400);
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(true);
    expect(result.notes[4].stableMs).toBeGreaterThanOrEqual(200);
    expect(result.notes[4].stableMs).toBeLessThan(250);
  });

  it('全程无声时第一个音判为未检测到', () => {
    const frames = synthesize([], steps[4].endT + 400);
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.failedNote).toMatchObject({ idx: 1, type: 'miss' });
  });

  it('晚一整拍（600 ms）演唱超出允许延迟，不能通过', () => {
    const frames = singSteps(steps, { lagMs: 600 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(false);
  });
});

describe('evaluatePhrase — 走势判定（每音 300 ms / 150 ms）', () => {
  const offsets = [0, 2, 4, 5, 7, 5, 4, 2, 0];

  it('每音 300 ms、整体晚 180 ms 且有 80 ms 过渡时通过', () => {
    const steps = makeNoteSteps(offsets, 300);
    const frames = singSteps(steps, { lagMs: 180, transitionMs: 80 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 300 });
    expect(result.regime).toBe('contour');
    expect(result.passed).toBe(true);
  });

  it('每音 150 ms 的快速音阶，准确演唱通过', () => {
    const steps = makeNoteSteps(offsets, 150);
    const frames = singSteps(steps, { lagMs: 60, transitionMs: 40 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 150 });
    expect(result.passed).toBe(true);
  });

  it('没有唱到最高音（停在 5 半音）时该音判为偏低', () => {
    const steps = makeNoteSteps(offsets, 300);
    const capped = offsets.map(o => Math.min(o, 5));
    const frames = singSteps(steps.map((s, i) => ({ ...s, offset: capped[i] })));
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 300 });
    expect(result.failedNote).toMatchObject({ idx: 5, type: 'low' });
  });

  it('某个音一闪而过（只停留 32 ms）时判为没唱到位', () => {
    const steps = makeNoteSteps(offsets, 300);
    const segments = [];
    steps.forEach((s, i) => {
      if (i === 4) {
        // 最高音只出现两帧，其余时间延续上一个音
        segments.push({ from: s.startT, to: s.endT - 32, offset: offsets[3] });
        segments.push({ from: s.endT - 32, to: s.endT, offset: s.offset });
      } else {
        segments.push({ from: s.startT, to: s.endT, offset: s.offset });
      }
    });
    const frames = synthesize(segments, steps[steps.length - 1].endT + 400);
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 300 });
    expect(result.passed).toBe(false);
    expect(result.failedNote?.idx).toBe(5);
  });
});

describe('evaluatePhrase — 参数校验', () => {
  it('没有练习音时抛出错误', () => {
    expect(() => evaluatePhrase({ ...baseParams, frames: [], noteSteps: [], noteMs: 600 })).toThrow(/至少一个练习音/);
  });
});

// 构造带时间戳的帧序列：起始时间 t0，每帧间隔 dtMs
const makeStampedFrames = (count, { pitch = 220, clarity = 0.9, rms = 0.5, t0 = 0, dtMs = 17, clipped = false } = {}) =>
  Array.from({ length: count }, (_, i) => ({ pitch, clarity, rms, t: t0 + i * dtMs, clipped }));

describe('detectEarlyVoicing', () => {
  const baseGate = { baselineRms: 0.01, deltaDb: 0, clarityTheta: 0.6 };

  it('完全没有发声时返回 early=false', () => {
    const frames = makeStampedFrames(40, { rms: 0.001 });
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 250 });
    expect(result).toEqual({ early: false, durationMs: 0 });
  });

  it('单帧 / 孤立帧通过 gate 不会触发', () => {
    const frames = makeStampedFrames(20, { rms: 0.001 });
    frames[10] = { pitch: 220, clarity: 0.9, rms: 0.5, t: 170, clipped: false };
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 200 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBe(0);
  });

  it('短促瞬态（< 阈值）不会触发', () => {
    const frames = makeStampedFrames(20, { rms: 0.001 });
    for (let i = 5; i < 10; i++) frames[i] = { pitch: 220, clarity: 0.9, rms: 0.5, t: i * 17, clipped: false };
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 200 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBeLessThan(200);
  });

  it('持续发声超过阈值会触发', () => {
    const frames = makeStampedFrames(20);
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 250 });
    expect(result.early).toBe(true);
    expect(result.durationMs).toBeGreaterThan(250);
  });

  it('中间有 gate 失败的间隙会重置 run', () => {
    const frames = [
      ...makeStampedFrames(12, { t0: 0 }),
      ...makeStampedFrames(5, { t0: 12 * 17, rms: 0.001 }),
      ...makeStampedFrames(12, { t0: 17 * 17 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 250 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBeLessThan(250);
  });

  it('削波帧仍然计入发声时长（削波只用作 UI 提示，不再 reject）', () => {
    const frames = makeStampedFrames(30, { clipped: true });
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 1000, thresholdMs: 200 });
    expect(result.early).toBe(true);
  });

  it('只检查 t < endT 的帧：练习音开始后的发声不算切入过早', () => {
    const frames = [
      ...makeStampedFrames(20, { rms: 0.001, t0: 0 }),
      ...makeStampedFrames(30, { t0: 340 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 340, thresholdMs: 200 });
    expect(result.early).toBe(false);
  });

  it('endT 之前 100 ms 内的轻微抢拍不触发', () => {
    // 发声从 900 ms 开始，endT = 第一个音 1000 ms - 100 ms 容许抢拍 = 900 ms
    const frames = [
      ...makeStampedFrames(53, { rms: 0.001, t0: 0 }),
      ...makeStampedFrames(30, { t0: 901 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, frames, endT: 900, thresholdMs: 75 });
    expect(result.early).toBe(false);
  });
});
