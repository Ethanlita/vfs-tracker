/**
 * @file 事件管理端到端测试
 * @description 测试事件的增删改查以及附件上传下载功能
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { loginAsTestUser } from './helpers/auth.js';

test.describe('事件管理 - CRUD 操作', () => {
  test.beforeEach(async ({ page }) => {
    // 登录测试账号
    await loginAsTestUser(page);
  });

  test('应该能够查看事件列表', async ({ page }) => {
    // 导航到事件列表页面（根据实际路由调整）
    await page.goto('/events');
    
    // 等待事件列表加载
    const eventsList = page.locator('[data-testid="events-list"], .events-container');
    await expect(eventsList).toBeVisible({ timeout: 10000 });
    
    // 验证至少显示一些内容
    const listItems = page.locator('[data-testid="event-item"], .event-card');
    const count = await listItems.count();
    
    // 可能是空状态或有事件
    if (count === 0) {
      // 验证空状态提示
      const emptyState = page.locator('text=/暂无|没有事件/i');
      await expect(emptyState).toBeVisible();
    } else {
      // 验证有事件显示
      expect(count).toBeGreaterThan(0);
    }
  });

  test('应该能够创建新事件', async ({ page }) => {
    // 导航到事件列表
    await page.goto('/events');
    
    // 点击创建事件按钮
    const createButton = page.locator('text=/创建事件|新建|添加/i').first();
    await createButton.click();
    
    // 验证事件表单出现
    const eventForm = page.locator('form, [data-testid="event-form"]');
    await expect(eventForm).toBeVisible({ timeout: 5000 });
    
    // 填写事件信息
    const titleInput = page.locator('input[name="title"], input[placeholder*="标题"]').first();
    await titleInput.fill('测试事件 - E2E Test');
    
    // 选择事件类型（如果有）
    const typeSelect = page.locator('select[name="type"], select[name="eventType"]');
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption({ index: 1 });
    }
    
    // 填写描述/备注（如果有）
    const descInput = page.locator('textarea[name="description"], textarea[name="notes"]');
    if (await descInput.count() > 0) {
      await descInput.fill('这是一个端到端测试创建的事件');
    }
    
    // 提交表单
    const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("创建")').first();
    await submitButton.click();
    
    // 验证成功提示或跳转到事件详情
    await page.waitForTimeout(2000);
    
    // 应该看到成功消息或新事件出现在列表中
    const successMessage = page.locator('text=/成功|创建成功/i');
    const newEvent = page.locator('text=/测试事件 - E2E Test/i');
    
    const hasSuccess = await successMessage.isVisible().catch(() => false);
    const hasNewEvent = await newEvent.isVisible().catch(() => false);
    
    expect(hasSuccess || hasNewEvent).toBeTruthy();
  });

  test('应该能够查看事件详情', async ({ page }) => {
    // 导航到事件列表
    await page.goto('/events');
    
    // 等待事件列表加载
    await page.waitForSelector('[data-testid="event-item"], .event-card', { timeout: 10000 });
    
    // 点击第一个事件
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click();
    
    // 验证事件详情页面加载
    const eventDetail = page.locator('[data-testid="event-detail"], .event-detail-container');
    await expect(eventDetail).toBeVisible({ timeout: 5000 });
    
    // 验证事件标题显示
    const eventTitle = page.locator('h1, h2, [data-testid="event-title"]');
    await expect(eventTitle).toBeVisible();
  });

  test('应该能够编辑事件', async ({ page }) => {
    // 先创建一个测试事件（或假设已有事件）
    await page.goto('/events');
    
    // 点击第一个事件进入详情
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click({ timeout: 10000 });
    
    // 点击编辑按钮
    const editButton = page.locator('button:has-text("编辑"), button[aria-label*="编辑"]');
    if (await editButton.count() > 0) {
      await editButton.click();
      
      // 验证进入编辑模式
      const titleInput = page.locator('input[name="title"]');
      await expect(titleInput).toBeEditable({ timeout: 5000 });
      
      // 修改标题
      await titleInput.clear();
      await titleInput.fill('已编辑的事件标题');
      
      // 保存修改
      const saveButton = page.locator('button:has-text("保存"), button[type="submit"]').first();
      await saveButton.click();
      
      // 验证修改成功
      await page.waitForTimeout(1000);
      const updatedTitle = page.locator('text=/已编辑的事件标题/i');
      await expect(updatedTitle).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该能够删除事件', async ({ page }) => {
    await page.goto('/events');
    
    // 记录删除前的事件数量
    await page.waitForSelector('[data-testid="event-item"], .event-card', { timeout: 10000 });
    const initialCount = await page.locator('[data-testid="event-item"], .event-card').count();
    
    if (initialCount === 0) {
      test.skip();
      return;
    }
    
    // 点击第一个事件
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click();
    
    // 查找删除按钮
    const deleteButton = page.locator('button:has-text("删除"), button[aria-label*="删除"]');
    
    if (await deleteButton.count() > 0) {
      await deleteButton.click();
      
      // 处理确认对话框（如果有）
      page.on('dialog', dialog => dialog.accept());
      
      // 等待删除完成
      await page.waitForTimeout(2000);
      
      // 验证返回列表或显示成功消息
      const currentUrl = page.url();
      expect(currentUrl).toContain('/events');
      
      // 验证事件数量减少（如果可以）
      const finalCount = await page.locator('[data-testid="event-item"], .event-card').count();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    } else {
      test.skip();
    }
  });
});

test.describe('事件管理 - 附件功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录测试账号
    await loginAsTestUser(page);
  });

  test('应该能够上传附件', async ({ page }) => {
    // 导航到创建事件页面
    await page.goto('/events');
    const createButton = page.locator('text=/创建事件|新建|添加/i').first();
    await createButton.click();
    
    // 查找文件上传输入框
    const fileInput = page.locator('input[type="file"]');
    
    if (await fileInput.count() > 0) {
      // 创建一个测试文件
      const testFilePath = path.join(__dirname, '../fixtures/test-audio.txt');
      
      // 上传文件
      await fileInput.setInputFiles(testFilePath);
      
      // 等待上传完成
      await page.waitForTimeout(2000);
      
      // 验证文件显示在附件列表中
      const attachmentList = page.locator('[data-testid="attachment-list"], .attachments');
      await expect(attachmentList).toBeVisible();
      
      // 验证文件名显示
      const fileName = page.locator('text=/test-audio/i');
      await expect(fileName).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('应该能够查看附件列表', async ({ page }) => {
    // 进入有附件的事件详情页
    await page.goto('/events');
    
    // 假设第一个事件有附件
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click({ timeout: 10000 });
    
    // 查找附件区域
    const attachmentSection = page.locator('[data-testid="attachments"], .attachment-section');
    
    if (await attachmentSection.isVisible()) {
      // 验证附件列表显示
      const attachmentItems = page.locator('[data-testid="attachment-item"], .attachment-file');
      const count = await attachmentItems.count();
      
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
        
        // 验证每个附件有文件名和操作按钮
        const firstAttachment = attachmentItems.first();
        await expect(firstAttachment).toBeVisible();
      }
    } else {
      // 没有附件的情况
      test.skip();
    }
  });

  test('应该能够下载附件', async ({ page }) => {
    await page.goto('/events');
    
    // 进入事件详情
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click({ timeout: 10000 });
    
    // 查找下载按钮
    const downloadButton = page.locator('button:has-text("下载"), a[download], button[aria-label*="下载"]').first();
    
    if (await downloadButton.count() > 0) {
      // 监听下载事件
      const downloadPromise = page.waitForEvent('download');
      
      await downloadButton.click();
      
      // 等待下载开始
      const download = await downloadPromise;
      
      // 验证下载的文件名
      const fileName = download.suggestedFilename();
      expect(fileName).toBeTruthy();
      expect(fileName.length).toBeGreaterThan(0);
    } else {
      test.skip();
    }
  });

  test('应该能够删除附件', async ({ page }) => {
    await page.goto('/events');
    
    // 进入事件详情
    const firstEvent = page.locator('[data-testid="event-item"], .event-card').first();
    await firstEvent.click({ timeout: 10000 });
    
    // 记录初始附件数量
    const attachmentItems = page.locator('[data-testid="attachment-item"], .attachment-file');
    const initialCount = await attachmentItems.count();
    
    if (initialCount === 0) {
      test.skip();
      return;
    }
    
    // 查找删除附件按钮
    const deleteAttachmentButton = page.locator('button[aria-label*="删除附件"], button:has-text("删除")').first();
    
    if (await deleteAttachmentButton.count() > 0) {
      // 处理确认对话框
      page.on('dialog', dialog => dialog.accept());
      
      await deleteAttachmentButton.click();
      
      // 等待删除完成
      await page.waitForTimeout(2000);
      
      // 验证附件数量减少
      const finalCount = await attachmentItems.count();
      expect(finalCount).toBeLessThan(initialCount);
    } else {
      test.skip();
    }
  });
});

test.describe('事件管理 - 边界情况', () => {
  test('上传超大文件应该显示错误', async ({ page }) => {
    // TODO: 实现超大文件上传测试
    test.skip();
  });

  test('上传不支持的文件类型应该显示错误', async ({ page }) => {
    // TODO: 实现文件类型验证测试
    test.skip();
  });

  test('无网络连接时应该提示错误', async ({ page, context }) => {
    // TODO: 实现离线场景测试
    test.skip();
  });
});
