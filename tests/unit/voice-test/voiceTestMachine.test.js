/** @file 嗓音测试状态图的单元测试。 */
import { describe, expect, it } from 'vitest';
import { voiceTestMachine } from '../../../src/voice-test/voiceTestMachine.js';

describe('voiceTestMachine', () => {
  it('仅在当前步骤完成后允许前进', () => {
    const initial = voiceTestMachine.initialState;
    expect(voiceTestMachine.transition(initial, { type: 'NEXT', complete: false }).value).toBe('consent');
    expect(voiceTestMachine.transition(initial, { type: 'NEXT', complete: true }).value).toBe('calibration');
  });

  it('支持后退、问卷跳过和完整草稿恢复范围', () => {
    expect(voiceTestMachine.transition('calibration', 'BACK').value).toBe('consent');
    expect(voiceTestMachine.transition('survey', 'SKIP').value).toBe('report');
    for (let step = 0; step <= 8; step += 1) {
      expect(voiceTestMachine.transition('consent', { type: 'GO_TO', step }).changed).toBe(step !== 0);
    }
    expect(voiceTestMachine.transition('reading', { type: 'GO_TO', step: 99 }).value).toBe('reading');
  });

  it('从任意步骤重置到同意页', () => {
    expect(voiceTestMachine.transition('report', 'RESET').value).toBe('consent');
  });
});
