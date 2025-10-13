/**
 * 单元测试: src/utils/timeout.js
 * 
 * 测试网络请求超时处理功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTimeout, withTimeout, withAmplifyTimeout, TIMEOUT_CONFIG } from '../../../src/utils/timeout.js';
import { ApiError } from '../../../src/utils/apiError.js';

describe('timeout.js 单元测试', () => {
  
  // ============================================
  // TIMEOUT_CONFIG 常量测试
  // ============================================
  
  describe('TIMEOUT_CONFIG', () => {
    it('应该包含所有预期的端点配置', () => {
      expect(TIMEOUT_CONFIG).toHaveProperty('/user', 8000);
      expect(TIMEOUT_CONFIG).toHaveProperty('/events', 8000);
      expect(TIMEOUT_CONFIG).toHaveProperty('/all-events', 34000);
      expect(TIMEOUT_CONFIG).toHaveProperty('/upload-url', 305000);
      expect(TIMEOUT_CONFIG).toHaveProperty('/file-url', 305000);
      expect(TIMEOUT_CONFIG).toHaveProperty('default', 8000);
    });

    it('应该为快速操作使用 8 秒超时', () => {
      expect(TIMEOUT_CONFIG['/user']).toBe(8000);
      expect(TIMEOUT_CONFIG['/user/public']).toBe(8000);
      expect(TIMEOUT_CONFIG['/events']).toBe(8000);
    });

    it('应该为复杂查询使用 34 秒超时', () => {
      expect(TIMEOUT_CONFIG['/all-events']).toBe(34000);
      expect(TIMEOUT_CONFIG['/song-recommendations']).toBe(34000);
      expect(TIMEOUT_CONFIG['/gemini-proxy']).toBe(34000);
    });

    it('应该为文件操作使用 305 秒超时', () => {
      expect(TIMEOUT_CONFIG['/upload-url']).toBe(305000);
      expect(TIMEOUT_CONFIG['/file-url']).toBe(305000);
    });
  });

  // ============================================
  // getTimeout 函数测试
  // ============================================
  
  describe('getTimeout', () => {
    it('应该返回精确匹配的超时时间', () => {
      expect(getTimeout('/user')).toBe(8000);
      expect(getTimeout('/all-events')).toBe(34000);
      expect(getTimeout('/upload-url')).toBe(305000);
    });

    it('应该移除查询参数', () => {
      expect(getTimeout('/user?id=123')).toBe(8000);
      expect(getTimeout('/all-events?filter=recent')).toBe(34000);
    });

    it('应该移除尾部斜杠', () => {
      expect(getTimeout('/user/')).toBe(8000);
      expect(getTimeout('/events/')).toBe(8000);
    });

    it('应该使用前缀匹配', () => {
      expect(getTimeout('/user/123')).toBe(8000);
      expect(getTimeout('/user/123/profile')).toBe(8000);
      expect(getTimeout('/events/abc-def')).toBe(8000);
    });

    it('未匹配路径应该返回默认超时', () => {
      expect(getTimeout('/unknown')).toBe(8000);
      expect(getTimeout('/api/v2/data')).toBe(8000);
      expect(getTimeout('')).toBe(8000);
    });

    it('应该处理复杂的路径', () => {
      expect(getTimeout('/user/123?includeProfile=true')).toBe(8000);
      expect(getTimeout('/all-events/?page=2&limit=50')).toBe(34000);
    });
  });

  // ============================================
  // withTimeout 函数测试
  // ============================================
  
  describe('withTimeout', () => {
    let unhandledRejections = [];
    
    beforeEach(() => {
      vi.useFakeTimers();
      
      // 捕获 unhandled rejections
      unhandledRejections = [];
      process.on('unhandledRejection', (reason) => {
        unhandledRejections.push(reason);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      process.removeAllListeners('unhandledRejection');
    });

    it('Promise 成功时应该正常 resolve', async () => {
      const successPromise = Promise.resolve('success data');

      const resultPromise = withTimeout(successPromise, 5000, {
        method: 'GET',
        path: '/api/test'
      });

      // 等待 Promise resolve,不要触发超时
      await vi.runOnlyPendingTimersAsync();

      const result = await resultPromise;
      expect(result).toBe('success data');
    });

    it('Promise 失败时应该正常 reject', async () => {
      // 使用立即 reject 的 Promise,但确保被 withTimeout 捕获
      const failPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('original error')), 10);
      });

      const resultPromise = withTimeout(failPromise, 5000, {
        method: 'GET',
        path: '/api/test'
      });

      // 确保 Promise 被捕获后再检查
      await vi.advanceTimersByTimeAsync(10);
      
      // 使用 try-catch 确保错误被处理
      try {
        await resultPromise;
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toBe('original error');
      }
    });

    it('超时时应该 reject 并抛出 ApiError', async () => {
      // 创建一个永远不会 resolve 的 Promise
      const neverResolve = new Promise(() => {});

      const resultPromise = withTimeout(neverResolve, 3000, {
        method: 'POST',
        path: '/api/upload'
      });

      // 快进时间到超时
      vi.advanceTimersByTime(3000);

      await expect(resultPromise).rejects.toThrow(ApiError);
      
      try {
        await resultPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.errorCode).toBe('TIMEOUT');
        expect(error.code).toBe('TIMEOUT'); // 兼容属性
        expect(error.statusCode).toBe(408);
        expect(error.timeout).toBe(3000); // 兼容属性
        expect(error.requestMethod).toBe('POST');
        expect(error.requestPath).toBe('/api/upload');
        expect(error.message).toContain('请求超时');
        expect(error.message).toContain('POST');
        expect(error.message).toContain('/api/upload');
        expect(error.details).toHaveProperty('message');
        expect(error.details).toHaveProperty('configuredTimeout', '3000ms');
      }
    });

    it('超时错误应该包含正确的提示信息 (短超时)', async () => {
      const neverResolve = new Promise(() => {});

      const resultPromise = withTimeout(neverResolve, 5000, {
        method: 'GET',
        path: '/api/quick'
      });

      vi.advanceTimersByTime(5000);

      try {
        await resultPromise;
      } catch (error) {
        expect(error.details.suggestion).toContain('请检查网络连接状态');
      }
    });

    it('超时错误应该包含正确的提示信息 (长超时)', async () => {
      const neverResolve = new Promise(() => {});

      const resultPromise = withTimeout(neverResolve, 305000, {
        method: 'POST',
        path: '/api/large-file'
      });

      vi.advanceTimersByTime(305000);

      try {
        await resultPromise;
      } catch (error) {
        expect(error.details.suggestion).toContain('大型操作可能需要更多时间');
      }
    });

    it('Promise 快速完成时应该清除超时定时器', async () => {
      const quickPromise = new Promise(resolve => {
        setTimeout(() => resolve('quick result'), 100);
      });

      const resultPromise = withTimeout(quickPromise, 5000, {
        method: 'GET',
        path: '/api/test'
      });

      // 快进 100ms (Promise 完成)
      vi.advanceTimersByTime(100);
      await vi.runOnlyPendingTimersAsync();

      const result = await resultPromise;
      expect(result).toBe('quick result');

      // 继续快进到超时时间,不应该触发超时错误
      vi.advanceTimersByTime(5000);
      // Promise 已经 resolved,不会有额外的错误
    });

    it('缺少 context 时应该使用默认值', async () => {
      const neverResolve = new Promise(() => {});

      const resultPromise = withTimeout(neverResolve, 2000);

      vi.advanceTimersByTime(2000);

      try {
        await resultPromise;
      } catch (error) {
        expect(error.message).toContain('REQUEST');
        expect(error.message).toContain('unknown');
        expect(error.requestMethod).toBeUndefined();
        expect(error.requestPath).toBeUndefined();
      }
    });
  });

  // ============================================
  // withAmplifyTimeout 函数测试
  // ============================================
  
  describe('withAmplifyTimeout', () => {
    let unhandledRejections = [];
    
    beforeEach(() => {
      vi.useFakeTimers();
      
      // 捕获 unhandled rejections
      unhandledRejections = [];
      process.on('unhandledRejection', (reason) => {
        unhandledRejections.push(reason);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      process.removeAllListeners('unhandledRejection');
    });

    it('Amplify operation 成功时应该返回结果', async () => {
      const mockBody = { data: 'amplify data' };
      const mockOperation = {
        response: Promise.resolve({
          body: {
            json: async () => mockBody
          }
        })
      };

      const resultPromise = withAmplifyTimeout(mockOperation, 5000, {
        method: 'GET',
        path: '/user/123'
      });

      await vi.runOnlyPendingTimersAsync();

      const result = await resultPromise;
      expect(result).toEqual(mockBody);
    });

    it('Amplify operation 失败时应该抛出原始错误', async () => {
      // 使用延迟的 rejection
      const mockOperation = {
        response: new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Amplify error')), 10);
        })
      };

      const resultPromise = withAmplifyTimeout(mockOperation, 5000, {
        method: 'POST',
        path: '/events'
      });

      await vi.advanceTimersByTimeAsync(10);

      // 使用 try-catch 确保错误被处理
      try {
        await resultPromise;
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).toBe('Amplify error');
      }
    });

    it('Amplify operation 超时时应该抛出 ApiError', async () => {
      const mockOperation = {
        response: new Promise(() => {}) // 永不 resolve
      };

      const resultPromise = withAmplifyTimeout(mockOperation, 3000, {
        method: 'GET',
        path: '/all-events'
      });

      vi.advanceTimersByTime(3000);

      try {
        await resultPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.errorCode).toBe('TIMEOUT');
        expect(error.statusCode).toBe(408);
        expect(error.requestMethod).toBe('GET');
        expect(error.requestPath).toBe('/all-events');
      }
    });

    it('Amplify operation 超时后不会调用 cancel (由 Amplify 自动处理)', async () => {
      const cancelFn = vi.fn();
      let rejectFn;
      const mockOperation = {
        response: new Promise((_, reject) => {
          rejectFn = reject; // 保存 reject 函数以便清理
        }),
        cancel: cancelFn
      };

      const resultPromise = withAmplifyTimeout(mockOperation, 2000, {
        method: 'GET',
        path: '/test'
      });

      // 触发超时
      await vi.advanceTimersByTimeAsync(2000);

      try {
        await resultPromise;
        // 不应该执行到这里
        expect.fail('应该抛出超时错误');
      } catch (error) {
        // withAmplifyTimeout 不主动调用 cancel,由 Amplify 内部处理
        expect(cancelFn).not.toHaveBeenCalled();
        expect(error).toBeInstanceOf(ApiError);
        expect(error.errorCode).toBe('TIMEOUT');
      } finally {
        // 清理未处理的 Promise
        if (rejectFn) rejectFn(new Error('cleanup'));
      }
    });

    it('Amplify operation 成功时应该清除超时定时器', async () => {
      const cancelFn = vi.fn();
      const mockBody = 'quick data';
      const mockOperation = {
        response: Promise.resolve({
          body: {
            json: async () => mockBody
          }
        }),
        cancel: cancelFn
      };

      const resultPromise = withAmplifyTimeout(mockOperation, 5000, {
        method: 'GET',
        path: '/test'
      });

      await vi.runOnlyPendingTimersAsync();

      const result = await resultPromise;
      expect(result).toBe(mockBody);

      // cancel 不应该被调用
      expect(cancelFn).not.toHaveBeenCalled();
    });
  });
});
