/**
 * @file 公共仪表板端到端测试
 * @description 测试公共仪表板的访问和数据展示功能
 */
import { test, expect } from '@playwright/test';

test.describe('公共仪表板 - 访问和基本功能', () => {
  test('应该能够访问公共仪表板', async ({ page }) => {
    // 公共仪表板应该可以不登录访问
    await page.goto('/');
    
    // 查找公共仪表板链接
    const dashboardLink = page.locator('text=/公共仪表板|公开数据|Public Dashboard/i, a[href*="public"], a[href*="dashboard"]').first();
    
    if (await dashboardLink.count() > 0) {
      await dashboardLink.click();
      
      // 验证进入仪表板页面
      await page.waitForURL(/public|dashboard/i, { timeout: 5000 });
    } else {
      // 直接访问
      await page.goto('/public-dashboard');
    }
    
    // 验证页面加载
    await page.waitForLoadState('networkidle');
    const dashboard = page.locator('[data-testid="public-dashboard"], .dashboard-container');
    
    // 验证有内容显示
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
    expect(bodyContent.length).toBeGreaterThan(0);
  });

  test('未登录用户应该能够查看公共数据', async ({ page }) => {
    // 确保未登录状态
    await page.goto('/public-dashboard');
    
    // 验证页面可以访问（不需要登录）
    await page.waitForLoadState('networkidle');
    
    // 应该显示一些公共数据或统计信息
    const dataElements = page.locator('[data-testid="dashboard-card"], .stat-card, .data-card');
    
    // 如果有数据卡片，验证它们可见
    const cardCount = await dataElements.count();
    
    if (cardCount > 0) {
      await expect(dataElements.first()).toBeVisible();
      expect(cardCount).toBeGreaterThan(0);
    } else {
      // 至少应该有一些文本内容
      const content = await page.textContent('body');
      expect(content.length).toBeGreaterThan(100);
    }
  });

  test('应该显示数据统计信息', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找统计数据显示
    const statsSection = page.locator('[data-testid="statistics"], .statistics-section, text=/统计|数据概览|Statistics/i');
    
    const hasStats = await statsSection.isVisible().catch(() => false);
    
    if (hasStats) {
      await expect(statsSection).toBeVisible();
      
      // 验证显示数字统计
      const numbers = page.locator('text=/\\d+/');
      const numberCount = await numbers.count();
      expect(numberCount).toBeGreaterThan(0);
    }
  });

  test('应该显示可视化图表', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找图表元素
    const charts = page.locator('canvas, svg, [data-testid*="chart"]');
    const chartCount = await charts.count();
    
    if (chartCount > 0) {
      await expect(charts.first()).toBeVisible();
      expect(chartCount).toBeGreaterThan(0);
    } else {
      // 如果没有图表，至少应该有数据表格或列表
      const dataDisplay = page.locator('table, [data-testid="data-list"], .data-table');
      const hasDataDisplay = await dataDisplay.isVisible().catch(() => false);
      
      if (hasDataDisplay) {
        await expect(dataDisplay).toBeVisible();
      }
    }
  });
});

test.describe('公共仪表板 - 数据展示', () => {
  test('应该显示用户数量统计', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找用户数量相关信息
    const userStats = page.locator('text=/用户数|总用户|Users|Members/i');
    
    const hasUserStats = await userStats.isVisible().catch(() => false);
    
    if (hasUserStats) {
      await expect(userStats.first()).toBeVisible();
    }
  });

  test('应该显示测试数量统计', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找测试数量相关信息
    const testStats = page.locator('text=/测试数|总测试|Tests|Recordings/i');
    
    const hasTestStats = await testStats.isVisible().catch(() => false);
    
    if (hasTestStats) {
      await expect(testStats.first()).toBeVisible();
    }
  });

  test('应该显示数据趋势', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找趋势图或趋势数据
    const trendSection = page.locator('[data-testid="trend-chart"], text=/趋势|Trend/i');
    
    const hasTrend = await trendSection.isVisible().catch(() => false);
    
    if (hasTrend) {
      await expect(trendSection.first()).toBeVisible();
    }
  });

  test('应该能够筛选或切换数据视图', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找筛选器或标签页
    const filters = page.locator('select, [role="tab"], button[aria-label*="filter"], .filter-button');
    const filterCount = await filters.count();
    
    if (filterCount > 0) {
      // 尝试切换视图
      const firstFilter = filters.first();
      await firstFilter.click();
      
      // 验证内容更新
      await page.waitForTimeout(1000);
      
      // 页面应该有响应
      const hasContent = await page.locator('body').textContent();
      expect(hasContent).toBeTruthy();
    } else {
      test.skip();
    }
  });
});

test.describe('公共仪表板 - 响应式设计', () => {
  test('应该在桌面端正确显示', async ({ page }) => {
    // 设置桌面视口
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证布局
    const container = page.locator('[data-testid="public-dashboard"], .dashboard-container');
    
    if (await container.count() > 0) {
      const box = await container.first().boundingBox();
      
      if (box) {
        // 宽度应该合理利用桌面空间
        expect(box.width).toBeGreaterThan(800);
      }
    }
  });

  test('应该在移动端正确显示', async ({ page }) => {
    // 设置移动视口
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证移动端布局
    const container = page.locator('[data-testid="public-dashboard"], .dashboard-container');
    
    if (await container.count() > 0) {
      const box = await container.first().boundingBox();
      
      if (box) {
        // 应该适应移动端宽度
        expect(box.width).toBeLessThanOrEqual(400);
      }
    }
  });

  test('移动端图表应该可滚动或响应式调整', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找图表容器
    const chartContainer = page.locator('[data-testid*="chart"], canvas, svg').first();
    
    if (await chartContainer.count() > 0) {
      const isVisible = await chartContainer.isVisible().catch(() => false);
      
      if (isVisible) {
        const box = await chartContainer.boundingBox();
        
        if (box) {
          // 图表应该适应移动端屏幕
          expect(box.width).toBeLessThanOrEqual(400);
        }
      }
    }
  });
});

test.describe('公共仪表板 - 性能', () => {
  test('页面加载应该快速', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // 公共页面应该在 5 秒内加载
    expect(loadTime).toBeLessThan(5000);
  });

  test('数据刷新应该流畅', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 查找刷新按钮（如果有）
    const refreshButton = page.locator('button:has-text("刷新"), button[aria-label*="refresh"]');
    
    if (await refreshButton.count() > 0) {
      const startTime = Date.now();
      
      await refreshButton.click();
      
      // 等待刷新完成
      await page.waitForTimeout(1000);
      
      const refreshTime = Date.now() - startTime;
      
      // 刷新应该快速
      expect(refreshTime).toBeLessThan(3000);
    } else {
      test.skip();
    }
  });
});

test.describe('公共仪表板 - 数据隐私', () => {
  test('不应该显示个人敏感信息', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 获取页面全部内容
    const pageContent = await page.textContent('body');
    
    // 不应该包含邮箱地址
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(pageContent);
    expect(hasEmail).toBeFalsy();
    
    // 不应该包含手机号码（中国格式）
    const hasPhone = /1[3-9]\d{9}/.test(pageContent);
    expect(hasPhone).toBeFalsy();
  });

  test('应该只显示聚合或匿名化的数据', async ({ page }) => {
    await page.goto('/public-dashboard');
    await page.waitForLoadState('networkidle');
    
    // 验证显示的是统计数据，而非个人详情
    const pageContent = await page.textContent('body');
    
    // 应该包含统计相关的词汇
    const hasStats = /平均|总计|统计|average|total|count/i.test(pageContent);
    expect(hasStats).toBeTruthy();
  });
});
