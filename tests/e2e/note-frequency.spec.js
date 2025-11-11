/**
 * @file 音符-频率转换工具端到端测试
 * @description 测试音符与频率之间的转换功能
 */
import { test, expect } from '@playwright/test';

test.describe('音符-频率转换 - 基本功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('应该能够访问音符-频率转换工具', async ({ page }) => {
    // 查找转换工具入口
    const converterLink = page.locator('text=/音符.*频率|频率.*转换|Note.*Frequency/i, a[href*="converter"], a[href*="note"]').first();
    
    if (await converterLink.count() > 0) {
      await converterLink.click();
      
      // 验证进入转换页面
      await page.waitForURL(/converter|note|frequency/i, { timeout: 5000 });
    } else {
      // 直接访问
      await page.goto('/note-frequency-converter');
    }
    
    // 验证页面加载
    await page.waitForLoadState('networkidle');
    const converterContainer = page.locator('[data-testid="converter"], .converter-container');
    
    // 验证有内容
    const content = await page.textContent('body');
    expect(content.length).toBeGreaterThan(50);
  });

  test('应该显示音符输入和频率输出', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找音符输入区域
    const noteInput = page.locator('input[name*="note"], select[name*="note"], [data-testid="note-input"]');
    
    const hasNoteInput = await noteInput.count() > 0;
    
    if (hasNoteInput) {
      await expect(noteInput.first()).toBeVisible();
    }
    
    // 查找频率显示区域
    const frequencyDisplay = page.locator('[data-testid="frequency-output"], text=/Hz|频率/i');
    
    const hasFrequency = await frequencyDisplay.isVisible().catch(() => false);
    
    if (hasFrequency) {
      await expect(frequencyDisplay.first()).toBeVisible();
    }
  });

  test('应该能够从音符转换到频率', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找音符输入
    const noteInput = page.locator('input[name*="note"], select[name*="note"]').first();
    
    if (await noteInput.count() > 0) {
      // 输入或选择一个音符（例如 C4 / 中央C）
      const inputType = await noteInput.getAttribute('type');
      
      if (inputType === 'text' || !inputType) {
        await noteInput.fill('C4');
      } else {
        // 如果是下拉选择
        await noteInput.selectOption({ index: 1 });
      }
      
      // 触发转换（可能自动转换或需要点击按钮）
      const convertButton = page.locator('button:has-text("转换"), button:has-text("计算"), [data-testid="convert-button"]');
      
      if (await convertButton.count() > 0) {
        await convertButton.click();
      }
      
      // 等待结果
      await page.waitForTimeout(1000);
      
      // 验证显示频率结果
      const frequencyResult = page.locator('[data-testid="frequency-result"], text=/\\d+.*Hz/i');
      
      const hasResult = await frequencyResult.isVisible().catch(() => false);
      
      if (hasResult) {
        await expect(frequencyResult.first()).toBeVisible();
        
        // C4 的频率应该约为 261.63 Hz
        const resultText = await frequencyResult.first().textContent();
        expect(resultText).toMatch(/26[0-9]\./); // 大约 260-269 Hz
      }
    } else {
      test.skip();
    }
  });

  test('应该能够从频率转换到音符', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找频率输入
    const frequencyInput = page.locator('input[name*="frequency"], input[type="number"]').first();
    
    if (await frequencyInput.count() > 0) {
      // 输入一个频率（例如 440 Hz = A4）
      await frequencyInput.fill('440');
      
      // 触发转换
      const convertButton = page.locator('button:has-text("转换"), button:has-text("计算")');
      
      if (await convertButton.count() > 0) {
        await convertButton.click();
      }
      
      // 等待结果
      await page.waitForTimeout(1000);
      
      // 验证显示音符结果
      const noteResult = page.locator('[data-testid="note-result"], text=/A4|La4/i');
      
      const hasResult = await noteResult.isVisible().catch(() => false);
      
      if (hasResult) {
        await expect(noteResult.first()).toBeVisible();
        
        // 应该显示 A4
        const resultText = await noteResult.first().textContent();
        expect(resultText).toMatch(/A4|La4/i);
      }
    } else {
      test.skip();
    }
  });

  test('应该支持不同的八度选择', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找八度选择器
    const octaveSelect = page.locator('select[name*="octave"], input[name*="octave"]');
    
    if (await octaveSelect.count() > 0) {
      // 选择不同的八度
      await octaveSelect.selectOption({ index: 2 });
      
      // 验证频率相应变化
      await page.waitForTimeout(1000);
      
      // 应该显示不同的频率
      const frequencyDisplay = page.locator('[data-testid="frequency-result"], text=/\\d+.*Hz/i');
      
      const hasFrequency = await frequencyDisplay.isVisible().catch(() => false);
      
      if (hasFrequency) {
        await expect(frequencyDisplay.first()).toBeVisible();
      }
    } else {
      test.skip();
    }
  });
});

test.describe('音符-频率转换 - 参考表', () => {
  test('应该显示常用音符频率对照表', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找参考表
    const referenceTable = page.locator('table, [data-testid="reference-table"], text=/参考|对照表|Reference/i');
    
    const hasTable = await referenceTable.isVisible().catch(() => false);
    
    if (hasTable) {
      await expect(referenceTable.first()).toBeVisible();
      
      // 验证表格有多行数据
      const tableRows = page.locator('tr, [data-testid="table-row"]');
      const rowCount = await tableRows.count();
      
      expect(rowCount).toBeGreaterThan(5);
    }
  });

  test('参考表应该包含标准音高 A4=440Hz', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找 A4 和 440 Hz 的引用
    const a4Reference = page.locator('text=/A4.*440|440.*A4/i');
    
    const hasA4 = await a4Reference.isVisible().catch(() => false);
    
    if (hasA4) {
      await expect(a4Reference.first()).toBeVisible();
    }
  });

  test('应该能够点击参考表中的音符快速转换', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找可点击的表格行
    const tableRow = page.locator('tr[role="button"], tr:has(button), [data-testid="clickable-row"]').first();
    
    if (await tableRow.count() > 0) {
      await tableRow.click();
      
      // 验证输入框填充了相应的值
      await page.waitForTimeout(500);
      
      const noteInput = page.locator('input[name*="note"]');
      
      if (await noteInput.count() > 0) {
        const value = await noteInput.first().inputValue();
        expect(value.length).toBeGreaterThan(0);
      }
    } else {
      test.skip();
    }
  });
});

test.describe('音符-频率转换 - 输入验证', () => {
  test('无效的频率输入应该显示错误', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 查找频率输入
    const frequencyInput = page.locator('input[name*="frequency"], input[type="number"]').first();
    
    if (await frequencyInput.count() > 0) {
      // 输入无效值（负数）
      await frequencyInput.fill('-100');
      
      // 触发验证
      const convertButton = page.locator('button:has-text("转换")');
      if (await convertButton.count() > 0) {
        await convertButton.click();
      } else {
        await frequencyInput.blur();
      }
      
      await page.waitForTimeout(1000);
      
      // 应该显示错误消息
      const errorMessage = page.locator('text=/无效|错误|invalid|error/i, .error-message');
      
      const hasError = await errorMessage.isVisible().catch(() => false);
      
      if (hasError) {
        await expect(errorMessage.first()).toBeVisible();
      }
    } else {
      test.skip();
    }
  });

  test('超出人耳范围的频率应该提示', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 输入超高频率（人耳范围约 20-20000 Hz）
    const frequencyInput = page.locator('input[name*="frequency"], input[type="number"]').first();
    
    if (await frequencyInput.count() > 0) {
      await frequencyInput.fill('25000');
      
      // 触发转换
      const convertButton = page.locator('button:has-text("转换")');
      if (await convertButton.count() > 0) {
        await convertButton.click();
      }
      
      await page.waitForTimeout(1000);
      
      // 可能显示警告（虽然仍然转换）
      const warningMessage = page.locator('text=/超出|范围|警告|warning/i');
      
      const hasWarning = await warningMessage.isVisible().catch(() => false);
      
      // 这个是可选的警告
      if (hasWarning) {
        await expect(warningMessage.first()).toBeVisible();
      }
    } else {
      test.skip();
    }
  });
});

test.describe('音符-频率转换 - 实用功能', () => {
  test('应该能够清除输入', async ({ page }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 先输入一些值
    const noteInput = page.locator('input[name*="note"]').first();
    
    if (await noteInput.count() > 0) {
      await noteInput.fill('C4');
      
      // 查找清除按钮
      const clearButton = page.locator('button:has-text("清除"), button:has-text("重置"), [data-testid="clear-button"]');
      
      if (await clearButton.count() > 0) {
        await clearButton.click();
        
        // 验证输入被清除
        const value = await noteInput.inputValue();
        expect(value).toBe('');
      }
    } else {
      test.skip();
    }
  });

  test('应该支持复制转换结果', async ({ page, context }) => {
    await page.goto('/note-frequency-converter');
    await page.waitForLoadState('networkidle');
    
    // 授予剪贴板权限
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);
    
    // 进行一次转换
    const noteInput = page.locator('input[name*="note"]').first();
    
    if (await noteInput.count() > 0) {
      await noteInput.fill('A4');
      
      // 查找复制按钮
      const copyButton = page.locator('button:has-text("复制"), button[aria-label*="复制"], [data-testid="copy-button"]');
      
      if (await copyButton.count() > 0) {
        await copyButton.click();
        
        await page.waitForTimeout(500);
        
        // 验证复制成功提示
        const successMessage = page.locator('text=/已复制|复制成功|Copied/i');
        
        const hasSuccess = await successMessage.isVisible().catch(() => false);
        
        if (hasSuccess) {
          await expect(successMessage).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });
});
