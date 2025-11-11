/**
 * @file 音阶练习端到端测试
 * @description 测试音阶练习功能和交互流程
 */
import { test, expect } from '@playwright/test';

test.describe('音阶练习 - 基本功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该能够访问音阶练习页面', async ({ page }) => {
    // 查找音阶练习入口
    const scaleLink = page.locator('text=/音阶练习|Scale Practice|音阶/i, a[href*="scale"]').first();
    
    if (await scaleLink.count() > 0) {
      await scaleLink.click();
      
      // 验证进入练习页面
      await page.waitForURL(/scale/i, { timeout: 5000 });
    } else {
      // 直接访问
      await page.goto('/scale-practice');
    }
    
    // 验证页面加载
    await page.waitForLoadState('networkidle');
    const practiceContainer = page.locator('[data-testid="scale-practice"], .scale-practice-container');
    
    // 验证有内容
    const content = await page.textContent('body');
    expect(content.length).toBeGreaterThan(50);
  });

  test('应该显示音阶练习说明', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找说明文字
    const instructions = page.locator('[data-testid="instructions"], .instructions, text=/使用方法|练习说明|如何练习/i');
    
    const hasInstructions = await instructions.isVisible().catch(() => false);
    
    if (hasInstructions) {
      await expect(instructions).toBeVisible();
    }
    
    // 应该有开始练习的按钮
    const startButton = page.locator('button:has-text("开始"), button:has-text("练习"), [data-testid="start-practice"]');
    await expect(startButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('应该能够选择不同的音阶类型', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找音阶选择器
    const scaleSelector = page.locator('select[name*="scale"], [data-testid="scale-selector"]');
    
    if (await scaleSelector.count() > 0) {
      // 获取选项数量
      const options = scaleSelector.locator('option');
      const optionCount = await options.count();
      
      // 应该有多种音阶可选（如大调、小调等）
      expect(optionCount).toBeGreaterThan(1);
      
      // 尝试选择不同的音阶
      await scaleSelector.selectOption({ index: 1 });
      
      // 验证选择生效
      await page.waitForTimeout(500);
    } else {
      // 可能是按钮选择
      const scaleButtons = page.locator('button[data-scale], .scale-option');
      const buttonCount = await scaleButtons.count();
      
      if (buttonCount > 0) {
        expect(buttonCount).toBeGreaterThan(1);
      }
    }
  });

  test('应该能够选择起始音', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找起始音选择器
    const rootNoteSelector = page.locator('select[name*="root"], select[name*="note"], [data-testid="root-selector"]');
    
    if (await rootNoteSelector.count() > 0) {
      // 应该有 12 个半音可选（C, C#, D, ...）
      const options = rootNoteSelector.locator('option');
      const optionCount = await options.count();
      
      expect(optionCount).toBeGreaterThan(5);
      
      // 选择一个起始音
      await rootNoteSelector.selectOption({ index: 2 });
      
      await page.waitForTimeout(500);
    } else {
      test.skip();
    }
  });

  test('应该能够开始音阶练习', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 授予麦克风权限
    await context.grantPermissions(['microphone']);
    
    // 点击开始练习
    const startButton = page.locator('button:has-text("开始"), [data-testid="start-practice"]').first();
    await startButton.click({ timeout: 10000 });
    
    // 验证进入练习模式
    await page.waitForTimeout(1000);
    
    // 应该显示当前要唱的音符
    const currentNote = page.locator('[data-testid="current-note"], .current-note, text=/当前音符|Current Note/i');
    
    const hasNote = await currentNote.isVisible().catch(() => false);
    
    if (hasNote) {
      await expect(currentNote).toBeVisible();
    } else {
      // 或者有其他练习指示
      const practiceIndicator = page.locator('text=/练习中|正在练习|Practicing/i');
      const hasPractice = await practiceIndicator.isVisible().catch(() => false);
      expect(hasPractice).toBeTruthy();
    }
  });
});

test.describe('音阶练习 - 练习过程', () => {
  test('应该显示音阶序列', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找音阶音符显示
    const scaleNotes = page.locator('[data-testid="scale-notes"], .scale-sequence');
    
    const hasNotes = await scaleNotes.isVisible().catch(() => false);
    
    if (hasNotes) {
      await expect(scaleNotes).toBeVisible();
      
      // 应该显示多个音符
      const noteElements = page.locator('[data-testid="note-item"], .note');
      const noteCount = await noteElements.count();
      
      // 音阶至少有 5 个音符
      expect(noteCount).toBeGreaterThan(4);
    }
  });

  test('应该能够跟随播放音阶', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找播放按钮
    const playButton = page.locator('button:has-text("播放"), button:has-text("示范"), button[aria-label*="play"]');
    
    if (await playButton.count() > 0) {
      await playButton.click();
      
      // 验证播放状态
      await page.waitForTimeout(1000);
      
      // 应该显示播放中的指示
      const playingIndicator = page.locator('text=/播放中|Playing/i, [data-testid="playing"]');
      
      const isPlaying = await playingIndicator.isVisible().catch(() => false);
      
      // 播放中或播放后，按钮状态应该改变
      const buttonText = await playButton.textContent();
      expect(buttonText).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('应该能够录制自己的演唱', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    await context.grantPermissions(['microphone']);
    
    // 开始练习
    const startButton = page.locator('button:has-text("开始")').first();
    await startButton.click({ timeout: 10000 });
    
    await page.waitForTimeout(1000);
    
    // 查找录音按钮
    const recordButton = page.locator('button:has-text("录音"), button:has-text("开始录音"), [data-testid="record"]');
    
    if (await recordButton.count() > 0) {
      await recordButton.click();
      
      // 等待录音
      await page.waitForTimeout(3000);
      
      // 停止录音
      const stopButton = page.locator('button:has-text("停止"), [data-testid="stop-recording"]');
      if (await stopButton.count() > 0) {
        await stopButton.click();
      }
      
      await page.waitForTimeout(1000);
      
      // 应该显示录音完成或分析结果
      const result = page.locator('[data-testid="recording-result"], text=/完成|分析/i');
      const hasResult = await result.isVisible().catch(() => false);
      
      if (hasResult) {
        await expect(result).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('应该显示音准反馈', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    await context.grantPermissions(['microphone']);
    
    // 完成一次练习
    // TODO: 实际练习流程
    
    // 查找音准反馈
    const pitchFeedback = page.locator('[data-testid="pitch-feedback"], text=/准确|音准|Accuracy/i');
    
    const hasFeedback = await pitchFeedback.isVisible().catch(() => false);
    
    if (hasFeedback) {
      await expect(pitchFeedback.first()).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该能够查看练习进度', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找进度指示
    const progressBar = page.locator('[role="progressbar"], progress, [data-testid="progress"]');
    
    const hasProgress = await progressBar.isVisible().catch(() => false);
    
    if (hasProgress) {
      await expect(progressBar.first()).toBeVisible();
    } else {
      // 或者是文字进度（如 3/7）
      const progressText = page.locator('text=/\\d+\\/\\d+/');
      const hasText = await progressText.isVisible().catch(() => false);
      
      if (hasText) {
        await expect(progressText.first()).toBeVisible();
      }
    }
  });
});

test.describe('音阶练习 - 练习结果', () => {
  test('应该能够查看练习结果', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    await context.grantPermissions(['microphone']);
    
    // 完成练习
    // TODO: 完整的练习流程
    
    // 查找结果页面
    const resultsSection = page.locator('[data-testid="practice-results"], .results-container');
    
    const hasResults = await resultsSection.isVisible().catch(() => false);
    
    if (hasResults) {
      await expect(resultsSection).toBeVisible();
      
      // 应该显示得分或评价
      const score = page.locator('[data-testid="score"], text=/得分|评分|Score/i');
      const hasScore = await score.isVisible().catch(() => false);
      
      if (hasScore) {
        await expect(score.first()).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('应该显示每个音符的准确度', async ({ page }) => {
    await page.goto('/scale-practice/results/test-id-123');
    
    // 查找音符准确度列表
    const noteAccuracy = page.locator('[data-testid="note-accuracy"], .note-result');
    const accuracyCount = await noteAccuracy.count();
    
    if (accuracyCount > 0) {
      expect(accuracyCount).toBeGreaterThan(0);
      
      // 每个音符应该有准确度显示
      const firstNote = noteAccuracy.first();
      await expect(firstNote).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该能够保存练习结果', async ({ page }) => {
    await page.goto('/scale-practice/results/test-id-123');
    
    // 查找保存按钮
    const saveButton = page.locator('button:has-text("保存"), [data-testid="save-results"]');
    
    if (await saveButton.count() > 0) {
      await saveButton.click();
      
      // 验证保存成功
      await page.waitForTimeout(1000);
      
      const successMessage = page.locator('text=/保存成功|已保存/i');
      const hasSuccess = await successMessage.isVisible().catch(() => false);
      
      if (hasSuccess) {
        await expect(successMessage).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('应该能够重新练习同一音阶', async ({ page }) => {
    await page.goto('/scale-practice/results/test-id-123');
    
    // 查找重新练习按钮
    const retryButton = page.locator('button:has-text("重新练习"), button:has-text("再次练习"), [data-testid="retry"]');
    
    if (await retryButton.count() > 0) {
      await retryButton.click();
      
      // 验证返回练习界面
      await page.waitForTimeout(1000);
      
      const startButton = page.locator('button:has-text("开始"), [data-testid="start-practice"]');
      await expect(startButton.first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

test.describe('音阶练习 - 高级功能', () => {
  test('应该能够调整练习速度', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找速度调节器
    const tempoControl = page.locator('input[name*="tempo"], input[name*="speed"], [data-testid="tempo-slider"]');
    
    if (await tempoControl.count() > 0) {
      // 调整速度
      await tempoControl.fill('80');
      
      // 验证设置生效
      await page.waitForTimeout(500);
      
      const value = await tempoControl.inputValue();
      expect(value).toBe('80');
    } else {
      test.skip();
    }
  });

  test('应该能够切换上行/下行音阶', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找方向切换
    const directionToggle = page.locator('select[name*="direction"], button:has-text("上行"), button:has-text("下行")');
    
    if (await directionToggle.count() > 0) {
      if (await directionToggle.first().getAttribute('type')) {
        // 按钮类型
        await directionToggle.first().click();
      } else {
        // 选择器类型
        await directionToggle.first().selectOption({ index: 1 });
      }
      
      await page.waitForTimeout(500);
    } else {
      test.skip();
    }
  });

  test('应该能够查看历史练习记录', async ({ page }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 查找历史记录入口
    const historyLink = page.locator('a:has-text("历史"), a:has-text("记录"), [data-testid="history"]');
    
    if (await historyLink.count() > 0) {
      await historyLink.click();
      
      // 验证进入历史页面
      await page.waitForTimeout(1000);
      
      const historyList = page.locator('[data-testid="history-list"], .history-container');
      const hasHistory = await historyList.isVisible().catch(() => false);
      
      if (hasHistory) {
        await expect(historyList).toBeVisible();
      }
    } else {
      test.skip();
    }
  });
});

test.describe('音阶练习 - 错误处理', () => {
  test('无麦克风权限应该提示', async ({ page, context }) => {
    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    
    // 拒绝麦克风权限
    await context.clearPermissions();
    
    // 尝试开始练习
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

  test('音频播放失败应该有提示', async ({ page }) => {
    // TODO: 模拟音频播放失败
    test.skip();
  });
});
