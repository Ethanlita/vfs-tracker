/** @file 嗓音测试步骤进度显示。 */
import { VOICE_TEST_STEPS } from '../../voice-test/voiceTestSteps.js';

/** 用文本和原生进度语义同步呈现当前步骤。 */
export default function VoiceTestProgress({ currentStep }) {
  const value = currentStep + 1;
  return (
    <div className="mb-8" aria-label="嗓音测试进度">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm text-gray-600">
        <span>步骤 {value} / {VOICE_TEST_STEPS.length}</span>
        <span>{Math.round((value / VOICE_TEST_STEPS.length) * 100)}%</span>
      </div>
      <progress className="sr-only" value={value} max={VOICE_TEST_STEPS.length}>
        {value} / {VOICE_TEST_STEPS.length}
      </progress>
      <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-purple-600 transition-[width]" style={{ width: `${(value / VOICE_TEST_STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}
