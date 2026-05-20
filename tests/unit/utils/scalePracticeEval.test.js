/**
 * 单元测试：src/utils/scalePracticeEval.js
 *
 * 覆盖逐拍稳定性判定逻辑，确保“保持足够时间”的规则生效。
 */
import { describe, it, expect } from 'vitest';
import { detectEarlyVoicing, evaluateNoteStability } from '../../../src/utils/scalePracticeEval.js';

const baseParams = {
  baseFreq: 440,
  semitoneRatio: Math.pow(2, 1 / 12),
  tolerance: 75,
  baselineRms: 0.01,
  deltaDb: 0,
  clarityTheta: 0.6,
  stableWindowMs: 250
};

const makeFrame = (pitch, clarity = 0.9, rms = 0.5) => ({ pitch, clarity, rms });

describe('evaluateNoteStability', () => {
  it('每个音都满足音准与稳定时长时应返回通过', () => {
    const noteSteps = [
      { beatIdx: 0, offset: 0 },
      { beatIdx: 1, offset: 4 }
    ];
    const beatData = [
      new Array(6).fill(makeFrame(440)),
      new Array(6).fill(makeFrame(440 * Math.pow(2, 4 / 12)))
    ];
    const result = evaluateNoteStability({
      ...baseParams,
      beatData,
      noteSteps,
      frameDuration: 60,
      beatDurations: [500, 500]
    });
    expect(result.passed).toBe(true);
    expect(result.stableDurations[0]).toBeGreaterThanOrEqual(250);
    expect(result.stableDurations[1]).toBeGreaterThanOrEqual(250);
  });

  it('音准偏高时应返回对应的失败原因', () => {
    const noteSteps = [{ beatIdx: 0, offset: 0 }];
    const beatData = [
      [
        makeFrame(480),
        makeFrame(480),
        makeFrame(480)
      ]
    ];
    const result = evaluateNoteStability({
      ...baseParams,
      beatData,
      noteSteps,
      frameDuration: 100,
      beatDurations: [600]
    });
    expect(result.passed).toBe(false);
    expect(result.failedNote?.type).toBe('high');
    expect(result.failedNote?.idx).toBe(1);
  });

  it('稳定时间不足时应返回 unstable 失败', () => {
    const noteSteps = [{ beatIdx: 0, offset: 0 }];
    const beatData = [
      [
        makeFrame(440),
        makeFrame(440)
      ]
    ];
    const result = evaluateNoteStability({
      ...baseParams,
      beatData,
      noteSteps,
      frameDuration: 80,
      beatDurations: [500]
    });
    expect(result.passed).toBe(false);
    expect(result.failedNote?.type).toBe('unstable');
    expect(result.failedNote?.requiredMs).toBeLessThanOrEqual(300);
  });

  it('frameDuration 为 0 时会按拍长与帧数估算 dt', () => {
    const noteSteps = [{ beatIdx: 0, offset: 0 }];
    const beatData = [
      new Array(5).fill(makeFrame(440))
    ];
    const result = evaluateNoteStability({
      ...baseParams,
      beatData,
      noteSteps,
      frameDuration: 0,
      beatDurations: [400]
    });
    expect(result.passed).toBe(true);
    expect(result.stableDurations[0]).toBeGreaterThan(300);
  });
});

// 构造带时间戳的帧序列：起始时间 t0，每帧间隔 dtMs
const makeStampedFrames = (count, { pitch = 220, clarity = 0.9, rms = 0.5, t0 = 0, dtMs = 17, clipped = false } = {}) => {
  return Array.from({ length: count }, (_, i) => ({
    pitch, clarity, rms, t: t0 + i * dtMs, clipped
  }));
};

describe('detectEarlyVoicing', () => {
  const baseGate = { baselineRms: 0.01, deltaDb: 0, clarityTheta: 0.6 };

  it('完全没有发声时返回 early=false', () => {
    const beatData = [
      makeStampedFrames(20, { rms: 0.001 }), // 能量低于基线，全部 fail
      makeStampedFrames(20, { rms: 0.001 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 2, thresholdMs: 250 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBe(0);
  });

  it('单帧 / 孤立帧通过 gate 不会触发', () => {
    // 20 帧里只有 1 帧 pass
    const frames = makeStampedFrames(20, { rms: 0.001 });
    frames[10] = { pitch: 220, clarity: 0.9, rms: 0.5, t: 170, clipped: false };
    const beatData = [frames];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 200 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBe(0); // 单帧 runStart 设了但没下一帧 → 时长 0
  });

  it('短促瞬态（< 阈值）不会触发', () => {
    // 连续 5 帧通过，约 68 ms（5 * 17 - 17）
    const frames = makeStampedFrames(20, { rms: 0.001 });
    for (let i = 5; i < 10; i++) {
      frames[i] = { pitch: 220, clarity: 0.9, rms: 0.5, t: i * 17, clipped: false };
    }
    const beatData = [frames];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 200 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBeLessThan(200);
  });

  it('持续发声超过阈值会触发', () => {
    // 连续 20 帧 pass，约 320 ms
    const beatData = [makeStampedFrames(20, { t0: 0, dtMs: 17 })];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 250 });
    expect(result.early).toBe(true);
    expect(result.durationMs).toBeGreaterThan(250);
  });

  it('跨拍连续发声会被累加', () => {
    // 第 0 拍 8 帧 pass, 第 1 拍 8 帧 pass，时间戳连续 → 应累加成一段约 270ms 的 run
    const beatData = [
      makeStampedFrames(8, { t0: 0, dtMs: 17 }),
      makeStampedFrames(8, { t0: 8 * 17, dtMs: 17 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 2, thresholdMs: 200 });
    expect(result.early).toBe(true);
    expect(result.durationMs).toBeGreaterThan(200);
  });

  it('中间有 gate 失败的间隙会重置 run', () => {
    // 12 帧 pass + 5 帧 fail + 12 帧 pass，每段约 200ms，但 max 还是 200ms 不到 250
    const part1 = makeStampedFrames(12, { t0: 0, dtMs: 17 });
    const fail = makeStampedFrames(5, { t0: 12 * 17, dtMs: 17, rms: 0.001 });
    const part2 = makeStampedFrames(12, { t0: 17 * 17, dtMs: 17 });
    const beatData = [[...part1, ...fail, ...part2]];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 250 });
    expect(result.early).toBe(false);
    expect(result.durationMs).toBeLessThan(250);
  });

  it('削波帧仍然计入发声时长（削波只用作 UI 提示，不再 reject）', () => {
    // 30 帧全 clipped 但其他 gate 都过 → 应被识别为发声
    const beatData = [makeStampedFrames(30, { clipped: true, t0: 0, dtMs: 17 })];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 200 });
    expect(result.early).toBe(true);
    expect(result.durationMs).toBeGreaterThan(200);
  });

  it('firstNoteIdx=0 时直接返回 false', () => {
    const beatData = [makeStampedFrames(30)];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 0, thresholdMs: 200 });
    expect(result.early).toBe(false);
  });

  it('只检查 [0, firstNoteIdx)，不会扫到 note 拍', () => {
    // 第 0 拍 fail，第 1 拍（属于 note 不该被检查）大量 pass
    const beatData = [
      makeStampedFrames(20, { rms: 0.001 }),
      makeStampedFrames(30, { t0: 20 * 17, dtMs: 17 })
    ];
    const result = detectEarlyVoicing({ ...baseGate, beatData, firstNoteIdx: 1, thresholdMs: 200 });
    expect(result.early).toBe(false);
  });
});
