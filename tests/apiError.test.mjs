import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AppError,
  ApiError,
  AuthenticationError,
  ensureApiError,
  ensureAppError,
  normalizeFetchError
} from '../src/utils/apiError.js';

const { Response } = globalThis;

// 验证 AppError.from 能正确吸收上下文；同时记录字符串输入的处理结果。
// Verify that AppError.from merges context information correctly while handling string inputs.
test('AppError.from merges contextual information for plain inputs', () => {
  const appError = AppError.from({ message: '测试失败', statusCode: 418, details: { stage: 'unit' } }, {
    requestMethod: 'GET',
    requestPath: '/tea',
    details: { locale: 'zh-CN' }
  });

  assert.equal(appError.message, '测试失败');
  assert.equal(appError.statusCode, 418);
  assert.equal(appError.requestMethod, 'GET');
  assert.equal(appError.requestPath, '/tea');
  assert.deepEqual(appError.details, { stage: 'unit', locale: 'zh-CN' });
});

// 覆盖 ApiError.from 处理已实例化错误的能力；确保上下文被双向合并。
// Cover the ability of ApiError.from to enrich an existing ApiError instance with extra context.
test('ApiError.from merges details onto existing ApiError', () => {
  const original = new ApiError('原始错误', {
    statusCode: 500,
    requestMethod: 'POST',
    requestPath: '/legacy',
    details: { preserved: true }
  });

  const merged = ApiError.from(original, {
    details: { appended: true },
    requestId: 'req-123'
  });

  assert.strictEqual(merged, original);
  assert.equal(merged.requestId, 'req-123');
  assert.deepEqual(merged.details, { preserved: true, appended: true });
});

// 验证 ApiError.fromResponse 对 fetch Response 的兼容性；重点检查请求ID与响应内容。
// Verify that ApiError.fromResponse understands fetch Response objects and records request metadata.
test('ApiError.fromResponse extracts status and request id from fetch responses', async () => {
  const response = new Response(JSON.stringify({ error: 'broken' }), {
    status: 502,
    headers: { 'x-request-id': 'abc-xyz', 'content-type': 'application/json' }
  });

  const error = await ApiError.fromResponse(response, { requestMethod: 'PATCH' });

  assert.equal(error.statusCode, 502);
  assert.equal(error.requestId, 'abc-xyz');
  assert.equal(error.requestMethod, 'PATCH');
  assert.equal(error.message, '请求失败，状态码 502');
  assert.deepEqual(error.responseBody, { error: 'broken' });
});

// 确保 AuthenticationError 默认保持无状态码，并给出操作提示。
// Ensure AuthenticationError keeps statusCode undefined and includes helpful guidance.
test('AuthenticationError provides guidance without status code', () => {
  const authError = new AuthenticationError();

  assert.equal(authError.statusCode, undefined);
  assert.equal(authError.errorCode, 'AUTH_MISSING_ID_TOKEN');
  assert.equal(authError.details.提示, '由于缺少身份凭证，请求未发送到服务器。');
});

// 检查 ensureApiError 对非 AppError 输入的回退逻辑；确认其返回 ApiError。
// Check that ensureApiError upgrades generic inputs into ApiError instances with merged context.
test('ensureApiError wraps generic values into ApiError', () => {
  const ensured = ensureApiError({ message: '服务异常', status: 503 }, { requestPath: '/health' });

  assert.ok(ensured instanceof ApiError);
  assert.equal(ensured.statusCode, 503);
  assert.equal(ensured.requestPath, '/health');
});

// 覆盖 ensureAppError 的补充逻辑，防止遗漏 AppError 的上下文更新。
// Cover ensureAppError so existing AppError instances preserve additional context.
test('ensureAppError reuses existing AppError while applying context', () => {
  const base = new AppError('基础错误');
  const enriched = ensureAppError(base, { statusCode: 400, meta: { severity: 'warn' } });

  assert.strictEqual(enriched, base);
  assert.equal(enriched.statusCode, 400);
  assert.deepEqual(enriched.meta, { severity: 'warn' });
});

// 验证 normalizeFetchError 对 Response 和上下文参数的融合情况。
// Verify that normalizeFetchError combines fetch responses with contextual overrides.
test('normalizeFetchError returns ApiError with response metadata', () => {
  const response = new Response('Not Found', { status: 404 });
  const error = normalizeFetchError(response, { requestPath: '/missing', message: '资源缺失' });

  assert.ok(error instanceof ApiError);
  assert.equal(error.statusCode, 404);
  assert.equal(error.requestPath, '/missing');
  assert.equal(error.message, '资源缺失');
});
