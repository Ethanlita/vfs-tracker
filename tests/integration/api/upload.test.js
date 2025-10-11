/**
 * @file API 上传功能集成测试
 * @description 测试完整的文件上传流程: 获取上传 URL -> 上传到 S3
 * 
 * 测试覆盖:
 * - 完整的上传工作流
 * - 认证流程集成
 * - 错误恢复和重试
 * - 真实场景模拟
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { getUploadUrl, uploadVoiceTestFileToS3 } from '../../../src/api.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { http, HttpResponse } from 'msw';
import { fetchAuthSession } from 'aws-amplify/auth';

// Mock Amplify Auth
vi.mock('aws-amplify/auth');

describe('API 上传功能集成测试', () => {
  const mockIdToken = 'mock-id-token-12345';
  const mockFile = new Blob(['test audio data'], { type: 'audio/wav' });
  const fileKey = 'users/test-user/test-recording.wav';
  const contentType = 'audio/wav';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authenticated session
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: { idToken: mockIdToken }
    });
  });

  describe('完整上传流程', () => {
    it('应该成功完成从获取 URL 到上传文件的完整流程', async () => {
      // 第一步: 获取上传 URL
      const uploadUrl = await getUploadUrl(fileKey, contentType);
      
      expect(uploadUrl).toBeTruthy();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain(fileKey);

      // 第二步: 使用 URL 上传文件
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const uploadResult = await uploadVoiceTestFileToS3(uploadUrl, mockFile);

      expect(uploadResult).toBeDefined();
      expect(uploadResult.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        uploadUrl,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'audio/wav' },
          body: mockFile
        })
      );
    });

    it('应该处理不同文件类型的上传', async () => {
      const testCases = [
        { type: 'audio/wav', extension: 'wav' },
        { type: 'audio/mpeg', extension: 'mp3' },
        { type: 'audio/ogg', extension: 'ogg' }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      for (const testCase of testCases) {
        const key = `test-file.${testCase.extension}`;
        const file = new Blob(['data'], { type: testCase.type });

        const url = await getUploadUrl(key, testCase.type);
        expect(url).toContain(key);

        const result = await uploadVoiceTestFileToS3(url, file);
        expect(result.ok).toBe(true);
      }
    });

    it('应该在上传失败后能够重试', async () => {
      // 第一次调用: 获取 URL
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // 模拟第一次上传失败
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: () => Promise.resolve('Service temporarily unavailable')
        })
        // 第二次上传成功
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        });

      // 第一次尝试应该失败
      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();

      // 重试应该成功
      const retryResult = await uploadVoiceTestFileToS3(uploadUrl, mockFile);
      expect(retryResult.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('上传 URL 应该在请求体中包含文件元数据', async () => {
      // 通过添加自定义 handler 来捕获请求体
      let capturedRequestBody = null;

      server.use(
        http.post('https://test-api.execute-api.us-east-1.amazonaws.com/dev/upload-url', async ({ request }) => {
          capturedRequestBody = await request.json();
          
          return HttpResponse.json({
            uploadUrl: `https://mock-s3.amazonaws.com/${capturedRequestBody.fileKey}`
          });
        })
      );

      await getUploadUrl(fileKey, contentType);

      expect(capturedRequestBody).toEqual({
        fileKey,
        contentType
      });
    });
  });

  describe('认证集成', () => {
    it('获取上传 URL 应该使用 ID Token', async () => {
      let capturedAuthHeader = null;

      server.use(
        http.post('https://test-api.execute-api.us-east-1.amazonaws.com/dev/upload-url', ({ request }) => {
          capturedAuthHeader = request.headers.get('Authorization');
          
          return HttpResponse.json({
            uploadUrl: 'https://mock-url.com'
          });
        })
      );

      await getUploadUrl(fileKey, contentType);

      expect(capturedAuthHeader).toBe(`Bearer ${mockIdToken}`);
    });

    it('未认证用户应该无法获取上传 URL', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: { idToken: null }
      });

      await expect(getUploadUrl(fileKey, contentType))
        .rejects.toThrow('未检测到身份凭证');
    });

    it('过期的 token 应该触发认证错误', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: undefined
      });

      await expect(getUploadUrl(fileKey, contentType))
        .rejects.toThrow();
    });
  });

  describe('错误处理', () => {
    it('获取 URL 失败时应该提供清晰的错误信息', async () => {
      server.use(
        http.post('https://test-api.execute-api.us-east-1.amazonaws.com/dev/upload-url', () => {
          return new HttpResponse(null, {
            status: 500,
            statusText: 'Internal Server Error'
          });
        })
      );

      try {
        await getUploadUrl(fileKey, contentType);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.statusCode).toBe(500);
        expect(error.requestPath).toContain('/upload-url');
      }
    });

    it('上传到 S3 失败时应该包含详细的错误上下文', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access Denied')
      });

      try {
        await uploadVoiceTestFileToS3(uploadUrl, mockFile);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.statusCode).toBe(403);
        expect(error.requestMethod).toBe('PUT');
        expect(error.uploadUrl).toBe(uploadUrl);
      }
    });

    it('网络错误应该被正确捕获', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      global.fetch = vi.fn().mockRejectedValue(
        new TypeError('Network request failed')
      );

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    });

    it('S3 返回的 XML 错误应该被解析', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidRequest</Code>
  <Message>Missing required header</Message>
</Error>`)
      });

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    });
  });

  describe('大文件上传', () => {
    it('应该能够上传大文件', async () => {
      // 创建一个大文件 (模拟 10MB)
      const largeFile = new Blob(['x'.repeat(1024 * 1024)], { type: 'audio/wav' });
      Object.defineProperty(largeFile, 'size', { value: 10 * 1024 * 1024 });

      const uploadUrl = await getUploadUrl('large-file.wav', 'audio/wav');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadVoiceTestFileToS3(uploadUrl, largeFile);

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        uploadUrl,
        expect.objectContaining({
          body: largeFile
        })
      );
    });

    it('应该处理上传超时', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), 50)
        )
      );

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow('Upload timeout');
    }, { timeout: 5000 });
  });

  describe('并发上传', () => {
    it('应该能够并发上传多个文件', async () => {
      const files = [
        { key: 'file1.wav', file: new Blob(['data1'], { type: 'audio/wav' }) },
        { key: 'file2.wav', file: new Blob(['data2'], { type: 'audio/wav' }) },
        { key: 'file3.wav', file: new Blob(['data3'], { type: 'audio/wav' }) }
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const uploadPromises = files.map(async ({ key, file }) => {
        const url = await getUploadUrl(key, 'audio/wav');
        return uploadVoiceTestFileToS3(url, file);
      });

      const results = await Promise.all(uploadPromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.ok).toBe(true);
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('部分上传失败不应该影响其他上传', async () => {
      const files = [
        { key: 'file1.wav', shouldFail: false },
        { key: 'file2.wav', shouldFail: true },
        { key: 'file3.wav', shouldFail: false }
      ];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ 
          ok: false, 
          status: 500,
          text: () => Promise.resolve('Server Error')
        })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const uploadPromises = files.map(async ({ key, shouldFail }) => {
        const url = await getUploadUrl(key, 'audio/wav');
        const file = new Blob(['data'], { type: 'audio/wav' });
        
        try {
          return await uploadVoiceTestFileToS3(url, file);
        } catch (error) {
          if (shouldFail) {
            return { error: true, message: error.message };
          }
          throw error;
        }
      });

      const results = await Promise.all(uploadPromises);

      expect(results[0].ok).toBe(true);
      expect(results[1].error).toBe(true);
      expect(results[2].ok).toBe(true);
    });
  });

  describe('边界情况和特殊场景', () => {
    it('应该处理文件名包含特殊字符', async () => {
      const specialKeys = [
        'users/测试用户/文件.wav',
        'files/file (1).wav',
        'uploads/file-with-dashes.wav',
        'data/file_with_underscores.wav'
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      for (const key of specialKeys) {
        const url = await getUploadUrl(key, 'audio/wav');
        expect(url).toContain(key);

        const result = await uploadVoiceTestFileToS3(url, mockFile);
        expect(result.ok).toBe(true);
      }
    });

    it('应该处理空文件上传', async () => {
      const emptyFile = new Blob([], { type: 'audio/wav' });
      const uploadUrl = await getUploadUrl('empty.wav', 'audio/wav');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const result = await uploadVoiceTestFileToS3(uploadUrl, emptyFile);

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        uploadUrl,
        expect.objectContaining({
          body: emptyFile
        })
      );
    });

    it('应该处理 S3 返回的重定向', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 307,
          statusText: 'Temporary Redirect',
          text: () => Promise.resolve('Redirected')
        });

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    });

    it('URL 中的查询参数应该被保留', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);
      
      // 检查 URL 是否包含查询参数
      expect(uploadUrl).toMatch(/\?/);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      await uploadVoiceTestFileToS3(uploadUrl, mockFile);

      // 验证 fetch 使用了完整的 URL (包括查询参数)
      const fetchUrl = vi.mocked(global.fetch).mock.calls[0][0];
      expect(fetchUrl).toBe(uploadUrl);
    });
  });

  describe('性能和优化', () => {
    it('获取上传 URL 应该在合理时间内完成', async () => {
      const startTime = Date.now();
      
      await getUploadUrl(fileKey, contentType);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 应该在 1 秒内完成
    });

    it('上传应该在合理时间内完成', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const startTime = Date.now();
      await uploadVoiceTestFileToS3(uploadUrl, mockFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // mock 上传应该很快
    });

    it('应该能够快速处理多次连续上传', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const url = await getUploadUrl(`file${i}.wav`, 'audio/wav');
        await uploadVoiceTestFileToS3(url, mockFile);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 10 次上传应该在 5 秒内完成
    });
  });
});
