/**
 * @file 音阶练习端到端测试。
 * @description 验证公开入口、说明和麦克风权限失败后的恢复操作。
 */
import { test, expect } from '@playwright/test';

test('访客可阅读说明并开始权限步骤', async ({ page }) => {
  await page.goto('/scale-practice');
  await expect(page.getByRole('heading', { name: '音阶练习', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '音阶练习说明', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '我已知晓，开始' })).toBeEnabled();
});

test('权限拒绝后显示重试入口且页面不崩溃', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    });
  });
  await page.goto('/scale-practice');
  await page.getByRole('button', { name: '我已知晓，开始' }).click();
  await expect(page.getByRole('alert')).toContainText('无法获取麦克风权限');
  await expect(page.getByRole('button', { name: '重新尝试获取权限' })).toBeVisible();
});
