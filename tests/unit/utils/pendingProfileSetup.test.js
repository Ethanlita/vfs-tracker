/** @file 离线资料草稿的账号隔离、迁移、校验和并发清理测试。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEGACY_PENDING_PROFILE_KEY,
  pendingProfileKey,
  profileBaseVersion,
  readPendingProfileSetup,
  removePendingProfileSetup,
  savePendingProfileSetup,
} from '../../../src/utils/pendingProfileSetup.js';

const payload = { profile: { name: '离线用户', bio: '', isNamePublic: false, socials: [], areSocialsPublic: false } };

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn((_key, action) => action()) } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('离线资料草稿', () => {
  it('按账号保存并读取完整草稿', async () => {
    const draft = await savePendingProfileSetup({
      ownerUserId: 'user-a', payload, baseVersion: { exists: false, updatedAt: null }, kind: 'complete', returnUrl: '/mypage',
    });
    expect(await readPendingProfileSetup('user-a')).toEqual(draft);
    expect(await readPendingProfileSetup('user-b')).toBeNull();
    expect(localStorage.getItem(pendingProfileKey('user-a'))).toContain('离线用户');
  });

  it('清理旧草稿ID不会删除另一标签页后来保存的草稿', async () => {
    const first = await savePendingProfileSetup({ ownerUserId: 'user-a', payload, baseVersion: { exists: false, updatedAt: null }, kind: 'complete', returnUrl: '/mypage' });
    const second = await savePendingProfileSetup({ ownerUserId: 'user-a', payload: { profile: { ...payload.profile, name: '更新草稿' } }, baseVersion: { exists: false, updatedAt: null }, kind: 'complete', returnUrl: '/mypage' });
    expect(await removePendingProfileSetup('user-a', first.draftId)).toBe(false);
    expect((await readPendingProfileSetup('user-a')).draftId).toBe(second.draftId);
    expect(await removePendingProfileSetup('user-a', second.draftId)).toBe(true);
    expect(await readPendingProfileSetup('user-a')).toBeNull();
  });

  it('迁移匹配账号的旧草稿并要求人工确认版本', async () => {
    localStorage.setItem(LEGACY_PENDING_PROFILE_KEY, JSON.stringify({ userId: 'user-a', payload, savedAt: 7 }));
    const draft = await readPendingProfileSetup('user-a');
    expect(draft).toMatchObject({ ownerUserId: 'user-a', baseVersion: null, savedAt: 7 });
    expect(localStorage.getItem(LEGACY_PENDING_PROFILE_KEY)).toBeNull();
  });

  it('不读取或迁移其他账号的旧草稿', async () => {
    const raw = JSON.stringify({ userId: 'user-a', payload, savedAt: 7 });
    localStorage.setItem(LEGACY_PENDING_PROFILE_KEY, raw);
    expect(await readPendingProfileSetup('user-b')).toBeNull();
    expect(localStorage.getItem(LEGACY_PENDING_PROFILE_KEY)).toBe(raw);
  });

  it('存储写入失败时抛错且不产生草稿', async () => {
    const original = localStorage;
    vi.stubGlobal('localStorage', { getItem: original.getItem.bind(original), setItem: vi.fn(() => { throw new DOMException('blocked', 'SecurityError'); }), removeItem: original.removeItem.bind(original) });
    await expect(savePendingProfileSetup({ ownerUserId: 'user-a', payload, baseVersion: { exists: false, updatedAt: null }, kind: 'complete', returnUrl: '/mypage' })).rejects.toThrow('无法安全更新离线资料草稿');
    expect(original.getItem(pendingProfileKey('user-a'))).toBeNull();
  });

  it('损坏JSON和无效结构不会被解释为空草稿', async () => {
    localStorage.setItem(pendingProfileKey('user-a'), '{broken');
    await expect(readPendingProfileSetup('user-a')).rejects.toThrow('无法读取离线资料草稿');
    localStorage.setItem(pendingProfileKey('user-a'), JSON.stringify({ ownerUserId: 'user-a' }));
    await expect(readPendingProfileSetup('user-a')).rejects.toThrow('格式不正确');
  });

  it('拒绝kind与互斥提交路径不一致的草稿并保留原文', async () => {
    const draft = await savePendingProfileSetup({
      ownerUserId: 'user-a', payload, baseVersion: { exists: false, updatedAt: null }, kind: 'complete', returnUrl: '/mypage',
    });
    const invalid = { ...draft, kind: 'skip' };
    const raw = JSON.stringify(invalid);
    localStorage.setItem(pendingProfileKey('user-a'), raw);
    await expect(readPendingProfileSetup('user-a')).rejects.toThrow('格式不正确');
    expect(localStorage.getItem(pendingProfileKey('user-a'))).toBe(raw);
  });

  it('从不存在、已有和损坏的服务端资料构造准确版本', () => {
    expect(profileBaseVersion({ exists: false })).toEqual({ exists: false, updatedAt: null });
    expect(profileBaseVersion({ exists: true, updatedAt: '2026-01-01T00:00:00.000Z' })).toEqual({ exists: true, updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(profileBaseVersion({ exists: true })).toEqual({ exists: true, updatedAt: null });
  });
});
