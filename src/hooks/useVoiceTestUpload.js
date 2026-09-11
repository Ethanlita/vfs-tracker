/** @file 嗓音测试录音上传服务：持久化、上传、重试、放弃及请求所有权隔离。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getVoiceTestUploadUrl, uploadVoiceTestFileToS3 } from '../api';
import { ensureAppError } from '../utils/apiError.js';
import { removePendingVoiceRecording, savePendingVoiceRecording } from '../utils/voiceTestDraft.js';

/**
 * 管理单个嗓音测试会话的上传生命周期。
 * @param {object} options 服务依赖与当前会话快照。
 */
export function useVoiceTestUpload({
  ownerUserId,
  sessionId,
  draftExpiresAt,
  setRecordedBlobs,
  setDraftError,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [pendingRecording, setPendingRecording] = useState(null);
  const [discardInfo, setDiscardInfo] = useState(false);
  const activeUploadRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionIdRef = useRef(sessionId);
  const discardTimerRef = useRef(null);
  sessionIdRef.current = sessionId;

  useEffect(() => () => {
    mountedRef.current = false;
    activeUploadRef.current = null;
    window.clearTimeout(discardTimerRef.current);
  }, []);

  /** 取消发布旧上传的结果并清空上传界面状态。 */
  const resetUpload = useCallback(() => {
    activeUploadRef.current = null;
    setIsUploading(false);
    setUploadError(null);
    setPendingRecording(null);
    setDiscardInfo(false);
    window.clearTimeout(discardTimerRef.current);
  }, []);

  /** 把草稿存储中发现的原始片段接回唯一重试入口。 */
  const restorePendingRecording = useCallback(recording => {
    setPendingRecording(recording);
    setUploadError(ensureAppError(new Error('发现尚未完成上传的录音片段。'), {
      message: '发现尚未完成上传的录音片段，请重试上传或明确放弃。',
    }));
  }, []);

  /** 首次上传与重试共享此函数，迟到响应不能写入另一个会话。 */
  const uploadRecording = useCallback(async recording => {
    if (activeUploadRef.current || recording.sessionId !== sessionIdRef.current) return;
    activeUploadRef.current = recording;
    setPendingRecording(recording);
    const { blob, sessionId: recordingSession, stepId, fileName } = recording;
    const isCurrent = () => mountedRef.current
      && activeUploadRef.current === recording
      && sessionIdRef.current === recordingSession;
    setIsUploading(true);
    setUploadError(null);
    setDiscardInfo(false);
    let requestMethod = 'POST';
    let requestPath = '/uploads';
    try {
      // 原始音频先写入带固定过期时间的 IndexedDB，再沿唯一上传路径发送。
      requestMethod = 'LOCAL';
      requestPath = '/local-recording';
      await savePendingVoiceRecording(ownerUserId, recording, draftExpiresAt);
      if (!isCurrent()) return;
      setDraftError(null);
      requestMethod = 'POST';
      requestPath = '/uploads';
      const { putUrl, objectKey } = await getVoiceTestUploadUrl(recordingSession, stepId, fileName, 'audio/wav');
      if (!isCurrent()) return;
      requestMethod = 'PUT';
      requestPath = putUrl;
      await uploadVoiceTestFileToS3(putUrl, blob);
      if (!isCurrent()) return;
      setRecordedBlobs(previous => {
        const existing = previous[stepId] || [];
        if (existing.some(item => item.fileName === fileName)) return previous;
        return { ...previous, [stepId]: [...existing, { blob, objectKey, fileName }] };
      });
      setPendingRecording(null);
      try {
        await removePendingVoiceRecording(ownerUserId);
      } catch {
        setDraftError('录音已上传，但临时本地副本暂时无法清理；它会在 60 分钟有效期后失效。');
      }
    } catch (cause) {
      if (!isCurrent()) return;
      setUploadError(ensureAppError(cause, {
        message: requestPath === '/local-recording'
          ? '无法安全保存待上传录音，请释放浏览器存储空间后重试或明确放弃。'
          : requestMethod === 'PUT' ? '上传失败，请点击下方“重试上传”。' : '获取上传地址失败，请稍后重试。',
        requestMethod,
        requestPath,
      }));
    } finally {
      if (activeUploadRef.current === recording) {
        activeUploadRef.current = null;
        if (mountedRef.current) setIsUploading(false);
      }
    }
  }, [draftExpiresAt, ownerUserId, setDraftError, setRecordedBlobs]);

  /** 按录音所属步骤和已有成功文件数创建稳定文件名。 */
  const record = useCallback((blob, stepInfo, recordingCount) => {
    if (activeUploadRef.current || pendingRecording || !sessionId) return;
    if (recordingCount >= (stepInfo.recordingsNeeded || 0)) return;
    return uploadRecording({
      blob,
      sessionId,
      stepId: stepInfo.id,
      fileName: `${stepInfo.id}_${recordingCount + 1}.wav`,
    });
  }, [pendingRecording, sessionId, uploadRecording]);

  /** 放弃刚录制但尚未进入上传流程的片段，只显示短暂确认。 */
  const discardRecording = useCallback(() => {
    setDiscardInfo(true);
    window.clearTimeout(discardTimerRef.current);
    discardTimerRef.current = window.setTimeout(() => setDiscardInfo(false), 3000);
  }, []);

  const retryUpload = useCallback(
    () => pendingRecording ? uploadRecording(pendingRecording) : undefined,
    [pendingRecording, uploadRecording]
  );

  /** 明确放弃失败片段，不修改任何已成功上传记录。 */
  const discardFailedUpload = useCallback(async () => {
    if (activeUploadRef.current) return;
    try {
      await removePendingVoiceRecording(ownerUserId);
      setPendingRecording(null);
      setUploadError(null);
    } catch {
      setDraftError('无法清理临时录音，请关闭其他本站标签页后重试。');
    }
  }, [ownerUserId, setDraftError]);

  // 只有尚未确认持久化的原始录音需要浏览器原生离页保护。
  useEffect(() => {
    if (!isUploading && !uploadError) return undefined;
    const warnBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isUploading, uploadError]);

  return {
    isUploading,
    uploadError,
    pendingRecording,
    discardInfo,
    record,
    discardRecording,
    retryUpload,
    discardFailedUpload,
    restorePendingRecording,
    resetUpload,
  };
}
