/** @file 嗓音测试草稿的账号隔离、有效期和临时录音存储协议。 */

export const VOICE_TEST_DRAFT_VERSION = 1;
export const VOICE_TEST_DRAFT_TTL_MS = 60 * 60 * 1000;
const DRAFT_PREFIX = 'voiceTestDraft:v1:';
const RECORDING_DB = 'vfs-voice-test-drafts-v1';
const RECORDING_STORE = 'failed-recordings';
const MAX_STEP = 8;

/** 将稿件标识限制为可持久化字符串；旧版草稿没有该字段时保持兼容。 */
const normalizeReadingPassageId = readingPassageId => (
  typeof readingPassageId === 'string' && readingPassageId.trim().length > 0
    ? readingPassageId.trim()
    : null
);

/** 返回账号专属的草稿键，避免不同登录账号共享测试状态。 */
export const voiceTestDraftKey = ownerUserId => `${DRAFT_PREFIX}${encodeURIComponent(ownerUserId)}`;

/** 将已上传记录限制为恢复流程需要的非音频字段。 */
const normalizeUploads = uploadedRecordings => {
  const result = {};
  for (const [step, recordings] of Object.entries(uploadedRecordings || {})) {
    if (!Array.isArray(recordings)) continue;
    const safe = recordings
      .filter(item => item && typeof item.objectKey === 'string' && typeof item.fileName === 'string')
      .map(item => ({ objectKey: item.objectKey, fileName: item.fileName }));
    if (safe.length) result[step] = safe;
  }
  return result;
};

/** 校验量表结构，避免损坏草稿把向导恢复到无法继续的状态。 */
const normalizeFormData = formData => {
  const validAnswer = value => value === null || Number.isFinite(value);
  const rbh = formData?.rbh;
  const ovhs9 = formData?.ovhs9;
  const tvqg = formData?.tvqg;
  if (!rbh || !['R', 'B', 'H'].every(key => validAnswer(rbh[key]))) return null;
  if (!Array.isArray(ovhs9) || ovhs9.length !== 9 || !ovhs9.every(validAnswer)) return null;
  if (!Array.isArray(tvqg) || tvqg.length !== 12 || !tvqg.every(validAnswer)) return null;
  return { rbh: { R: rbh.R, B: rbh.B, H: rbh.H }, ovhs9: [...ovhs9], tvqg: [...tvqg] };
};

/** 校验并读取账号草稿；过期或损坏数据会立即清理，不能冒充可恢复进度。 */
export function readVoiceTestDraft(ownerUserId, now = Date.now()) {
  if (!ownerUserId) return { status: 'missing', draft: null };
  const key = voiceTestDraftKey(ownerUserId);
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    return { status: 'unavailable', draft: null, error };
  }
  if (!raw) return { status: 'missing', draft: null };
  try {
    const parsed = JSON.parse(raw);
    const formData = normalizeFormData(parsed?.formData);
    const valid = parsed?.version === VOICE_TEST_DRAFT_VERSION
      && parsed.ownerUserId === ownerUserId
      && typeof parsed.sessionId === 'string' && parsed.sessionId.length > 0
      && Number.isInteger(parsed.currentStep) && parsed.currentStep >= 0 && parsed.currentStep <= MAX_STEP
      && Number.isFinite(parsed.createdAt)
      && Number.isFinite(parsed.expiresAt)
      && parsed.expiresAt > parsed.createdAt
      && formData;
    if (!valid) {
      localStorage.removeItem(key);
      return { status: 'invalid', draft: null };
    }
    if (parsed.expiresAt <= now) {
      localStorage.removeItem(key);
      return { status: 'expired', draft: null };
    }
    return {
      status: 'valid',
      draft: {
        ...parsed,
        readingPassageId: normalizeReadingPassageId(parsed.readingPassageId),
        formData,
        uploadedRecordings: normalizeUploads(parsed.uploadedRecordings),
      },
    };
  } catch (error) {
    try { localStorage.removeItem(key); } catch {
      // 原始读取错误已经足够说明存储不可用。
    }
    return { status: 'invalid', draft: null, error };
  }
}

/** 写入不含原始音频的测试草稿，并保持会话创建时确定的固定过期时间。 */
export function writeVoiceTestDraft(ownerUserId, draft) {
  const formData = normalizeFormData(draft?.formData);
  if (!ownerUserId || draft?.ownerUserId !== ownerUserId || typeof draft.sessionId !== 'string'
    || !Number.isInteger(draft.currentStep) || draft.currentStep < 0 || draft.currentStep > MAX_STEP
    || !Number.isFinite(draft.createdAt) || !Number.isFinite(draft.expiresAt)
    || draft.expiresAt <= draft.createdAt || !formData) {
    throw new TypeError('Voice test draft owner and session are required');
  }
  const safeDraft = {
    version: VOICE_TEST_DRAFT_VERSION,
    ownerUserId,
    sessionId: draft.sessionId,
    currentStep: draft.currentStep,
    uploadedRecordings: normalizeUploads(draft.uploadedRecordings),
    readingPassageId: normalizeReadingPassageId(draft.readingPassageId),
    formData,
    analysisStarted: draft.analysisStarted === true,
    createdAt: draft.createdAt,
    expiresAt: draft.expiresAt,
    updatedAt: Date.now(),
  };
  localStorage.setItem(voiceTestDraftKey(ownerUserId), JSON.stringify(safeDraft));
  return safeDraft;
}

/** 删除账号草稿；由重新开始或完成敏感数据清理时调用。 */
export function removeVoiceTestDraft(ownerUserId) {
  if (ownerUserId) localStorage.removeItem(voiceTestDraftKey(ownerUserId));
}

/** 打开只保存单个待上传录音的 IndexedDB。 */
const openRecordingDb = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('IndexedDB is unavailable'));
    return;
  }
  const request = indexedDB.open(RECORDING_DB, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(RECORDING_STORE)) {
      request.result.createObjectStore(RECORDING_STORE, { keyPath: 'ownerUserId' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Unable to open recording storage'));
});

/** 执行一次 IndexedDB 请求并确保数据库连接关闭。 */
const runRecordingRequest = async (mode, operation) => {
  const db = await openRecordingDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(RECORDING_STORE, mode);
      const request = operation(transaction.objectStore(RECORDING_STORE));
      let requestResult;
      let settled = false;
      request.onsuccess = () => { requestResult = request.result; };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(request.error || new Error('Recording storage request failed'));
        }
      };
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(requestResult);
        }
      };
      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error || new Error('Recording storage transaction aborted'));
        }
      };
    });
  } finally {
    db.close();
  }
};

/** 在上传开始前保存原始片段；每个账号最多保留一个失败或在途片段。 */
export function savePendingVoiceRecording(ownerUserId, recording, expiresAt) {
  if (!ownerUserId || !(recording?.blob instanceof Blob)) {
    return Promise.reject(new TypeError('Pending recording owner and Blob are required'));
  }
  return runRecordingRequest('readwrite', store => store.put({
    ownerUserId,
    sessionId: recording.sessionId,
    stepId: recording.stepId,
    fileName: recording.fileName,
    blob: recording.blob,
    expiresAt,
  }));
}

/** 读取仍在有效期内且属于当前账号及会话的待上传片段。 */
export async function readPendingVoiceRecording(ownerUserId, sessionId, now = Date.now()) {
  if (!ownerUserId) return null;
  const record = await runRecordingRequest('readonly', store => store.get(ownerUserId));
  if (!record) return null;
  if (record.expiresAt <= now || record.sessionId !== sessionId || !(record.blob instanceof Blob)) {
    await removePendingVoiceRecording(ownerUserId);
    return null;
  }
  return record;
}

/** 删除账号的临时原始录音。 */
export function removePendingVoiceRecording(ownerUserId) {
  if (!ownerUserId || !globalThis.indexedDB) return Promise.resolve();
  return runRecordingRequest('readwrite', store => store.delete(ownerUserId));
}
