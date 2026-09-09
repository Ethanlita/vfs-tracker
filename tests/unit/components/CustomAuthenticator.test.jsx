/**
 * 单元测试: src/components/CustomAuthenticator.jsx
 *
 * 覆盖 Issue #89 邮箱补充验证相关流程：
 * - 验证页 / 重发验证码检测到填的是邮箱时给出提示，且不向 Cognito 发请求
 * - 注册后记录待验证账号，回访登录页时提示"继续验证"并预填用户名
 * - 验证成功或账号已验证时回到登录页并清除记录
 * - 提交前去掉用户名与验证码的首尾空格
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn, signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import CustomAuthenticator from '../../../src/components/CustomAuthenticator.jsx';
import { savePendingSignUp, loadPendingSignUp } from '../../../src/utils/pendingSignUp.js';

/**
 * 构造带 name 的 Cognito 风格错误
 * @param {string} name - 错误名称（如 CodeMismatchException）
 * @param {string} [message] - 错误信息
 * @returns {Error}
 */
const cognitoError = (name, message = name) => Object.assign(new Error(message), { name });

/**
 * 从登录页进入注册页，再点击"去验证邮箱"进入验证页
 * @param {import('@testing-library/user-event').UserEvent} user
 */
const goToConfirmPage = async (user) => {
  await user.click(screen.getByRole('button', { name: '立即注册' }));
  await user.click(screen.getByRole('button', { name: '去验证邮箱' }));
  expect(screen.getByPlaceholderText('注册用户名')).toBeInTheDocument();
};

describe('CustomAuthenticator 组件测试（Issue #89 邮箱补充验证）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // 验证页：用户名 vs 邮箱
  // ============================================
  describe('验证页', () => {
    it('用户名填了邮箱时提示改用注册用户名，且不调用 confirmSignUp', async () => {
      const user = userEvent.setup();
      render(<CustomAuthenticator />);
      await goToConfirmPage(user);

      await user.type(screen.getByPlaceholderText('注册用户名'), 'alice@example.com');
      await user.type(screen.getByPlaceholderText('验证码'), '123456');
      await user.click(screen.getByRole('button', { name: '验证' }));

      const hints = await screen.findAllByText(/只能用注册时填写的用户名来验证/);
      expect(hints.length).toBeGreaterThan(0);
      expect(confirmSignUp).not.toHaveBeenCalled();
    });

    it('重发验证码时用户名填了邮箱同样提示，且不调用 resendSignUpCode', async () => {
      const user = userEvent.setup();
      render(<CustomAuthenticator />);
      await goToConfirmPage(user);

      await user.type(screen.getByPlaceholderText('注册用户名'), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: '重新发送验证码' }));

      const hints = await screen.findAllByText(/只能用注册时填写的用户名来验证/);
      expect(hints.length).toBeGreaterThan(0);
      expect(resendSignUpCode).not.toHaveBeenCalled();
    });

    it('提交前会去掉用户名和验证码的首尾空格', async () => {
      const user = userEvent.setup();
      render(<CustomAuthenticator />);
      await goToConfirmPage(user);

      await user.type(screen.getByPlaceholderText('注册用户名'), '  alice  ');
      await user.type(screen.getByPlaceholderText('验证码'), ' 123456 ');
      await user.click(screen.getByRole('button', { name: '验证' }));

      await waitFor(() => {
        expect(confirmSignUp).toHaveBeenCalledWith({ username: 'alice', confirmationCode: '123456' });
      });
    });

    it('验证成功后回到登录页、保留用户名并清除待验证记录', async () => {
      const user = userEvent.setup();
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      render(<CustomAuthenticator />);

      await user.click(screen.getByRole('button', { name: '继续验证' }));
      expect(screen.getByPlaceholderText('注册用户名')).toHaveValue('alice');
      await user.type(screen.getByPlaceholderText('验证码'), '123456');
      await user.click(screen.getByRole('button', { name: '验证' }));

      expect(await screen.findByText(/邮箱验证成功/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('用户名或邮箱')).toHaveValue('alice');
      expect(loadPendingSignUp()).toBeNull();
    });

    it('账号已经验证过时视为验证完成并引导登录', async () => {
      const user = userEvent.setup();
      vi.mocked(confirmSignUp).mockRejectedValueOnce(
        cognitoError('NotAuthorizedException', 'User cannot be confirmed. Current status is CONFIRMED')
      );
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      render(<CustomAuthenticator />);

      await user.click(screen.getByRole('button', { name: '继续验证' }));
      await user.type(screen.getByPlaceholderText('验证码'), '123456');
      await user.click(screen.getByRole('button', { name: '验证' }));

      expect(await screen.findByText(/已经完成邮箱验证/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('用户名或邮箱')).toHaveValue('alice');
      expect(loadPendingSignUp()).toBeNull();
    });

    it('验证码过期时提示使用页面上的"重新发送验证码"', async () => {
      const user = userEvent.setup();
      vi.mocked(confirmSignUp).mockRejectedValueOnce(cognitoError('ExpiredCodeException'));
      render(<CustomAuthenticator />);
      await goToConfirmPage(user);

      await user.type(screen.getByPlaceholderText('注册用户名'), 'alice');
      await user.type(screen.getByPlaceholderText('验证码'), '123456');
      await user.click(screen.getByRole('button', { name: '验证' }));

      expect(await screen.findByText(/验证码已过期或无效/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重新发送验证码' })).toBeInTheDocument();
    });

    it('验证码错误时提示以最新一封邮件为准', async () => {
      const user = userEvent.setup();
      vi.mocked(confirmSignUp).mockRejectedValueOnce(cognitoError('CodeMismatchException'));
      render(<CustomAuthenticator />);
      await goToConfirmPage(user);

      await user.type(screen.getByPlaceholderText('注册用户名'), 'alice');
      await user.type(screen.getByPlaceholderText('验证码'), '000000');
      await user.click(screen.getByRole('button', { name: '验证' }));

      expect(await screen.findByText(/验证码错误/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 待验证账号记录
  // ============================================
  describe('待验证账号记录', () => {
    it('注册成功后记录待验证账号并进入验证页', async () => {
      const user = userEvent.setup();
      render(<CustomAuthenticator />);

      await user.click(screen.getByRole('button', { name: '立即注册' }));
      await user.type(screen.getByPlaceholderText('用户名'), 'alice');
      await user.type(screen.getByPlaceholderText('邮箱'), 'alice@example.com');
      await user.type(screen.getByPlaceholderText(/^密码/), 'Passw0rd!');
      await user.type(screen.getByPlaceholderText('确认密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '注册' }));

      expect(await screen.findByText(/注册成功/)).toBeInTheDocument();
      expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice' }));
      expect(screen.getByPlaceholderText('注册用户名')).toHaveValue('alice');
      expect(loadPendingSignUp()).toMatchObject({ username: 'alice', email: 'alice@example.com' });
    });

    it('存在记录时登录页显示提示，点击"继续验证"进入验证页并预填', async () => {
      const user = userEvent.setup();
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      render(<CustomAuthenticator />);

      expect(screen.getByText(/账号「alice」尚未完成邮箱验证/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '继续验证' }));

      expect(screen.getByPlaceholderText('注册用户名')).toHaveValue('alice');
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('点击"不再提示"会清除记录', async () => {
      const user = userEvent.setup();
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      render(<CustomAuthenticator />);

      await user.click(screen.getByRole('button', { name: '不再提示' }));

      expect(screen.queryByText(/尚未完成邮箱验证/)).not.toBeInTheDocument();
      expect(loadPendingSignUp()).toBeNull();
    });
  });

  // ============================================
  // 登录页
  // ============================================
  describe('登录页', () => {
    it('收到 CONFIRM_SIGN_UP 时记录待验证账号、进入验证页并自动重发验证码', async () => {
      const user = userEvent.setup();
      // Amplify v6 将 Cognito 的异常转换为 nextStep，不向组件抛出该异常。
      vi.mocked(signIn).mockResolvedValueOnce({
        isSignedIn: false,
        nextStep: { signInStep: 'CONFIRM_SIGN_UP' }
      });
      render(<CustomAuthenticator />);

      await user.type(screen.getByPlaceholderText('用户名或邮箱'), ' alice ');
      await user.type(screen.getByPlaceholderText('密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(resendSignUpCode).toHaveBeenCalledWith({ username: 'alice' });
      });
      expect(await screen.findByText(/验证码已重新发送/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('注册用户名')).toHaveValue('alice');
      expect(loadPendingSignUp()).toMatchObject({ username: 'alice' });
    });

    it('自动重发失败后保留验证页和用户名，允许手动重试并完成验证', async () => {
      const user = userEvent.setup();
      vi.mocked(signIn).mockResolvedValueOnce({
        isSignedIn: false, nextStep: { signInStep: 'CONFIRM_SIGN_UP' }
      });
      vi.mocked(resendSignUpCode).mockRejectedValueOnce(cognitoError('LimitExceededException'));
      render(<CustomAuthenticator />);
      await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'alice');
      await user.type(screen.getByPlaceholderText('密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '登录' }));

      expect(await screen.findByText(/请在验证页面点击/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('注册用户名')).toHaveValue('alice');
      const resend = screen.getByRole('button', { name: '重新发送验证码' });
      expect(resend).toBeEnabled();
      await user.click(resend);
      expect(await screen.findByText(/验证码已重新发送/)).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText('验证码'), '123456');
      await user.click(screen.getByRole('button', { name: '验证' }));
      expect(await screen.findByText(/邮箱验证成功/)).toBeInTheDocument();
      expect(loadPendingSignUp()).toBeNull();
    });

    it('用待验证账号的邮箱登录失败时给出针对性提示', async () => {
      const user = userEvent.setup();
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      vi.mocked(signIn).mockRejectedValueOnce(
        cognitoError('NotAuthorizedException', 'Incorrect username or password.')
      );
      render(<CustomAuthenticator />);

      await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'alice@example.com');
      await user.type(screen.getByPlaceholderText('密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '登录' }));

      expect(await screen.findByText(/验证完成前无法用邮箱登录/)).toBeInTheDocument();
    });

    it('没有对应记录时登录失败仍提示用户名或密码错误', async () => {
      const user = userEvent.setup();
      vi.mocked(signIn).mockRejectedValueOnce(
        cognitoError('NotAuthorizedException', 'Incorrect username or password.')
      );
      render(<CustomAuthenticator />);

      await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'bob@example.com');
      await user.type(screen.getByPlaceholderText('密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '登录' }));

      expect(await screen.findByText('用户名或密码错误')).toBeInTheDocument();
    });

    it('登录成功后清除对应的待验证记录', async () => {
      const user = userEvent.setup();
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' });
      render(<CustomAuthenticator>{() => null}</CustomAuthenticator>);

      await user.type(screen.getByPlaceholderText('用户名或邮箱'), 'alice');
      await user.type(screen.getByPlaceholderText('密码'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(loadPendingSignUp()).toBeNull();
      });
      expect(screen.queryByText(/尚未完成邮箱验证/)).not.toBeInTheDocument();
    });
  });
});
