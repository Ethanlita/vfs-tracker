/** 认证表单的标签、错误关联及键盘密码控制回归测试。 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, it, expect, vi } from 'vitest';
import { signIn, resetPassword } from 'aws-amplify/auth';
import CustomAuthenticator from '../../../src/components/CustomAuthenticator.jsx';

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

it('登录标签和自动填充语义保持关联，键盘可显示并隐藏密码', async () => {
  const user = userEvent.setup();
  render(<CustomAuthenticator />);
  expect(screen.getByLabelText('用户名或邮箱')).toHaveAttribute('autocomplete', 'username');
  const password = screen.getByLabelText('密码');
  expect(password).toHaveAttribute('autocomplete', 'current-password');
  await user.type(password, 'Example!123');
  await user.tab();
  expect(screen.getByRole('button', { name: '显示密码' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(password).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: '隐藏密码' })).toHaveAttribute('aria-pressed', 'true');
  await user.keyboard(' ');
  expect(password).toHaveAttribute('type', 'password');
  expect(password).toHaveValue('Example!123');
  expect(signIn).not.toHaveBeenCalled();
});

it('注册密码独立切换，切换认证步骤后恢复隐藏', async () => {
  const user = userEvent.setup(); render(<CustomAuthenticator />);
  await user.click(screen.getByRole('button', { name: '立即注册' }));
  expect(screen.getByLabelText('邮箱')).toHaveAttribute('autocomplete', 'email');
  expect(screen.getByLabelText('昵称（可选）')).not.toBeRequired();
  await user.click(screen.getByRole('button', { name: '显示密码', exact: true }));
  expect(screen.getByLabelText(/^密码（/)).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText('确认密码')).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: '立即登录' }));
  expect(screen.getByLabelText('密码')).toHaveAttribute('type', 'password');
});

it('认证失败通过警告播报并关联输入，编辑后移除旧错误关联', async () => {
  signIn.mockRejectedValueOnce(new Error('测试认证失败'));
  const user = userEvent.setup(); render(<CustomAuthenticator />);
  const username = screen.getByLabelText('用户名或邮箱');
  await user.type(username, 'audit-user');
  await user.type(screen.getByLabelText('密码'), 'Example!123');
  await user.click(screen.getByRole('button', { name: '登录', exact: true }));
  const alert = await screen.findByRole('alert');
  expect(username).toHaveAttribute('aria-describedby', alert.id);
  expect(screen.getByLabelText('密码')).toHaveAttribute('aria-describedby', alert.id);
  await user.type(username, 'a');
  expect(username).not.toHaveAttribute('aria-describedby');
});

it('邮箱验证及密码重置提供可见标签和验证码自动填充属性', async () => {
  resetPassword.mockResolvedValueOnce({ nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' } });
  const user = userEvent.setup(); render(<CustomAuthenticator />);
  await user.click(screen.getByRole('button', { name: '立即注册' }));
  await user.click(screen.getByRole('button', { name: '去验证邮箱' }));
  expect(screen.getByLabelText('注册用户名')).toBeRequired();
  expect(screen.getByLabelText('验证码')).toHaveAttribute('autocomplete', 'one-time-code');
  await user.click(screen.getByRole('button', { name: '返回登录' }));
  await user.click(screen.getByRole('button', { name: '忘记密码？' }));
  await user.type(screen.getByLabelText('用户名'), 'audit-user');
  await user.click(screen.getByRole('button', { name: '发送验证码', exact: true }));
  expect(await screen.findByLabelText('新密码')).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByLabelText('确认新密码')).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByLabelText('验证码')).toHaveAttribute('autocomplete', 'one-time-code');
});

it('临时密码修改步骤同样提供标签和独立显示按钮', async () => {
  signIn.mockResolvedValueOnce({ isSignedIn: false, nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' } });
  const user = userEvent.setup(); render(<CustomAuthenticator />);
  await user.type(screen.getByLabelText('用户名或邮箱'), 'audit-user');
  await user.type(screen.getByLabelText('密码'), 'Temporary!123');
  await user.click(screen.getByRole('button', { name: '登录', exact: true }));
  const password = await screen.findByLabelText('新密码');
  expect(password).toHaveAttribute('autocomplete', 'new-password');
  await user.click(screen.getByRole('button', { name: '显示新密码', exact: true }));
  expect(password).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText('确认新密码')).toHaveAttribute('type', 'password');
});
