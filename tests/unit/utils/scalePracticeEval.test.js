/**
 * 单元测试：src/utils/scalePracticeEval.js
 *
 * 覆盖整句判定（延迟估计、换音点对齐、首尾音边界、稳定 / 走势两种判定方式）与切入过早检测。
 * 帧数据由合成「歌唱」生成：按固定 16 ms 采样间隔，在给定时间区间内输出指定半音的基频。
 */
import { describe, it, expect } from 'vitest';
import {
  PHRASE_EVAL_CONFIG,
  detectEarlyVoicing,
  estimateGlobalLag,
  evaluatePhrase,
  resolveJudgeRegime,
  resolveLateLimitMs
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
  // 与 evaluatePhrase 相同的搜索上限：lagMaxMs + 每音时长
  const maxLag = PHRASE_EVAL_CONFIG.lagMaxMs + 300;

  it('准时演唱估计为 0 ms', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    expect(estimateGlobalLag(toVoiced(singSteps(steps)), notes, maxLag)).toBe(0);
  });

  it('整体晚 200 ms 演唱时估计约 200 ms', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    const lag = estimateGlobalLag(toVoiced(singSteps(steps, { lagMs: 200 })), notes, maxLag);
    expect(Math.abs(lag - 200)).toBeLessThanOrEqual(20);
  });

  it('最后一个音拖长不会把延迟估大', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    const lag = estimateGlobalLag(toVoiced(singSteps(steps, { release: 600 })), notes, maxLag);
    expect(lag).toBe(0);
  });

  it('没有有声帧时返回 0', () => {
    expect(estimateGlobalLag([], notes, maxLag)).toBe(0);
  });

  it('晚一整拍（300 ms）时估计约 300 ms，而不是卡在旧的 350 ms 范围内错位', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 300);
    const lag = estimateGlobalLag(toVoiced(singSteps(steps, { lagMs: 300 })), notes, maxLag);
    expect(Math.abs(lag - 300)).toBeLessThanOrEqual(20);
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

  it('晚一整拍（600 ms）演唱超出允许延迟，整句判为跟唱太晚', () => {
    // 旧实现只是碰巧因为末音被裁短而失败；现在由延迟上限明确拒绝
    const frames = singSteps(steps, { lagMs: 600 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(false);
    expect(result.failedNote).toMatchObject({ type: 'late', limitMs: 500 });
    expect(Math.abs(result.failedNote.lagMs - 600)).toBeLessThanOrEqual(20);
    expect(result.lagMs).toBe(result.failedNote.lagMs);
    expect(result.notes).toEqual([]);
  });

  it('晚 400 ms 且每音有 60 ms 滑音（估计约 460 ms，上限 500 ms 以内）仍可通过', () => {
    // 延迟估计的是音高真正到位的时刻，滑音时间也算在内
    const frames = singSteps(steps, { lagMs: 400, transitionMs: 60 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 600 });
    expect(result.passed).toBe(true);
    expect(Math.abs(result.lagMs - 460)).toBeLessThanOrEqual(20);
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

/**
 * 合成「接近真人」的演唱：每 16 ms 一帧，可设采样起始相位、整体延迟、固定偏差和逐帧随机抖动。
 * 随机数用固定种子的线性同余生成器，结果可复现。
 * @param {Array<{ offset:number, startT:number, endT:number }>} steps 名义练习音
 * @param {Object} [opts]
 * @param {number} [opts.lagMs=0] 整体延迟
 * @param {number} [opts.phaseMs=0] 第一帧的时间戳（模拟采样相位）
 * @param {number} [opts.biasCents=0] 每帧固定偏差
 * @param {number} [opts.jitterCents=0] 每帧随机抖动幅度（±）
 * @param {number} [opts.seed=1] 随机种子
 * @param {Object<number, { from?:number, to?:number, cents?:number }>} [opts.overrides]
 *   按音下标替换演唱：只在该音开始后 [from, to) 毫秒内发声，并额外偏离 cents
 * @param {{ ms:number, cents:number }|null} [opts.tail] 最后一个音结束后继续发声 ms 毫秒，偏离最后一个音 cents
 * @param {number} [opts.release=350] 最后一个音之后的总采集时长
 */
const singRealistic = (steps, {
  lagMs = 0,
  phaseMs = 0,
  biasCents = 0,
  jitterCents = 0,
  seed = 1,
  overrides = {},
  tail = null,
  release = 350
} = {}) => {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const last = steps[steps.length - 1];
  const lastEnd = last.endT + lagMs;
  const frames = [];
  for (let t = phaseMs; t < lastEnd + release; t += FRAME_MS) {
    const i = steps.findIndex(s => t >= s.startT + lagMs && t < s.endT + lagMs);
    let cents = null;
    if (i >= 0) {
      const { from = 0, to = Infinity, cents: extra = 0 } = overrides[i] ?? {};
      const local = t - (steps[i].startT + lagMs);
      if (local >= from && local < to) {
        cents = steps[i].offset * 100 + biasCents + extra + (rand() * 2 - 1) * jitterCents;
      }
    } else if (tail && t >= lastEnd && t < lastEnd + tail.ms) {
      cents = last.offset * 100 + tail.cents;
    }
    frames.push(cents === null
      ? { t, pitch: 0, clarity: 0, rms: 0.001 }
      : { t, pitch: BASE_FREQ * Math.pow(2, cents / 1200), clarity: 0.95, rms: 0.3 });
  }
  return frames;
};

describe('evaluatePhrase — 首尾音边界', () => {
  // 16 分音符版的九音音型；每音时长 = 60000 / BPM / 4
  const offsets = [0, 2, 4, 5, 7, 5, 4, 2, 0];
  const sixteenth = bpm => 60000 / bpm / 4;

  /**
   * 首尾音完整唱满时，保留下来的稳定时长应接近整个音长：
   * 名义区间内最多因采样相位少两帧（首帧晚到、末帧早结束），不应再被裁掉更多。
   */
  const expectEdgesKept = (result, noteMs) => {
    expect(result.notes[0].stableMs).toBeGreaterThanOrEqual(noteMs - 2 * FRAME_MS);
    expect(result.notes[offsets.length - 1].stableMs).toBeGreaterThanOrEqual(noteMs - 2 * FRAME_MS);
  };

  it.each([80, 140, 160])('16 分音符 %i BPM、音高准确且无延迟时通过，首尾音不被裁短', bpm => {
    const noteMs = sixteenth(bpm);
    const steps = makeNoteSteps(offsets, noteMs);
    const result = evaluatePhrase({ ...baseParams, frames: singRealistic(steps), noteSteps: steps, noteMs });
    expect(result.regime).toBe('contour');
    expect(result.lagMs).toBe(0);
    expect(result.passed).toBe(true);
    expectEdgesKept(result, noteMs);
  });

  it.each([
    { label: '120 BPM、每帧抖动 ±15 cents', bpm: 120, jitterCents: 15, biasCents: 0 },
    { label: '140 BPM、每帧抖动 ±15 cents', bpm: 140, jitterCents: 15, biasCents: 0 },
    { label: '160 BPM、每帧抖动 ±15 cents', bpm: 160, jitterCents: 15, biasCents: 0 },
    { label: '160 BPM、整体偏高 8 cents', bpm: 160, jitterCents: 0, biasCents: 8 }
  ].map(c => [c.label, c]))('16 分音符 %s 且晚 220 ms 时通过', (_label, { bpm, jitterCents, biasCents }) => {
    // 旧实现下首尾音只剩 32–48 ms，被判为没唱到位
    const noteMs = sixteenth(bpm);
    const steps = makeNoteSteps(offsets, noteMs);
    const frames = singRealistic(steps, { lagMs: 220, jitterCents, biasCents });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs });
    expect(result.passed).toBe(true);
    expectEdgesKept(result, noteMs);
  });

  it.each([
    { label: '采样相位 5 ms、准时', phaseMs: 5, lagMs: 0 },
    { label: '采样相位 11 ms、晚 120 ms', phaseMs: 11, lagMs: 120 },
    { label: '采样相位 3 ms、晚 300 ms', phaseMs: 3, lagMs: 300 },
    { label: '采样相位 8 ms、抢拍 60 ms', phaseMs: 8, lagMs: -60 }
  ].map(c => [c.label, c]))('16 分音符 160 BPM、%s 时通过', (_label, { phaseMs, lagMs }) => {
    const noteMs = sixteenth(160);
    const steps = makeNoteSteps(offsets, noteMs);
    const frames = singRealistic(steps, { phaseMs, lagMs, jitterCents: 10 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs });
    expect(result.passed).toBe(true);
    expectEdgesKept(result, noteMs);
  });

  it('稳定判定下（四分音符 150 BPM，每音 400 ms）首尾音同样保留整个音长', () => {
    // 旧实现下首音约 272 ms、末音约 224 ms，离 200 ms 的要求只差一点
    const steps = makeNoteSteps(offsets, 400);
    const frames = singRealistic(steps, { lagMs: 220, jitterCents: 15 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 400 });
    expect(result.regime).toBe('stable');
    expect(result.passed).toBe(true);
    expectEdgesKept(result, 400);
  });

  it('末音之后滑走的帧（偏低 300 cents）不计入末音，整句仍通过', () => {
    const noteMs = sixteenth(160);
    const steps = makeNoteSteps(offsets, noteMs);
    const frames = singRealistic(steps, { lagMs: 220, jitterCents: 10, tail: { ms: 200, cents: -300 } });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs });
    expect(result.passed).toBe(true);
    expect(Math.abs(result.notes[offsets.length - 1].cents)).toBeLessThanOrEqual(75);
  });

  describe('首尾音真的有问题时仍然判失败（16 分音符 160 BPM，晚 220 ms）', () => {
    const noteMs = sixteenth(160);
    const steps = makeNoteSteps(offsets, noteMs);
    const last = offsets.length - 1;
    const run = overrides => evaluatePhrase({
      ...baseParams,
      frames: singRealistic(steps, { lagMs: 220, jitterCents: 10, overrides }),
      noteSteps: steps,
      noteMs
    });

    it('末音只唱了 32 ms 就停下，判为没唱到位', () => {
      expect(run({ [last]: { to: 32 } }).failedNote).toMatchObject({ idx: 9, type: 'brief' });
    });

    it('末音唱高 150 cents，判为偏高', () => {
      expect(run({ [last]: { cents: 150 } }).failedNote).toMatchObject({ idx: 9, type: 'high' });
    });

    it('末音没有唱出来，判为未检测到', () => {
      expect(run({ [last]: { to: 0 } }).failedNote).toMatchObject({ idx: 9, type: 'miss' });
    });

    it('首音晚进、只唱了最后 32 ms，判为没唱到位', () => {
      expect(run({ 0: { from: noteMs - 32 } }).failedNote).toMatchObject({ idx: 1, type: 'brief' });
    });

    it('首音唱低 150 cents，判为偏低', () => {
      expect(run({ 0: { cents: -150 } }).failedNote).toMatchObject({ idx: 1, type: 'low' });
    });
  });
});

describe('evaluatePhrase — 跟唱太晚', () => {
  const offsets = [0, 2, 4, 5, 7, 5, 4, 2, 0];

  it('上限为 350 ms + 换音点浮动：每音 ≥ 333 ms 时 500 ms，更快时随每音时长缩小', () => {
    expect(resolveLateLimitMs(600)).toBe(500);
    expect(resolveLateLimitMs(1500)).toBe(500);
    expect(resolveLateLimitMs(187.5)).toBeCloseTo(434.375, 5);
    expect(resolveLateLimitMs(93.75)).toBeCloseTo(392.1875, 5);
  });

  it('每音 400 ms、晚 450 ms 时通过（旧实现因末音被裁短误判为保持不足）', () => {
    const steps = makeNoteSteps(offsets, 400);
    const frames = singRealistic(steps, { lagMs: 450, jitterCents: 15 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 400 });
    expect(result.passed).toBe(true);
  });

  it('每音 1500 ms（40 BPM）、晚 600 ms 时判为跟唱太晚（旧实现在慢速下从不拒绝）', () => {
    const steps = makeNoteSteps([0, 2, 4, 5, 7], 1500);
    const frames = singRealistic(steps, { lagMs: 600, jitterCents: 15 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs: 1500 });
    expect(result.failedNote).toMatchObject({ type: 'late', limitMs: 500 });
  });

  it('16 分音符 80 BPM、晚 500 ms（上限约 434 ms）时判为跟唱太晚', () => {
    const noteMs = 187.5;
    const steps = makeNoteSteps(offsets, noteMs);
    const frames = singRealistic(steps, { lagMs: 500, jitterCents: 15 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs });
    expect(result.failedNote?.type).toBe('late');
    expect(result.failedNote.limitMs).toBeCloseTo(434.375, 5);
  });

  it('16 分音符 80 BPM、晚 400 ms（上限以内）时通过', () => {
    const noteMs = 187.5;
    const steps = makeNoteSteps(offsets, noteMs);
    const frames = singRealistic(steps, { lagMs: 400, jitterCents: 15 });
    const result = evaluatePhrase({ ...baseParams, frames, noteSteps: steps, noteMs });
    expect(result.passed).toBe(true);
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
