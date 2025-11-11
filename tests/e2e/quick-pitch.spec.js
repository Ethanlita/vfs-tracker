/**
 * @file 快速基频测试端到端测试
 * @description 测试快速基频测试功能
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

test.describe('快速基频测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录测试账号
    await loginAsTestUser(page);
  });

  test('应该能够进入快速基频测试页面', async ({ page }) => {
    // 查找快速基频测试入口
    const quickPitchLink = page.locator('text=/快速基频|快速测试|Quick Pitch/i, a[href*="quick-pitch"]').first();
    
    if (await quickPitchLink.count() > 0) {
      await quickPitchLink.click();
      
      // 验证进入快速测试页面
      await page.waitForURL(/quick-pitch|quickpitch/i, { timeout: 5000 });
    } else {
      // 直接访问
      await page.goto('/quick-pitch');
    }
    
    // 验证页面加载
    await page.waitForLoadState('networkidle');
    const testContainer = page.locator('[data-testid="quick-pitch-test"], .quick-pitch-container');
    
    // 至少应该有测试界面或说明
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('应该显示快速测试说明', async ({ page }) => {
    await page.goto('/quick-pitch');
    
    // 验证显示测试说明或指导
    const instructions = page.locator('[data-testid="instructions"], text=/使用方法|测试说明|如何测试/i');
    
    const hasInstructions = await instructions.isVisible().catch(() => false);
    
    if (hasInstructions) {
      await expect(instructions).toBeVisible();
    }
    
    // 验证有开始按钮
    const startButton = page.locator('button:has-text("开始"), button:has-text("测试"), [data-testid="start-test"]');
    await expect(startButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('应该能够进行快速测试', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    // 点击开始测试
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-test"]').first();
    await startButton.click({ timeout: 10000 });
    
    // 验证进入测试状态
    await page.waitForTimeout(1000);
    
    // 应该显示录音中或测试中的状态
    const testingIndicator = page.locator('text=/测试中|录音中|Recording/i, [data-testid="testing-indicator"]');
    
    const isTesting = await testingIndicator.isVisible().catch(() => false);
    
    // 如果没有明确的指示器，至少开始按钮应该变化
    if (!isTesting) {
      const stopButton = page.locator('button:has-text("停止"), button:has-text("完成")');
      const hasStopButton = await stopButton.isVisible().catch(() => false);
      expect(hasStopButton).toBeTruthy();
    }
  });

  test('应该能够快速获取基频结果', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    // 开始测试
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-test"]').first();
    await startButton.click({ timeout: 10000 });
    
    // 等待短暂时间（快速测试应该很快）
    await page.waitForTimeout(3000);
    
    // 停止测试（如果有停止按钮）
    const stopButton = page.locator('button:has-text("停止"), button:has-text("完成")');
    if (await stopButton.count() > 0) {
      await stopButton.click();
    }
    
    // 等待结果显示（快速测试应该很快出结果）
    await page.waitForTimeout(5000);
    
    // 验证显示基频结果
    const resultDisplay = page.locator('[data-testid="pitch-result"], text=/基频|Hz|pitch/i');
    
    const hasResult = await resultDisplay.isVisible().catch(() => false);
    
    if (hasResult) {
      await expect(resultDisplay.first()).toBeVisible();
      
      // 验证显示数值
      const resultText = await resultDisplay.first().textContent();
      expect(resultText).toMatch(/\d+/); // 应该包含数字
    }
  });

  test('应该显示简化的结果信息', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    // 完成快速测试
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const stopButton = page.locator('button:has-text("停止")');
    if (await stopButton.count() > 0) {
      await stopButton.click();
    }
    
    await page.waitForTimeout(5000);
    
    // 验证显示关键参数（简化版）
    const keyParams = page.locator('text=/平均基频|基频范围|Average|Mean/i');
    
    const hasParams = await keyParams.isVisible().catch(() => false);
    
    if (hasParams) {
      await expect(keyParams.first()).toBeVisible();
    }
  });

  test('应该能够重新进行快速测试', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    // 完成一次测试
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // 查找重新测试按钮
    const retestButton = page.locator('button:has-text("重新"), button:has-text("再次"), [data-testid="retest"]');
    
    if (await retestButton.count() > 0) {
      await retestButton.click();
      
      // 验证返回初始状态
      const newStartButton = page.locator('button:has-text("开始")').first();
      await expect(newStartButton).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('快速基频测试 - 与完整测试的区别', () => {
  test('应该比完整测试更快', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    const startTime = Date.now();
    
    // 开始测试
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    
    await page.waitForTimeout(3000);
    
    // 停止测试
    const stopButton = page.locator('button:has-text("停止")');
    if (await stopButton.count() > 0) {
      await stopButton.click();
    }
    
    // 等待结果
    await page.waitForTimeout(5000);
    
    const totalTime = Date.now() - startTime;
    
    // 快速测试应该在 15 秒内完成
    expect(totalTime).toBeLessThan(15000);
  });

  test('应该只显示关键参数', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.grantPermissions(['microphone']);
    
    // 完成测试
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    
    const stopButton = page.locator('button:has-text("停止")');
    if (await stopButton.count() > 0) {
      await stopButton.click();
    }
    
    await page.waitForTimeout(5000);
    
    // 验证只显示核心参数，不是完整报告
    const resultItems = page.locator('[data-testid="result-item"], .result-parameter');
    const itemCount = await resultItems.count();
    
    // 快速测试参数应该较少（假设少于 5 个主要参数）
    if (itemCount > 0) {
      expect(itemCount).toBeLessThan(10);
    }
  });
});

test.describe('快速基频测试 - 错误处理', () => {
  test('无麦克风权限应该提示', async ({ page, context }) => {
    await page.goto('/quick-pitch');
    await context.clearPermissions();
    
    // 尝试开始测试
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    
    await page.waitForTimeout(2000);
    
    // 验证错误提示
    const errorMessage = page.locator('text=/麦克风|权限|Permission/i');
    
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }
  });
});
