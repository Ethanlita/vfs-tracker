/**
 * @file 生产 PWA 版本更新端到端测试。
 * @description 用真实 Service Worker 和两份生产构建 A→B 模拟一次部署，覆盖此前复现过的问题：
 * 打开即提示旧版本、长时间打开收不到更新、横幅在登录加载期间丢失、未受控页面点击更新后卡住，
 * 以及部署后旧页面懒加载路由白屏。只在桌面 Chromium 项目运行，Service Worker 行为与视口无关。
 */
import { test, expect } from '@playwright/test';
import { TEST_USER_POOL_CLIENT_ID, buildVersions, removeVersions, startVersionedServer } from './support/versionedSite.js';

const BANNER_TEXT = '检测到应用有新版本可用。';
const DESKTOP_PROJECT = 'desktop-chromium';

/** @type {{root: string, dirs: {a: string, b: string}, entries: {A: string, B: string}}} */
let versions;
/** @type {Awaited<ReturnType<typeof startVersionedServer>>} */
let site;

// Playwright 要求钩子的第一个参数使用对象解构；这里不需要任何 fixture。
// eslint-disable-next-line no-empty-pattern
test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== DESKTOP_PROJECT) return;
  // 两次生产构建约需一分钟。
  test.setTimeout(300_000);
  versions = await buildVersions();
  site = await startVersionedServer(versions.dirs);
});

test.afterAll(async () => {
  await site?.close();
  removeVersions(versions?.root);
});

// eslint-disable-next-line no-empty-pattern
test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== DESKTOP_PROJECT, 'Service Worker 更新流程与视口无关，只在桌面项目验证');
  site.deploy('a');
});

/**
 * 在页面中求值；页面恰好在刷新时返回 null，让 expect.poll 继续重试而不是直接失败。
 * @param {import('@playwright/test').Page} page - 目标页面。
 * @param {Function} fn - 页面内执行的函数。
 */
async function evaluateWhenStable(page, fn) {
  try {
    return await page.evaluate(fn);
  } catch (error) {
    if (/Execution context was destroyed|navigat/i.test(error.message)) return null;
    throw error;
  }
}

/** 读取页面当前运行的版本（按入口脚本区分）；刷新途中返回 null。 */
async function version(page) {
  const src = await evaluateWhenStable(page, () => document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') ?? '');
  if (src === null) return null;
  if (src.includes(versions.entries.A)) return 'A';
  if (src.includes(versions.entries.B)) return 'B';
  return 'unknown';
}

/** 页面是否受 Service Worker 控制；刷新途中返回 null。 */
const isControlled = page => evaluateWhenStable(page, () => Boolean(navigator.serviceWorker.controller));

/** 打开版本 A 并通过一次刷新让页面受 Service Worker 控制。 */
async function openControlledA(context, pathname = '/') {
  const page = await context.newPage();
  await page.goto(site.url(pathname));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => isControlled(page)).toBe(true);
  // 等浏览器在导航后自带的那次 sw.js 检查结束，避免它而非被测逻辑发现新版本。
  await page.waitForTimeout(4000);
  return page;
}

test('部署后打开：唯一标签页且未操作时静默切到新版本，不显示横幅', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await (await openControlledA(context)).close();
    site.deploy('b');

    const page = await context.newPage();
    let bannerSeen = false;
    await page.exposeFunction('reportUpdateBanner', () => { bannerSeen = true; });
    await page.addInitScript(text => {
      new MutationObserver(() => {
        if (document.body?.innerText.includes(text)) window.reportUpdateBanner();
      }).observe(document, { childList: true, subtree: true, characterData: true });
    }, BANNER_TEXT);

    await page.goto(site.url('/'));
    await expect.poll(() => version(page), { timeout: 20_000 }).toBe('B');
    await expect(page.getByRole('heading', { name: '欢迎来到VFS Tracker!' })).toBeVisible();
    expect(bannerSeen).toBe(false);
  } finally {
    await context.close();
  }
});

test('还有其他标签页时显示横幅；点击后所有标签页都切到新版本', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const first = await openControlledA(context, '/posts');
    site.deploy('b');
    const second = await context.newPage();
    await second.goto(site.url('/'));

    await expect(second.getByText(BANNER_TEXT)).toBeVisible({ timeout: 20_000 });
    await second.getByRole('button', { name: '立即刷新' }).click();

    await expect.poll(() => version(second), { timeout: 15_000 }).toBe('B');
    await expect.poll(() => version(first), { timeout: 15_000 }).toBe('B');
    await expect(second.getByText(BANNER_TEXT)).toBeHidden();
  } finally {
    await context.close();
  }
});

test('首访（未受控）标签页点击更新也能完成，不会停在"正在更新…"', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    await first.goto(site.url('/'));
    await first.evaluate(() => navigator.serviceWorker.ready);
    expect(await isControlled(first)).toBe(false);

    site.deploy('b');
    const second = await context.newPage();
    await second.goto(site.url('/posts'));

    await expect(first.getByText(BANNER_TEXT)).toBeVisible({ timeout: 20_000 });
    await first.getByRole('button', { name: '立即刷新' }).click();

    await expect.poll(() => version(first), { timeout: 15_000 }).toBe('B');
    await expect.poll(() => isControlled(first)).toBe(true);
    await expect.poll(() => version(second), { timeout: 15_000 }).toBe('B');
  } finally {
    await context.close();
  }
});

test('强制刷新（绕过 Service Worker）后的页面点击更新也能完成', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const holder = await openControlledA(context, '/posts');
    const page = await openControlledA(context);
    site.deploy('b');
    await page.reload();
    await expect(page.getByText(BANNER_TEXT)).toBeVisible({ timeout: 20_000 });

    // 等同 Ctrl+Shift+R；CDP 调用在导航提交前就返回，必须等新文档的 load 事件。
    const cdp = await context.newCDPSession(page);
    await Promise.all([page.waitForEvent('load'), cdp.send('Page.reload', { ignoreCache: true })]);
    expect(await isControlled(page)).toBe(false);

    await expect(page.getByText(BANNER_TEXT)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '立即刷新' }).click();

    await expect.poll(() => isControlled(page), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => version(holder), { timeout: 15_000 }).toBe('B');
    await expect(page.getByText(BANNER_TEXT)).toBeHidden();
  } finally {
    await context.close();
  }
});

test('登录状态需要联网刷新时，加载期间也能看到更新提示', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await openControlledA(context);
    // 另一个旧标签页让新版本保持 waiting，并阻止静默更新。
    await openControlledA(context, '/posts');
    site.deploy('b');
    await page.reload();
    await expect(page.getByText(BANNER_TEXT)).toBeVisible({ timeout: 20_000 });

    // 写入一个已过期的 Cognito 会话，让 getCurrentUser() 必须联网刷新 token。
    await page.evaluate(clientId => {
      const encode = value => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const now = Math.floor(Date.now() / 1000);
      const jwt = claims => `${encode({ alg: 'RS256', kid: 'e2e' })}.${encode({ sub: 'e2e-sub', 'cognito:username': 'e2e', iat: now - 7200, exp: now - 3600, ...claims })}.c2ln`;
      const prefix = `CognitoIdentityServiceProvider.${clientId}`;
      localStorage.setItem(`${prefix}.LastAuthUser`, 'e2e');
      localStorage.setItem(`${prefix}.e2e.accessToken`, jwt({ token_use: 'access', client_id: clientId, username: 'e2e' }));
      localStorage.setItem(`${prefix}.e2e.idToken`, jwt({ token_use: 'id', aud: clientId }));
      localStorage.setItem(`${prefix}.e2e.refreshToken`, 'e2e-refresh-token');
      localStorage.setItem(`${prefix}.e2e.clockDrift`, '0');
    }, TEST_USER_POOL_CLIENT_ID);
    await page.close();

    await context.route('https://cognito-idp.us-east-1.amazonaws.com/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 8000));
      await route.fulfill({
        status: 400,
        contentType: 'application/x-amz-json-1.1',
        headers: { 'x-amzn-errortype': 'NotAuthorizedException' },
        body: JSON.stringify({ __type: 'NotAuthorizedException', message: 'Refresh Token has expired' }),
      });
    });
    const reopened = await context.newPage();
    await reopened.goto(site.url('/'));

    await expect(reopened.getByText('正在加载用户资料...')).toBeVisible();
    await expect(reopened.getByText(BANNER_TEXT)).toBeVisible({ timeout: 5000 });
    await expect(reopened.getByText('正在加载用户资料...')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('部署后仍运行旧代码的页面打开懒加载路由时自动恢复，不白屏', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(site.url('/'));
    await page.evaluate(() => navigator.serviceWorker.ready);
    expect(await isControlled(page)).toBe(false);

    site.deploy('b');
    await page.evaluate(() => {
      history.pushState({}, '', '/note-frequency-tool');
      dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page.getByRole('heading', { name: 'Hz-音符转换器' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('长时间打开的页面定时检查新版本', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(site.url('/'));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => isControlled(page)).toBe(true);
    await page.waitForTimeout(4000);

    site.deploy('b');
    // 站内跳转不会触发浏览器的检查。
    await page.evaluate(() => {
      history.pushState({}, '', '/posts');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);

    await page.clock.fastForward('31:00');
    await expect(page.getByText(BANNER_TEXT)).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});
