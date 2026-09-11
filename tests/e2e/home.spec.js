/**
 * @file 访客主页端到端测试。
 * @description 验证主页主操作与桌面、手机共用的功能侧栏。
 */
import { test, expect } from '@playwright/test';

test('主页显示明确入口并可进入公开仪表板', async ({ page }) => {
  await page.route(/\/public\/dashboard(?:\?|$)/, route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page).toHaveTitle(/VFS Tracker/);
  await expect(page.getByRole('heading', { name: '欢迎来到VFS Tracker!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看数据汇总' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('功能侧栏具有名称、可关闭并恢复触发按钮焦点', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '打开菜单' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '全部功能' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: '功能导航' })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭菜单' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('320px 主页和侧栏不产生整页横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: '打开菜单' }).click();
  await expect(page.getByRole('dialog', { name: '全部功能' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
