/**
 * @file Hz 与音名转换工具端到端测试。
 * @description 使用当前页面的可访问名称验证转换、输入错误及窄屏布局。
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/note-frequency-tool');
  await expect(page.getByRole('heading', { name: 'Hz-音符转换器', exact: true })).toBeVisible();
});

test('显示两个转换入口和可横向操作的 88 键钢琴', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: '频率（Hz）' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '音名', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '88 键钢琴横向滚动区' })).toBeVisible();
});

test('按 Enter 完成 Hz 与音名双向转换', async ({ page }) => {
  const frequency = page.getByRole('textbox', { name: '频率（Hz）' });
  await frequency.fill('440');
  await frequency.press('Enter');
  await expect(page.getByText('440 Hz ≈ A4', { exact: false })).toBeVisible();

  const note = page.getByRole('textbox', { name: '音名', exact: true });
  await note.fill('C4');
  await note.press('Enter');
  await expect(page.getByText('C4 = 261.63 Hz', { exact: false })).toBeVisible();
});

test('拒绝无效频率且保留可修改的输入', async ({ page }) => {
  const input = page.getByRole('textbox', { name: '频率（Hz）' });
  await input.fill('invalid');
  await input.press('Enter');
  await expect(page.getByText('请输入大于 0 的频率值，例如 440。', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('invalid');
});

test('320px 视口不产生整页横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('heading', { name: 'Hz-音符转换器', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
