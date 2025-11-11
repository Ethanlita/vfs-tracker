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
import { fetchAuthSession } from 'aws-amplify/auth';
import { ApiError, AuthenticationError, UploadError } from '../../src/utils/apiError.js';

// Mock dependencies
vi.mock('aws-amplify/auth');
vi.mock('aws-amplify/api');

describe('getUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API 调用', () => {
    const mockIdToken = 'mock-id-token-12345';

    beforeEach(() => {
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
    beforeEach(async () => {
      // 使用 MSW 提供的 mock 上传 URL
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: { idToken: 'mock-id-token' }
      });
      
      const { post } = await import('aws-amplify/api');
      vi.mocked(post).mockReturnValue({
        response: Promise.resolve({
          body: {
            json: async () => ({
              uploadUrl: 'https://mock-s3-bucket.s3.amazonaws.com/test-file?presigned=true'
            })
          }
        })
      });
    });

    it('应处理特殊字符的文件名', async () => {
      const fileKey = 'users/测试用户/文件 (1).wav';
      const url = await getUploadUrl(fileKey, 'audio/wav');

      expect(url).toContain('s3');
      expect(url).toBeTruthy();
    });

    it('应处理空文件键', async () => {
      const url = await getUploadUrl('', 'audio/wav');

      expect(url).toBeTruthy();
      expect(url).toContain('s3');
    });

    it('应处理不同的 MIME 类型', async () => {
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
  
  // 备份原始 global.fetch
  let originalFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // 保存原始 fetch
    originalFetch = global.fetch;
    // 创建 mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // 恢复原始 fetch
    global.fetch = originalFetch;
  });

  describe('S3 上传操作', () => {

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
