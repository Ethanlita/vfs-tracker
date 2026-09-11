/** @file 根据显式状态机步骤选择唯一内容组件。 */
import VoiceTestRecorderPane from './VoiceTestRecorderPane.jsx';
import VoiceTestResultPane from './VoiceTestResultPane.jsx';
import VoiceTestSurveyPane from './VoiceTestSurveyPane.jsx';

/** 把步骤类型映射到对应展示组件。 */
export default function VoiceTestStepContent({ model }) {
  const { step } = model;
  if (step.id === 8) {
    return <VoiceTestResultPane step={step} analysis={model.analysis} isUploading={model.upload.isUploading} onGenerate={model.onGenerate} onRetryAnalysis={model.onRetryAnalysis} onRetryQuery={model.analysis.retryQuery} onRestart={model.onRestart} />;
  }
  if (step.id === 7) return <VoiceTestSurveyPane formData={model.formData} onChange={model.onFormChange} />;
  if (step.requiresRecording) {
    return <VoiceTestRecorderPane step={step} recordings={model.recordings} reading={model.reading} upload={model.upload} playback={model.playback} onRecordingComplete={model.onRecordingComplete} onRestart={model.onRestart} onGoToPending={model.onGoToPending} />;
  }
  return <p className="text-gray-700 whitespace-pre-line">{step.instructions}</p>;
}
