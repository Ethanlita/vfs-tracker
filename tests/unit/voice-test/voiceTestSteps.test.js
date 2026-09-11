/**
 * @file 嗓音测试步骤文案契约测试。
 * @description 确保录音提示与 v2 声学任务映射使用相同的音量语义。
 */
import { describe, expect, it } from 'vitest';
import { VOICE_TEST_STEPS } from '../../../src/voice-test/voiceTestSteps.js';

describe('嗓音测试 Step 4 文案', () => {
  it('明确要求低/高音量且提示保持稳定音高', () => {
    const step = VOICE_TEST_STEPS.find(item => item.id === 4);

    expect(step.instructions).toContain('最低和最高的可控音量');
    expect(step.instructions).toContain('音高尽量保持舒适、稳定');
    expect(step.recordingLabels).toEqual([
      '最低音量 /a/，录制完成后请点击停止',
      '最高音量 /a/，录制完成后请点击停止',
    ]);
  });
});
