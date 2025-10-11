/**
 * @file 测试辅助函数
 * @description 提供常用的测试工具函数
 */

import { vi } from 'vitest';
import { validateData } from '../api/schemas.js';

/**
 * 等待指定的毫秒数
 * @param {number} ms - 等待时间（毫秒）
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 等待下一个微任务
 */
export const waitForNextUpdate = () => new Promise(resolve => {
  setTimeout(resolve, 0);
});

/**
 * 创建一个 mock 的 Fetch Response
 * @param {any} data - 响应数据
 * @param {number} status - HTTP 状态码
 */
export function createMockResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)]),
  };
}

/**
 * 创建一个 mock 的 Amplify Auth Session
 * @param {Object} options - 配置选项
 * @param {string} options.userId - 用户 ID
 * @param {string} options.email - 用户邮箱
 * @param {string} options.nickname - 用户昵称
 */
export function createMockAuthSession(options = {}) {
  const {
    userId = 'us-east-1:test-user-id',
    email = 'test@example.com',
    nickname = 'testuser',
  } = options;

  return {
    tokens: {
      idToken: {
        toString: () => 'mock-id-token-12345',
        payload: {
          sub: userId,
          email,
          nickname,
          'cognito:username': nickname,
          token_use: 'id',
          auth_time: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      accessToken: {
        toString: () => 'mock-access-token-12345',
      },
    },
    credentials: {
      accessKeyId: 'mock-access-key',
      secretAccessKey: 'mock-secret-key',
    },
  };
}

/**
 * 校验数据是否符合指定的 Joi Schema
 * @param {Object} schema - Joi schema
 * @param {any} data - 要校验的数据
 * @throws {Error} 如果数据不符合 schema
 */
export function assertValidSchema(schema, data) {
  const result = validateData(schema, data);
  if (!result.valid) {
    const errorMessages = result.errors.map(e => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(`Schema validation failed:\n${errorMessages}`);
  }
  return result.value;
}

/**
 * 创建一个 mock 的 console 方法，可以捕获输出
 * @param {string} method - console 方法名（log, warn, error 等）
 * @returns {Function} 恢复原始 console 方法的函数
 */
export function mockConsole(method = 'error') {
  const originalMethod = console[method];
  const mockMethod = vi.fn();
  console[method] = mockMethod;
  
  return () => {
    console[method] = originalMethod;
  };
}

/**
 * 抑制控制台输出（用于测试预期会产生错误的情况）
 * @param {Function} fn - 要执行的函数
 */
export async function suppressConsole(fn) {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = vi.fn();
  console.warn = vi.fn();
  
  try {
    await fn();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/**
 * 生成一个随机的测试 ID
 */
export function generateTestId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成一个 Cognito 格式的用户 ID
 */
export function generateUserId() {
  return `us-east-1:${generateTestId()}`;
}

/**
 * 生成一个事件 ID
 */
export function generateEventId() {
  return `event_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 断言数组包含特定元素
 */
export function assertArrayIncludes(array, element) {
  if (!array.includes(element)) {
    throw new Error(`Expected array to include ${element}, but it didn't`);
  }
}

/**
 * 断言对象包含特定属性
 */
export function assertObjectHasKey(obj, key) {
  if (!(key in obj)) {
    throw new Error(`Expected object to have key "${key}", but it didn't`);
  }
}

/**
 * Mock localStorage
 */
export function createMockLocalStorage() {
  const storage = {};
  return {
    getItem: vi.fn((key) => storage[key] || null),
    setItem: vi.fn((key, value) => {
      storage[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      for (const key in storage) {
        delete storage[key];
      }
    }),
  };
}

/**
 * 等待元素消失
 */
export async function waitForElementToBeRemoved(element, timeout = 3000) {
  const startTime = Date.now();
  while (document.contains(element)) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for element to be removed');
    }
    await wait(50);
  }
}
