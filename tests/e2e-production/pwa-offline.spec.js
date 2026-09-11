/**
 * @file 生产 PWA 离线端到端测试。
 * @description 在桌面和手机视口中验证公开页面、文档及本地工具可由 Service Worker 离线重载。
 */
import { test, expect } from '@playwright/test';

const OFFLINE_ROUTES = [
  { path: '/', text: '欢迎来到VFS Tracker!' },
  { path: '/posts', text: '所有文档' },
  { path: '/docs?doc=%E4%BD%BF%E7%94%A8%E5%8D%8F%E8%AE%AE.md', text: '使用协议' },
  { path: '/note-frequency-tool', text: 'Hz-音符转换器' },
  { path: '/vfs-effect-preview', text: 'VFS效果预览' },
  { path: '/quick-f0-test', text: '快速基频测试' },
  { path: '/scale-practice', text: '音阶练习' },
];

/** 等待首个生产 Service Worker 激活，并通过一次刷新取得页面控制权。 */
async function waitForServiceWorkerControl(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

/** 断言当前页面已呈现目标内容且没有整页横向溢出。 */
async function expectUsablePage(page, expectedText) {
  await expect(page.getByRole('heading', { name: expectedText, exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('404');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test('预缓存页面在断网后仍可直接导航和刷新', async ({ page, context }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expectUsablePage(page, OFFLINE_ROUTES[0].text);
  await waitForServiceWorkerControl(page);

  for (const route of OFFLINE_ROUTES) {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expectUsablePage(page, route.text);
  }

  await context.setOffline(true);
  try {
    for (const route of OFFLINE_ROUTES) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expectUsablePage(page, route.text);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectUsablePage(page, route.text);
    }
  } finally {
    await context.setOffline(false);
  }

  expect(pageErrors).toEqual([]);
});

test('Hz 与音名转换在生产构建中保持可操作', async ({ page }) => {
  await page.goto('/note-frequency-tool');
  const frequencyInput = page.getByRole('textbox', { name: '频率（Hz）' });
  await frequencyInput.fill('440');
  await frequencyInput.press('Enter');
  await expect(page.getByText('440 Hz ≈ A4', { exact: false })).toBeVisible();

  const noteInput = page.getByRole('textbox', { name: '音名', exact: true });
  await noteInput.fill('C4');
  await noteInput.press('Enter');
  await expect(page.getByText('C4 = 261.63 Hz', { exact: false })).toBeVisible();
});
