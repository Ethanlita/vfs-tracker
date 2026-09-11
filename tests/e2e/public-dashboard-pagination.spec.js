/** @file 公共仪表板真实浏览器验证：轻量首屏、完整统计、按需明细和移动布局。 */
import { test, expect } from '@playwright/test';
import { dashboardFixture, chartEvents } from '../../src/test-utils/fixtures/index.js';

test('用户列表位于最后，每页显示 20 人并支持往返翻页', async ({ page }, testInfo) => {
  const users = dashboardFixture(45).light.map((event, index) => ({ ...event, userId: `user-${index}`, userName: `用户 ${index}` }));
  await page.route(/\/public\/dashboard(?:\?|$)/, route => route.fulfill({ json: users }));
  await page.goto('/dashboard');
  const list = page.getByRole('region', { name: '用户列表' });
  const navigation = list.getByRole('navigation', { name: '用户列表分页' });
  await expect(page.getByRole('heading', { level: 2 }).last()).toHaveText('用户列表');
  await expect(list.getByRole('button', { name: '查看档案' })).toHaveCount(20);
  await expect(navigation.getByRole('button', { name: '上一页' })).toBeDisabled();
  await navigation.getByRole('button', { name: '下一页' }).click();
  await expect(list.getByRole('button', { name: '查看档案' })).toHaveCount(20);
  await expect(list.getByText('用户 20', { exact: true })).toBeVisible();
  await expect(list.getByText('用户 0', { exact: true })).toHaveCount(0);
  await navigation.getByRole('button', { name: '下一页' }).click();
  await expect(list.getByRole('button', { name: '查看档案' })).toHaveCount(5);
  await expect(navigation.getByText('第 3 / 3 页')).toBeVisible();
  await expect(navigation.getByRole('button', { name: '下一页' })).toBeDisabled();
  await list.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await list.screenshot({ path: testInfo.outputPath('users-last-page.png') });
  await navigation.getByRole('button', { name: '上一页' }).click();
  await expect(list.getByRole('button', { name: '查看档案' })).toHaveCount(20);
  await expect(navigation.getByText('第 2 / 3 页')).toBeVisible();
});

test('未登录访问、按需翻页、图表及布局', async ({ page }, testInfo) => {
  const fixture = dashboardFixture(23);
  const events = [...fixture.light, ...chartEvents.map(event => ({ ...event, userId: 'user2', userName: '用户2' }))];
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/(?:public\/dashboard|user\/[^/]+\/public|public\/users\/[^/]+\/events)(?:\?|$)/, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/dev/, '');
    requests.push(path);
    if (path === '/public/dashboard') return route.fulfill({ json: events });
    if (path === '/user/user1/public') return route.fulfill({ json: { profile: { bio: '分页测试公开简介' } } });
    if (path === '/public/users/user1/events') {
      const ids = JSON.parse(url.searchParams.get('ids'));
      expect(ids.length).toBeLessThanOrEqual(20);
      return route.fulfill({ json: ids.map(id => fixture.details.find(event => event.eventId === id)) });
    }
    return route.fulfill({ status: 404, json: { message: 'Unexpected test API request' } });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '公开仪表板', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看档案' })).toHaveCount(2);
  expect(requests).toContain('/public/dashboard');
  expect(requests).not.toContain('/all-events');
  expect(requests).not.toContain('/public/users/user1/events');
  await expect(page.locator('canvas')).toHaveCount(3);
  await page.getByRole('combobox').first().selectOption('vfs-only');
  await expect(page.locator('canvas')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: '查看档案' }).first().click();
  const drawer = page.getByRole('dialog', { name: '用户公开资料' });
  await expect(drawer.getByText('明细 1', { exact: true })).toBeVisible();
  await expect(drawer.getByText('23', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: '下一页' }).click();
  await expect(drawer.getByText('明细 21', { exact: true })).toBeVisible();
  await expect(drawer.getByText('明细 1', { exact: true })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: '下一页' })).toBeDisabled();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('details.png') });
  await drawer.getByRole('button', { name: '关闭用户资料' }).click();
  await expect(drawer).toHaveCount(0);
  expect(errors).toEqual([]);
});
