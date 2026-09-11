/** @file TD-PSOLA 基频标记候选选择与推进回归测试。 */
import { describe, expect, it } from 'vitest';
import {
  resolvePitchMarkPosition,
  scorePitchPeriodCandidate,
} from '../../../src/utils/tdPsolaPitchMarks.js';

describe('TD-PSOLA 基频标记辅助逻辑', () => {
  it('相关性相同时优先选择接近预估基频的一倍周期', () => {
    const estimatedPeriod = 245;

    expect(scorePitchPeriodCandidate(1, 245, estimatedPeriod))
      .toBeGreaterThan(scorePitchPeriodCandidate(1, 490, estimatedPeriod));
  });

  it('保留落在连续周期范围内的精确候选', () => {
    expect(resolvePitchMarkPosition({
      candidate: 492,
      previous: 245,
      expected: 490,
      period: 245,
      bufferLength: 2000,
    })).toBe(492);
  });

  it('候选反复落在旧周期时使用预期位置继续推进', () => {
    let previous = 245;
    const positions = [previous];

    for (let index = 0; index < 5; index += 1) {
      const expected = previous + 245;
      const resolved = resolvePitchMarkPosition({
        candidate: 245,
        previous,
        expected,
        period: 245,
        bufferLength: 3000,
      });
      positions.push(resolved);
      previous = resolved;
    }

    expect(positions).toEqual([245, 490, 735, 980, 1225, 1470]);
  });

  it('回退位置到达音频末端时停止生成标记', () => {
    expect(resolvePitchMarkPosition({
      candidate: 100,
      previous: 900,
      expected: 1100,
      period: 200,
      bufferLength: 1000,
    })).toBeNull();
  });
});
