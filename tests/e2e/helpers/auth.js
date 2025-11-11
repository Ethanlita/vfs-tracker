/**
 * @file E2E 测试认证辅助函数
 * @description 提供登录、登出等认证相关的辅助函数
 */

/**
 * 使用测试账号登录
 * 
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @param {Object} options - 登录选项
 * @param {string} options.email - 测试账号邮箱 (可选，默认使用环境变量)
 * @param {string} options.password - 测试账号密码 (可选，默认使用环境变量)
 * @param {number} options.timeout - 超时时间，单位毫秒 (默认 30000)
 * @returns {Promise<void>}
 * 
 * @example
 * test('需要登录的测试', async ({ page }) => {
 *   await loginAsTestUser(page);
 *   // 现在可以执行需要认证的操作
 * });
 */
const USER_MENU_SELECTOR = '[data-testid="user-menu"], .user-menu, button:has-text("账号"), button:has-text("Account")';
const LOGOUT_BUTTON_SELECTOR = '[data-testid="logout-button"], button:has-text("登出"), button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("登出"), a:has-text("Logout")';

export async function loginAsTestUser(page, options = {}) {
  const {
    email = process.env.VITE_CONTRACT_TEST_USER_EMAIL,
    password = process.env.VITE_CONTRACT_TEST_USER_PASSWORD,
    timeout = 30000
  } = options;

  // 验证环境变量
  if (!email || !password) {
    throw new Error(
      '缺少测试账号凭据！\n' +
      '请确保以下环境变量已设置：\n' +
      '  - VITE_CONTRACT_TEST_USER_EMAIL\n' +
      '  - VITE_CONTRACT_TEST_USER_PASSWORD\n\n' +
      '参考文档: docs/CONTRACT_TEST_ENVIRONMENT.md'
    );
  }

  console.log(`🔐 开始登录测试账号: ${email}`);

  try {
    // 导航到首页
    await page.goto('/', { waitUntil: 'networkidle', timeout });

    // 查找并点击登录按钮
    const loginButton = page.locator('header button:has-text("登录"), header button:has-text("Login"), header button:has-text("Sign In")').first();
    await loginButton.highlight();
    await loginButton.click({ timeout: 10000 });

    console.log('  ✓ 找到并点击登录按钮');

    // 等待登录表单加载
    await page.waitForSelector(
      'input[type="email"], input[type="text"], input[name*="email"], input[name*="username"]',
      { timeout: 10000 }
    );

    console.log('  ✓ 登录表单已加载');

    // 填写邮箱/用户名
    const emailInput = page.locator(
      'input[type="email"], input[name*="email"], input[name*="username"]'
    ).first();
    await emailInput.fill(email);

    console.log('  ✓ 已填写邮箱');

    // 填写密码
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(password);

    console.log('  ✓ 已填写密码');

    // 提交登录表单
    const submitButton = page
      .locator('[data-amplify-authenticator] button[type="submit"]:not([role="tab"]), [data-amplify-authenticator] button:not([role="tab"]):has-text("Sign in")')
      .first();
    await submitButton.highlight();
    await submitButton.click();

    console.log('  ✓ 已提交登录表单');

    // 等待登录成功 - 可能重定向到多个页面
    await page.waitForURL(
      /\/(dashboard|events|home|my-page)/i,
      { timeout: 15000 }
    ).catch(async () => {
      // 如果 URL 没有变化，检查是否有用户菜单出现
      const userMenu = page.locator(USER_MENU_SELECTOR);
      await userMenu.waitFor({ state: 'visible', timeout: 5000 });
    });

    console.log('  ✓ 登录成功！\n');

    // 等待页面稳定
    await page.waitForLoadState('networkidle');

    await page.locator(`${USER_MENU_SELECTOR}, ${LOGOUT_BUTTON_SELECTOR}`).first().waitFor({
      state: 'visible',
      timeout: 15000
    });

  } catch (error) {
    console.error('❌ 登录失败:', error.message);

    // 截图以便调试
    const screenshotPath = `test-results/login-failure-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`📸 已保存失败截图: ${screenshotPath}`);

    throw new Error(`登录失败: ${error.message}`);
  }
}

/**
 * 登出当前用户
 * 
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @param {Object} options - 登出选项
 * @param {number} options.timeout - 超时时间，单位毫秒 (默认 10000)
 * @returns {Promise<void>}
 * 
 * @example
 * test('登出测试', async ({ page }) => {
 *   await loginAsTestUser(page);
 *   await logout(page);
 *   // 验证已返回登录页面
 * });
 */
export async function logout(page, options = {}) {
  const { timeout = 10000 } = options;

  console.log('🚪 开始登出');

  try {
    // 查找登出按钮（可能在用户菜单中）
    const logoutButton = page.locator(LOGOUT_BUTTON_SELECTOR);

    // 如果登出按钮不可见，尝试打开用户菜单
    if (!(await logoutButton.isVisible({ timeout: 2000 }).catch(() => false))) {
      const userMenu = page.locator(USER_MENU_SELECTOR).first();

      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenu.click();
        console.log('  ✓ 已打开用户菜单');
        
        // 等待菜单展开
        await page.waitForTimeout(500);
      }
    }

    // 点击登出按钮
    await logoutButton.first().click({ timeout });
    console.log('  ✓ 已点击登出按钮');

    // 等待返回登录页面或首页
    await page.waitForURL(/\/(login|signin|auth|^$)/i, { timeout }).catch(() => {
      // 如果 URL 没有变化，检查登录按钮是否重新出现
      return page.waitForSelector('text=/登录|Login|Sign In/i', { timeout });
    });

    console.log('  ✓ 登出成功！\n');

  } catch (error) {
    console.error('❌ 登出失败:', error.message);
    throw new Error(`登出失败: ${error.message}`);
  }
}

/**
 * 检查当前是否已登录
 * 
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @returns {Promise<boolean>} 是否已登录
 * 
 * @example
 * const loggedIn = await isLoggedIn(page);
 * if (!loggedIn) {
 *   await loginAsTestUser(page);
 * }
 */
export async function isLoggedIn(page) {
  try {
    // 检查是否有用户菜单或登出按钮
    const userIndicators = page.locator(`${USER_MENU_SELECTOR}, ${LOGOUT_BUTTON_SELECTOR}`);

    return await userIndicators.first().isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

/**
 * 清除所有认证状态（localStorage, sessionStorage, cookies）
 * 
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @returns {Promise<void>}
 * 
 * @example
 * test.afterEach(async ({ page }) => {
 *   await clearAuthState(page);
 * });
 */
export async function clearAuthState(page) {
  console.log('🧹 清除认证状态');

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.context().clearCookies();

  console.log('  ✓ 已清除所有认证状态\n');
}

/**
 * 等待用户资料加载完成
 * 
 * @param {import('@playwright/test').Page} page - Playwright 页面对象
 * @param {number} timeout - 超时时间，单位毫秒 (默认 10000)
 * @returns {Promise<void>}
 * 
 * @example
 * await loginAsTestUser(page);
 * await waitForProfileLoad(page);
 * // 现在可以访问需要用户资料的功能
 */
export async function waitForProfileLoad(page, timeout = 10000) {
  console.log('⏳ 等待用户资料加载');

  try {
    // 等待用户相关的 UI 元素出现
    await page.waitForSelector(
      '[data-testid="user-profile"], .user-profile, [data-testid="user-info"]',
      { timeout, state: 'visible' }
    ).catch(() => {
      // 如果没有专门的资料元素，等待网络空闲
      return page.waitForLoadState('networkidle', { timeout });
    });

    console.log('  ✓ 用户资料已加载\n');
  } catch (error) {
    console.warn('⚠️  用户资料加载超时（可能不影响测试）');
  }
}
