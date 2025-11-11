/**
 * 单元测试: src/utils/apiError.js
 * 
 * 测试完整的错误处理体系
 * 参考: docs/error-handling-guide.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppError,
  ApiError,
  AuthenticationError,
  ClientError,
  ServiceError,
  ValidationError,
  PermissionError,
  StorageError,
  UploadError,
  ensureAppError,
  ensureApiError,
  normalizeFetchError
} from '../../../src/utils/apiError.js';

describe('apiError.js 单元测试', () => {
  
  // ============================================
  // AppError 类测试
  // ============================================
  
  describe('AppError', () => {
    it('应该创建基本的 AppError', () => {
      const error = new AppError('测试错误');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('测试错误');
    });

    it('缺少 message 时应该使用默认消息', () => {
      const error = new AppError();

      expect(error.message).toBe('发生未知错误');
    });

    it('应该接受 context 参数', () => {
      const error = new AppError('测试错误', {
        statusCode: 500,
        requestMethod: 'GET',
        requestPath: '/api/test',
        requestId: 'req-123',
        errorCode: 'TEST_ERROR'
      });

      expect(error.statusCode).toBe(500);
      expect(error.requestMethod).toBe('GET');
      expect(error.requestPath).toBe('/api/test');
      expect(error.requestId).toBe('req-123');
      expect(error.errorCode).toBe('TEST_ERROR');
    });

    it('应该处理 originalError', () => {
      const originalError = new Error('原始错误');
      const error = new AppError('包装错误', {
        originalError
      });

      expect(error.originalError).toBe(originalError);
    });

    it('应该从 context.cause 提取 originalError', () => {
      const causeError = new Error('cause 错误');
      const error = new AppError('包装错误', {
        cause: causeError
      });

      expect(error.originalError).toBe(causeError);
      expect(error.cause).toBe(causeError);
    });

    describe('applyContext', () => {
      it('应该能够应用额外的 context', () => {
        const error = new AppError('初始错误', {
          statusCode: 400
        });

        error.applyContext({
          requestMethod: 'POST',
          requestPath: '/api/new'
        });

        expect(error.statusCode).toBe(400); // 保留
        expect(error.requestMethod).toBe('POST'); // 新增
        expect(error.requestPath).toBe('/api/new'); // 新增
      });

      it('应该能够更新 message', () => {
        const error = new AppError('初始消息');

        error.applyContext({
          message: '更新的消息'
        });

        expect(error.message).toBe('更新的消息');
      });

      it('应该合并 details (数组)', () => {
        const error = new AppError('错误', {
          details: ['错误1', '错误2']
        });

        error.applyContext({
          details: ['错误3']
        });

        expect(error.details).toEqual(['错误1', '错误2', '错误3']);
      });

      it('应该合并 details (对象)', () => {
        const error = new AppError('错误', {
          details: { field1: 'value1' }
        });

        error.applyContext({
          details: { field2: 'value2' }
        });

        expect(error.details).toEqual({
          field1: 'value1',
          field2: 'value2'
        });
      });

      it('应该合并 meta', () => {
        const error = new AppError('错误', {
          meta: { key1: 'value1' }
        });

        error.applyContext({
          meta: { key2: 'value2' }
        });

        expect(error.meta).toEqual({
          key1: 'value1',
          key2: 'value2'
        });
      });

      it('context 为 null 或 undefined 时应该返回自身', () => {
        const error = new AppError('错误');
        
        const result1 = error.applyContext(null);
        const result2 = error.applyContext(undefined);

        expect(result1).toBe(error);
        expect(result2).toBe(error);
      });
    });

    describe('AppError.from', () => {
      it('输入已经是 AppError 时应该返回并应用 context', () => {
        const original = new AppError('原始错误', {
          statusCode: 400
        });

        const result = AppError.from(original, {
          requestMethod: 'GET'
        });

        expect(result).toBe(original); // 同一个实例
        expect(result.statusCode).toBe(400);
        expect(result.requestMethod).toBe('GET');
      });

      it('应该从 Error 创建 AppError', () => {
        const originalError = new Error('测试错误');

        const result = AppError.from(originalError);

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('测试错误');
        expect(result.originalError).toBe(originalError);
      });

      it('应该从字符串创建 AppError', () => {
        const result = AppError.from('错误消息');

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('错误消息');
        expect(result.originalError).toBeInstanceOf(Error);
      });

      it('应该从带 message 的对象创建 AppError', () => {
        const input = {
          message: '对象错误',
          statusCode: 404
        };

        const result = AppError.from(input);

        expect(result).toBeInstanceOf(AppError);
        expect(result.message).toBe('对象错误');
        expect(result.statusCode).toBe(404);
      });

      it('应该提取 Amplify 风格的状态码', () => {
        const amplifyError = {
          message: 'Amplify 错误',
          $metadata: {
            httpStatusCode: 500
          }
        };

        const result = AppError.from(amplifyError);

        expect(result.statusCode).toBe(500);
      });

      it('应该提取多种来源的 requestMethod', () => {
        const input1 = { request: { method: 'POST' } };
        const input2 = { method: 'DELETE' };

        const result1 = AppError.from(input1);
        const result2 = AppError.from(input2);

        expect(result1.requestMethod).toBe('POST');
        expect(result2.requestMethod).toBe('DELETE');
      });

      it('应该提取多种来源的 requestPath', () => {
        const input1 = { request: { url: '/api/path1' } };
        const input2 = { url: '/api/path2' };

        const result1 = AppError.from(input1, {});
        const result2 = AppError.from(input2, {});

        expect(result1.requestPath).toBe('/api/path1');
        expect(result2.requestPath).toBe('/api/path2');
      });

      it('应该使用 context 覆盖输入的值', () => {
        const input = {
          message: '输入消息',
          statusCode: 400
        };

        const result = AppError.from(input, {
          message: 'context 消息',
          statusCode: 500
        });

        expect(result.message).toBe('context 消息');
        expect(result.statusCode).toBe(500);
      });
    });
  });

  // ============================================
  // ApiError 类测试
  // ============================================
  
  describe('ApiError', () => {
    it('应该创建基本的 ApiError', () => {
      const error = new ApiError('API 错误');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('API 错误');
    });

    it('缺少 message 时应该使用 API 默认消息', () => {
      const error = new ApiError();

      expect(error.message).toBe('请求失败，请稍后重试');
    });

    describe('ApiError.from', () => {
      it('输入已经是 ApiError 时应该返回并应用 context', () => {
        const original = new ApiError('原始 API 错误', {
          statusCode: 404
        });

        const result = ApiError.from(original, {
          requestMethod: 'GET'
        });

        expect(result).toBe(original);
        expect(result.statusCode).toBe(404);
        expect(result.requestMethod).toBe('GET');
      });

      it('应该从 Error 创建 ApiError', () => {
        const originalError = new Error('网络错误');

        const result = ApiError.from(originalError);

        expect(result).toBeInstanceOf(ApiError);
        expect(result.message).toBe('网络错误');
        expect(result.originalError).toBe(originalError);
      });

      it('应该提取 Amplify 风格的 metadata', () => {
        const amplifyError = {
          message: 'Amplify API 错误',
          $metadata: {
            httpStatusCode: 403,
            requestId: 'amplify-req-123',
            attempts: 3
          }
        };

        const result = ApiError.from(amplifyError);

        expect(result.statusCode).toBe(403);
        expect(result.requestId).toBe('amplify-req-123');
        expect(result.attempts).toBe(3);
      });

      it('应该从 response.headers 提取 requestId', () => {
        const input = {
          message: 'API 错误',
          response: {
            headers: {
              get: (key) => {
                if (key === 'x-amzn-requestid') return 'aws-req-456';
                return null;
              }
            }
          }
        };

        const result = ApiError.from(input);

        expect(result.requestId).toBe('aws-req-456');
      });

      it('应该从普通对象 headers 提取 requestId', () => {
        const input = {
          message: 'API 错误',
          headers: {
            'x-request-id': 'plain-req-789'
          }
        };

        const result = ApiError.from(input);

        expect(result.requestId).toBe('plain-req-789');
      });

      it('应该提取 responseBody', () => {
        const input = {
          message: 'API 错误',
          body: { error: '详细错误信息' }
        };

        const result = ApiError.from(input);

        expect(result.responseBody).toEqual({ error: '详细错误信息' });
      });

      it('应该提取多种来源的 requestMethod', () => {
        const input1 = { config: { method: 'PATCH' } };
        const input2 = { response: { method: 'PUT' } };

        const result1 = ApiError.from(input1);
        const result2 = ApiError.from(input2);

        expect(result1.requestMethod).toBe('PATCH');
        expect(result2.requestMethod).toBe('PUT');
      });
    });

    describe('ApiError.fromResponse', () => {
      it('应该从 Response 对象创建 ApiError', async () => {
        const mockResponse = {
          status: 500,
          url: '/api/test',
          headers: {
            get: (key) => {
              if (key === 'content-type') return 'application/json';
              if (key === 'x-request-id') return 'resp-123';
              return null;
            }
          },
          clone: function() {
            return {
              headers: this.headers,
              json: async () => ({ error: 'Server Error' }),
              text: async () => 'Server Error'
            };
          }
        };

        const result = await ApiError.fromResponse(mockResponse);

        expect(result).toBeInstanceOf(ApiError);
        expect(result.statusCode).toBe(500);
        expect(result.requestPath).toBe('/api/test');
        expect(result.requestId).toBe('resp-123');
        expect(result.responseBody).toEqual({ error: 'Server Error' });
        expect(result.message).toContain('500');
      });

      it('response 为 null 时应该使用 context', async () => {
        const result = await ApiError.fromResponse(null, {
          message: '自定义消息',
          statusCode: 400
        });

        expect(result).toBeInstanceOf(ApiError);
        expect(result.message).toBe('自定义消息');
        expect(result.statusCode).toBe(400);
      });

      it('应该处理非 JSON 响应', async () => {
        const mockResponse = {
          status: 400,
          url: '/api/test',
          headers: {
            get: (key) => {
              if (key === 'content-type') return 'text/plain';
              return null;
            }
          },
          clone: function() {
            return {
              headers: this.headers,
              json: async () => { throw new Error('Not JSON'); },
              text: async () => 'Plain text error'
            };
          }
        };

        const result = await ApiError.fromResponse(mockResponse);

        expect(result).toBeInstanceOf(ApiError);
        expect(result.statusCode).toBe(400);
        expect(result.responseBody).toBe('Plain text error');
      });

      it('解析 response 失败时应该继续', async () => {
        const mockResponse = {
          status: 503,
          url: '/api/test',
          headers: {
            get: () => null
          },
          clone: function() {
            return {
              json: async () => { throw new Error('Parse failed'); },
              text: async () => { throw new Error('Parse failed'); }
            };
          }
        };

        const result = await ApiError.fromResponse(mockResponse);

        expect(result).toBeInstanceOf(ApiError);
        expect(result.statusCode).toBe(503);
        expect(result.responseBody).toBeUndefined();
      });
    });
  });

  // ============================================
  // 专用错误类测试
  // ============================================
  
  describe('AuthenticationError', () => {
    it('应该创建 AuthenticationError', () => {
      const error = new AuthenticationError();

      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toContain('未登录');
      expect(error.errorCode).toBe('AUTH_MISSING_ID_TOKEN');
      expect(error.statusCode).toBeUndefined(); // 请求未发送
    });

    it('应该包含提示 details', () => {
      const error = new AuthenticationError();

      expect(error.details).toHaveProperty('提示');
      expect(error.details.提示).toContain('缺少身份凭证');
    });
  });

  describe('ClientError', () => {
    it('应该创建 ClientError', () => {
      const error = new ClientError('客户端错误');

      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ClientError');
      expect(error.message).toBe('客户端错误');
    });
  });

  describe('ServiceError', () => {
    it('应该创建 ServiceError', () => {
      const error = new ServiceError('服务错误', {
        serviceName: 'TestService'
      });

      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('ServiceError');
      expect(error.serviceName).toBe('TestService');
    });

    it('应该通过 applyContext 更新 serviceName', () => {
      const error = new ServiceError('错误');

      error.applyContext({
        serviceName: 'NewService'
      });

      expect(error.serviceName).toBe('NewService');
    });
  });

  describe('ValidationError', () => {
    it('应该创建 ValidationError', () => {
      const error = new ValidationError('验证失败', {
        fieldErrors: [
          { field: 'email', message: '格式不正确' },
          { field: 'age', message: '必须大于0' }
        ]
      });

      expect(error).toBeInstanceOf(ClientError);
      expect(error.name).toBe('ValidationError');
      expect(error.fieldErrors).toHaveLength(2);
      expect(error.fieldErrors[0].field).toBe('email');
    });
  });

  describe('PermissionError', () => {
    it('应该创建 PermissionError', () => {
      const error = new PermissionError('权限被拒绝', {
        permissionName: 'microphone'
      });

      expect(error).toBeInstanceOf(ClientError);
      expect(error.name).toBe('PermissionError');
      expect(error.permissionName).toBe('microphone');
    });
  });

  describe('StorageError', () => {
    it('应该创建 StorageError', () => {
      const error = new StorageError('存储失败', {
        operation: 'set',
        key: 'user-data',
        quotaExceeded: true
      });

      expect(error).toBeInstanceOf(ClientError);
      expect(error.name).toBe('StorageError');
      expect(error.operation).toBe('set');
      expect(error.key).toBe('user-data');
      expect(error.quotaExceeded).toBe(true);
    });
  });

  describe('UploadError', () => {
    it('应该创建 UploadError', () => {
      const error = new UploadError('上传失败', {
        objectKey: 'uploads/file.jpg',
        uploadUrl: 'https://s3.amazonaws.com/...',
        statusCode: 413
      });

      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('UploadError');
      expect(error.objectKey).toBe('uploads/file.jpg');
      expect(error.uploadUrl).toContain('s3.amazonaws.com');
      expect(error.statusCode).toBe(413);
    });
  });

  // ============================================
  // 辅助函数测试
  // ============================================
  
  describe('ensureAppError', () => {
    it('输入已经是 AppError 时应该返回并应用 context', () => {
      const original = new AppError('原始错误', { statusCode: 400 });

      const result = ensureAppError(original, { requestMethod: 'GET' });

      expect(result).toBe(original);
      expect(result.statusCode).toBe(400);
      expect(result.requestMethod).toBe('GET');
    });

    it('输入不是 AppError 时应该转换', () => {
      const error = new Error('普通错误');

      const result = ensureAppError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('普通错误');
      expect(result.originalError).toBe(error);
    });
  });

  describe('ensureApiError', () => {
    it('输入已经是 ApiError 时应该返回并应用 context', () => {
      const original = new ApiError('API 错误', { statusCode: 404 });

      const result = ensureApiError(original, { requestMethod: 'POST' });

      expect(result).toBe(original);
      expect(result.statusCode).toBe(404);
      expect(result.requestMethod).toBe('POST');
    });

    it('输入是 AppError 时应该应用 context 并返回', () => {
      const appError = new AppError('App 错误', { statusCode: 500 });

      const result = ensureApiError(appError);

      expect(result).toBe(appError); // 仍然是 AppError,不转换
      expect(result.statusCode).toBe(500);
    });

    it('输入不是错误对象时应该转换为 ApiError', () => {
      const error = new Error('网络错误');

      const result = ensureApiError(error);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('网络错误');
    });
  });

  describe('normalizeFetchError', () => {
    it('应该从 Response 对象创建 ApiError', () => {
      const response = {
        status: 404,
        url: '/api/users/123',
        request: { method: 'GET' }
      };

      const result = normalizeFetchError(response);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(404);
      expect(result.requestPath).toBe('/api/users/123');
      expect(result.requestMethod).toBe('GET');
    });

    it('response 为 null 时应该使用 context', () => {
      const result = normalizeFetchError(null, {
        message: '网络断开',
        statusCode: 0
      });

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toBe('网络断开');
      expect(result.statusCode).toBe(0);
    });

    it('应该使用 response 的核心字段,保留 context 的其他字段', () => {
      const response = {
        status: 500,
        url: '/api/test',
        request: { method: 'POST' }
      };

      const result = normalizeFetchError(response, {
        errorCode: 'CUSTOM_ERROR',
        details: { reason: 'timeout' }
      });

      // response 的核心字段优先
      expect(result.statusCode).toBe(500);
      expect(result.requestPath).toBe('/api/test');
      expect(result.requestMethod).toBe('POST');
      
      // context 的其他字段会保留
      expect(result.errorCode).toBe('CUSTOM_ERROR');
      expect(result.details).toEqual({ reason: 'timeout' });
    });
  });
});
