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
  { id: 0, title: '说明与同意', instructions: '本工具旨在提供嗓音分析的参考数据，并非医疗诊断。您的数据将被匿名化处理，仅能用于参考。' +
          '\n过程需要约10分钟，请您在测试途中不要退出页面或者刷新页面，否则所有进度都将会丢失。' +
          '\n这不仅会浪费您的时间，也会占用额外的AWS Lambda运行时和S3存储空间。' +
          '\n每次您完成一个片段的录音后，请点击“停止录音且继续”，这样录音才会停止并自动上传。如本段说错或失误，可点击“停止录音且放弃”丢弃本段并重新录制。' +
          '\n上传的音频文件只会在S3中保留60分钟，因此，请务必在60分钟内完成测试，否则将会产生不可预知的测试结果。' +
          '\n如果您准备好了，点击“下一步”即表示您同意以上条款。', requiresRecording: false },
  { id: 1, title: '设备与环境校准', instructions: '请在安静的环境中进行测试。首先，录制5秒钟的静音。然后，用正常音量朗读“他去无锡市，我到黑龙江”两遍。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['点击开始录音，保持安静5秒，然后请点击停止', '点击开始录音，朗读标准句，然后点击停止'] },
  { id: 2, title: '最长发声时 (MPT) + 稳定元音', instructions: '请用舒适的音量，尽可能长地发出元音 /a/。此步骤需要录制两次，我们会取效果最好的一次。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['第一次 /a/ （啊）发声，录制完成后请点击停止', '第二次 /a/ （啊）发声，录制完成后请点击停止'] },
  { id: 3, title: '音域测定：滑音', instructions: '请从您最低的音平滑地唱到最高的音（上滑音），然后从最高的音平滑地唱到最低的音（下滑音）。上下滑音各需录制两次。' +
          '\n提示：滑音，即选择一个元音（如“/a/ (啊)”或“/u/ (呜)”），从自己舒适的中音开始，把声音顺滑地持续拉高到能达到的最高音（上滑音），再连续滑回最低音（下滑音）。' +
          '\n要求连贯不中断、不突然跳音，用来测试声音能覆盖的最高与最低范围，也就是音域极限。', requiresRecording: true, recordingsNeeded: 4, recordingLabels: ['第一次上滑音，录制完成后请点击停止', '第二次上滑音，录制完成后请点击停止', '第一次下滑音，录制完成后请点击停止', '第二次下滑音，录制完成后请点击停止'] },
  { id: 4, title: '定点音 + 共振峰', instructions: '请分别用您最低和最高的可控音量，稳定地发出元音 /a/，各持续3-4秒。', requiresRecording: true, recordingsNeeded: 2, recordingLabels: ['最低音 /a/，录制完成后请点击停止', '最高音 /a/，录制完成后请点击停止'] },
  { id: 5, title: '朗读指定语句', instructions: '请按屏幕上显示的文字进行朗读。' +
          '\n许多人感觉跨性别女性多为程序员，这让人联想到计算机之父图灵的遭遇。他因同性恋被迫接受雌激素注射作为惩罚，并因此承受了乳房发育等副作用带来的巨大身心痛苦。\n' +
          '\n然而，一种反向思考是：如果承受这种“惩罚”的是一位有性别认同障碍的跨性别女性，那么刑罚就变成了奖励，副作用也成了期望的疗效。\n' +
          '\n这种惩罚与奖励的戏剧性反转，何尝不是图灵对后辈的一种“爱护”与“保护”呢？他仿佛以自己的牺牲，通过施加在性别认同上的影响，为后来的从业者开辟了一条独特的道路，使得她们再也无惧这种毫无人道的惩罚。' +
          '\n因此，当我们每一次打开电脑，每一次解锁手机，我们都应当回想起那位伟大的计算机科学家，不仅是为了他对计算机科学领域做出的贡献，也是为了他一直以来对该领域的后辈的无私保护，而从心中升起无限的敬意。', requiresRecording: true, recordingsNeeded: 1 },
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
  const [discardInfo, setDiscardInfo] = useState(false); // 放弃提示状态

  const [formData, setFormData] = useState({
    rbh: { R: null, B: null, H: null },
    ovhs9: Array(9).fill(null),
    tvqg: Array(12).fill(null),
  });

  const [analysisStatus, setAnalysisStatus] = useState('idle'); // idle, processing, done, failed
  const [analysisResults, setAnalysisResults] = useState(null);
  const pollingRef = useRef(null);
  const failedUploadRef = useRef(null);

  // Playback state
  const audioRef = useRef(null); // Ref to store the Audio object
  const [activePlayback, setActivePlayback] = useState({ blob: null, isPlaying: false, progress: 0, duration: 0 });

  const handleFormChange = (formName, values) => setFormData(prev => ({ ...prev, [formName]: values }));

  useEffect(() => {
    // IIFE to handle async session start
    (async () => {
      try {
        setIsLoading(true);
        const response = await createVoiceTestSession(user?.userId);
        setSessionId(response.sessionId);
        setError(null);
      } catch {
        setError('无法启动嗓音测试会话，请稍后重试。');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      clearInterval(pollingRef.current);
      cleanupAudio(); // Clean up audio player on component unmount
    };
  }, [user]);

  /**
   * @en Cleans up the audio player, pausing it and revoking the object URL.
   * @zh 清理音频播放器，暂停播放并释放对象URL。
   */
  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setActivePlayback({ blob: null, isPlaying: false, progress: 0, duration: 0 });
  };

  /**
   * @en Handles playback of recorded audio, including play, pause, and switching tracks.
   * @zh 处理录制音频的回放，包括播放、暂停和切换音轨。
   * @param {Blob} blob The audio blob to play.
   */
  const handlePlayback = (blob) => {
    if (audioRef.current && activePlayback.blob === blob) {
      if (activePlayback.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      }
    } else {
      cleanupAudio();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setActivePlayback(prev => ({ ...prev, isPlaying: true }));
      audio.onpause = () => setActivePlayback(prev => ({ ...prev, isPlaying: false }));
      audio.onended = () => setActivePlayback(prev => ({ ...prev, isPlaying: false, progress: 0 }));
      audio.ontimeupdate = () => setActivePlayback(prev => ({ ...prev, progress: audio.currentTime }));
      audio.onloadedmetadata = () => setActivePlayback(prev => ({ ...prev, duration: audio.duration }));

      audio.play().catch(e => console.error("Playback failed:", e));
      setActivePlayback({ blob, isPlaying: true, progress: 0, duration: 0 });
    }
  };

  /**
   * @en Handles seeking the audio to a new time.
   * @zh 处理音频跳转到新的时间点。
   * @param {React.ChangeEvent<HTMLInputElement>} e The input change event.
   */
  const handleSeek = (e) => {
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setActivePlayback(prev => ({ ...prev, progress: newTime }));
    }
  };

  /**
   * @en Restarts the entire test: creates a new session and clears all recorded data, form inputs, and analysis status.
   * @zh 重新开始整个测试：新建 session，清空所有已录制、表单与分析状态。
   */
  const handleRestartWizard = async () => {
    if (!window.confirm('确定要重新开始整个测试吗？\n此操作会新建会话并清空当前进度。')) return;
    cleanupAudio();
    try {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setIsLoading(true);
      const response = await createVoiceTestSession(user?.userId);
      setSessionId(response.sessionId);
      // 清空本地状态（确保所有相关状态都被复位）
      setCurrentStep(0);
      setRecordedBlobs({});
      setFormData({ rbh: { R: null, B: null, H: null }, ovhs9: Array(9).fill(null), tvqg: Array(12).fill(null) });
      setAnalysisStatus('idle');
      setAnalysisResults(null);
      failedUploadRef.current = null;
      setUploadError(null);
      setIsUploading(false);
      setDiscardInfo(false);
    } catch {
      alert('重新开始失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @en Callback for when recording is complete: gets an upload URL and uploads the file.
   * @zh 上传完成回调：负责获取上传 URL 并上传文件。
   */
  const handleRecordingComplete = async (blob) => {
    setIsUploading(true);
    setUploadError(null);
    setDiscardInfo(false); // 有新上传时清除放弃提示
    failedUploadRef.current = null; // 清除旧的失败记录
    const stepInfo = STEPS[currentStep];
    const recordingIndex = recordedBlobs[currentStep]?.length || 0; // 下一个序号
    const fileName = `${stepInfo.id}_${recordingIndex + 1}.wav`;
    try {
      const { putUrl, objectKey } = await getVoiceTestUploadUrl(sessionId, stepInfo.id, fileName, 'audio/wav');
      await uploadVoiceTestFileToS3(putUrl, blob);
      setRecordedBlobs(prev => ({ ...prev, [currentStep]: [...(prev[currentStep] || []), { blob, objectKey, fileName }] }));
    } catch (err) {
      console.error('[VoiceTestWizard] 上传失败:', err);
      setUploadError('上传失败，请点击下方“重试上传”。');
      failedUploadRef.current = { blob, stepId: stepInfo.id, fileName };
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * 当用户选择“停止录音且放弃”：不触发上传，不改变已完成计数，仅给出轻提示。
   */
  const handleDiscardRecording = () => {
    setDiscardInfo(true);
    // 2-3 秒后自动隐藏提示
    setTimeout(() => setDiscardInfo(false), 3000);
  };

  /**
   * @en Retries uploading the last failed recording.
   * @zh 重试上传：使用缓存的失败 blob 再次请求 presigned URL 上传。
   */
  const handleRetryUpload = async () => {
    if (!failedUploadRef.current) return;
    const { blob, stepId, fileName } = failedUploadRef.current;
    setIsUploading(true);
    setUploadError(null);
    try {
      const { putUrl, objectKey } = await getVoiceTestUploadUrl(sessionId, stepId, fileName, 'audio/wav');
      await uploadVoiceTestFileToS3(putUrl, blob);
      setRecordedBlobs(prev => ({ ...prev, [currentStep]: [...(prev[currentStep] || []), { blob, objectKey, fileName }] }));
      failedUploadRef.current = null;
    } catch (e) {
      console.error('[VoiceTestWizard] 重试上传仍失败:', e);
      setUploadError('重试上传仍失败，请检查网络或稍后再试。');
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * @en Triggers the backend analysis and starts polling for results.
   * @zh 触发后端分析，启动轮询。
   */
  const handleGenerateReport = async () => {
    setAnalysisStatus('processing');
    try {
      await requestVoiceTestAnalyze(sessionId, { hasExternal: false }, formData);
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
          console.error('[VoiceTestWizard] 轮询失败:', pollErr);
          setAnalysisStatus('failed');
          clearInterval(pollingRef.current);
        }
      }, 3000);
    } catch (err) {
      console.error('[VoiceTestWizard] 请求分析失败:', err);
      setAnalysisStatus('failed');
    }
  };

  /**
   * @en Retries the analysis if it failed.
   * @zh 分析失败或需要重新生成报告时的重试。
   */
  const handleRetryAnalysis = () => {
    if (!window.confirm('将重新发起分析，这可能再次消耗计算资源。继续吗？')) return;
    // 重新设为 idle 以触发重新生成按钮流转
    setAnalysisStatus('idle');
    setAnalysisResults(null);
  };

  const handleNext = () => {
    cleanupAudio();
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  }
  const handleBack = () => {
    cleanupAudio();
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }

  const renderStepContent = () => {
    const stepInfo = STEPS[currentStep];
    
    if (stepInfo.id === 8) { // 结果生成步骤
      switch (analysisStatus) {
        case 'idle':
          return (
            <div className="text-center space-y-4">
              <p className="mb-6">{stepInfo.instructions}</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <button onClick={handleGenerateReport} disabled={isUploading} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors">生成报告</button>
                <button onClick={handleRestartWizard} disabled={isUploading} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">重新开始测试</button>
              </div>
            </div>
          );
        case 'processing':
          return <div className="text-center space-y-4"><p>正在分析您的嗓音数据，请稍候... (这可能需要1-2分钟)</p><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" /></div>;
        case 'done':
          return (
            <div className="space-y-6">
              <TestResultsDisplay results={analysisResults} />
              <div className="flex flex-wrap gap-4 justify-center">
                <button onClick={handleRetryAnalysis} className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors">重新生成报告</button>
                <button onClick={handleRestartWizard} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">重新开始测试</button>
              </div>
            </div>
          );
        case 'failed':
          return (
            <div className="text-center space-y-4">
              <p className="text-red-600">分析失败，请重试。</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <button onClick={handleRetryAnalysis} className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">重试分析</button>
                <button onClick={handleRestartWizard} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors">重新开始测试</button>
              </div>
            </div>
          );
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
        <div className="text-center w-full">
          <p className="mb-4 text-gray-600 whitespace-pre-line">{stepInfo.instructions}</p>
          <div className="my-4 p-3 bg-gray-100 rounded-lg space-y-1">
            <p className="font-semibold">进度: {recordingsForStep.length} / {stepInfo.recordingsNeeded}</p>
            {stepInfo.recordingLabels && <p className="text-sm text-gray-500">当前录制: {stepInfo.recordingLabels[recordingsForStep.length] || '已完成'}</p>}
            {/* 辅助提示：放弃本段将回到本次开始前状态 */}
            <p className="text-xs text-gray-400">如说错或失误，可点击“停止录音且放弃”——本段不会计入进度。</p>
          </div>
          {discardInfo && <div className="my-3 p-2 bg-gray-50 text-gray-600 rounded text-sm">已放弃刚才的录音，本次不计入进度。</div>}
          {isUploading && <p className="my-4 text-blue-600">正在上传...</p>}
          {uploadError && <div className="my-4 p-3 bg-red-100 text-red-700 rounded-md space-y-2">
            <p>{uploadError}</p>
            {failedUploadRef.current && <button onClick={handleRetryUpload} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">重试上传</button>}
          </div>}
          {allRecordingsDone && !isUploading && !uploadError && <div className="my-4 p-3 bg-green-100 text-green-800 rounded-lg"><p>✅ 本步骤所有录音已完成。</p></div>}
          <div className="mt-4">
            <Recorder key={`${currentStep}-${recordingsForStep.length}`} onRecordingComplete={handleRecordingComplete} onDiscardRecording={handleDiscardRecording} isRecording={isUploading || allRecordingsDone} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {/* 已隐藏单步重置功能：强制用户使用重新开始测试，以避免旧文件仍存在导致的混淆 */}
            <button onClick={handleRestartWizard} disabled={isUploading} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">重新开始测试</button>
          </div>
          {recordingsForStep.length > 0 && (
            <div className="mt-8 text-left max-w-xl mx-auto">
              <h4 className="font-semibold mb-2 text-gray-700 text-sm">已录制文件（列表仅表示本地进度，后端暂不支持删除已上传文件）</h4>
              <ul className="space-y-2 max-h-60 overflow-auto pr-1 text-xs">
                {recordingsForStep.map((r, idx) => {
                  const isActive = activePlayback.blob === r.blob;
                  return (
                    <li key={idx} className="bg-white border border-gray-200 rounded px-3 py-2 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="truncate mr-2 font-medium">{r.fileName}</span>
                        <div className="flex items-center">
                          <button onClick={() => handlePlayback(r.blob)} className={`px-2 py-1 text-white rounded-md transition-colors text-xs ${isActive && activePlayback.isPlaying ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            {isActive && activePlayback.isPlaying ? '暂停' : '播放'}
                          </button>
                          <span className="text-gray-400 ml-2">#{idx + 1}</span>
                        </div>
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-2">
                          <input type="range" min="0" max={activePlayback.duration || 0} value={activePlayback.progress} onChange={handleSeek} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                          <span className="text-gray-500 text-xs">{new Date(activePlayback.progress * 1000).toISOString().substr(14, 5)}</span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
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
  let isStepComplete; // 去除冗余初始值
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
        <div className="flex justify-between items-center">
          <button 
            onClick={handleBack} 
            disabled={currentStep === 0 || analysisStatus === 'processing'} 
            className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
          >
            上一步
          </button>
          
          <div className="flex items-center gap-4">
            {currentStep === 7 && (
              <button 
                onClick={handleNext} 
                className="px-6 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                跳过
              </button>
            )}

            {currentStep < STEPS.length - 1 && (
              <button 
                onClick={handleNext} 
                disabled={!isStepComplete || isUploading} 
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors"
              >
                {currentStep === 7 ? '提交' : '下一步'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceTestWizard;
