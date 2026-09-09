/** @file 邮箱补充验证端到端回归：浏览器 UI → 真实 Amplify SDK → 模拟 Cognito HTTP。 */
import { test, expect } from '@playwright/test';
import { mockCognitoSignUp, signupAccount as account } from './helpers/cognito-signup.js';

test('注册后离开并刷新，可继续验证、处理无效验证码并回到登录页', async ({ page }, testInfo) => {
  const { calls } = await mockCognitoSignUp(page);
  await page.goto('/login');
  await page.getByRole('button', { name: '立即注册' }).click();
  await page.getByPlaceholder('用户名', { exact: true }).fill(account.username);
  await page.getByPlaceholder('邮箱', { exact: true }).fill(account.email);
  await page.getByPlaceholder(/^密码（/).fill(account.password);
  await page.getByPlaceholder('确认密码').fill(account.password);
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect(page.getByRole('heading', { name: '验证邮箱' })).toBeVisible();
  expect(calls.find(call => call.operation === 'SignUp')?.body.Username).toBe(account.username);

  // 页面重载丢弃组件状态，验证 localStorage 能恢复真实注册步骤保存的账号。
  await page.reload();
  await page.getByRole('button', { name: '继续验证' }).click();
  await expect(page.getByPlaceholder('注册用户名')).toHaveValue(account.username);
  await expect(page.getByText(account.email, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('restored-signup.png'), fullPage: true });

  // 邮箱误填必须在前端被拦截，不能向 Cognito 发起确认或重发。
  await page.getByPlaceholder('注册用户名').fill(account.email);
  await page.getByPlaceholder('验证码').fill(account.code);
  const callCount = calls.length;
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await page.getByRole('button', { name: '重新发送验证码', exact: true }).click();
  await expect(page.getByText(/只能用注册时填写的用户名来验证/).first()).toBeVisible();
  expect(calls).toHaveLength(callCount);
  await page.getByPlaceholder('注册用户名').fill(account.username);

  for (const [code, message] of [['000000', /验证码错误/], ['111111', /验证码已过期或无效/]]) {
    await page.getByPlaceholder('验证码').fill(code);
    await page.getByRole('button', { name: '验证', exact: true }).click();
    await expect(page.getByText(message)).toBeVisible();
  }
  await page.getByRole('button', { name: '重新发送验证码', exact: true }).click();
  await expect(page.getByText(/验证码已重新发送/)).toBeVisible();
  await page.getByPlaceholder('验证码').fill(account.code);
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await expect(page.getByText(/邮箱验证成功/)).toBeVisible();
  await expect(page.getByPlaceholder('用户名或邮箱')).toHaveValue(account.username);
  expect(calls.filter(call => call.operation === 'ConfirmSignUp').at(-1).body).toMatchObject({ Username: account.username, ConfirmationCode: account.code });
  await page.reload();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '继续验证' })).toHaveCount(0);
});

test('未验证账号登录经真实 SDK 进入验证页，自动重发失败后可手动完成验证', async ({ page }) => {
  const { calls, allowResend } = await mockCognitoSignUp(page, { failResend: true });
  await page.goto('/login');
  await page.getByPlaceholder('用户名或邮箱').fill(account.username);
  await page.getByPlaceholder('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByPlaceholder('注册用户名')).toHaveValue(account.username);
  await expect(page.getByText(/请在验证页面点击/)).toBeVisible();
  expect(calls.find(call => call.operation === 'InitiateAuth')?.body.AuthParameters.USERNAME).toBe(account.username);
  // 故障恢复后再由用户手动发起请求，区分 SDK 内部重试和界面上的重试。
  allowResend();
  await page.getByRole('button', { name: '重新发送验证码', exact: true }).click();
  await expect(page.getByText(/验证码已重新发送/)).toBeVisible();
  await expect(page.getByRole('button', { name: /重新发送 \(/ })).toBeDisabled();
  await page.getByPlaceholder('验证码').fill(account.code);
  await page.getByRole('button', { name: '验证', exact: true }).click();
  await expect(page.getByText(/邮箱验证成功/)).toBeVisible();
  await expect(page.getByPlaceholder('用户名或邮箱')).toHaveValue(account.username);
});
