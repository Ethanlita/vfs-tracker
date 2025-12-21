/**
 * @file SSM service 单元测试
 * 测试 src/admin/services/ssm.js 中的函数
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SSM_PATHS,
  getRateLimitConfig,
  updateRateLimitParam,
  updateRateLimitConfig
} from '../../../src/admin/services/ssm.js';

// Mock SSM 客户端
const mockSend = vi.fn();
const mockClient = { send: mockSend };

describe('SSM Service 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SSM_PATHS 常量', () => {
    it('应该定义所有必需的参数路径', () => {
      expect(SSM_PATHS.RATE_LIMIT_PREFIX).toBe('/vfs-tracker/rate-limit');
      expect(SSM_PATHS.ADVICE_WINDOW_HOURS).toBe('/vfs-tracker/rate-limit/advice-window-hours');
      expect(SSM_PATHS.ADVICE_MAX_REQUESTS).toBe('/vfs-tracker/rate-limit/advice-max-requests');
      expect(SSM_PATHS.SONG_WINDOW_HOURS).toBe('/vfs-tracker/rate-limit/song-window-hours');
      expect(SSM_PATHS.SONG_MAX_REQUESTS).toBe('/vfs-tracker/rate-limit/song-max-requests');
    });
  });

  describe('getRateLimitConfig', () => {
    it('应该返回从 SSM 获取的配置', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [
          { Name: SSM_PATHS.ADVICE_WINDOW_HOURS, Value: '48' },
          { Name: SSM_PATHS.ADVICE_MAX_REQUESTS, Value: '20' },
          { Name: SSM_PATHS.SONG_WINDOW_HOURS, Value: '12' },
          { Name: SSM_PATHS.SONG_MAX_REQUESTS, Value: '5' },
        ],
      });

      const config = await getRateLimitConfig(mockClient);

      expect(config).toEqual({
        adviceWindowHours: 48,
        adviceMaxRequests: 20,
        songWindowHours: 12,
        songMaxRequests: 5,
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('应该使用默认值当参数不存在', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [], // 无参数返回
      });

      const config = await getRateLimitConfig(mockClient);

      expect(config).toEqual({
        adviceWindowHours: 24,
        adviceMaxRequests: 10,
        songWindowHours: 24,
        songMaxRequests: 10,
      });
    });

    it('应该处理部分参数缺失的情况', async () => {
      mockSend.mockResolvedValueOnce({
        Parameters: [
          { Name: SSM_PATHS.ADVICE_WINDOW_HOURS, Value: '36' },
          // 其他参数缺失
        ],
      });

      const config = await getRateLimitConfig(mockClient);

      expect(config.adviceWindowHours).toBe(36);
      expect(config.adviceMaxRequests).toBe(10); // 默认值
      expect(config.songWindowHours).toBe(24); // 默认值
      expect(config.songMaxRequests).toBe(10); // 默认值
    });

    it('应该处理 undefined Parameters', async () => {
      mockSend.mockResolvedValueOnce({
        // Parameters 为 undefined
      });

      const config = await getRateLimitConfig(mockClient);

      expect(config).toEqual({
        adviceWindowHours: 24,
        adviceMaxRequests: 10,
        songWindowHours: 24,
        songMaxRequests: 10,
      });
    });
  });

  describe('updateRateLimitParam', () => {
    it('应该调用 SSM 更新参数', async () => {
      mockSend.mockResolvedValueOnce({});

      await updateRateLimitParam(mockClient, SSM_PATHS.ADVICE_WINDOW_HOURS, 48);

      expect(mockSend).toHaveBeenCalledTimes(1);
      // 验证 command 被正确构造（PutParameterCommand）
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Name: SSM_PATHS.ADVICE_WINDOW_HOURS,
        Value: '48',
        Type: 'String',
        Overwrite: true,
      });
    });

    it('应该将数字转换为字符串', async () => {
      mockSend.mockResolvedValueOnce({});

      await updateRateLimitParam(mockClient, SSM_PATHS.ADVICE_MAX_REQUESTS, 100);

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Value).toBe('100');
      expect(typeof command.input.Value).toBe('string');
    });
  });

  describe('updateRateLimitConfig', () => {
    it('应该批量更新所有配置', async () => {
      mockSend.mockResolvedValue({});

      await updateRateLimitConfig(mockClient, {
        adviceWindowHours: 48,
        adviceMaxRequests: 20,
        songWindowHours: 12,
        songMaxRequests: 5,
      });

      expect(mockSend).toHaveBeenCalledTimes(4);
    });

    it('应该只更新提供的配置项', async () => {
      mockSend.mockResolvedValue({});

      await updateRateLimitConfig(mockClient, {
        adviceWindowHours: 48,
        // 只更新一个参数
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('应该跳过 undefined 的配置项', async () => {
      mockSend.mockResolvedValue({});

      await updateRateLimitConfig(mockClient, {
        adviceWindowHours: undefined,
        adviceMaxRequests: 20,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('应该在空配置时不发送任何请求', async () => {
      await updateRateLimitConfig(mockClient, {});

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('应该并行执行所有更新', async () => {
      // 使用假定时器避免依赖真实时间导致测试不稳定
      vi.useFakeTimers();

      try {
        let callCount = 0;
        mockSend.mockImplementation(
          () => new Promise(resolve => {
            callCount++;
            setTimeout(() => resolve({}), 10);
          })
        );

        const promise = updateRateLimitConfig(mockClient, {
          adviceWindowHours: 48,
          adviceMaxRequests: 20,
          songWindowHours: 12,
          songMaxRequests: 5,
        });

        // 并行执行时，所有调用应立即触发
        expect(mockSend).toHaveBeenCalledTimes(4);

        // 推进时间并等待完成
        vi.runAllTimers();
        await promise;
        expect(callCount).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
