/**
 * @file 契约测试设置文件
 * @description 
 * 契约测试不使用 MSW mock，直接调用真实的 AWS API
 * 需要真实的环境变量配置
 */

import { expect, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import 'whatwg-fetch';

// 验证环境变量
beforeAll(() => {
  const requiredEnvVars = [
    'VITE_COGNITO_USER_POOL_ID',
    'VITE_COGNITO_USER_POOL_WEB_CLIENT_ID',
    'VITE_AWS_REGION',
    'VITE_API_ENDPOINT',
    'VITE_S3_BUCKET',
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n请创建 .env.contract 文件并配置真实的 AWS 凭证');
    console.error('参考: .env.contract.example\n');
    throw new Error('契约测试需要真实的环境变量配置');
  }

  console.log('\n✅ 契约测试环境配置完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 API Endpoint:', import.meta.env.VITE_API_ENDPOINT);
  console.log('🪣 S3 Bucket:', import.meta.env.VITE_S3_BUCKET);
  console.log('🔐 Region:', import.meta.env.VITE_AWS_REGION);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  注意: 契约测试会调用真实的 AWS API');
  console.log('   可能会产生费用和数据修改\n');
});

// 不导入 MSW server
// 不 mock Amplify API - 让真实请求通过

console.log('📋 契约测试设置加载完成 - 不使用 MSW mock');
