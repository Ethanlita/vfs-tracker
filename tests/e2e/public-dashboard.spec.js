/**
 * @file 公开仪表板端到端边界测试。
 * @description 使用隔离响应验证空态与失败后的显式重试，不读取真实用户数据。
 */
import { test, expect } from '@playwright/test';

const DASHBOARD_REQUEST = /\/public\/dashboard(?:\?|$)/;

test('空数据仍显示完整统计与用户空态', async ({ page }) => {
  await page.route(DASHBOARD_REQUEST, route => route.fulfill({ json: [] }));
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: '公开仪表板', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '总记录事件数' }).locator('..')).toContainText('0');
  await expect(page.getByRole('heading', { name: '贡献用户数' }).locator('..')).toContainText('0');
  await expect(page.getByRole('region', { name: '用户列表' })).toContainText('暂无公开用户');
});

test('接口失败时显示错误并允许原地重试', async ({ page }) => {
  let attempts = 0;
  let shouldFail = true;
  await page.route(DASHBOARD_REQUEST, route => {
    attempts += 1;
    return shouldFail
      ? route.fulfill({ status: 503, json: { message: 'temporary failure' } })
      : route.fulfill({ json: [] });
  });
  await page.goto('/dashboard');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  const attemptsBeforeRetry = attempts;
  shouldFail = false;
  await alert.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('heading', { name: '公开仪表板', exact: true })).toBeVisible();
  expect(attempts).toBeGreaterThan(attemptsBeforeRetry);
});
