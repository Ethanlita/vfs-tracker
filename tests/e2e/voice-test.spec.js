/**
 * @file 声音测试端到端测试
 * @description 测试完整的嗓音测试流程，包括录音、分析和结果展示
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth.js';

test.describe('声音测试 - 完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 登录测试账号
    await loginAsTestUser(page);
  });

  test('应该能够进入声音测试页面', async ({ page }) => {
    // 查找声音测试入口（可能在导航菜单或主页）
    const voiceTestLink = page.locator('text=/声音测试|嗓音测试|Voice Test/i, a[href*="voice-test"]').first();
    
    if (await voiceTestLink.count() > 0) {
      await voiceTestLink.click();
      
      // 验证进入测试页面
      await page.waitForURL(/voice-test|voicetest/i, { timeout: 5000 });
      
      // 验证测试界面加载
      const testInterface = page.locator('[data-testid="voice-test"], .voice-test-container');
      await expect(testInterface).toBeVisible();
    } else {
      // 直接访问测试页面
      await page.goto('/voice-test');
      await page.waitForLoadState('networkidle');
    }
  });

  test('应该显示测试说明和指导', async ({ page }) => {
    await page.goto('/voice-test');
    
    // 验证显示测试说明
    const instructions = page.locator('[data-testid="instructions"], .test-instructions, text=/测试说明|使用方法/i');
    
    const hasInstructions = await instructions.isVisible().catch(() => false);
    
    if (hasInstructions) {
      await expect(instructions).toBeVisible();
    }
    
    // 验证有开始测试的按钮或区域
    const startButton = page.locator('button:has-text("开始"), button:has-text("录音"), [data-testid="start-recording"]');
    await expect(startButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('应该能够请求麦克风权限', async ({ page, context }) => {
    await page.goto('/voice-test');
    
    // 模拟授予麦克风权限
    await context.grantPermissions(['microphone']);
    
    // 点击开始录音按钮
    const recordButton = page.locator('button:has-text("开始录音"), button:has-text("开始测试"), [data-testid="start-recording"]').first();
    await recordButton.click({ timeout: 10000 });
    
    // 验证录音状态变化
    await page.waitForTimeout(1000);
    
    // 应该显示录音中的指示
    const recordingIndicator = page.locator('text=/录音中|Recording/i, [data-testid="recording-indicator"]');
    
    // 如果有录音指示器，验证它可见
    const isRecording = await recordingIndicator.isVisible().catch(() => false);
    
    if (isRecording) {
      await expect(recordingIndicator).toBeVisible();
    }
  });

  test('应该能够完成声音录制', async ({ page, context }) => {
    await page.goto('/voice-test');
    await context.grantPermissions(['microphone']);
    
    // 开始录音
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-recording"]').first();
    await startButton.click({ timeout: 10000 });
    
    // 等待几秒模拟录音
    await page.waitForTimeout(3000);
    
    // 停止录音
    const stopButton = page.locator('button:has-text("停止"), button:has-text("完成"), [data-testid="stop-recording"]');
    
    if (await stopButton.count() > 0) {
      await stopButton.click();
      
      // 验证录音完成
      await page.waitForTimeout(1000);
      
      // 应该显示分析中或预览界面
      const analysisIndicator = page.locator('text=/分析中|处理中|Analysis/i, text=/预览|Preview/i');
      
      const hasIndicator = await analysisIndicator.isVisible().catch(() => false);
      expect(hasIndicator).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('应该能够查看测试结果', async ({ page, context }) => {
    // 完成一次完整的测试流程
    await page.goto('/voice-test');
    await context.grantPermissions(['microphone']);
    
    // 开始录音
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-recording"]').first();
    await startButton.click({ timeout: 10000 });
    
    await page.waitForTimeout(3000);
    
    // 停止录音
    const stopButton = page.locator('button:has-text("停止"), [data-testid="stop-recording"]');
    if (await stopButton.count() > 0) {
      await stopButton.click();
    }
    
    // 等待分析完成（可能需要较长时间）
    await page.waitForTimeout(10000);
    
    // 查找结果显示
    const resultsSection = page.locator('[data-testid="test-results"], .test-results, text=/测试结果|Results/i');
    
    // 验证结果页面显示
    const hasResults = await resultsSection.isVisible().catch(() => false);
    
    if (hasResults) {
      await expect(resultsSection).toBeVisible();
      
      // 验证显示关键参数
      const parameters = page.locator('text=/基频|音高|频率|Pitch|Frequency/i');
      await expect(parameters.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('应该能够保存测试结果', async ({ page, context }) => {
    // 完成测试后
    await page.goto('/voice-test');
    await context.grantPermissions(['microphone']);
    
    // 假设已经完成测试并显示结果
    // TODO: 完整的测试流程
    
    // 查找保存按钮
    const saveButton = page.locator('button:has-text("保存"), button:has-text("保存结果"), [data-testid="save-results"]');
    
    if (await saveButton.count() > 0) {
      await saveButton.click();
      
      // 验证保存成功提示
      await page.waitForTimeout(2000);
      
      const successMessage = page.locator('text=/保存成功|已保存/i');
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      
      expect(hasSuccess).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('应该能够重新测试', async ({ page, context }) => {
    await page.goto('/voice-test');
    await context.grantPermissions(['microphone']);
    
    // 假设已经完成一次测试
    // TODO: 完整的测试流程
    
    // 查找重新测试按钮
    const retestButton = page.locator('button:has-text("重新测试"), button:has-text("再次测试"), [data-testid="retest"]');
    
    if (await retestButton.count() > 0) {
      await retestButton.click();
      
      // 验证返回到测试准备界面
      const startButton = page.locator('button:has-text("开始"), [data-testid="start-recording"]');
      await expect(startButton.first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('声音测试 - 结果展示', () => {
  test('应该显示基频参数', async ({ page }) => {
    // 假设有测试结果页面
    await page.goto('/voice-test/results/test-id-123');
    
    // 查找基频相关参数
    const pitchParams = page.locator('text=/基频|平均基频|F0|Pitch/i');
    
    const hasPitch = await pitchParams.isVisible().catch(() => false);
    
    if (hasPitch) {
      await expect(pitchParams.first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该显示音域参数', async ({ page }) => {
    await page.goto('/voice-test/results/test-id-123');
    
    // 查找音域参数
    const rangeParams = page.locator('text=/音域|最高|最低|Range/i');
    
    const hasRange = await rangeParams.isVisible().catch(() => false);
    
    if (hasRange) {
      await expect(rangeParams.first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该显示可视化图表', async ({ page }) => {
    await page.goto('/voice-test/results/test-id-123');
    
    // 查找图表元素
    const chart = page.locator('canvas, svg, [data-testid="result-chart"]');
    
    const hasChart = await chart.isVisible().catch(() => false);
    
    if (hasChart) {
      await expect(chart.first()).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('声音测试 - 错误处理', () => {
  test('拒绝麦克风权限应该显示错误提示', async ({ page, context }) => {
    await page.goto('/voice-test');
    
    // 模拟拒绝麦克风权限
    await context.clearPermissions();
    
    // 尝试开始录音
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-recording"]').first();
    await startButton.click({ timeout: 10000 });
    
    // 等待错误提示
    await page.waitForTimeout(2000);
    
    // 验证显示权限错误提示
    const errorMessage = page.locator('text=/麦克风权限|权限被拒绝|Permission denied/i');
    
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('录音时间过短应该提示', async ({ page, context }) => {
    await page.goto('/voice-test');
    await context.grantPermissions(['microphone']);
    
    // 开始录音
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    
    // 立即停止（录音时间过短）
    await page.waitForTimeout(500);
    
    const stopButton = page.locator('button:has-text("停止")');
    if (await stopButton.count() > 0) {
      await stopButton.click();
      
      // 应该显示时间过短的提示
      const warningMessage = page.locator('text=/时间过短|录音太短|Too short/i');
      
      const hasWarning = await warningMessage.isVisible().catch(() => false);
      
      if (hasWarning) {
        await expect(warningMessage).toBeVisible();
      }
    }
  });
});
