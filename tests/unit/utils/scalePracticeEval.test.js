/**
 * 单元测试：src/utils/scalePracticeEval.js
 *
 * 覆盖逐拍稳定性判定逻辑，确保“保持足够时间”的规则生效。
 */
import { describe, it, expect } from 'vitest';
import { evaluateNoteStability } from '../../../src/utils/scalePracticeEval.js';

const baseParams = {
  baseFreq: 440,
  semitoneRatio: Math.pow(2, 1 / 12),
  tolerance: 50,
  baselineRms: 0.01,
  deltaDb: 0,
  clarityTheta: 0.6,
  stableWindowMs: 300
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
    expect(result.stableDurations[0]).toBeGreaterThanOrEqual(300);
    expect(result.stableDurations[1]).toBeGreaterThanOrEqual(300);
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
