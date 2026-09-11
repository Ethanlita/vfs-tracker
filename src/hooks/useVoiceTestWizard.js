/** @file 嗓音测试编排：连接步骤 actor、会话草稿、上传、稿件、回放与分析服务。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createVoiceTestSession, getReadingPassages } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { ensureAppError } from '../utils/apiError.js';
import { useVoiceAnalysis } from './useVoiceAnalysis';
import { usePwaUpdateBlocker } from './usePwaUpdateBlocker.js';
import { useVoiceTestActor } from './useVoiceTestActor.js';
import { useVoiceTestUpload } from './useVoiceTestUpload.js';
import { getVoiceTestStep } from '../voice-test/voiceTestMachine.js';
import { VOICE_TEST_STEPS as STEPS, createEmptyVoiceTestForm as createEmptyFormData } from '../voice-test/voiceTestSteps.js';
import {
  VOICE_TEST_DRAFT_TTL_MS,
  readPendingVoiceRecording,
  readVoiceTestDraft,
  removePendingVoiceRecording,
  removeVoiceTestDraft,
  writeVoiceTestDraft,
} from '../utils/voiceTestDraft.js';

/**
 * 管理完整嗓音测试业务生命周期，并向纯展示组件提供稳定的视图模型。
 */
export function useVoiceTestWizard() {
  const { user } = useAuth();
  const ownerUserId = user?.userId || user?.attributes?.sub || null;
  /** 仅发布状态名和事件名，供开发工具与端到端测试观察关键路径。 */
  const observeTransition = useCallback(detail => {
    window.dispatchEvent(new CustomEvent('vfs:voice-test-transition', { detail }));
  }, []);
  const { state: wizardState, send: sendWizardEvent } = useVoiceTestActor(observeTransition);
  const currentStep = getVoiceTestStep(wizardState).id;
  /** 草稿恢复和跨步骤上传提醒均通过同一状态机入口跳转。 */
  const goToStep = useCallback(step => sendWizardEvent({ type: 'GO_TO', step }), [sendWizardEvent]);
  const [sessionId, setSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordedBlobs, setRecordedBlobs] = useState({});
  const [draftOwner, setDraftOwner] = useState(null);
  const [draftCreatedAt, setDraftCreatedAt] = useState(null);
  const [draftExpiresAt, setDraftExpiresAt] = useState(null);
  const [draftError, setDraftError] = useState(null);
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [analysisStarted, setAnalysisStarted] = useState(false);

  const [formData, setFormData] = useState(createEmptyFormData);
  const [readingPassages, setReadingPassages] = useState([]);
  const [readingPassageIndex, setReadingPassageIndex] = useState(0);
  const [readingPassageId, setReadingPassageId] = useState(null);
  const [readingPassagesLoading, setReadingPassagesLoading] = useState(false);
  const [readingPassagesError, setReadingPassagesError] = useState(null);

  const analysis = useVoiceAnalysis(sessionId);
  const {
    status: analysisStatus,
    cancel: cancelAnalysis,
    generate: generateAnalysis,
    reset: resetAnalysis,
    retryQuery: retryAnalysisQuery,
  } = analysis;
  const mountedRef = useRef(true);
  const ownerUserIdRef = useRef(ownerUserId);
  const sessionRequestRef = useRef(null);
  const resumedAnalysisRef = useRef(null);
  const readingPassagesRequestRef = useRef(null);
  const readingPassageIdRef = useRef(readingPassageId);
  ownerUserIdRef.current = ownerUserId;
  readingPassageIdRef.current = readingPassageId;

  const upload = useVoiceTestUpload({
    ownerUserId,
    sessionId,
    draftExpiresAt,
    setRecordedBlobs,
    setDraftError,
  });
  const {
    isUploading,
    uploadError,
    pendingRecording,
    discardInfo,
    record: uploadRecording,
    discardRecording: handleDiscardRecording,
    retryUpload: handleRetryUpload,
    discardFailedUpload,
    restorePendingRecording,
    resetUpload,
  } = upload;

  // 进入正式步骤后的录音、量表和上传进度不能被另一标签页的更新清空。
  usePwaUpdateBlocker(
    currentStep > 0 || Object.keys(recordedBlobs).length > 0 || isUploading || uploadError !== null,
    '嗓音测试进度'
  );

  // Playback state
  const audioRef = useRef(null); // Ref to store the Audio object
  const [activePlayback, setActivePlayback] = useState({ blob: null, isPlaying: false, progress: 0, duration: 0 });

  /** 清理播放器并释放对象 URL；卸载、切步和会话到期共用同一路径。 */
  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setActivePlayback({ blob: null, isPlaying: false, progress: 0, duration: 0 });
  }, []);

  const handleFormChange = (formName, values) => setFormData(prev => ({ ...prev, [formName]: values }));

  /** 切换到下一篇启用稿件，并同步记录稳定标识供刷新后恢复。 */
  const handleChangeReadingPassage = useCallback(() => {
    if (readingPassages.length < 2) return;
    const nextIndex = (readingPassageIndex + 1) % readingPassages.length;
    setReadingPassageIndex(nextIndex);
    setReadingPassageId(readingPassages[nextIndex].passageId);
  }, [readingPassageIndex, readingPassages]);

  /** 从唯一后端稿件库读取当前启用内容。 */
  const loadReadingPassages = useCallback(async () => {
    // StrictMode effect 重放和重复点击共用同一个在途读取。
    if (readingPassagesRequestRef.current) return readingPassagesRequestRef.current;
    setReadingPassagesLoading(true);
    setReadingPassagesError(null);
    const request = (async () => {
      try {
        const passages = await getReadingPassages();
        if (!Array.isArray(passages) || passages.length === 0 || passages.some(passage => !passage?.passageId || !passage.title || !passage.author || !passage.content)) {
          throw new Error('朗读稿件响应格式不正确');
        }
        setReadingPassages(passages);
        const restoredIndex = passages.findIndex(passage => passage.passageId === readingPassageIdRef.current);
        const nextIndex = restoredIndex >= 0 ? restoredIndex : 0;
        setReadingPassageIndex(nextIndex);
        setReadingPassageId(passages[nextIndex].passageId);
      } catch (loadError) {
        setReadingPassages([]);
        setReadingPassagesError(loadError);
      } finally {
        setReadingPassagesLoading(false);
        readingPassagesRequestRef.current = null;
      }
    })();
    readingPassagesRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (currentStep === 5 && !readingPassagesLoading && !readingPassagesError && readingPassages.length === 0) {
      loadReadingPassages();
    }
  }, [currentStep, loadReadingPassages, readingPassages.length, readingPassagesError, readingPassagesLoading]);

  const initializeSession = useCallback(async ({ forceNew = false } = {}) => {
    if (!ownerUserId) return;
    const requestedOwner = ownerUserId;
    try {
      setIsLoading(true);
      let request = sessionRequestRef.current;
      if (forceNew || request?.ownerUserId !== requestedOwner) {
        request = { ownerUserId: requestedOwner, promise: createVoiceTestSession(requestedOwner) };
        sessionRequestRef.current = request;
      }
      // 同一组件的 StrictMode effect 重放共用请求；组件销毁后不会留下永久悬挂的全局缓存。
      const response = await request.promise;
      if (!mountedRef.current || ownerUserIdRef.current !== requestedOwner) return;
      const createdAt = Date.now();
      setSessionId(response.sessionId);
      setDraftOwner(ownerUserId);
      setDraftCreatedAt(createdAt);
      setDraftExpiresAt(createdAt + VOICE_TEST_DRAFT_TTL_MS);
      setError(null);
    } catch (err) {
      if (!mountedRef.current || ownerUserIdRef.current !== requestedOwner) return;
      if (sessionRequestRef.current?.ownerUserId === requestedOwner) sessionRequestRef.current = null;
      setError(ensureAppError(err, {
        message: '无法启动嗓音测试会话，请稍后重试。',
        requestMethod: 'POST',
        requestPath: '/sessions'
      }));
    } finally {
      if (mountedRef.current && ownerUserIdRef.current === requestedOwner) setIsLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!ownerUserId) return undefined;

    let cancelled = false;
    const restoreOrCreate = async () => {
      setIsLoading(true);
      setDraftOwner(null);
      setDraftError(null);
      setRecoveryNotice('');
      setError(null);
      goToStep(0);
      setSessionId(null);
      setRecordedBlobs({});
      setReadingPassageIndex(0);
      setReadingPassageId(null);
      setFormData(createEmptyFormData());
      resetUpload();
      setAnalysisStarted(false);
      resumedAnalysisRef.current = null;
      cancelAnalysis();

      const stored = readVoiceTestDraft(ownerUserId);
      if (stored.status === 'valid') {
        const draft = stored.draft;
        setSessionId(draft.sessionId);
        goToStep(Math.max(0, Math.min(draft.currentStep, STEPS.length - 1)));
        setRecordedBlobs(Object.fromEntries(Object.entries(draft.uploadedRecordings).map(([step, items]) => [
          step,
          items.map(item => ({ ...item, blob: null, restored: true })),
        ])));
        setReadingPassageId(draft.readingPassageId);
        setFormData(draft.formData);
        setAnalysisStarted(draft.analysisStarted);
        setDraftCreatedAt(draft.createdAt);
        setDraftExpiresAt(draft.expiresAt);
        setDraftOwner(ownerUserId);
        setRecoveryNotice('已恢复上一次未完成的嗓音测试。已上传片段可继续使用，本地试听副本不会长期保留。');
        try {
          const pending = await readPendingVoiceRecording(ownerUserId, draft.sessionId);
          if (!cancelled && pending) {
            restorePendingRecording(pending);
          }
        } catch {
          if (!cancelled) setDraftError('无法读取临时录音存储。已上传进度仍已恢复；未上传片段可能需要重新录制。');
        }
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (stored.status === 'expired') {
        setRecoveryNotice('上一次测试已超过 60 分钟并清理，本次将使用新会话。');
      } else if (stored.status === 'invalid') {
        setRecoveryNotice('上一次测试草稿已损坏并清理，本次将使用新会话。');
      } else if (stored.status === 'unavailable') {
        setDraftError('浏览器拒绝访问测试草稿存储，当前进度无法安全恢复。');
      }
      // 没有可恢复元数据时，任何账号同名原始录音都是孤儿；立即清理，避免只剩 IndexedDB 音频长期驻留。
      try {
        await removePendingVoiceRecording(ownerUserId);
      } catch {
        if (!cancelled) setDraftError('无法清理过期或孤立的临时录音，请关闭其他本站标签页后重试。');
      }
      if (!cancelled) await initializeSession();
    };
    restoreOrCreate();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      resetUpload();
      cleanupAudio(); // Clean up audio player on component unmount
    };
  }, [cancelAnalysis, cleanupAudio, goToStep, initializeSession, ownerUserId, resetUpload, restorePendingRecording]);

  /**
   * @en Cleans up the audio player, pausing it and revoking the object URL.
   * @zh 清理音频播放器，暂停播放并释放对象URL。
   */
  // 页面持续打开跨过固定期限时也立即清理，不能只依赖下次刷新时的惰性过期检查。
  useEffect(() => {
    if (!draftExpiresAt || draftOwner !== ownerUserId) return undefined;
    const expiringOwner = draftOwner;
    const expireCurrentDraft = async () => {
      if (!mountedRef.current || ownerUserIdRef.current !== expiringOwner) return;
      resetUpload();
      cancelAnalysis();
      cleanupAudio();
      try {
        removeVoiceTestDraft(expiringOwner);
        await removePendingVoiceRecording(expiringOwner);
      } catch {
        if (ownerUserIdRef.current === expiringOwner) {
          setDraftError('测试已到期，但临时录音清理失败。请关闭其他本站标签页后重试。');
        }
      }
      if (!mountedRef.current || ownerUserIdRef.current !== expiringOwner) return;
      setSessionId(null);
      setDraftOwner(null);
      setDraftCreatedAt(null);
      setDraftExpiresAt(null);
      goToStep(0);
      setRecordedBlobs({});
      setReadingPassageIndex(0);
      setReadingPassageId(null);
      setFormData(createEmptyFormData());
      setAnalysisStarted(false);
      resumedAnalysisRef.current = null;
      resetAnalysis();
      setRecoveryNotice('测试会话已达到 60 分钟期限并清理，本次将使用新会话。');
      await initializeSession({ forceNew: true });
    };
    const remaining = draftExpiresAt - Date.now();
    if (remaining <= 0) {
      void expireCurrentDraft();
      return undefined;
    }
    const timer = window.setTimeout(() => { void expireCurrentDraft(); }, remaining);
    return () => window.clearTimeout(timer);
  }, [cancelAnalysis, cleanupAudio, draftExpiresAt, draftOwner, goToStep, initializeSession, ownerUserId, resetAnalysis, resetUpload]);

  // 草稿只保存服务端对象信息和量表，不把已经上传的原始 Blob 写入 localStorage。
  useEffect(() => {
    if (!sessionId || draftOwner !== ownerUserId || !draftCreatedAt || !draftExpiresAt) return;
    try {
      writeVoiceTestDraft(ownerUserId, {
        ownerUserId,
        sessionId,
        currentStep,
        uploadedRecordings: recordedBlobs,
        readingPassageId,
        formData,
        analysisStarted,
        createdAt: draftCreatedAt,
        expiresAt: draftExpiresAt,
      });
    } catch {
      setDraftError('测试草稿保存失败。请保持当前页面打开，或释放浏览器存储空间后继续。');
    }
  }, [analysisStarted, currentStep, draftCreatedAt, draftExpiresAt, draftOwner, formData, ownerUserId, readingPassageId, recordedBlobs, sessionId]);

  // 已提交分析的恢复会话只继续查询原任务，不再调用分析提交接口。
  useEffect(() => {
    if (!analysisStarted || currentStep !== 8 || !sessionId || draftOwner !== ownerUserId) return;
    if (resumedAnalysisRef.current === sessionId) return;
    resumedAnalysisRef.current = sessionId;
    retryAnalysisQuery();
  }, [analysisStarted, currentStep, draftOwner, ownerUserId, retryAnalysisQuery, sessionId]);

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
        audioRef.current.play().catch(() => undefined);
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

      audio.play().catch(() => undefined);
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
    if (isUploading) return;
    if (!window.confirm('确定要重新开始整个测试吗？\n此操作会新建会话并清空当前进度。')) return;
    const restartOwner = ownerUserId;
    cleanupAudio();
    try {
      cancelAnalysis();
      setIsLoading(true);
      // 用户已经明确放弃旧进度；先清掉敏感本地副本，避免新会话创建成功后因清理失败产生孤儿会话。
      await removePendingVoiceRecording(restartOwner);
      removeVoiceTestDraft(restartOwner);
      resetUpload();
      const response = await createVoiceTestSession(restartOwner);
      if (!mountedRef.current || ownerUserIdRef.current !== restartOwner) return;
      const createdAt = Date.now();
      setSessionId(response.sessionId);
      setDraftOwner(restartOwner);
      setDraftCreatedAt(createdAt);
      setDraftExpiresAt(createdAt + VOICE_TEST_DRAFT_TTL_MS);
      // 清空本地状态（确保所有相关状态都被复位）
      goToStep(0);
      setRecordedBlobs({});
      setReadingPassageIndex(0);
      setReadingPassageId(null);
      setFormData(createEmptyFormData());
      setAnalysisStarted(false);
      resumedAnalysisRef.current = null;
      resetAnalysis();
      setDraftError(null);
      setRecoveryNotice('已放弃旧进度并开始新的嗓音测试。');
    } catch (err) {
      if (!mountedRef.current || ownerUserIdRef.current !== restartOwner) return;
      setError(ensureAppError(err, {
        message: '重新开始失败，请稍后再试。',
        requestMethod: 'POST',
        requestPath: '/sessions'
      }));
    } finally {
      if (mountedRef.current && ownerUserIdRef.current === restartOwner) setIsLoading(false);
    }
  };

  /** 保存新录音的步骤快照；未处理的失败片段不能被另一段录音覆盖。 */
  const handleRecordingComplete = (blob) => {
    const stepInfo = STEPS[currentStep];
    const recordingIndex = recordedBlobs[stepInfo.id]?.length || 0;
    return uploadRecording(blob, stepInfo, recordingIndex);
  };

  /**
   * @en Triggers the backend analysis and starts polling for results.
   * @zh 触发后端分析，启动轮询。
   */
  const handleGenerateReport = () => {
    setAnalysisStarted(true);
    resumedAnalysisRef.current = sessionId;
    generateAnalysis(formData);
  };

  /**
   * @en Retries the analysis if it failed.
   * @zh 分析失败或需要重新生成报告时的重试。
   */
  const handleRetryAnalysis = () => {
    if (!window.confirm('将重新发起分析，这可能再次消耗计算资源。继续吗？')) return;
    // 重新设为 idle 以触发重新生成按钮流转
    setAnalysisStarted(false);
    resumedAnalysisRef.current = null;
    resetAnalysis();
  };

  const handleNext = () => {
    cleanupAudio();
    sendWizardEvent({ type: 'NEXT', complete: true });
  }
  const handleBack = () => {
    cleanupAudio();
    sendWizardEvent('BACK');
  }

  /** 问卷跳过使用显式状态机事件，便于观察与测试。 */
  const handleSkip = () => {
    cleanupAudio();
    sendWizardEvent('SKIP');
  };

  const isFormsComplete = () => {
    const { rbh, ovhs9, tvqg } = formData;
    return Object.values(rbh).every(v => v !== null) && ovhs9.every(v => v !== null) && tvqg.every(v => v !== null);
  };

  const stepInfo = STEPS[currentStep];
  let isStepComplete; // 去除冗余初始值
  if (stepInfo.id === 7) isStepComplete = isFormsComplete();
  else if (stepInfo.requiresRecording) isStepComplete = (recordedBlobs[currentStep] || []).length >= (stepInfo.recordingsNeeded || 0);
  else isStepComplete = true;

  const stepContentModel = {
    step: stepInfo,
    recordings: recordedBlobs[currentStep] || [],
    formData,
    analysis,
    reading: {
      currentPassage: readingPassages[readingPassageIndex] || null,
      count: readingPassages.length,
      loading: readingPassagesLoading,
      error: readingPassagesError,
      onRetry: loadReadingPassages,
      onChange: handleChangeReadingPassage,
    },
    upload: {
      isUploading,
      error: uploadError,
      pendingRecording,
      discardInfo,
      onRetry: handleRetryUpload,
      onDiscardFailed: discardFailedUpload,
      onDiscardRecording: handleDiscardRecording,
    },
    playback: { active: activePlayback, onToggle: handlePlayback, onSeek: handleSeek },
    onFormChange: handleFormChange,
    onRecordingComplete: handleRecordingComplete,
    onGenerate: handleGenerateReport,
    onRetryAnalysis: handleRetryAnalysis,
    onRestart: handleRestartWizard,
    onGoToPending: pendingStep => { cleanupAudio(); goToStep(pendingStep); },
  };

  return {
    isLoading,
    error,
    retryInitialization: initializeSession,
    draftError,
    recoveryNotice,
    dismissRecovery: () => setRecoveryNotice(''),
    isUploading,
    currentStep,
    analysisStatus,
    isStepComplete,
    stepContentModel,
    onBack: handleBack,
    onNext: handleNext,
    onSkip: handleSkip,
    onRestart: handleRestartWizard,
  };
}
