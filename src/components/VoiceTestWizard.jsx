/** @file 嗓音测试页面外壳；业务编排由 useVoiceTestWizard 统一管理。 */
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import VoiceTestProgress from './voice-test/VoiceTestProgress.jsx';
import VoiceTestStepContent from './voice-test/VoiceTestStepContent.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useVoiceTestWizard } from '../hooks/useVoiceTestWizard.js';
import { VOICE_TEST_STEPS } from '../voice-test/voiceTestSteps.js';

/**
 * 嗓音测试向导页面，只处理加载边界、页面布局与导航展示。
 * @returns {JSX.Element} 嗓音测试向导。
 */
export default function VoiceTestWizard() {
  useDocumentMeta({
    title: '嗓音测试',
    description: '进行全面的嗓音女性化测试，包括基频测量、音域测定、共振峰分析和主观评估问卷。',
  });
  const wizard = useVoiceTestWizard();

  if (wizard.isLoading) return <div className="p-8 text-center"><p>正在初始化...</p></div>;
  if (wizard.error) {
    return <div className="p-8"><ApiErrorNotice error={wizard.error} onRetry={wizard.retryInitialization} /></div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-3 sm:p-6 lg:p-8">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:p-8">
        {wizard.draftError && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{wizard.draftError}</div>}
        {wizard.recoveryNotice && (
          <div role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
            <p>{wizard.recoveryNotice}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={wizard.dismissRecovery} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800">继续当前测试</button>
              <button type="button" onClick={wizard.onRestart} disabled={wizard.isUploading} className="rounded-lg border border-blue-300 bg-white px-4 py-2 font-medium text-blue-900 disabled:opacity-60">放弃并新建测试</button>
            </div>
          </div>
        )}

        <VoiceTestProgress currentStep={wizard.currentStep} />
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">{VOICE_TEST_STEPS[wizard.currentStep].title}</h2>
        <div className="mb-8 flex min-h-[300px] items-center justify-center rounded-lg bg-gray-50 p-4 sm:p-6">
          <VoiceTestStepContent model={wizard.stepContentModel} />
        </div>
        <nav aria-label="嗓音测试步骤" className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={wizard.onBack} disabled={wizard.currentStep === 0 || wizard.analysisStatus === 'processing'} className="rounded-lg bg-gray-300 px-4 py-2 font-semibold text-gray-800 transition-colors hover:bg-gray-400 disabled:cursor-not-allowed disabled:bg-gray-200 sm:px-6">上一步</button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            {wizard.currentStep === 7 && <button onClick={wizard.onSkip} className="rounded-lg bg-gray-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-gray-600 sm:px-6">跳过</button>}
            {wizard.currentStep < VOICE_TEST_STEPS.length - 1 && <button onClick={wizard.onNext} disabled={!wizard.isStepComplete || wizard.isUploading} className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300 sm:px-6">{wizard.currentStep === 7 ? '提交' : '下一步'}</button>}
          </div>
        </nav>
      </div>
    </div>
  );
}
