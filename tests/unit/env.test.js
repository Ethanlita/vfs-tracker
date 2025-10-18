/**
 * 单元测试: src/env.js
 * 
 * 测试环境配置和 API endpoint 管理函数
 * 
 * @deprecated 此文件测试 isProductionReady 函数及相关环境配置逻辑
 * @note Phase 3.2 P2.2: 保留此测试以验证历史行为,等待 Phase 4 完成后删除
 * @see Phase 4 计划 - 彻底废除开发模式 (ROADMAP.md)
 * @context 当前 isProductionReady 在测试中已移除依赖,但源代码中仍在使用
 *          Phase 4 将移除所有源代码中的 isProductionReady 调用,届时删除此文件
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isProductionReady,
  getNormalizedApiBase,
  getApiStagePath,
  getFullApiEndpoint,
  logEnvReadiness
} from '../../src/env.js';

describe('env.js 单元测试', () => {
  // 保存原始环境变量
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    // 重置环境变量
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', undefined);
    vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', undefined);
    vi.stubEnv('VITE_AWS_REGION', undefined);
    vi.stubEnv('VITE_API_ENDPOINT', undefined);
    vi.stubEnv('VITE_S3_BUCKET', undefined);
    vi.stubEnv('VITE_API_STAGE', undefined);
    vi.stubEnv('DEV', undefined);
    vi.stubEnv('MODE', 'test');
  });

  // ============================================
  // isProductionReady() 测试
  // ============================================
  
  describe('isProductionReady', () => {
    it('所有必需环境变量都存在时应该返回 true', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'test-client-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');

      expect(isProductionReady()).toBe(true);
    });

    it('缺少 USER_POOL_ID 时应该返回 false', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'test-client-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');

      expect(isProductionReady()).toBe(false);
    });

    it('缺少 CLIENT_ID 时应该返回 false', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');

      expect(isProductionReady()).toBe(false);
    });

    it('缺少 REGION 时应该返回 false', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'test-client-id');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');

      expect(isProductionReady()).toBe(false);
    });

    it('缺少 API_ENDPOINT 时应该返回 false', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'test-client-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');

      expect(isProductionReady()).toBe(false);
    });

    it('缺少 S3_BUCKET 时应该返回 false', () => {
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'test-client-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');

      expect(isProductionReady()).toBe(false);
    });

    it('所有环境变量都缺失时应该返回 false', () => {
      expect(isProductionReady()).toBe(false);
    });
  });

  // ============================================
  // getNormalizedApiBase() 测试
  // ============================================
  
  describe('getNormalizedApiBase', () => {
    it('VITE_API_ENDPOINT 已配置时应该使用配置值', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://custom-api.example.com');

      const result = getNormalizedApiBase();

      expect(result).toBe('https://custom-api.example.com');
    });

    it('应该移除末尾的斜杠', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com///');

      const result = getNormalizedApiBase();

      expect(result).toBe('https://api.test.com');
    });

    it('VITE_API_ENDPOINT = "auto" 且域名以 .cn 结尾时应该返回 CN API', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'auto');
      
      // Mock window.location
      const originalLocation = global.window?.location;
      delete global.window?.location;
      global.window = global.window || {};
      global.window.location = {
        hostname: 'vfs-tracker.cn'
      };

      const result = getNormalizedApiBase();

      expect(result).toBe('https://api.vfs-tracker.cn');

      // 恢复
      if (originalLocation) {
        global.window.location = originalLocation;
      }
    });

    it('VITE_API_ENDPOINT = "auto" 且域名不是 .cn 时应该返回国际 API', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'auto');
      
      // Mock window.location
      const originalLocation = global.window?.location;
      delete global.window?.location;
      global.window = global.window || {};
      global.window.location = {
        hostname: 'vfs-tracker.app'
      };

      const result = getNormalizedApiBase();

      expect(result).toBe('https://api.vfs-tracker.app');

      // 恢复
      if (originalLocation) {
        global.window.location = originalLocation;
      }
    });

    it('VITE_API_ENDPOINT 未配置时应该使用 "auto" 逻辑', () => {
      // 不设置 VITE_API_ENDPOINT (默认为 'auto')
      
      // Mock window.location
      const originalLocation = global.window?.location;
      delete global.window?.location;
      global.window = global.window || {};
      global.window.location = {
        hostname: 'localhost'
      };

      const result = getNormalizedApiBase();

      expect(result).toBe('https://api.vfs-tracker.app'); // 默认国际版

      // 恢复
      if (originalLocation) {
        global.window.location = originalLocation;
      }
    });

    it('window 不存在时应该返回默认的国际 API', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'auto');
      
      // 模拟 SSR 环境 (没有 window)
      const originalWindow = global.window;
      global.window = undefined;

      const result = getNormalizedApiBase();

      expect(result).toBe('https://api.vfs-tracker.app');

      // 恢复
      global.window = originalWindow;
    });
  });

  // ============================================
  // getApiStagePath() 测试
  // ============================================
  
  describe('getApiStagePath', () => {
    it('VITE_API_STAGE 存在时应该返回带前导斜杠的 stage', () => {
      vi.stubEnv('VITE_API_STAGE', 'dev');

      const result = getApiStagePath();

      expect(result).toBe('/dev');
    });

    it('应该移除原有的前导斜杠', () => {
      vi.stubEnv('VITE_API_STAGE', '/dev');

      const result = getApiStagePath();

      expect(result).toBe('/dev');
    });

    it('VITE_API_STAGE 不存在时应该返回空字符串', () => {
      const result = getApiStagePath();

      expect(result).toBe('');
    });

    it('VITE_API_STAGE 为空字符串时应该返回空字符串', () => {
      vi.stubEnv('VITE_API_STAGE', '');

      const result = getApiStagePath();

      expect(result).toBe('');
    });
  });

  // ============================================
  // getFullApiEndpoint() 测试
  // ============================================
  
  describe('getFullApiEndpoint', () => {
    it('应该组合 base + stage', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_API_STAGE', 'dev');

      const result = getFullApiEndpoint();

      expect(result).toBe('https://api.test.com/dev');
    });

    it('stage 为空时应该只返回 base', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');

      const result = getFullApiEndpoint();

      expect(result).toBe('https://api.test.com');
    });

    it('应该正确处理 base 末尾斜杠', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com/');
      vi.stubEnv('VITE_API_STAGE', 'dev');

      const result = getFullApiEndpoint();

      expect(result).toBe('https://api.test.com/dev');
    });

    it('应该正确处理 stage 前导斜杠', () => {
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_API_STAGE', '/dev');

      const result = getFullApiEndpoint();

      expect(result).toBe('https://api.test.com/dev');
    });
  });

  // ============================================
  // logEnvReadiness() 测试
  // ============================================
  
  describe('logEnvReadiness', () => {
    it('DEV 模式应该输出日志', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('MODE', 'development');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logEnvReadiness('test-context');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[env] readiness check @test-context',
        expect.objectContaining({
          hasUserPoolId: false,
          hasClientId: false,
          hasRegion: false,
          hasApiEndpoint: true,
          hasS3Bucket: false,
          ready: false,
          mode: 'development'
        })
      );

      consoleSpy.mockRestore();
    });

    it('PROD 模式不应该输出日志', () => {
      vi.stubEnv('DEV', false);
      vi.stubEnv('MODE', 'production');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logEnvReadiness('test-context');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该包含所有环境变量的状态', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'pool-id');
      vi.stubEnv('VITE_COGNITO_USER_POOL_WEB_CLIENT_ID', 'client-id');
      vi.stubEnv('VITE_AWS_REGION', 'us-east-1');
      vi.stubEnv('VITE_API_ENDPOINT', 'https://api.test.com');
      vi.stubEnv('VITE_S3_BUCKET', 'test-bucket');
      vi.stubEnv('VITE_API_STAGE', 'dev');
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logEnvReadiness();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[env]'),
        expect.objectContaining({
          hasUserPoolId: true,
          hasClientId: true,
          hasRegion: true,
          hasApiEndpoint: true,
          hasS3Bucket: true,
          apiResolved: 'https://api.test.com/dev',
          bucket: 'test-bucket',
          ready: true
        })
      );

      consoleSpy.mockRestore();
    });

    it('没有传入 context 时应该使用默认值 "global"', () => {
      vi.stubEnv('DEV', true);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logEnvReadiness();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[env] readiness check @global',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });
});
