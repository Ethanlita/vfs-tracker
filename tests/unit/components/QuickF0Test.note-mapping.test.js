/**
 * @file QuickF0Test.note-mapping.test.js
 * @description QuickF0Test 频率转音名算法单元测试
 */

import { describe, it, expect } from 'vitest';
import { frequencyToNoteName } from '../../../src/components/QuickF0Test.jsx';

describe('QuickF0Test frequencyToNoteName', () => {
  it('应该正确映射常见标准频率到音名', () => {
    expect(frequencyToNoteName(440)).toBe('A4');
    expect(frequencyToNoteName(261.63)).toBe('C4');
    expect(frequencyToNoteName(329.63)).toBe('E4');
    expect(frequencyToNoteName(220)).toBe('A3');
    expect(frequencyToNoteName(880)).toBe('A5');
  });

  it('对于无效频率应返回占位符', () => {
    expect(frequencyToNoteName(0)).toBe('--');
    expect(frequencyToNoteName(-1)).toBe('--');
    expect(frequencyToNoteName(null)).toBe('--');
    expect(frequencyToNoteName(undefined)).toBe('--');
  });
});
