/**
 * @file API 上传功能单元测试
 * @description 测试 getUploadUrl 和 uploadVoiceTestFileToS3 的所有场景
 * 
 * 测试覆盖:
 * - 生产/开发模式切换
 * - 认证状态处理
 * - 错误处理和超时
 * - S3 上传流程
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUploadUrl, uploadVoiceTestFileToS3 } from '../../src/api.js';
import * as env from '../../src/env.js';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ApiError, AuthenticationError, UploadError } from '../../src/utils/apiError.js';

// Mock dependencies
vi.mock('aws-amplify/auth');
vi.mock('aws-amplify/api');
vi.mock('../../src/env.js', async () => {
  const actual = await vi.importActual('../../src/env.js');
  return {
    ...actual,
    isProductionReady: vi.fn(),
    logEnvReadiness: vi.fn()
  };
});

// Mock fetch for uploadVoiceTestFileToS3
global.fetch = vi.fn();

describe('getUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('开发模式', () => {
    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(false);
    });

    it('应该返回模拟上传 URL', async () => {
      const fileKey = 'test-file.wav';
      const contentType = 'audio/wav';

      const url = await getUploadUrl(fileKey, contentType);

      expect(url).toContain('mock-upload-url.s3.amazonaws.com');
      expect(url).toContain(fileKey);
      expect(url).toContain('mock=true');
      expect(env.isProductionReady).toHaveBeenCalled();
    });

    it('模拟 URL 应包含文件键', async () => {
      const fileKey = 'users/123/voice-test-456.wav';
      const contentType = 'audio/wav';

      const url = await getUploadUrl(fileKey, contentType);

      expect(url).toBe(`https://mock-upload-url.s3.amazonaws.com/${fileKey}?mock=true`);
    });

    it('不应调用认证 API', async () => {
      await getUploadUrl('test.wav', 'audio/wav');

      expect(fetchAuthSession).not.toHaveBeenCalled();
    });
  });

  describe('生产模式', () => {
    const mockIdToken = 'mock-id-token-12345';

    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(true);
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: { idToken: mockIdToken }
      });
    });

    it('应该调用认证 API 获取上传 URL', async () => {
      const fileKey = 'test-file.wav';
      const contentType = 'audio/wav';
      const expectedUrl = 'https://s3.amazonaws.com/presigned-url';

      // Mock the post API call
      const { post } = await import('aws-amplify/api');
      vi.mocked(post).mockReturnValue({
        response: Promise.resolve({
          body: {
            json: () => Promise.resolve({ uploadUrl: expectedUrl })
          }
        })
      });

      const url = await getUploadUrl(fileKey, contentType);

      expect(url).toBe(expectedUrl);
      expect(fetchAuthSession).toHaveBeenCalled();
      expect(post).toHaveBeenCalledWith({
        apiName: 'api',
        path: '/upload-url',
        options: {
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockIdToken}`
          }),
          body: { fileKey, contentType }
        }
      });
    });

    it('应该传递正确的请求体参数', async () => {
      const fileKey = 'users/test-user/test.wav';
      const contentType = 'audio/mpeg';

      const { post } = await import('aws-amplify/api');
      vi.mocked(post).mockReturnValue({
        response: Promise.resolve({
          body: {
            json: () => Promise.resolve({ uploadUrl: 'https://test-url.com' })
          }
        })
      });

      await getUploadUrl(fileKey, contentType);

      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            body: { fileKey, contentType }
          })
        })
      );
    });

    it('未认证时应抛出 AuthenticationError', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: { idToken: null }
      });

      await expect(getUploadUrl('test.wav', 'audio/wav'))
        .rejects.toThrow(AuthenticationError);

      await expect(getUploadUrl('test.wav', 'audio/wav'))
        .rejects.toThrow('未检测到身份凭证');
    });

    it('API 错误时应抛出 ApiError', async () => {
      const { post } = await import('aws-amplify/api');
      const apiError = new Error('Network Error');
      apiError.statusCode = 500;

      vi.mocked(post).mockReturnValue({
        response: Promise.reject(apiError)
      });

      await expect(getUploadUrl('test.wav', 'audio/wav'))
        .rejects.toThrow(ApiError);
    });
  });

  describe('边界情况', () => {
    it('应处理特殊字符的文件名', async () => {
      vi.mocked(env.isProductionReady).mockReturnValue(false);

      const fileKey = 'users/测试用户/文件 (1).wav';
      const url = await getUploadUrl(fileKey, 'audio/wav');

      expect(url).toContain(fileKey);
    });

    it('应处理空文件键', async () => {
      vi.mocked(env.isProductionReady).mockReturnValue(false);

      const url = await getUploadUrl('', 'audio/wav');

      expect(url).toBe('https://mock-upload-url.s3.amazonaws.com/?mock=true');
    });

    it('应处理不同的 MIME 类型', async () => {
      vi.mocked(env.isProductionReady).mockReturnValue(false);

      const contentTypes = [
        'audio/wav',
        'audio/mpeg',
        'audio/ogg',
        'application/octet-stream'
      ];

      for (const contentType of contentTypes) {
        const url = await getUploadUrl('test.file', contentType);
        expect(url).toBeTruthy();
      }
    });
  });
});

describe('uploadVoiceTestFileToS3', () => {
  const mockPutUrl = 'https://s3.amazonaws.com/bucket/key?presigned=true';
  const mockFile = new Blob(['test audio data'], { type: 'audio/wav' });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('开发模式', () => {
    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(false);
      // 确保 VITE_FORCE_REAL 未设置
      delete import.meta.env.VITE_FORCE_REAL;
    });

    it('应模拟上传成功', async () => {
      const result = await uploadVoiceTestFileToS3(mockPutUrl, mockFile);

      expect(result).toBeUndefined();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(env.isProductionReady).toHaveBeenCalled();
    });

    it('应记录模拟上传日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await uploadVoiceTestFileToS3(mockPutUrl, mockFile);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[mock] uploadVoiceTestFileToS3')
      );

      consoleSpy.mockRestore();
    });

    it('VITE_FORCE_REAL 时应执行真实上传', async () => {
      import.meta.env.VITE_FORCE_REAL = 'true';
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadVoiceTestFileToS3(mockPutUrl, mockFile);

      expect(global.fetch).toHaveBeenCalledWith(
        mockPutUrl,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: mockFile
        })
      );
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);

      delete import.meta.env.VITE_FORCE_REAL;
    });
  });

  describe('生产模式', () => {
    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(true);
    });

    it('应成功上传文件到 S3', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await uploadVoiceTestFileToS3(mockPutUrl, mockFile);

      expect(global.fetch).toHaveBeenCalledWith(
        mockPutUrl,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: mockFile
        }
      );
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('应使用正确的 HTTP 方法和头部', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200
      });

      await uploadVoiceTestFileToS3(mockPutUrl, mockFile);

      expect(global.fetch).toHaveBeenCalledWith(
        mockPutUrl,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' }
        })
      );
    });

    it('应传递完整的文件数据', async () => {
      const largeFile = new Blob(['x'.repeat(10000)], { type: 'audio/wav' });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200
      });

      await uploadVoiceTestFileToS3(mockPutUrl, largeFile);

      const callArgs = vi.mocked(global.fetch).mock.calls[0];
      expect(callArgs[1].body).toBe(largeFile);
      expect(callArgs[1].body.size).toBe(10000);
    });

    it('上传失败时应抛出 UploadError', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access Denied')
      });

      await expect(uploadVoiceTestFileToS3(mockPutUrl, mockFile))
        .rejects.toThrow(UploadError);

      try {
        await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(UploadError);
        expect(error.statusCode).toBe(403);
        expect(error.requestMethod).toBe('PUT');
        expect(error.uploadUrl).toBe(mockPutUrl);
      }
    });

    it('网络错误时应抛出 ApiError (UploadError 的基类)', async () => {
      const networkError = new Error('Network request failed');
      vi.mocked(global.fetch).mockRejectedValue(networkError);

      // 注意: 代码中 catch 块检查 `error instanceof ApiError`
      // 由于 UploadError 继承自 ApiError, 新创建的 UploadError 会满足这个条件
      // 但实际上会抛出 UploadError (它是 ApiError 的子类)
      await expect(uploadVoiceTestFileToS3(mockPutUrl, mockFile))
        .rejects.toThrow(ApiError);

      try {
        await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
      } catch (error) {
        // 验证错误类型和属性
        expect(error).toBeInstanceOf(ApiError);
        expect(error.requestMethod).toBe('PUT');
        expect(error.requestPath).toBe(mockPutUrl);
      }
    });

    it('应处理 S3 返回的各种状态码', async () => {
      const statusCodes = [400, 403, 404, 500, 503];

      for (const status of statusCodes) {
        vi.mocked(global.fetch).mockResolvedValue({
          ok: false,
          status,
          statusText: `Status ${status}`,
          text: () => Promise.resolve(`Error: ${status}`)
        });

        await expect(uploadVoiceTestFileToS3(mockPutUrl, mockFile))
          .rejects.toThrow(UploadError);

        try {
          await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
        } catch (error) {
          expect(error.statusCode).toBe(status);
        }
      }
    });

    it('超时时应正确处理', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      vi.mocked(global.fetch).mockRejectedValue(timeoutError);

      await expect(uploadVoiceTestFileToS3(mockPutUrl, mockFile))
        .rejects.toThrow();
    });
  });

  describe('边界情况', () => {
    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(true);
    });

    it('应处理空文件', async () => {
      const emptyFile = new Blob([], { type: 'audio/wav' });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200
      });

      await uploadVoiceTestFileToS3(mockPutUrl, emptyFile);

      expect(global.fetch).toHaveBeenCalledWith(
        mockPutUrl,
        expect.objectContaining({
          body: emptyFile
        })
      );
    });

    it('应处理超大文件 (模拟 100MB)', async () => {
      // 创建一个大的 Blob 对象 (不实际分配内存)
      const largeFile = new Blob(['x'.repeat(1024 * 1024)], { type: 'audio/wav' });
      Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200
      });

      await uploadVoiceTestFileToS3(mockPutUrl, largeFile);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('应处理无效的上传 URL', async () => {
      const invalidUrl = 'not-a-valid-url';

      vi.mocked(global.fetch).mockRejectedValue(
        new TypeError('Failed to fetch')
      );

      await expect(uploadVoiceTestFileToS3(invalidUrl, mockFile))
        .rejects.toThrow();
    });

    it('应保留原有的 ApiError', async () => {
      const existingError = new UploadError('原有错误', {
        requestMethod: 'PUT',
        uploadUrl: mockPutUrl
      });

      vi.mocked(global.fetch).mockRejectedValue(existingError);

      await expect(uploadVoiceTestFileToS3(mockPutUrl, mockFile))
        .rejects.toThrow(existingError);
    });
  });

  describe('错误上下文', () => {
    beforeEach(() => {
      vi.mocked(env.isProductionReady).mockReturnValue(true);
    });

    it('错误应包含请求方法', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Error')
      });

      try {
        await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
      } catch (error) {
        expect(error.requestMethod).toBe('PUT');
      }
    });

    it('错误应包含上传 URL', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden')
      });

      try {
        await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
      } catch (error) {
        expect(error.uploadUrl).toBe(mockPutUrl);
        expect(error.requestPath).toBe(mockPutUrl);
      }
    });

    it('错误应包含状态码', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not Found')
      });

      try {
        await uploadVoiceTestFileToS3(mockPutUrl, mockFile);
      } catch (error) {
        expect(error.statusCode).toBe(404);
      }
    });
  });
});
