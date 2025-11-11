/**
 * @file Delete Event API 集成测试
 * @description 测试删除事件相关 API 的调用和响应
 * 
 * 当前 API 接口:
 * - deleteEvent(eventId) - 删除指定的事件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { deleteEvent } from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { ApiError } from '../../../src/utils/apiError.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

describe('Delete Event API 集成测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:complete-user-001',
      email: 'complete@example.com',
      nickname: 'Complete User'
    });
  });

  describe('deleteEvent', () => {
    it('应该成功删除事件', async () => {
      const eventId = 'test-event-id-001';
      const result = await deleteEvent(eventId);

      // API 应该返回成功消息
      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('应该返回明确的成功消息', async () => {
      const eventId = 'test-event-id-002';
      const result = await deleteEvent(eventId);

      // 验证消息内容
      expect(result.message).toMatch(/success|deleted/i);
    });

    it('应该接受有效的 UUID 格式事件ID', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = await deleteEvent(validUuid);

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('调用时应该使用认证的用户身份', async () => {
      // 这个测试验证 deleteEvent 使用了 authenticatedDelete
      const eventId = 'auth-test-event-id';
      
      // 如果没有认证，authenticatedDelete 会抛出 AuthenticationError
      // 由于我们在 beforeEach 中设置了认证，这里应该成功
      await expect(deleteEvent(eventId)).resolves.toBeDefined();
    });

    it('应该能处理不同格式的事件ID', async () => {
      const testIds = [
        'evt-123456',
        'event_abc_def',
        '12345678-1234-1234-1234-123456789012'
      ];

      for (const eventId of testIds) {
        const result = await deleteEvent(eventId);
        expect(result).toBeDefined();
        expect(result.message).toBeDefined();
      }
    });
  });

  describe('错误处理 (P1.2.4 - Phase 3.3 Code Review)', () => {
    const testEventId = 'test-event-001';

    describe('deleteEvent 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.delete(`${API_URL}/event/${testEventId}`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await deleteEvent(testEventId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 403 禁止访问错误', async () => {
        server.use(
          http.delete(`${API_URL}/event/${testEventId}`, () => {
            return HttpResponse.json(
              { error: 'Forbidden', message: '无权删除此事件' },
              { status: 403 }
            );
          })
        );

        try {
          await deleteEvent(testEventId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(403);
        }
      });

      it('应该处理 404 事件不存在错误', async () => {
        server.use(
          http.delete(`${API_URL}/event/${testEventId}`, () => {
            return HttpResponse.json(
              { error: 'Not Found', message: '事件不存在' },
              { status: 404 }
            );
          })
        );

        try {
          await deleteEvent(testEventId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(404);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.delete(`${API_URL}/event/${testEventId}`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '删除失败' },
              { status: 500 }
            );
          })
        );

        try {
          await deleteEvent(testEventId);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });
  });
});
