/**
 * @file Playwright 端到端测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',
  
  // 测试超时时间
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  
  // 并行运行测试
  fullyParallel: true,
  
  // CI 环境下失败时不重试，本地开发可以重试
  retries: process.env.CI ? 2 : 0,
  
  // 并行 worker 数量
  workers: process.env.CI ? 1 : undefined,
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  // 共享配置
  use: {
    // 基础 URL
    baseURL: 'http://localhost:3000',
    
    // 追踪模式 - 失败时保留追踪
    trace: 'on-first-retry',
    
    // 截图模式
    screenshot: 'only-on-failure',
    
    // 视频模式
    video: 'retain-on-failure',
  },

  // 配置不同的浏览器项目
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 在测试前启动开发服务器
  webServer: {
    command: 'npm run dev:playwright',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
