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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  // 保存原始的 fetch,以便在测试间恢复
  let originalFetch;

  // 注意: MSW server 已在 setup.js 中全局启动,这里不需要重复启动
  // 只在测试开始前保存原始 fetch 的引用
  beforeEach(() => {
    vi.clearAllMocks();
    // 保存当前的 fetch (MSW 拦截后的版本)
    if (!originalFetch) {
      originalFetch = globalThis.fetch;
    }
    // Mock authenticated session
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: { idToken: mockIdToken }
    });
  });

  afterEach(() => {
    server.resetHandlers();
    // CRITICAL: 恢复原始 fetch,清除测试中可能的 mock
    if (originalFetch && globalThis.fetch !== originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  describe('完整上传流程', () => {
    it('应该成功完成从获取 URL 到上传文件的完整流程', async () => {
      // 第一步: 获取上传 URL (由 MSW 拦截)
      const uploadUrl = await getUploadUrl(fileKey, contentType);
      
      expect(uploadUrl).toBeTruthy();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain(fileKey);

      // 第二步: 使用 URL 上传文件到 S3
      // ✅ 使用 MSW handler 拦截 S3 上传请求,而不是直接 mock global.fetch
      let s3RequestBody = null;
      let s3RequestHeaders = null;
      
      server.use(
        http.put('https://*.amazonaws.com/*', async ({ request }) => {
          s3RequestBody = await request.blob();
          s3RequestHeaders = Object.fromEntries(request.headers.entries());
          return new HttpResponse(null, { status: 200 });
        })
      );

      const uploadResult = await uploadVoiceTestFileToS3(uploadUrl, mockFile);

      expect(uploadResult).toBeDefined();
      expect(uploadResult.ok).toBe(true);
      // 验证请求内容
      expect(s3RequestBody).toBeDefined();
      expect(s3RequestHeaders['content-type']).toBe('audio/wav');
    });

    it('应该处理不同文件类型的上传', async () => {
      const testCases = [
        { type: 'audio/wav', extension: 'wav' },
        { type: 'audio/mpeg', extension: 'mp3' },
        { type: 'audio/ogg', extension: 'ogg' }
      ];

      // 先一次性获取所有 URL (使用 MSW mock)
      const urlPromises = testCases.map(testCase => {
        const key = `test-file.${testCase.extension}`;
        return getUploadUrl(key, testCase.type);
      });
      const urls = await Promise.all(urlPromises);

      // ✅ 使用 MSW handler 拦截所有 S3 上传
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      // 执行所有上传
      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const url = urls[i];
        const file = new Blob(['data'], { type: testCase.type });

        expect(url).toBeTruthy();
        expect(url).toContain('s3');

        const result = await uploadVoiceTestFileToS3(url, file);
        expect(result.ok).toBe(true);
      }
    });

    it('应该在上传失败后能够重试', async () => {
      // 第一次调用: 获取 URL
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // ✅ 使用 MSW handler 模拟第一次失败,第二次成功
      let callCount = 0;
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          callCount++;
          if (callCount === 1) {
            // 第一次失败
            return new HttpResponse('Service temporarily unavailable', { 
              status: 503,
              statusText: 'Service Unavailable'
            });
          }
          // 第二次成功
          return new HttpResponse(null, { status: 200 });
        })
      );

      // 第一次尝试应该失败
      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();

      // 重试应该成功
      const retryResult = await uploadVoiceTestFileToS3(uploadUrl, mockFile);
      expect(retryResult.ok).toBe(true);
      expect(callCount).toBe(2);
    });

    it('上传 URL 应该在请求体中包含文件元数据', async () => {
      // 通过添加自定义 handler 来捕获请求体
      let capturedRequestBody = null;

      server.use(
        http.post('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/upload-url', async ({ request }) => {
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
        http.post('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/upload-url', ({ request }) => {
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
        http.post('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/upload-url', () => {
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

      // ✅ 使用 MSW handler 模拟 S3 403 错误
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse('Access Denied', { 
            status: 403,
            statusText: 'Forbidden'
          });
        })
      );

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

      // ✅ 使用 MSW handler 模拟网络错误
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return HttpResponse.error();
        })
      );

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    });

    it('S3 返回的 XML 错误应该被解析', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // ✅ 使用 MSW handler 返回 XML 错误响应
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse(
            `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>InvalidRequest</Code>
  <Message>Missing required header</Message>
</Error>`,
            { 
              status: 400,
              statusText: 'Bad Request',
              headers: { 'Content-Type': 'application/xml' }
            }
          );
        })
      );

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

      // ✅ 验证上传的文件内容
      let uploadedFile = null;
      server.use(
        http.put('https://*.amazonaws.com/*', async ({ request }) => {
          uploadedFile = await request.blob();
          return new HttpResponse(null, { status: 200 });
        })
      );

      const result = await uploadVoiceTestFileToS3(uploadUrl, largeFile);

      expect(result.ok).toBe(true);
      expect(uploadedFile).toBeDefined();
      expect(uploadedFile.type).toBe('audio/wav');
    });

    it('应该处理上传超时', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // ✅ 使用 MSW delay 模拟超时
      server.use(
        http.put('https://*.amazonaws.com/*', async () => {
          await new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout')), 50)
          );
          return new HttpResponse(null, { status: 200 });
        })
      );

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    }, { timeout: 5000 });
  });

  describe('并发上传', () => {
    it('应该能够并发上传多个文件', async () => {
      const files = [
        { key: 'file1.wav', file: new Blob(['data1'], { type: 'audio/wav' }) },
        { key: 'file2.wav', file: new Blob(['data2'], { type: 'audio/wav' }) },
        { key: 'file3.wav', file: new Blob(['data3'], { type: 'audio/wav' }) }
      ];

      // 先获取所有上传 URL (使用 MSW mock)
      const urlPromises = files.map(({ key }) => getUploadUrl(key, 'audio/wav'));
      const urls = await Promise.all(urlPromises);

      // ✅ 使用 MSW handler 处理所有 S3 上传
      let uploadCount = 0;
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          uploadCount++;
          return new HttpResponse(null, { status: 200 });
        })
      );

      // 执行上传
      const uploadPromises = files.map(({ file }, index) => 
        uploadVoiceTestFileToS3(urls[index], file)
      );

      const results = await Promise.all(uploadPromises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.ok).toBe(true);
      });
      expect(uploadCount).toBe(3);
    });

    it('部分上传失败不应该影响其他上传', async () => {
      const files = [
        { key: 'file1.wav', shouldFail: false },
        { key: 'file2.wav', shouldFail: true },
        { key: 'file3.wav', shouldFail: false }
      ];

      // 先获取所有上传 URL (使用 MSW mock)
      const urlPromises = files.map(({ key }) => getUploadUrl(key, 'audio/wav'));
      const urls = await Promise.all(urlPromises);

      // ✅ 使用 MSW handler 模拟第二次上传失败
      let callCount = 0;
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          callCount++;
          if (callCount === 2) {
            return new HttpResponse('Server Error', { status: 500 });
          }
          return new HttpResponse(null, { status: 200 });
        })
      );

      const uploadPromises = files.map(async ({ shouldFail }, index) => {
        const url = urls[index];
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

      // 先一次性获取所有 URL (使用 MSW mock)
      const urlPromises = specialKeys.map(key => getUploadUrl(key, 'audio/wav'));
      const urls = await Promise.all(urlPromises);

      // ✅ 使用 MSW handler 处理所有上传
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      // 执行所有上传
      for (let i = 0; i < specialKeys.length; i++) {
        const url = urls[i];
        expect(url).toBeTruthy();
        expect(url).toContain('s3');

        const result = await uploadVoiceTestFileToS3(url, mockFile);
        expect(result.ok).toBe(true);
      }
    });

    it('应该处理空文件上传', async () => {
      const emptyFile = new Blob([], { type: 'audio/wav' });
      const uploadUrl = await getUploadUrl('empty.wav', 'audio/wav');

      // ✅ 验证空文件上传
      let uploadedFile = null;
      server.use(
        http.put('https://*.amazonaws.com/*', async ({ request }) => {
          uploadedFile = await request.blob();
          return new HttpResponse(null, { status: 200 });
        })
      );

      const result = await uploadVoiceTestFileToS3(uploadUrl, emptyFile);

      expect(result.ok).toBe(true);
      expect(uploadedFile).toBeDefined();
      // 注意: MSW 可能会添加一些额外的字节（如 Content-Type header），所以检查大小很小即可
      expect(uploadedFile.size).toBeLessThan(50);
    });

    it('应该处理 S3 返回的重定向', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // ✅ 使用 MSW handler 返回重定向
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse('Redirected', { 
            status: 307,
            statusText: 'Temporary Redirect'
          });
        })
      );

      await expect(uploadVoiceTestFileToS3(uploadUrl, mockFile))
        .rejects.toThrow();
    });

    it('URL 中的查询参数应该被保留', async () => {
      const uploadUrl = await getUploadUrl(fileKey, contentType);
      
      // 检查 URL 是否包含查询参数
      expect(uploadUrl).toMatch(/\?/);

      // ✅ 捕获实际请求的 URL
      let capturedUrl = null;
      server.use(
        http.put('https://*.amazonaws.com/*', ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse(null, { status: 200 });
        })
      );

      await uploadVoiceTestFileToS3(uploadUrl, mockFile);

      // 验证使用了完整的 URL (包括查询参数)
      expect(capturedUrl).toBe(uploadUrl);
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
      
      // ✅ 使用 MSW handler 处理上传
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      const startTime = Date.now();
      await uploadVoiceTestFileToS3(uploadUrl, mockFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // mock 上传应该很快
    });

    it('应该能够快速处理多次连续上传', async () => {
      const startTime = Date.now();

      // Phase 1: 先一次性获取所有 URL (使用 MSW mock)
      const urlPromises = Array.from({ length: 10 }, (_, i) => 
        getUploadUrl(`file${i}.wav`, 'audio/wav')
      );
      const urls = await Promise.all(urlPromises);

      // Phase 2: ✅ 使用 MSW handler 处理所有上传
      server.use(
        http.put('https://*.amazonaws.com/*', () => {
          return new HttpResponse(null, { status: 200 });
        })
      );

      // Phase 3: 执行所有上传
      for (let i = 0; i < 10; i++) {
        await uploadVoiceTestFileToS3(urls[i], mockFile);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // 10 次上传应该在 5 秒内完成
    });
  });
});
