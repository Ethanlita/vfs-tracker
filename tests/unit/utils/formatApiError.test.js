/**
 * 单元测试: src/utils/formatApiError.js
 * 
 * 测试API错误格式化工具函数
 */

import { describe, it, expect } from 'vitest';
import { formatApiError } from '../../../src/utils/formatApiError.js';
import {
  ApiError,
  AuthenticationError,
  ServiceError,
  AppError
} from '../../../src/utils/apiError.js';

describe('formatApiError.js 单元测试', () => {

  // ============================================
  // 基础格式化功能测试
  // ============================================
  
  describe('基础格式化功能', () => {
    it('null 错误应该返回 null', () => {
      const result = formatApiError(null);
      expect(result).toBeNull();
    });

    it('undefined 错误应该返回 null', () => {
      const result = formatApiError(undefined);
      expect(result).toBeNull();
    });

    it('应该格式化简单的 Error 对象', () => {
      const error = new Error('测试错误');
      const result = formatApiError(error);

      expect(result).toHaveProperty('summary', '测试错误');
      expect(result).toHaveProperty('detailItems');
      expect(result).toHaveProperty('detailText');
      expect(result).toHaveProperty('error');
      expect(result.error).toBeInstanceOf(AppError);
    });

    it('没有 message 时应该使用默认 summary', () => {
      const error = new Error();
      error.message = '';
      const result = formatApiError(error);

      // ensureAppError 使用 '发生未知错误' 作为默认消息
      expect(result.summary).toBe('发生未知错误');
    });

    it('应该返回正确的结构', () => {
      const error = new ApiError('API错误', {
        statusCode: 404,
        requestPath: '/api/test'
      });

      const result = formatApiError(error);

      expect(result).toMatchObject({
        summary: expect.any(String),
        detailItems: expect.any(Array),
        detailText: expect.any(String),
        error: expect.any(AppError)
      });
    });
  });

  // ============================================
  // ApiError 格式化测试
  // ============================================
  
  describe('ApiError 格式化', () => {
    it('应该包含 statusCode', () => {
      const error = new ApiError('API错误', { statusCode: 404 });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '状态码',
        value: 404
      });
      expect(result.detailText).toContain('状态码：404');
    });

    it('应该包含 requestMethod', () => {
      const error = new ApiError('API错误', {
        requestMethod: 'get',
        statusCode: 200
      });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '请求方法',
        value: 'GET' // 应该转为大写
      });
    });

    it('应该包含 requestPath', () => {
      const error = new ApiError('API错误', {
        requestPath: '/api/users',
        statusCode: 500
      });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '请求地址',
        value: '/api/users'
      });
    });

    it('应该包含 requestId', () => {
      const error = new ApiError('API错误', {
        requestId: 'req-12345',
        statusCode: 500
      });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '请求 ID',
        value: 'req-12345'
      });
    });

    it('应该包含 errorCode', () => {
      const error = new ApiError('API错误', {
        errorCode: 'NOT_FOUND',
        statusCode: 404
      });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '错误代码',
        value: 'NOT_FOUND'
      });
    });

    it('应该格式化完整的 ApiError', () => {
      const error = new ApiError('用户不存在', {
        statusCode: 404,
        requestMethod: 'GET',
        requestPath: '/api/users/123',
        requestId: 'req-abc',
        errorCode: 'USER_NOT_FOUND',
        details: { userId: '123', reason: '数据库中找不到该用户' }
      });

      const result = formatApiError(error);

      expect(result.summary).toBe('用户不存在');
      expect(result.detailItems.length).toBeGreaterThanOrEqual(6);
      expect(result.detailText).toContain('状态码：404');
      expect(result.detailText).toContain('请求方法：GET');
    });
  });

  // ============================================
  // AuthenticationError 格式化测试
  // ============================================
  
  describe('AuthenticationError 格式化', () => {
    it('应该标记请求未发送', () => {
      const error = new AuthenticationError('认证失败');
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '请求状态',
        value: '请求未发送（鉴权失败）'
      });
    });

    it('不应该包含 statusCode (因为请求未发送)', () => {
      const error = new AuthenticationError('Token过期');
      const result = formatApiError(error);

      const hasStatusCode = result.detailItems.some(item => item.label === '状态码');
      expect(hasStatusCode).toBe(false);
    });
  });

  // ============================================
  // ServiceError 格式化测试
  // ============================================
  
  describe('ServiceError 格式化', () => {
    it('应该包含 serviceName', () => {
      const error = new ServiceError('服务不可用', { serviceName: 'DynamoDB' });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '服务',
        value: 'DynamoDB'
      });
    });

    it('应该格式化完整的 ServiceError', () => {
      const error = new ServiceError('S3 连接超时', {
        serviceName: 'S3',
        errorCode: 'TIMEOUT',
        details: { bucket: 'my-bucket', timeout: '30s' }
      });

      const result = formatApiError(error);

      expect(result.summary).toBe('S3 连接超时');
      expect(result.detailItems).toContainEqual({
        label: '服务',
        value: 'S3'
      });
      expect(result.detailText).toContain('服务：S3');
    });
  });

  // ============================================
  // details 字段格式化测试
  // ============================================
  
  describe('details 字段格式化', () => {
    it('应该格式化对象类型的 details', () => {
      const error = new ApiError('API错误', {
        statusCode: 400,
        details: {
          field: 'email',
          reason: '格式不正确'
        }
      });

      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: 'field',
        value: 'email'
      });
      expect(result.detailItems).toContainEqual({
        label: 'reason',
        value: '格式不正确'
      });
    });

    it('应该格式化数组类型的 details', () => {
      const error = new ApiError('验证失败', {
        statusCode: 400,
        details: [
          { label: '字段', value: 'email' },
          { label: '错误', value: '格式不正确' }
        ]
      });

      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '字段',
        value: 'email'
      });
      expect(result.detailItems).toContainEqual({
        label: '错误',
        value: '格式不正确'
      });
    });

    it('应该格式化字符串类型的 details', () => {
      const error = new ApiError('API错误', {
        statusCode: 500,
        details: '服务器内部错误，请稍后重试'
      });

      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '详细信息',
        value: '服务器内部错误，请稍后重试'
      });
    });

    it('应该过滤掉 null 和 undefined 的 details 项', () => {
      const error = new ApiError('API错误', {
        statusCode: 400,
        details: [
          { label: '有效', value: 'valid' },
          null,
          { label: '空值', value: null },
          undefined,
          { label: '未定义', value: undefined }
        ]
      });

      const result = formatApiError(error);

      // 只有有效的项应该被包含
      const validDetails = result.detailItems.filter(item => 
        item.label.includes('详细信息') || item.label === '有效'
      );
      expect(validDetails).toContainEqual({
        label: '有效',
        value: 'valid'
      });
    });
  });

  // ============================================
  // options 参数测试
  // ============================================
  
  describe('options 参数', () => {
    it('应该支持自定义 labels', () => {
      const error = new ApiError('API错误', {
        statusCode: 404,
        errorCode: 'NOT_FOUND'
      });

      const result = formatApiError(error, {
        labels: {
          statusCode: 'HTTP状态',
          errorCode: '错误类型'
        }
      });

      expect(result.detailItems).toContainEqual({
        label: 'HTTP状态',
        value: 404
      });
      expect(result.detailItems).toContainEqual({
        label: '错误类型',
        value: 'NOT_FOUND'
      });
    });

    it('includeResponseBody 为 true 时应该包含响应体', () => {
      const error = new ApiError('API错误', {
        statusCode: 500,
        responseBody: { error: 'Internal Server Error', code: 500 }
      });

      const result = formatApiError(error, { includeResponseBody: true });

      expect(result.detailItems).toContainEqual({
        label: '响应内容',
        value: '{"error":"Internal Server Error","code":500}'
      });
    });

    it('includeResponseBody 为 false 时不应该包含响应体', () => {
      const error = new ApiError('API错误', {
        statusCode: 500,
        responseBody: { error: 'Internal Server Error' }
      });

      const result = formatApiError(error, { includeResponseBody: false });

      const hasResponseBody = result.detailItems.some(item => item.label === '响应内容');
      expect(hasResponseBody).toBe(false);
    });

    it('应该支持 additionalDetails', () => {
      const error = new ApiError('API错误', { statusCode: 500 });

      const result = formatApiError(error, {
        additionalDetails: {
          timestamp: '2025-01-01T00:00:00Z',
          user: 'test@example.com'
        }
      });

      expect(result.detailItems).toContainEqual({
        label: 'timestamp',
        value: '2025-01-01T00:00:00Z'
      });
      expect(result.detailItems).toContainEqual({
        label: 'user',
        value: 'test@example.com'
      });
    });

    it('应该支持 context 选项', () => {
      const error = new Error('普通错误');

      const result = formatApiError(error, {
        context: {
          operation: '上传文件',
          fileName: 'test.txt'
        }
      });

      // context 应该被传递给 ensureAppError
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.summary).toBe('普通错误');
      // formatApiError 应该能正常处理带 context 的情况
      expect(result.detailItems).toBeDefined();
    });
  });

  // ============================================
  // detailText 生成测试
  // ============================================
  
  describe('detailText 生成', () => {
    it('应该使用 "·" 连接所有详细信息', () => {
      const error = new ApiError('API错误', {
        statusCode: 404,
        requestMethod: 'GET',
        requestPath: '/api/test'
      });

      const result = formatApiError(error);

      expect(result.detailText).toMatch(/·/);
      expect(result.detailText).toContain('状态码：404');
      expect(result.detailText).toContain('请求方法：GET');
      expect(result.detailText).toContain('请求地址：/api/test');
    });

    it('没有详细信息时 detailText 应该为空字符串', () => {
      const error = new Error('简单错误');
      const result = formatApiError(error);

      expect(result.detailText).toBe('');
    });

    it('单个详细信息不应该包含分隔符', () => {
      const error = new ApiError('API错误', {
        statusCode: 500
      });

      const result = formatApiError(error);

      expect(result.detailText).toBe('状态码：500');
      expect(result.detailText).not.toContain('·');
    });
  });

  // ============================================
  // 边缘情况测试
  // ============================================
  
  describe('边缘情况', () => {
    it('应该处理复杂的嵌套对象', () => {
      const error = new ApiError('API错误', {
        statusCode: 400,
        details: {
          validationErrors: {
            email: ['格式不正确', '已被使用'],
            password: ['长度不足']
          }
        }
      });

      const result = formatApiError(error);

      // 嵌套对象应该被 JSON.stringify
      const validationItem = result.detailItems.find(item => 
        item.label === 'validationErrors'
      );
      expect(validationItem).toBeDefined();
      expect(validationItem.value).toContain('email');
    });

    it('应该处理循环引用 (避免崩溃)', () => {
      const circularObj = { a: 1 };
      circularObj.self = circularObj;

      const error = new ApiError('API错误', {
        statusCode: 500,
        details: circularObj
      });

      // 不应该抛出错误
      expect(() => formatApiError(error)).not.toThrow();
    });

    it('statusCode 为 0 时应该显示', () => {
      const error = new ApiError('网络错误', { statusCode: 0 });
      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '状态码',
        value: 0
      });
    });

    it('requestMethod 已经是大写时不应该改变', () => {
      const error = new ApiError('API错误', {
        requestMethod: 'POST',
        statusCode: 201
      });

      const result = formatApiError(error);

      expect(result.detailItems).toContainEqual({
        label: '请求方法',
        value: 'POST'
      });
    });
  });
});
