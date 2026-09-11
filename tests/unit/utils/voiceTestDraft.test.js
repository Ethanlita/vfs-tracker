import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readVoiceTestDraft,
  removeVoiceTestDraft,
  voiceTestDraftKey,
  writeVoiceTestDraft,
} from '../../../src/utils/voiceTestDraft.js';

const owner = 'account/a';
const makeDraft = () => ({
  ownerUserId: owner,
  sessionId: 'session-a',
  currentStep: 3,
  uploadedRecordings: {
    1: [{ objectKey: 'private/object.wav', fileName: '1_1.wav', blob: new Blob(['sensitive']) }],
  },
  readingPassageId: 'passage-spring',
  formData: { rbh: { R: 1, B: 2, H: 3 }, ovhs9: Array(9).fill(2), tvqg: Array(12).fill(3) },
  analysisStarted: false,
  createdAt: 100,
  expiresAt: 10_000,
});

describe('嗓音测试草稿协议', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('按账号保存恢复且不序列化原始录音', () => {
    writeVoiceTestDraft(owner, makeDraft());
    const raw = localStorage.getItem(voiceTestDraftKey(owner));
    const result = readVoiceTestDraft(owner, 500);

    expect(raw).not.toContain('sensitive');
    expect(result.status).toBe('valid');
    expect(result.draft.uploadedRecordings[1]).toEqual([
      { objectKey: 'private/object.wav', fileName: '1_1.wav' },
    ]);
    expect(result.draft.readingPassageId).toBe('passage-spring');
    expect(readVoiceTestDraft('other-account', 500).status).toBe('missing');
  });

  it('过期草稿被清理且不能恢复', () => {
    writeVoiceTestDraft(owner, makeDraft());
    expect(readVoiceTestDraft(owner, 10_000).status).toBe('expired');
    expect(localStorage.getItem(voiceTestDraftKey(owner))).toBeNull();
  });

  it('损坏草稿被清理并明确返回 invalid', () => {
    localStorage.setItem(voiceTestDraftKey(owner), '{bad-json');
    expect(readVoiceTestDraft(owner).status).toBe('invalid');
    expect(localStorage.getItem(voiceTestDraftKey(owner))).toBeNull();
  });

  it('拒绝步骤越界或量表结构不完整的草稿', () => {
    localStorage.setItem(voiceTestDraftKey(owner), JSON.stringify({
      ...makeDraft(), version: 1, currentStep: 99, formData: { rbh: {}, ovhs9: [], tvqg: [] },
    }));

    expect(readVoiceTestDraft(owner).status).toBe('invalid');
  });

  it('兼容没有稿件标识的旧草稿', () => {
    const draft = makeDraft();
    delete draft.readingPassageId;
    localStorage.setItem(voiceTestDraftKey(owner), JSON.stringify({ ...draft, version: 1 }));

    const result = readVoiceTestDraft(owner, 500);

    expect(result.status).toBe('valid');
    expect(result.draft.readingPassageId).toBeNull();
  });

  it('存储不可用时不冒充空草稿', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(readVoiceTestDraft(owner).status).toBe('unavailable');
  });

  it('删除只影响指定账号', () => {
    writeVoiceTestDraft(owner, makeDraft());
    writeVoiceTestDraft('other', { ...makeDraft(), ownerUserId: 'other' });
    removeVoiceTestDraft(owner);
    expect(readVoiceTestDraft(owner).status).toBe('missing');
    expect(readVoiceTestDraft('other', 500).status).toBe('valid');
  });
});
