/**
 * @file Vitest 全局测试设置
 * @description 在所有测试运行前执行的配置
 */

import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import 'whatwg-fetch'; // Polyfill fetch for jsdom
import { server } from './mocks/msw-server.js';
import { getFullApiEndpoint } from '../env.js';

// ==================== Mock AWS Amplify ====================
// 注意: 我们不再 mock isProductionReady()
// 目标是让生产代码正常运行，但 mock 所有 AWS 服务调用
// MSW 会拦截所有 HTTP 请求，Amplify Auth mock 会拦截认证调用

// Mock aws-amplify/api - 让 API 调用被 MSW 拦截
// 关键决策: 使用 undici 的 Request API (MSW 2.x 使用的标准)
// 注意: jsdom 环境需要通过 global.fetch 调用,这样才能被 MSW 拦截
vi.mock('aws-amplify/api', () => {
  /**
   * 创建符合 Amplify V6 API 结构的 mock 响应
   * @param {string} url - 请求的 URL
   * @param {RequestInit} options - fetch 选项
   * @returns {Object} 包含 response Promise 的对象
   */
  const createAmplifyResponse = (url, options = {}) => {
    // CRITICAL: 使用 global.fetch,这样 MSW 才能拦截
    const fetchPromise = globalThis.fetch(url, options);
    
    return {
      response: fetchPromise.then(response => ({
        statusCode: response.status,
        body: {
          json: () => response.json(),
          text: () => response.text(),
          blob: () => response.blob(),
        }
      }))
    };
  };

  return {
    get: vi.fn(({ apiName, path, options = {} }) => {
      const baseUrl = getFullApiEndpoint();
      const url = `${baseUrl}${path}`;
      
      return createAmplifyResponse(url, {
        method: 'GET',
        headers: options.headers || {},
      });
    }),

    post: vi.fn(({ apiName, path, options = {} }) => {
      const baseUrl = getFullApiEndpoint();
      const url = `${baseUrl}${path}`;
      
      return createAmplifyResponse(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(options.body || {}),
      });
    }),

    put: vi.fn(({ apiName, path, options = {} }) => {
      const baseUrl = getFullApiEndpoint();
      const url = `${baseUrl}${path}`;
      
      return createAmplifyResponse(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(options.body || {}),
      });
    }),

    del: vi.fn(({ apiName, path, options = {} }) => {
      const baseUrl = getFullApiEndpoint();
      const url = `${baseUrl}${path}`;
      
      return createAmplifyResponse(url, {
        method: 'DELETE',
        headers: options.headers || {},
      });
    }),
  };
});

// Mock aws-amplify/auth - 使用我们的 auth mock
vi.mock('aws-amplify/auth', () => {
  const { mockFetchAuthSession, mockSignOut, mockSignIn } = 
    require('./mocks/amplify-auth.js');
  return {
    fetchAuthSession: mockFetchAuthSession,
    signOut: mockSignOut,
    signIn: mockSignIn,
  };
});

// ==================== MSW Server 配置 ====================

// 启动 MSW server（在所有测试之前）
beforeAll(() => {
  server.listen({ 
    onUnhandledRequest: 'warn' // 对未处理的请求发出警告
  });
  console.log('🔧 MSW Server started');
});

// 每个测试后重置 handlers 和清理 React 组件
afterEach(() => {
  cleanup(); // 清理 React Testing Library 渲染的组件
  server.resetHandlers(); // 重置所有 handlers 到初始状态
});

// 所有测试完成后关闭 server
afterAll(() => {
  server.close();
  console.log('🔧 MSW Server closed');
});

// ==================== 全局配置 ====================

// 告诉 React Testing Library 我们在测试环境中
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock window.matchMedia（某些组件可能需要）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo（某些组件可能需要）
window.scrollTo = vi.fn();

// Mock IntersectionObserver（某些组件可能需要）
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver（某些组件可能需要）
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

console.log('✅ Test environment setup completed');
