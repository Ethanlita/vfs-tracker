/** @file 资料向导的离线保存、恢复、存储失败与冲突确认测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfileSetupWizard from '../../../src/components/ProfileSetupWizard.jsx';

const mocks = vi.hoisted(() => ({
  auth: {},
  save: vi.fn(),
  remove: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../../src/utils/pendingProfileSetup.js', () => ({
  profileBaseVersion: profile => ({ exists: Boolean(profile?.profile), updatedAt: profile?.updatedAt || null }),
  savePendingProfileSetup: mocks.save,
  removePendingProfileSetup: mocks.remove,
}));

const currentProfile = {
  userId: 'account-a',
  updatedAt: '2026-01-01T00:00:00.000Z',
  profile: { name: '' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  mocks.save.mockResolvedValue({ draftId: 'draft-a' });
  mocks.remove.mockResolvedValue(true);
  mocks.retry.mockResolvedValue(true);
  mocks.auth = {
    user: { userId: 'account-a' },
    userProfile: currentProfile,
    completeProfileSetup: vi.fn(),
    pendingProfileSetup: null,
    pendingProfileSyncing: false,
    pendingProfileError: null,
    pendingProfileConflict: false,
    retryPendingProfileSetup: mocks.retry,
  };
});

/** 填写昵称并进入确认页。 */
async function reachConfirmation(user, name = '离线昵称') {
  await user.type(screen.getByPlaceholderText('请输入您的昵称'), name);
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '下一步' }));
}

describe('ProfileSetupWizard 离线资料草稿', () => {
  it('离线完成时按账号和服务端版本保存，确认持久化后才离开', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<MemoryRouter><ProfileSetupWizard onComplete={onComplete} /></MemoryRouter>);
    await reachConfirmation(user);
    await user.click(screen.getByRole('button', { name: '完成设置', exact: true }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(mocks.auth.completeProfileSetup).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'account-a',
      kind: 'complete',
      baseVersion: { exists: true, updatedAt: currentProfile.updatedAt },
      payload: { profile: expect.objectContaining({ name: '离线昵称' }) },
    }));
  });

  it('离线跳过只保存互斥的skip协议', async () => {
    const onComplete = vi.fn();
    render(<MemoryRouter><ProfileSetupWizard onComplete={onComplete} /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: '跳过设置' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'skip',
      payload: { profile: { setupSkipped: true } },
    }));
  });

  it('本地存储失败时留在向导并显示可操作错误', async () => {
    mocks.save.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const onComplete = vi.fn();
    render(<MemoryRouter><ProfileSetupWizard onComplete={onComplete} /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: '跳过设置' }));

    expect(await screen.findByText(/QuotaExceededError|无法保存离线资料/)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    expect(mocks.auth.completeProfileSetup).not.toHaveBeenCalled();
  });

  it('只恢复当前账号的完整草稿且保留公开选项', async () => {
    mocks.auth.pendingProfileSetup = {
      draftId: 'draft-a', ownerUserId: 'account-a', kind: 'complete', returnUrl: '/mypage',
      payload: { profile: { name: '恢复昵称', bio: '', isNamePublic: true, socials: [], areSocialsPublic: false } },
    };
    render(<MemoryRouter><ProfileSetupWizard /></MemoryRouter>);

    await waitFor(() => expect(screen.getByPlaceholderText('请输入您的昵称')).toHaveValue('恢复昵称'));
    expect(screen.getByLabelText(/在公共页面显示我的昵称/)).toBeChecked();
  });

  it('冲突覆盖按钮把明确选择传给同步逻辑', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    mocks.auth.pendingProfileConflict = true;
    mocks.auth.pendingProfileSetup = {
      draftId: 'draft-a', ownerUserId: 'account-a', kind: 'skip', returnUrl: '/mypage',
      payload: { profile: { setupSkipped: true } },
    };
    const onComplete = vi.fn();
    render(<MemoryRouter><ProfileSetupWizard onComplete={onComplete} /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: '使用离线草稿覆盖' }));

    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith({ overwrite: true }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
