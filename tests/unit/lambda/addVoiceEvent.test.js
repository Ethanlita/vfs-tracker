/** @file addVoiceEvent 输入边界回归：非法请求不能写库，服务故障不能误归类为 400。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalSelfTest } from '../../../src/test-utils/fixtures/index.js';
import { invalidEventBodyResponseSchema } from '../../../src/api/schemas.js';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  PutCommand: class { constructor(input) { this.input = input; } }
}));
import { handler } from '../../../lambda-functions/addVoiceEvent/index.mjs';

/**
 * 从已有事件 fixture 生成 API Gateway 请求，不依赖真实 AWS 服务。
 * @param {string} body - 本次测试的原始请求体
 * @returns {object} 带已认证 claims 的 API Gateway 事件
 */
const request = body => ({
  httpMethod: 'POST', body,
  requestContext: { authorizer: { claims: { sub: minimalSelfTest.userId } } }
});

describe('addVoiceEvent 请求体错误分类', () => {
  beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

  it.each([
    ['缺失', undefined], ['空字符串', ''], ['空白', '  '], ['非法 JSON', '{bad'],
    ['null', 'null'], ['数组', '[]'], ['字符串', '"text"'], ['数字', '42'], ['布尔值', 'true']
  ])('%s 请求返回 400，保留 CORS 且不写数据库', async (_label, body) => {
    const result = await handler(request(body));
    expect(result.statusCode).toBe(400);
    const response = JSON.parse(result.body);
    expect(response.errorCode).toBe('INVALID_REQUEST_BODY');
    expect(invalidEventBodyResponseSchema.validate(response).error).toBeUndefined();
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(send).not.toHaveBeenCalled();
  });

  it('错误响应契约拒绝缺失或错误的错误码', () => {
    expect(invalidEventBodyResponseSchema.validate({ message: 'invalid' }).error).toBeDefined();
    expect(invalidEventBodyResponseSchema.validate({ message: 'invalid', errorCode: 'SERVER_ERROR' }).error).toBeDefined();
  });

  it('空对象继续使用必填字段校验，不写数据库', async () => {
    const result = await handler(request('{}'));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain('Missing required fields');
    expect(send).not.toHaveBeenCalled();
  });

  it('合法事件保持成功响应，写入认证用户所属的事件', async () => {
    const result = await handler(request(JSON.stringify(minimalSelfTest)));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).eventId).toEqual(expect.any(String));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].input.Item).toMatchObject({
      userId: minimalSelfTest.userId, type: minimalSelfTest.type, details: minimalSelfTest.details
    });
  });

  it('数据库失败仍返回 500，不冒充输入错误', async () => {
    send.mockRejectedValueOnce(new Error('Database unavailable'));
    const result = await handler(request(JSON.stringify(minimalSelfTest)));
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).errorCode).not.toBe('INVALID_REQUEST_BODY');
  });

  it('OPTIONS 无需请求体并继续返回成功', async () => {
    const result = await handler({ httpMethod: 'OPTIONS' });
    expect(result.statusCode).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
