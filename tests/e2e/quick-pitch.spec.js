/**
 * @file 快速基频测试端到端测试。
 * @description 验证访客可使用本地页面，并在麦克风拒绝时获得可操作错误提示。
 */
import { test, expect } from '@playwright/test';

test('访客可打开测试页且云端保存保持禁用', async ({ page }) => {
  await page.goto('/quick-f0-test');
  await expect(page.getByRole('heading', { name: '快速基频测试', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始测试' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '停止测试' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存结果' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('当前未登录');
});

test('拒绝麦克风权限后恢复到可重试状态', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    });
  });
  await page.goto('/quick-f0-test');
  await page.getByRole('button', { name: '开始测试' }).click();
  await expect(page.getByRole('alert')).toContainText('无法启动测试，请确认已授予麦克风权限');
  await expect(page.getByRole('button', { name: '开始测试' })).toBeEnabled();
});
