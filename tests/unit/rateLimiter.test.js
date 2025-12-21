/**
 * @file rateLimiter 模块单元测试
 * 测试速率限制工具函数（导入真实模块的纯函数）
 */

import { describe, it, expect, vi } from 'vitest';

// 由于 rateLimiter.mjs 在 lambda-functions 目录下，需要 mock AWS SDK
// 但我们只测试纯函数，不测试需要 AWS 连接的函数
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({ send: vi.fn() })),
  GetItemCommand: vi.fn(),
  UpdateItemCommand: vi.fn()
}));

vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn(() => ({ send: vi.fn() })),
  GetParametersCommand: vi.fn()
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj)
}));

// 导入真实的纯函数
import {
  cleanExpiredHistory,
  checkRateLimit,
  calculateNextAvailableTime,
  formatNextAvailableTime,
  extractUserIdFromEvent
} from '../../lambda-functions/gemini-proxy/rateLimiter.mjs';

describe('rateLimiter 真实函数测试', () => {
  
  describe('cleanExpiredHistory', () => {
    it('应该移除超出时间窗口的记录', () => {
      const now = new Date();
      const history = [
        new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 小时前（应移除）
        new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(), // 23 小时前（应保留）
        new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),  // 1 小时前（应保留）
      ];

      const cleaned = cleanExpiredHistory(history, 24);
      
      expect(cleaned).toHaveLength(2);
      expect(cleaned).not.toContain(history[0]);
      expect(cleaned).toContain(history[1]);
      expect(cleaned).toContain(history[2]);
    });

    it('应该返回空数组当所有记录都过期', () => {
      const now = new Date();
      const history = [
        new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 小时前
        new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), // 3 小时前
      ];

      const cleaned = cleanExpiredHistory(history, 1);
      
      expect(cleaned).toHaveLength(0);
    });

    it('应该保留所有未过期的记录', () => {
      const now = new Date();
      const history = [
        new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      ];

      const cleaned = cleanExpiredHistory(history, 24);
      
      expect(cleaned).toHaveLength(3);
    });

    it('应该处理空数组', () => {
      expect(cleanExpiredHistory([], 24)).toEqual([]);
    });

    it('应该处理 null/undefined', () => {
      expect(cleanExpiredHistory(null, 24)).toEqual([]);
      expect(cleanExpiredHistory(undefined, 24)).toEqual([]);
    });
  });

  describe('checkRateLimit', () => {
    it('应该允许请求当未达到限制', () => {
      const history = ['2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z']; // 2 个请求
      const result = checkRateLimit(history, 10);
      
      expect(result.isLimited).toBe(false);
      expect(result.count).toBe(2);
    });

    it('应该拒绝请求当达到限制', () => {
      const history = Array(10).fill('2025-01-01T10:00:00Z'); // 10 个请求
      const result = checkRateLimit(history, 10);
      
      expect(result.isLimited).toBe(true);
      expect(result.count).toBe(10);
    });

    it('应该允许请求当历史为空', () => {
      const result = checkRateLimit([], 10);
      
      expect(result.isLimited).toBe(false);
      expect(result.count).toBe(0);
      expect(result.oldestTimestamp).toBeNull();
    });

    it('应该返回最早的时间戳', () => {
      const history = [
        '2025-01-01T08:00:00Z', // 最早
        '2025-01-01T09:00:00Z',
        '2025-01-01T10:00:00Z',
      ];
      const result = checkRateLimit(history, 10);
      
      expect(result.oldestTimestamp).toBe('2025-01-01T08:00:00Z');
    });
  });

  describe('calculateNextAvailableTime', () => {
    it('应该计算正确的下次可用时间', () => {
      const oldestTimestamp = '2025-01-01T08:00:00.000Z';
      const windowHours = 24;
      
      const nextAvailable = calculateNextAvailableTime(oldestTimestamp, windowHours);
      
      // 最早请求 + 24 小时
      expect(nextAvailable).toBe('2025-01-02T08:00:00.000Z');
    });

    it('应该处理不同的时间窗口', () => {
      const oldestTimestamp = '2025-01-01T12:00:00.000Z';
      
      expect(calculateNextAvailableTime(oldestTimestamp, 1)).toBe('2025-01-01T13:00:00.000Z');
      expect(calculateNextAvailableTime(oldestTimestamp, 12)).toBe('2025-01-02T00:00:00.000Z');
      expect(calculateNextAvailableTime(oldestTimestamp, 48)).toBe('2025-01-03T12:00:00.000Z');
    });
  });

  describe('formatNextAvailableTime', () => {
    it('应该格式化为中文友好格式', () => {
      const isoTimestamp = '2025-01-15T08:30:45.000Z';
      const formatted = formatNextAvailableTime(isoTimestamp);
      
      expect(formatted).toContain('2025年');
      expect(formatted).toContain('01月');
      expect(formatted).toContain('15日');
      expect(formatted).toContain('08时');
      expect(formatted).toContain('30分');
      expect(formatted).toContain('45秒');
      expect(formatted).toContain('UTC');
    });
  });

  describe('extractUserIdFromEvent', () => {
    it('应该从 authorizer claims 提取 userId', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user-123-abc'
            }
          }
        }
      };
      
      expect(extractUserIdFromEvent(event)).toBe('user-123-abc');
    });

    it('应该返回 null 当没有 authorizer claims（不解析 Authorization header）', () => {
      // 即使有 Authorization header，也不应该尝试解析（安全性考虑）
      const payload = { sub: 'user-456-def', token_use: 'id' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const token = `header.${encodedPayload}.signature`;
      
      const event = {
        headers: {
          Authorization: `Bearer ${token}`
        },
        requestContext: {}
      };
      
      // 由于没有 authorizer claims，应返回 null（不解析 JWT）
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('应该返回 null 当 requestContext 为空', () => {
      const event = {
        headers: {},
        requestContext: {}
      };
      
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('应该返回 null 当 authorizer 为空', () => {
      const event = {
        headers: {},
        requestContext: {
          authorizer: {}
        }
      };
      
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('应该返回 null 当 claims 为空', () => {
      const event = {
        headers: {},
        requestContext: {
          authorizer: {
            claims: {}
          }
        }
      };
      
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('应该返回 null 当 sub 为空', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: ''
            }
          }
        }
      };
      
      // 空字符串是 falsy，应返回 null
      expect(extractUserIdFromEvent(event)).toBeNull();
    });

    it('应该处理 undefined event', () => {
      expect(extractUserIdFromEvent(undefined)).toBeNull();
    });

    it('应该处理 null event', () => {
      expect(extractUserIdFromEvent(null)).toBeNull();
    });
  });
});

describe('限速逻辑集成测试', () => {
  it('应该正确判断限速场景', () => {
    const now = new Date();
    const windowHours = 24;
    const maxRequests = 3;
    
    // 模拟用户在过去 24 小时内已发送 3 个请求
    const history = [
      new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(), // 20 小时前
      new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 小时前
      new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),  // 1 小时前
    ];
    
    // 清理过期记录
    const cleanedHistory = cleanExpiredHistory(history, windowHours);
    expect(cleanedHistory).toHaveLength(3); // 全部在 24 小时内
    
    // 检查限速
    const { isLimited, oldestTimestamp } = checkRateLimit(cleanedHistory, maxRequests);
    expect(isLimited).toBe(true);
    
    // 计算下次可用时间
    const nextAvailable = calculateNextAvailableTime(oldestTimestamp, windowHours);
    const nextAvailableDate = new Date(nextAvailable);
    
    // 应该是最早请求 + 24 小时（即 4 小时后）
    expect(nextAvailableDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it('应该在记录过期后解除限速', () => {
    const now = new Date();
    const windowHours = 24;
    const maxRequests = 3;
    
    // 模拟用户的请求：2 个已过期，1 个未过期
    const history = [
      new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 小时前（过期）
      new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(), // 26 小时前（过期）
      new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),  // 1 小时前
    ];
    
    // 清理过期记录
    const cleanedHistory = cleanExpiredHistory(history, windowHours);
    expect(cleanedHistory).toHaveLength(1); // 只剩 1 个
    
    // 检查限速
    const { isLimited } = checkRateLimit(cleanedHistory, maxRequests);
    expect(isLimited).toBe(false); // 未达到限制
  });
});
