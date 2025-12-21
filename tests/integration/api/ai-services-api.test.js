/**
 * @file AI Services API 集成测试
 * @description 测试 AI 相关服务 API 的调用和响应
 * 
 * 当前 API 接口:
 * - callGeminiProxy(prompt) - 调用 Gemini AI 代理，返回 {response, rateLimited}
 * - getEncouragingMessage(userData) - 获取鼓励消息
 * - getSongRecommendations({lowestNote, highestNote}) - 获取歌曲推荐，返回 {recommendations, rateLimited, message}
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { 
  callGeminiProxy, 
  getEncouragingMessage, 
  getSongRecommendations 
} from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { ApiError } from '../../../src/utils/apiError.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

describe('AI Services API 集成测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:complete-user-001',
      email: 'complete@example.com',
      nickname: 'Complete User'
    });
  });

  describe('callGeminiProxy', () => {
    it('应该成功调用 Gemini 代理并返回响应对象', async () => {
      const prompt = '请给我一句鼓励的话';
      const result = await callGeminiProxy(prompt);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('rateLimited');
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    it('应该能处理不同类型的提示词', async () => {
      const prompts = [
        '简短的问候',
        '请分析用户的声音健康状况',
        '根据用户数据提供建议'
      ];

      for (const prompt of prompts) {
        const result = await callGeminiProxy(prompt);
        expect(result).toBeDefined();
        expect(typeof result.response).toBe('string');
      }
    });

    it('应该返回非空响应字符串', async () => {
      const prompt = '测试';
      const result = await callGeminiProxy(prompt);

      expect(result.response.trim().length).toBeGreaterThan(0);
    });
    
    it('正常响应时 rateLimited 应为 false', async () => {
      const prompt = '测试';
      const result = await callGeminiProxy(prompt);

      expect(result.rateLimited).toBe(false);
    });

    it('限速响应时应该返回 rateLimited 为 true', async () => {
      // 模拟后端返回限速提示（保持 success: true）
      server.use(
        http.post(`${API_URL}/gemini-proxy`, () => {
          return HttpResponse.json({
            success: true,
            response: '## ⏳ 请求频率限制',
            rateLimited: true,
            nextAvailableAt: '2025-01-01T12:00:00.000Z'
          });
        })
      );

      const result = await callGeminiProxy('测试');

      expect(result.rateLimited).toBe(true);
      expect(result.response).toContain('请求频率限制');
    });
  });

  describe('getEncouragingMessage', () => {
    it('当用户有事件数据时应该返回鼓励消息', async () => {
      const userData = {
        events: [
          {
            type: 'self-test',
            date: '2025-01-10',
            details: { pitch: 220, jitter: 0.5 },
            createdAt: '2025-01-10T10:00:00.000Z'
          }
        ]
      };

      const message = await getEncouragingMessage(userData);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('当用户没有事件数据时应该返回默认消息', async () => {
      const userData = { events: [] };

      const message = await getEncouragingMessage(userData);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('当 userData 为空时应该返回默认消息', async () => {
      const message = await getEncouragingMessage(null);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('应该处理多个事件记录', async () => {
      const userData = {
        events: [
          {
            type: 'self-test',
            date: '2025-01-10',
            details: { pitch: 220 },
            createdAt: '2025-01-10T10:00:00.000Z'
          },
          {
            type: 'surgery',
            date: '2025-01-05',
            details: { surgeryType: 'vocal cord surgery' },
            createdAt: '2025-01-05T08:00:00.000Z'
          },
          {
            type: 'feeling-log',
            date: '2025-01-08',
            details: { mood: 'good' },
            createdAt: '2025-01-08T12:00:00.000Z'
          }
        ]
      };

      const message = await getEncouragingMessage(userData);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('getSongRecommendations', () => {
    it('应该成功获取歌曲推荐并返回响应对象', async () => {
      const range = {
        lowestNote: 'C3',
        highestNote: 'C5'
      };

      const result = await getSongRecommendations(range);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('rateLimited');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('返回的推荐应该包含必要的字段', async () => {
      const range = {
        lowestNote: 'A2',
        highestNote: 'A4'
      };

      const result = await getSongRecommendations(range);

      expect(result.recommendations.length).toBeGreaterThan(0);
      result.recommendations.forEach(song => {
        expect(song).toHaveProperty('songName');
        expect(song).toHaveProperty('artist');
        expect(song).toHaveProperty('reason');
        expect(typeof song.songName).toBe('string');
        expect(typeof song.artist).toBe('string');
        expect(typeof song.reason).toBe('string');
      });
    });

    it('应该能处理不同的音域范围', async () => {
      const testRanges = [
        { lowestNote: 'C3', highestNote: 'C5' },
        { lowestNote: 'G2', highestNote: 'G4' },
        { lowestNote: 'E3', highestNote: 'E5' }
      ];

      for (const range of testRanges) {
        const result = await getSongRecommendations(range);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('推荐理由应该是非空字符串', async () => {
      const range = {
        lowestNote: 'D3',
        highestNote: 'D5'
      };

      const result = await getSongRecommendations(range);

      result.recommendations.forEach(song => {
        expect(song.reason.trim().length).toBeGreaterThan(0);
      });
    });
    
    it('正常响应时 rateLimited 应为 false', async () => {
      const range = {
        lowestNote: 'C3',
        highestNote: 'C5'
      };

      const result = await getSongRecommendations(range);

      expect(result.rateLimited).toBe(false);
    });

    it('限速响应时应该返回上次推荐和提示信息', async () => {
      // 模拟后端返回限速状态与历史推荐
      server.use(
        http.post(`${API_URL}/recommend-songs`, () => {
          return HttpResponse.json({
            success: true,
            recommendations: [
              { songName: '测试歌', artist: '测试歌手', reason: '测试原因' }
            ],
            rateLimited: true,
            message: '您已超出AI荐歌的使用量上限',
            nextAvailableAt: '2025-01-01T12:00:00.000Z'
          });
        })
      );

      const result = await getSongRecommendations({
        lowestNote: 'C3',
        highestNote: 'C5'
      });

      expect(result.rateLimited).toBe(true);
      expect(result.recommendations).toHaveLength(1);
      expect(result.message).toContain('AI荐歌');
    });
  });

  describe('错误状态码处理 (P1.2.4 - Phase 3.3 Code Review)', () => {
    describe('callGeminiProxy 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.post(`${API_URL}/gemini-proxy`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await callGeminiProxy('测试prompt');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 429 请求限流错误', async () => {
        server.use(
          http.post(`${API_URL}/gemini-proxy`, () => {
            return HttpResponse.json(
              { error: 'Too Many Requests', message: 'AI 请求过于频繁' },
              { status: 429 }
            );
          })
        );

        try {
          await callGeminiProxy('测试prompt');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(429);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/gemini-proxy`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: 'Gemini 服务失败' },
              { status: 500 }
            );
          })
        );

        try {
          await callGeminiProxy('测试prompt');
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });

    describe('getSongRecommendations 错误状态码', () => {
      const testRange = { lowestNote: 'C3', highestNote: 'C5' };

      it('应该处理 400 数据验证错误', async () => {
        server.use(
          http.post(`${API_URL}/recommend-songs`, () => {
            return HttpResponse.json(
              { error: 'Bad Request', message: '音域参数格式错误' },
              { status: 400 }
            );
          })
        );

        try {
          await getSongRecommendations(testRange);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(400);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/recommend-songs`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '推荐服务失败' },
              { status: 500 }
            );
          })
        );

        try {
          await getSongRecommendations(testRange);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });
  });
});
