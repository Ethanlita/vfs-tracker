/**
 * @file 访客认证入口端到端测试。
 * @description 验证登录表单、注册链接和浏览器原生必填约束；不使用或修改真实账号。
 */
import { test, expect } from '@playwright/test';

// WebKit 开发模式首次编译认证代码块明显慢于后续页面，单独放宽冷启动上限。
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.goto('/login?returnUrl=%2Fevent-manager');
  // 首次冷启动需加载认证代码块，给低性能 CI 留出明确时间。
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible({ timeout: 30_000 });
});

test('登录页提供用户名、密码和恢复入口', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: '用户名或邮箱' })).toBeVisible();
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '忘记密码？' })).toBeVisible();
});

test('空表单由必填约束阻止提交', async ({ page }) => {
  const username = page.getByRole('textbox', { name: '用户名或邮箱' });
  await page.getByRole('button', { name: '登录', exact: true }).click();
  expect(await username.evaluate(input => input.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fevent-manager$/);
});

test('登录与注册模式可往返切换', async ({ page }) => {
  await page.getByRole('button', { name: '立即注册' }).click();
  await expect(page.getByRole('heading', { name: '注册', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '邮箱', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '立即登录' }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
});
