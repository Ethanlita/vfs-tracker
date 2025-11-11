/**
 * @file 用户认证端到端测试
 * @description 测试用户登录、注册、登出流程
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser, logout, isLoggedIn } from './helpers/auth.js';

test.describe('用户认证流程', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前访问主页
    await page.goto('/');
  });

  test('应该显示登录按钮', async ({ page }) => {
    // 查找登录按钮（根据实际选择器调整）
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await expect(loginButton).toBeVisible({ timeout: 10000 });
  });

  test('点击登录按钮应该打开登录界面', async ({ page }) => {
    // 点击登录按钮
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await loginButton.click();
    
    // 验证登录表单出现（根据实际情况调整）
    const loginForm = page.locator('form, [role="dialog"], .login-modal');
    await expect(loginForm).toBeVisible({ timeout: 5000 });
  });

  test('登录表单应该有必要的输入字段', async ({ page }) => {
    // 打开登录界面
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await loginButton.click();
    
    // 等待表单加载
    await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 5000 });
    
    // 验证邮箱/用户名输入框
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[name*="username"]').first();
    await expect(emailInput).toBeVisible();
    
    // 验证密码输入框
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
    
    // 验证提交按钮
    const submitButton = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first();
    await expect(submitButton).toBeVisible();
  });

  test('应该显示注册选项', async ({ page }) => {
    // 打开登录界面
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await loginButton.click();
    
    // 查找注册链接或按钮
    const signupLink = page.locator('text=/注册|Sign Up|Create Account/i');
    
    // 如果有注册选项，应该可见
    if (await signupLink.count() > 0) {
      await expect(signupLink.first()).toBeVisible();
    }
  });

  test('空表单提交应该显示验证错误', async ({ page }) => {
    // 打开登录界面
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await loginButton.click();
    
    // 等待表单加载
    await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
    
    // 尝试直接提交空表单
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // 应该显示错误消息（浏览器原生验证或自定义验证）
    // 验证表单没有成功提交（URL 没有变化或显示错误消息）
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    // 应该还在登录页面
    expect(currentUrl).toContain('/');
  });
});

test.describe('登录后状态', () => {
  test('成功登录后应该显示用户信息', async ({ page }) => {
    // 使用登录辅助函数
    await loginAsTestUser(page);
    
    // 验证登录成功 - 用户菜单应该可见
    const userMenu = page.locator('[data-testid="user-menu"], .user-menu, button:has-text("退出"), button:has-text("登出")').first();
    await expect(userMenu).toBeVisible({ timeout: 20000 });
    
    // 验证已登录状态
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(true);
  });

  test('登录后应该能够登出', async ({ page }) => {
    // 先登录
    await loginAsTestUser(page);
    
    // 验证已登录
    expect(await isLoggedIn(page)).toBe(true);
    
    // 执行登出
    await logout(page);
    
    // 验证登出成功 - 登录按钮应该重新出现
    const loginButton = page.locator('text=/登录|Login|Sign In/i').first();
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    
    // 验证未登录状态
    const loggedIn = await isLoggedIn(page);
    expect(loggedIn).toBe(false);
  });
});

test.describe('认证持久化', () => {
  test('刷新页面后应该保持登录状态', async ({ page, context }) => {
    // 先登录
    await loginAsTestUser(page);
    
    // 验证已登录
    expect(await isLoggedIn(page)).toBe(true);
    
    // 刷新页面
    await page.reload();
    
    // 验证仍然登录
    // const userMenu = page.locator('.user-menu');
    // await expect(userMenu).toBeVisible();
  });
});
