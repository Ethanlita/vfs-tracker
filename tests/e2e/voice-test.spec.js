/**
 * @file 嗓音测试路由端到端测试。
 * @description 验证访客不会在未登录时创建云端会话，并能在登录后返回原目标。
 */
import { test, expect } from '@playwright/test';

test('访客进入嗓音测试时跳转登录并保留返回地址', async ({ page }) => {
  await page.goto('/voice-test?from=e2e');
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  const current = new URL(page.url());
  expect(current.pathname).toBe('/login');
  expect(current.searchParams.get('returnUrl')).toBe('/voice-test?from=e2e');
});
