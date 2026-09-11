/** @file AuthContext 离线资料自动同步、冲突停止与明确覆盖集成测试。 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession, fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { AuthProvider, useAuth } from '../../../src/contexts/AuthContext.jsx';

const mocks = vi.hoisted(() => ({
  authenticator: vi.fn(),
  getProfile: vi.fn(),
  setupProfile: vi.fn(),
  readDraft: vi.fn(),
  removeDraft: vi.fn(),
  draft: null,
}));

vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: () => mocks.authenticator(),
}));
vi.mock('../../../src/api.js', () => ({
  getUserProfile: mocks.getProfile,
  setupUserProfile: mocks.setupProfile,
  updateUserProfile: vi.fn(),
  isUserProfileComplete: profile => Boolean(profile?.profile?.name || profile?.profile?.setupSkipped),
}));
vi.mock('../../../src/utils/pendingProfileSetup.js', () => ({
  PENDING_PROFILE_EVENT: 'pending-profile-setup-updated',
  profileBaseVersion: profile => {
    const exists = profile?.exists === true || Boolean(profile?.profile || profile?.updatedAt);
    return { exists, updatedAt: exists ? (profile?.updatedAt || null) : null };
  },
  readPendingProfileSetup: mocks.readDraft,
  removePendingProfileSetup: mocks.removeDraft,
}));

const owner = 'us-east-1:offline-profile-owner';
const initialProfile = {
  exists: true,
  userId: owner,
  updatedAt: '2026-01-01T00:00:00.000Z',
  profile: { name: '', isNamePublic: false, areSocialsPublic: false },
};
const draft = {
  version: 2,
  draftId: '00000000-0000-4000-8000-000000000105',
  ownerUserId: owner,
  payload: { profile: { name: '离线资料', bio: '', isNamePublic: false, socials: [], areSocialsPublic: false } },
  baseVersion: { exists: true, updatedAt: initialProfile.updatedAt },
  kind: 'complete',
  savedAt: 1,
  returnUrl: '/mypage',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.draft = { ...draft };
  mocks.authenticator.mockReturnValue({
    authStatus: 'authenticated',
    user: { userId: owner, username: 'offline-owner' },
  });
  mocks.getProfile.mockResolvedValue(initialProfile);
  mocks.readDraft.mockImplementation(async userId => userId === owner ? mocks.draft : null);
  mocks.removeDraft.mockImplementation(async (userId, draftId) => {
    if (userId === owner && mocks.draft?.draftId === draftId) {
      mocks.draft = null;
      return true;
    }
    return false;
  });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.mocked(getCurrentUser).mockResolvedValue({ userId: owner, username: 'offline-owner' });
  vi.mocked(fetchUserAttributes).mockResolvedValue({ email: 'offline@example.test', nickname: 'Offline' });
  vi.mocked(fetchAuthSession).mockResolvedValue({ tokens: { idToken: { toString: () => 'token' } } });
});

describe('AuthContext 待同步资料', () => {
  it('联网后自动提交保存草稿时的版本，成功确认后才按草稿ID清除', async () => {
    const saved = { ...initialProfile, updatedAt: '2026-01-02T00:00:00.000Z', profile: draft.payload.profile };
    mocks.setupProfile.mockResolvedValue({ user: saved, isNewUser: false });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(mocks.setupProfile).toHaveBeenCalledWith(draft.payload, draft.baseVersion));
    await waitFor(() => expect(mocks.removeDraft).toHaveBeenCalledWith(owner, draft.draftId));
    await waitFor(() => expect(result.current.pendingProfileSetup).toBeNull());
    expect(result.current.userProfile).toMatchObject({ updatedAt: saved.updatedAt, profile: { name: '离线资料' } });
  });

  it('409后保留草稿，明确覆盖时先取最新版本再同步', async () => {
    const conflict = Object.assign(new Error('资料已经改变'), { statusCode: 409, errorCode: 'PROFILE_SETUP_CONFLICT' });
    mocks.setupProfile.mockRejectedValueOnce(conflict);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.pendingProfileConflict).toBe(true));
    expect(mocks.draft).not.toBeNull();
    expect(mocks.removeDraft).not.toHaveBeenCalled();

    const latest = { ...initialProfile, updatedAt: '2026-01-03T00:00:00.000Z' };
    mocks.getProfile.mockResolvedValue(latest);
    mocks.setupProfile.mockResolvedValue({
      user: { ...latest, updatedAt: '2026-01-04T00:00:00.000Z', profile: draft.payload.profile },
      isNewUser: false,
    });
    await act(async () => {
      expect(await result.current.retryPendingProfileSetup({ overwrite: true })).toBe(true);
    });

    expect(mocks.setupProfile).toHaveBeenLastCalledWith(draft.payload, {
      exists: true,
      updatedAt: latest.updatedAt,
    });
    expect(mocks.draft).toBeNull();
    expect(result.current.pendingProfileConflict).toBe(false);
  });
});
