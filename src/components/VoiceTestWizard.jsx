import React, { useState, useEffect, useRef } from 'react';
import {
  createVoiceTestSession,
  getVoiceTestUploadUrl,
  uploadVoiceTestFileToS3,
  requestVoiceTestAnalyze,
  getVoiceTestResults,
} from '../api';
import { useAuth } from '../contexts/AuthContext';
import Recorder from './Recorder';
import SurveyRBH from './SurveyRBH';
import SurveyOVHS9 from './SurveyOVHS9';
import SurveyTVQG from './SurveyTVQG';
import TestResultsDisplay from './TestResultsDisplay';

/**
 * @en Defines the structure and content for each step of the voice test wizard.
 * @zh 定义嗓音测试向导中每个步骤的结构和内容。
 */
const STEPS = [
  { id: 0, title: '说明与同意', instructions: '本工具旨在提供嗓音分析的参考数据，并非医疗诊断。您的数据将被匿名化处理，仅能用于参考。过程需要约10分钟，请您在测试途中不要退出页面或者刷新页面，否则所有进度都将会丢失。这不仅会浪费您的时间，也会占用额外的AWS Lambda运行时和S3存储空间。如果您准备好了，点击“下一步”即表示您同意以上条款。', requiresRecording: false },
  { id: 1, title: '设备与环境校准', instructions: '请在安静的环境中进行测试。首先，录制5秒钟的静音。然后，用正常音量朗读“他去无锡市，我到黑龙江”两遍。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['静音录制', '标准句朗读'] },
  { id: 2, title: '最长发声时 (MPT) + 稳定元音', instructions: '请用舒适的音量，尽可能长地发出元音 /a/。此步骤需要录制两次，我们会取效果最好的一次。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['第一次 /a/ 发声', '第二次 /a/ 发声'] },
  { id: 3, title: '音域测定：滑音', instructions: '请从您最低的音平滑地唱到最高的音（上滑音），然后从最高的音平滑地唱到最低的音（下滑音）。上下滑音各需录制两次。', requiresRecording: true, recordingsNeeded: 4, recordingLabels: ['第一次上滑音', '第二次上滑音', '第一次下滑音', '第二次下滑音'] },
  { id: 4, title: '定点音 + 共振峰', instructions: '请分别用您最低和最高的可控音量，稳定地发出元音 /a/，各持续3-4秒。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['最低音 /a/', '最高音 /a/'] },
  { id: 5, title: '朗读指定语句', instructions: '请按屏幕上显示的文字进行朗读。指定文字：许多人将跨性别女生与程序员联系，源于计算机科学之父图灵。他因性取向被判刑，选择雌激素注射以替代监禁，因此身体受损还长出乳房。若施刑者是跨性别女性，这种惩罚便成了奖赏。这样的反转仿佛图灵无声守护后辈，让性别认同获得庇护。每次解锁电脑与手机时，我们都应铭记他，不仅因科学贡献，也因他给予后人的保护与爱。', requiresRecording: true, recordingsNeeded: 1 },
  { id: 6, title: '自由说话', instructions: '请围绕开放话题“介绍一下你最喜欢的食物”进行30-60秒的自由发言。', requiresRecording: true, recordingsNeeded: 1 },
  { id: 7, title: '主观量表', instructions: '请根据您近期的嗓音情况，完成以下主观评估量表。', requiresRecording: false },
  { id: 8, title: '结果确认与报告生成', instructions: '所有测试已完成！请点击下方按钮，开始生成您的嗓音分析报告。', requiresRecording: false },
];

/**
 * @en The VoiceTestWizard component is a multi-step wizard that guides the user through a comprehensive voice analysis test.
 * It manages the overall state of the test, including the current step, session ID, recorded audio data, and questionnaire answers.
 * It orchestrates the recording, uploading, and final analysis processes.
 * @zh VoiceTestWizard 组件是一个多步骤向导，引导用户完成全面的嗓音分析测试。
 * 它管理测试的整体状态，包括当前步骤、会话ID、录制的音频数据和问卷答案。
 * 它负责协调录音、上传和最终的分析流程。
 * @returns {JSX.Element} The rendered voice test wizard component.
 */
const VoiceTestWizard = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [recordedBlobs, setRecordedBlobs] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [formData, setFormData] = useState({
    rbh: { R: null, B: null, H: null },
    ovhs9: Array(9).fill(null),
    tvqg: Array(12).fill(null),
  });

  const [analysisStatus, setAnalysisStatus] = useState('idle'); // idle, processing, done, failed
  const [analysisResults, setAnalysisResults] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    const startSession = async () => {
      try {
        setIsLoading(true);
        const response = await createVoiceTestSession(user?.userId);
        setSessionId(response.sessionId);
        setError(null);
      } catch (err) {
        setError('无法启动嗓音测试会话，请稍后重试。');
      } finally {
        setIsLoading(false);
      }
    };
    startSession();
    return () => clearInterval(pollingRef.current); // Cleanup on unmount
  }, [user]);

  const handleRecordingComplete = async (blob) => {
    setIsUploading(true);
    setUploadError(null);
    const stepInfo = STEPS[currentStep];
    const recordingIndex = recordedBlobs[currentStep]?.length || 0;
    const fileName = `${stepInfo.id}_${recordingIndex + 1}.wav`;
    try {
      const { putUrl, objectKey } = await getVoiceTestUploadUrl(sessionId, stepInfo.id, fileName, 'audio/wav');
      await uploadVoiceTestFileToS3(putUrl, blob);
      setRecordedBlobs(prev => ({ ...prev, [currentStep]: [...(prev[currentStep] || []), { blob, objectKey, fileName }] }));
    } catch (err) {
      setUploadError('上传失败，请重试。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFormChange = (formName, values) => setFormData(prev => ({ ...prev, [formName]: values }));

  const handleGenerateReport = async () => {
    setAnalysisStatus('processing');
    try {
      await requestVoiceTestAnalyze(sessionId, { hasExternal: false }, formData);
      // Start polling for results
      pollingRef.current = setInterval(async () => {
        try {
          const results = await getVoiceTestResults(sessionId);
          if (results.status === 'done') {
            setAnalysisStatus('done');
            setAnalysisResults(results);
            clearInterval(pollingRef.current);
          } else if (results.status === 'failed') {
            setAnalysisStatus('failed');
            clearInterval(pollingRef.current);
          }
        } catch (pollErr) {
          setAnalysisStatus('failed');
          clearInterval(pollingRef.current);
        }
      }, 3000); // Poll every 3 seconds
    } catch (err) {
      setAnalysisStatus('failed');
    }
  };

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const renderStepContent = () => {
    const stepInfo = STEPS[currentStep];
    
    if (stepInfo.id === 8) { // 结果生成步骤
      switch (analysisStatus) {
        case 'idle':
          return (
            <div className="text-center">
              <p className="mb-6">{stepInfo.instructions}</p>
              <button onClick={handleGenerateReport} className="px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-lg shadow-lg hover:bg-green-700 transition-all">生成报告</button>
            </div>
          );
        case 'processing':
          return <div className="text-center"><p>正在分析您的嗓音数据，请稍候... (这可能需要1-2分钟)</p><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mt-4"></div></div>;
        case 'done':
          return <TestResultsDisplay results={analysisResults} />;
        case 'failed':
          return <div className="text-center text-red-600"><p>分析失败，请稍后重试。</p></div>;
        default: return null;
      }
    }

    if (stepInfo.id === 7) {
      return (
        <div className="space-y-8">
          <SurveyRBH values={formData.rbh} onChange={(v) => handleFormChange('rbh', v)} />
          <SurveyOVHS9 values={formData.ovhs9} onChange={(v) => handleFormChange('ovhs9', v)} />
          <SurveyTVQG values={formData.tvqg} onChange={(v) => handleFormChange('tvqg', v)} />
        </div>
      );
    }

    if (stepInfo.requiresRecording) {
      const recordingsForStep = recordedBlobs[currentStep] || [];
      const allRecordingsDone = recordingsForStep.length >= (stepInfo.recordingsNeeded || 0);
      return (
        <div className="text-center">
          <p className="mb-4 text-gray-600 whitespace-pre-line">{stepInfo.instructions}</p>
          <div className="my-4 p-3 bg-gray-100 rounded-lg">
            <p className="font-semibold">进度: {recordingsForStep.length} / {stepInfo.recordingsNeeded}</p>
            {stepInfo.recordingLabels && <p className="text-sm text-gray-500">当前录制: {stepInfo.recordingLabels[recordingsForStep.length]}</p>}
          </div>
          {isUploading && <p className="my-4 text-blue-600">正在上传...</p>}
          {uploadError && <p className="my-4 text-red-600">{uploadError}</p>}
          {allRecordingsDone && !isUploading && <div className="my-4 p-3 bg-green-100 text-green-800 rounded-lg"><p>✅ 本步骤所有录音已完成。</p></div>}
          <div className="mt-4"><Recorder key={`${currentStep}-${recordingsForStep.length}`} onRecordingComplete={handleRecordingComplete} isRecording={isUploading || allRecordingsDone} /></div>
        </div>
      );
    }
    
    return <p className="text-gray-700 whitespace-pre-line">{stepInfo.instructions}</p>;
  };

  if (isLoading) return <div className="p-8 text-center"><p>正在初始化...</p></div>;
  if (error) return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;

  const isFormsComplete = () => {
    const { rbh, ovhs9, tvqg } = formData;
    return Object.values(rbh).every(v => v !== null) && ovhs9.every(v => v !== null) && tvqg.every(v => v !== null);
  };

  const stepInfo = STEPS[currentStep];
  let isStepComplete = false;
  if (stepInfo.id === 7) isStepComplete = isFormsComplete();
  else if (stepInfo.requiresRecording) isStepComplete = (recordedBlobs[currentStep] || []).length >= (stepInfo.recordingsNeeded || 0);
  else isStepComplete = true;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-8">
        <div className="mb-8">{/* Progress Bar */}</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">{STEPS[currentStep].title}</h2>
        <div className="min-h-[300px] flex items-center justify-center bg-gray-50 rounded-lg p-6 mb-8">
          {renderStepContent()}
        </div>
        <div className="flex justify-between">
          <button onClick={handleBack} disabled={currentStep === 0 || analysisStatus === 'processing'} className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors">上一步</button>
          {currentStep < STEPS.length - 1 && <button onClick={handleNext} disabled={!isStepComplete || isUploading} className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors">下一步</button>}
        </div>
      </div>
    </div>
  );
};

export default VoiceTestWizard;
