/**
 * API 超时处理集成测试
 * 
 * 测试内容:
 * 1. 不同端点使用正确的超时配置
 * 2. 请求超时时抛出正确的错误
 * 3. 超时错误包含完整的上下文信息
 * 4. 超时不影响正常请求
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { getUserProfile, getUploadUrl, getAllEvents, getEventsByUserId } from '../../../src/api.js';
import { getTimeout, isTimeoutError } from '../../../src/utils/timeout.js';

describe('API 超时处理', () => {
  describe('超时配置', () => {
    it('快速端点应使用 8 秒超时', () => {
      expect(getTimeout('/user/123')).toBe(8000);
      expect(getTimeout('/user/public/456')).toBe(8000);
      expect(getTimeout('/events/user789')).toBe(8000);
      expect(getTimeout('/avatar/test.jpg')).toBe(8000);
    });

    it('复杂查询应使用 34 秒超时', () => {
      expect(getTimeout('/all-events')).toBe(34000);
      expect(getTimeout('/song-recommendations')).toBe(34000);
      expect(getTimeout('/gemini-proxy')).toBe(34000);
    });

    it('文件操作应使用 305 秒超时', () => {
      expect(getTimeout('/upload-url')).toBe(305000);
      expect(getTimeout('/file-url')).toBe(305000);
    });

    it('未知端点应使用默认 8 秒超时', () => {
      expect(getTimeout('/unknown-endpoint')).toBe(8000);
      expect(getTimeout('/random/path')).toBe(8000);
    });
  });

  describe('超时行为', () => {
    afterEach(() => {
      server.resetHandlers();
    });

    it('应该在配置的超时时间后抛出错误', async () => {
      // Mock 一个慢速响应 (10秒)
      server.use(
        http.get('*/user/:userId', async () => {
          await delay(10000); // 超过 8 秒超时
          return HttpResponse.json({
            userId: 'test-user',
            profile: { userName: 'Test User' }
          });
        })
      );

      const startTime = Date.now();
      
      await expect(getUserProfile('test-user')).rejects.toThrow();
      
      const duration = Date.now() - startTime;
      
      // 应该在 8-9 秒之间超时 (8秒超时 + 少量误差)
      expect(duration).toBeGreaterThan(7000);
      expect(duration).toBeLessThan(10000);
    }, 15000); // 测试超时设置为 15 秒

    it('超时错误应包含正确的错误码和状态码', async () => {
      server.use(
        http.get('*/user/:userId', async () => {
          await delay(10000);
          return HttpResponse.json({ userId: 'test', profile: {} });
        })
      );

      try {
        await getUserProfile('test-user');
        expect.fail('应该抛出超时错误');
      } catch (error) {
        expect(error.code).toBe('TIMEOUT');
        expect(error.statusCode).toBe(408);
        expect(error.timeout).toBe(8000);
        expect(isTimeoutError(error)).toBe(true);
      }
    }, 15000);

    it('超时错误应包含详细的上下文信息', async () => {
      server.use(
        http.get('*/user/:userId', async () => {
          await delay(10000);
          return HttpResponse.json({ userId: 'test', profile: {} });
        })
      );

      try {
        await getUserProfile('test-user');
        expect.fail('应该抛出超时错误');
      } catch (error) {
        expect(error.message).toContain('请求超时');
        expect(error.details).toBeDefined();
        expect(error.details.message).toBeDefined();
        expect(error.details.configuredTimeout).toBe('8000ms');
        expect(error.details.suggestion).toContain('网络连接');
      }
    }, 15000);

    it('正常响应不应该超时', async () => {
      // Mock 快速响应 (100ms)
      server.use(
        http.get('*/user/:userId', async () => {
          await delay(100);
          return HttpResponse.json({
            userId: 'test-user',
            profile: {
              userName: 'Test User',
              email: 'test@example.com'
            }
          });
        })
      );

      const result = await getUserProfile('test-user');
      
      expect(result).toBeDefined();
      // authenticatedGet 返回完整响应 (没有 data 或 events 字段时)
      expect(result).toHaveProperty('userId', 'test-user');
      expect(result).toHaveProperty('profile');
      expect(result.profile).toHaveProperty('userName', 'Test User');
    });

    it('复杂查询应使用更长的超时时间', async () => {
      // 使用实际的函数名 getAllEvents (已存在于 src/api.js:272)
      // Mock 一个 20 秒的响应 (不超过 34 秒限制)
      server.use(
        http.get('*/all-events', async () => {
          await delay(20000);
          return HttpResponse.json([
            {
              eventId: 'event1',
              type: 'self-test',
              createdAt: new Date().toISOString()
            }
          ]);
        })
      );

      const startTime = Date.now();
      
      const result = await getAllEvents();
      
      const duration = Date.now() - startTime;
      
      // 应该成功完成,不超时
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(duration).toBeGreaterThan(19000);
      expect(duration).toBeLessThan(22000);
    }, 30000);

    it('文件操作应使用最长的超时时间', async () => {
      // Mock 一个 10 秒的文件上传响应
      server.use(
        http.post('*/upload-url', async () => {
          await delay(10000);
          return HttpResponse.json({
            uploadUrl: 'https://example.com/upload'
          });
        })
      );

      const startTime = Date.now();
      
      const result = await getUploadUrl('test-file.mp3', 'audio/mpeg');
      
      const duration = Date.now() - startTime;
      
      // 应该成功完成 (305 秒超时远大于 10 秒)
      // getUploadUrl 返回 data.uploadUrl (string)
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('https://');
      expect(duration).toBeGreaterThan(9000);
      expect(duration).toBeLessThan(12000);
    }, 15000);
  });

  describe('超时错误检测', () => {
    it('isTimeoutError 应该正确识别超时错误', () => {
      const timeoutError = {
        code: 'TIMEOUT',
        statusCode: 408,
        timeout: 8000
      };
      
      expect(isTimeoutError(timeoutError)).toBe(true);
    });

    it('isTimeoutError 应该拒绝非超时错误', () => {
      const networkError = {
        code: 'NETWORK_ERROR',
        statusCode: 0
      };
      
      const serverError = {
        code: 'INTERNAL_ERROR',
        statusCode: 500
      };
      
      expect(isTimeoutError(networkError)).toBe(false);
      expect(isTimeoutError(serverError)).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError({})).toBe(false);
    });
  });

  describe('多请求并发', () => {
    it('并发请求应该各自独立超时', async () => {
      // Mock 两个不同响应时间的请求
      let requestCount = 0;
      server.use(
        http.get('*/user/:userId', async ({ params }) => {
          requestCount++;
          const { userId } = params;
          
          if (userId === 'fast-user') {
            await delay(100);
            return HttpResponse.json({
              userId,
              profile: { userName: 'Fast User' }
            });
          } else {
            await delay(10000); // 超时
            return HttpResponse.json({
              userId,
              profile: { userName: 'Slow User' }
            });
          }
        })
      );

      const fastRequest = getUserProfile('fast-user');
      const slowRequest = getUserProfile('slow-user');

      const results = await Promise.allSettled([fastRequest, slowRequest]);

      expect(results[0].status).toBe('fulfilled');
      // authenticatedGet 返回完整响应
      expect(results[0].value).toHaveProperty('userId', 'fast-user');
      expect(results[0].value).toHaveProperty('profile');
      expect(results[0].value.profile).toHaveProperty('userName', 'Fast User');

      expect(results[1].status).toBe('rejected');
      expect(isTimeoutError(results[1].reason)).toBe(true);
    }, 15000);
  });

  describe('认证请求超时', () => {
    it('认证请求超时应该保留认证上下文', async () => {
      // 使用实际的函数名 getEventsByUserId (已存在于 src/api.js:285)
      server.use(
        http.get('*/events/:userId', async () => {
          await delay(10000);
          return HttpResponse.json([]);
        })
      );

      try {
        await getEventsByUserId('test-user');
        expect.fail('应该抛出超时错误');
      } catch (error) {
        expect(error.code).toBe('TIMEOUT');
        // 应该能看到这是一个 GET 请求
        expect(error.details).toBeDefined();
      }
    }, 15000);
  });
});
