/**
 * @file 事件路由端到端测试。
 * @description 验证访客访问受保护事件页面时保留完整返回地址，避免测试向真实账号写入事件。
 */
import { test, expect } from '@playwright/test';

/** 断言受保护页面统一跳转到登录页并保留原目标。 */
async function expectProtectedRoute(page, target) {
  await page.goto(target);
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  const current = new URL(page.url());
  expect(current.pathname).toBe('/login');
  expect(current.searchParams.get('returnUrl')).toBe(target);
}

test.describe('事件页面访问控制', () => {
  test('事件管理页保留查询参数和锚点', async ({ page }) => {
    await expectProtectedRoute(page, '/event-manager?source=e2e#events');
  });

  test('新增事件页登录后可返回原页面', async ({ page }) => {
    await expectProtectedRoute(page, '/add-event?type=self-test');
  });
});
