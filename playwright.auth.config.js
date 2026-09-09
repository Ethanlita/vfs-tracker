/** @file 邮箱验证专项测试：真实 Amplify SDK、模拟 Cognito HTTP、开发与生产双模式。 */
import { defineConfig, devices } from '@playwright/test';

// 使用虚构配置；网络由测试拦截，不需要真实账号或云端凭据。
const env = {
  VITE_COGNITO_USER_POOL_ID: 'us-east-1_AuthTest',
  VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: 'authtestclient',
  VITE_AWS_REGION: 'us-east-1',
  VITE_API_ENDPOINT: 'http://127.0.0.1:3099',
  VITE_API_STAGE: '',
  VITE_S3_BUCKET: 'auth-test-local'
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'signup-confirmation.spec.js',
  timeout: 30000,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'block' },
  projects: ['development', 'production'].flatMap(mode => [
    {
      name: `${mode}-desktop`,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: `http://127.0.0.1:${mode === 'development' ? 3095 : 3096}` }
    },
    {
      name: `${mode}-mobile`,
      use: { ...devices['Pixel 5'], channel: 'chrome', baseURL: `http://127.0.0.1:${mode === 'development' ? 3095 : 3096}` }
    }
  ]),
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3095 --strictPort',
      url: 'http://127.0.0.1:3095/login', env, reuseExistingServer: false
    },
    {
      command: 'node scripts/generate-posts-list.js && node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 3096 --strictPort',
      url: 'http://127.0.0.1:3096/login', env, reuseExistingServer: false, timeout: 120000
    }
  ]
});
