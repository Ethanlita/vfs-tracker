/**
 * @file 主页端到端测试
 * @description 测试应用主页的加载和基本功能
 */
import { test, expect } from '@playwright/test';

test.describe('主页测试', () => {
  test('应该成功加载主页', async ({ page }) => {
    // 访问主页
    await page.goto('/');
    
    // 验证页面标题
    await expect(page).toHaveTitle(/VFS Tracker/);
    
    // 验证主要导航元素存在
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('应该显示欢迎信息', async ({ page }) => {
    await page.goto('/');
    
    // 查找欢迎文本（根据实际内容调整）
    const welcomeText = page.locator('text=/欢迎|Welcome/i');
    await expect(welcomeText).toBeVisible({ timeout: 10000 });
  });

  test('导航菜单应该可以点击', async ({ page }) => {
    await page.goto('/');
    
    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    
    // 查找所有导航链接
    const navLinks = page.locator('nav a');
    const count = await navLinks.count();
    
    // 至少应该有一些导航链接
    expect(count).toBeGreaterThan(0);
  });

  test('应该能够切换语言（如果有语言切换功能）', async ({ page }) => {
    await page.goto('/');
    
    // 查找语言切换按钮（根据实际实现调整选择器）
    const languageButton = page.locator('[aria-label*="language"], [data-testid="language-toggle"]');
    
    if (await languageButton.isVisible()) {
      await languageButton.click();
      // 验证语言切换菜单打开
      const languageMenu = page.locator('[role="menu"], .language-menu');
      await expect(languageMenu).toBeVisible();
    } else {
      // 如果没有语言切换功能，跳过测试
      test.skip();
    }
  });

  test('页面应该响应式适配移动端', async ({ page, isMobile }) => {
    await page.goto('/');
    
    if (isMobile) {
      // 在移动端，可能有汉堡菜单
      const mobileMenu = page.locator('[aria-label*="menu"], .mobile-menu-button');
      
      // 如果找到移动菜单按钮，验证它可见
      if (await mobileMenu.count() > 0) {
        await expect(mobileMenu.first()).toBeVisible();
      }
    }
  });
});

test.describe('性能测试', () => {
  test('首次内容绘制应该快速', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    
    // 等待主要内容加载
    await page.waitForSelector('body', { state: 'visible' });
    
    const loadTime = Date.now() - startTime;
    
    // 页面应该在 3 秒内加载
    expect(loadTime).toBeLessThan(3000);
  });

  test('页面不应该有控制台错误', async ({ page }) => {
    const consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 过滤掉某些预期的错误（如果有）
    const unexpectedErrors = consoleErrors.filter(error => {
      // 排除某些已知的良性错误
      return !error.includes('某些可以忽略的错误模式');
    });
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});
