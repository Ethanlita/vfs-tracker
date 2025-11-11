import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * @file Vitest 配置 - 契约测试专用
 * @description 
 * 契约测试不使用 MSW mock，直接调用真实的 AWS API
 * 需要配置真实的环境变量（通过 .env.contract 文件）
 */
export default defineConfig(({ mode }) => {
  // 加载 .env.contract 文件
  const env = loadEnv('contract', process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      
      // 契约测试不使用 MSW setup
      setupFiles: './src/test-utils/setup-contract.js',
      
      // 只运行契约测试
      include: ['tests/contract/**/*.test.{js,jsx}'],
      
      // 从 .env.contract 加载环境变量
      env: {
        VITE_COGNITO_USER_POOL_ID: env.VITE_COGNITO_USER_POOL_ID,
        VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
        VITE_AWS_REGION: env.VITE_AWS_REGION,
        VITE_API_ENDPOINT: env.VITE_API_ENDPOINT,
        VITE_API_STAGE: env.VITE_API_STAGE,
        VITE_S3_BUCKET: env.VITE_S3_BUCKET,
        // 测试用户凭证（用于认证测试）
        TEST_USER_EMAIL: env.TEST_USER_EMAIL,
        TEST_USER_PASSWORD: env.TEST_USER_PASSWORD,
      },
      
      // 网络请求需要更长的超时时间
      testTimeout: 30000,
      hookTimeout: 30000,
      
      // 契约测试通常较慢，不需要并行
      threads: false,
      
      // 输出更详细的信息
      reporter: 'verbose',
    },
  };
});
