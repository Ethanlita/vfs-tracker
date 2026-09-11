/**
 * @file 管理员 PIN 解锁上下文测试
 * @description 验证网络恢复、错误 PIN、损坏存储和 STS 明确拒绝的凭证保留策略。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLogin from '../../../src/admin/components/AdminLogin';
import {
  AWSClientProvider,
  classifyCredentialUnlockError,
  useAWSClients,
} from '../../../src/admin/contexts/AWSClientContext';
import { SecureCredentialStorageError } from '../../../src/admin/utils/secureCredentialStorage';

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  has: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  stsSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-sts', () => ({
  GetCallerIdentityCommand: class GetCallerIdentityCommand {},
  STSClient: class STSClient {
    send(command) { return mocks.stsSend(command); }
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class DynamoDBClient {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({})) },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class S3Client {},
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: class SSMClient {},
}));

vi.mock('../../../src/admin/utils/secureCredentialStorage', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    clearEncryptedCredentials: mocks.clear,
    hasEncryptedCredentials: mocks.has,
    loadCredentialsSecure: mocks.load,
    saveCredentialsSecure: mocks.save,
  };
});

const storedCredentials = {
  accessKeyId: 'AKIA1234567890123456',
  secretAccessKey: 'secret-key-for-context-test-123456',
  savedAt: 1,
};

let latestContext;

/** 将上下文最新值暴露给测试，并显示认证结果。 */
function ContextProbe() {
  latestContext = useAWSClients();
  return <output>{latestContext.isAuthenticated ? 'authenticated' : 'locked'}</output>;
}

/** 渲染真实上下文和登录界面，覆盖状态同步而非仅测试纯函数。 */
function renderLogin() {
  return render(
    <AWSClientProvider>
      <AdminLogin />
      <ContextProbe />
    </AWSClientProvider>
  );
}

describe('AWSClientProvider PIN 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.has.mockReturnValue(true);
    mocks.load.mockResolvedValue(storedCredentials);
  });

  it.each([
    [new TypeError('Failed to fetch'), '断网'],
    [Object.assign(new Error('timeout'), { name: 'TimeoutError' }), '超时'],
    [Object.assign(new Error('service unavailable'), { $metadata: { httpStatusCode: 503 } }), '服务端临时错误'],
  ])('%s 时保留密文并允许使用相同 PIN 恢复', async (failure) => {
    mocks.stsSend
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({
        Arn: 'arn:aws:iam::123456789012:user/test-admin',
        Account: '123456789012',
        UserId: 'test-admin',
      });
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('PIN 码'), '2580');
    await user.click(screen.getByRole('button', { name: '🔓 解锁' }));

    expect(await screen.findByText('暂时无法连接 AWS 验证凭证，请检查网络后重试')).toBeInTheDocument();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(latestContext.hasSavedCredentials).toBe(true);

    await user.type(screen.getByLabelText('PIN 码'), '2580');
    await user.click(screen.getByRole('button', { name: '🔓 解锁' }));

    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument());
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('错误 PIN 保留密文且不调用 STS', async () => {
    mocks.load.mockRejectedValue(
      new SecureCredentialStorageError(
        'PIN_OR_DATA_INVALID',
        'PIN 码错误，或保存的凭证数据已损坏'
      )
    );
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('PIN 码'), '0000');
    await user.click(screen.getByRole('button', { name: '🔓 解锁' }));

    expect(await screen.findByText(/PIN 码错误/)).toBeInTheDocument();
    expect(mocks.stsSend).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(screen.getByText(/检测到已保存的凭证/)).toBeInTheDocument();
  });

  it.each([
    'InvalidClientTokenId',
    'SignatureDoesNotMatch',
    'ExpiredTokenException',
  ])('STS 明确返回 %s 时清除密文并切换到凭证登录界面', async (errorName) => {
    mocks.stsSend.mockRejectedValue(Object.assign(new Error('rejected'), { name: errorName }));
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('PIN 码'), '2580');
    await user.click(screen.getByRole('button', { name: '🔓 解锁' }));

    expect(await screen.findByText('AWS 已明确拒绝该凭证，请重新登录')).toBeInTheDocument();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(screen.getByText('请输入 IAM 凭证以继续')).toBeInTheDocument();
    expect(screen.queryByText(/检测到已保存的凭证/)).not.toBeInTheDocument();
  });

  it('损坏存储给出独立提示，清理后界面与实际状态一致', async () => {
    mocks.load.mockRejectedValue(
      new SecureCredentialStorageError('CORRUPT_DATA', '保存的凭证数据已损坏')
    );
    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('PIN 码'), '2580');
    await user.click(screen.getByRole('button', { name: '🔓 解锁' }));

    expect(await screen.findByText('保存的凭证数据已损坏')).toBeInTheDocument();
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(latestContext.hasSavedCredentials).toBe(false);
    expect(screen.getByText('请输入 IAM 凭证以继续')).toBeInTheDocument();
  });

  it('用户主动改用其他凭证时，通过上下文同步清除状态', async () => {
    renderLogin();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /使用其他凭证登录/ }));

    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(latestContext.hasSavedCredentials).toBe(false);
    expect(screen.getByText('请输入 IAM 凭证以继续')).toBeInTheDocument();
  });

  it('初次登录等待加密写入完成后才发布认证状态', async () => {
    mocks.has.mockReturnValue(false);
    mocks.stsSend.mockResolvedValue({
      Arn: 'arn:aws:iam::123456789012:user/test-admin',
      Account: '123456789012',
      UserId: 'test-admin',
    });
    let finishSave;
    mocks.save.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    render(
      <AWSClientProvider>
        <ContextProbe />
      </AWSClientProvider>
    );

    let loginPromise;
    act(() => {
      loginPromise = latestContext.login(
        storedCredentials.accessKeyId,
        storedCredentials.secretAccessKey,
        true,
        '2580'
      );
    });

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(screen.getByText('locked')).toBeInTheDocument();
    expect(latestContext.isLoading).toBe(true);

    await act(async () => {
      finishSave();
      await loginPromise;
    });

    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(latestContext.hasSavedCredentials).toBe(true);
  });
});

describe('classifyCredentialUnlockError', () => {
  it('未知错误采用保留凭证的可重试结果', () => {
    expect(classifyCredentialUnlockError(new Error('unexpected'))).toEqual({
      message: '暂时无法连接 AWS 验证凭证，请检查网络后重试',
      clearSaved: false,
    });
  });
});
