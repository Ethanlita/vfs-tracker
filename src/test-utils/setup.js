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
      response: fetchPromise.then(async response => {
        console.log('[Amplify Mock] Raw response object keys:', Object.keys(response));
        console.log('[Amplify Mock] Response type:', typeof response);
        console.log('[Amplify Mock] Is Response instance:', response instanceof Response);
        console.log('[Amplify Mock] Has json method:', typeof response.json);
        console.log('[Amplify Mock] Has text method:', typeof response.text);
        console.log('[Amplify Mock] Has headers:', !!response.headers);
        console.log('[Amplify Mock] Received response:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        });
        
        // 预先读取响应数据 (因为 Response body 只能读取一次)
        let responseData;
        // 安全地访问 headers
        const contentType = response.headers?.get ? response.headers.get('content-type') : null;
        console.log('[Amplify Mock] Content-Type header:', contentType);
        console.log('[Amplify Mock] Attempting to parse response...');
        
        try {
          if (contentType && contentType.includes('application/json')) {
            console.log('[Amplify Mock] Parsing as JSON...');
            responseData = await response.json();
            console.log('[Amplify Mock] Parsed JSON responseData:', responseData);
          } else {
            console.log('[Amplify Mock] Parsing as text...');
            responseData = await response.text();
            console.log('[Amplify Mock] Parsed text responseData:', responseData);
          }
        } catch (error) {
          // 如果读取失败,使用空对象
          console.error('[Amplify Mock] ERROR parsing response!');
          console.error('[Amplify Mock] Error type:', error.constructor.name);
          console.error('[Amplify Mock] Error message:', error.message);
          console.error('[Amplify Mock] Error stack:', error.stack);
          responseData = null;
        }
        
        // 对于错误响应,抛出错误
        if (!response.ok) {
          const errorMessage = 
            responseData?.error || 
            responseData?.message || 
            (typeof responseData === 'string' ? responseData : null) ||
            response.statusText ||
            'Request failed';
          
          const error = new Error(errorMessage);
          error.statusCode = response.status;
          error.status = response.status;
          error.$metadata = { httpStatusCode: response.status };
          throw error;
        }
        
        // 成功响应: 返回缓存的数据
        // 确保 headers 是一个对象，提供 get 方法
        // 如果 response.headers 不存在或没有 get 方法,创建一个 Mock Headers 对象
        const headers = response.headers || {
          get: () => null,
          has: () => false,
          entries: () => [],
          keys: () => [],
          values: () => [],
        };
        
        return {
          statusCode: response.status,
          headers: headers,
          body: {
            json: () => Promise.resolve(responseData),
            text: () => Promise.resolve(typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
            blob: () => Promise.reject(new Error('Blob not supported in test environment')),
          }
        };
      })
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
      console.log('[Amplify Mock] POST request to:', url);
      console.log('[Amplify Mock] Request body:', options.body);
      
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
