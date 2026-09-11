/**
 * @file getVoiceEvents 分页测试
 * @description 验证 Lambda 完整消费 DynamoDB Query 游标并保持用户隔离和全量排序。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const awsMocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(function DynamoDBClient() {}),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: awsMocks.send })) },
  QueryCommand: vi.fn(function QueryCommand(input) { this.input = input; }),
}));

const { handler } = await import('../../../lambda-functions/getVoiceEvents/index.mjs');

/** 构造由 API Gateway Cognito 授权器认证的请求。 */
function request(pathUserId = 'user-a', authenticatedUserId = 'user-a') {
  return {
    httpMethod: 'GET',
    pathParameters: { userId: pathUserId },
    requestContext: { authorizer: { claims: { sub: authenticatedUserId, email: 'user@example.test' } } },
    headers: {},
  };
}

describe('getVoiceEvents DynamoDB 分页', () => {
  beforeEach(() => {
    awsMocks.send.mockReset();
  });

  it('消费包含空中间页的全部游标并按创建时间降序返回', async () => {
    const pageOneKey = { userId: 'user-a', eventId: 'event-old' };
    const pageTwoKey = { userId: 'user-a', eventId: 'event-middle' };
    awsMocks.send
      .mockResolvedValueOnce({
        Items: [{ eventId: 'event-old', createdAt: '2026-01-01T00:00:00.000Z' }],
        LastEvaluatedKey: pageOneKey,
      })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: pageTwoKey })
      .mockResolvedValueOnce({ Items: [{ eventId: 'event-new', createdAt: '2026-03-01T00:00:00.000Z' }] });

    const response = await handler(request());
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.complete).toBe(true);
    expect(body.events.map(event => event.eventId)).toEqual(['event-new', 'event-old']);
    expect(body.debug).toBeUndefined();
    expect(awsMocks.send).toHaveBeenCalledTimes(3);
    expect(awsMocks.send.mock.calls[0][0].input.ExclusiveStartKey).toBeUndefined();
    expect(awsMocks.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual(pageOneKey);
    expect(awsMocks.send.mock.calls[2][0].input.ExclusiveStartKey).toEqual(pageTwoKey);
  });

  it('单页空结果仍返回完整响应标记', async () => {
    awsMocks.send.mockResolvedValueOnce({ Items: [] });

    const response = await handler(request());
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual(expect.objectContaining({ events: [], complete: true }));
    expect(body.debug).toBeUndefined();
    expect(awsMocks.send).toHaveBeenCalledOnce();
  });

  it('路径用户与认证用户不同时拒绝访问且不查询数据库', async () => {
    const response = await handler(request('user-b', 'user-a'));

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).debug).toBeUndefined();
    expect(awsMocks.send).not.toHaveBeenCalled();
  });

  it('后续页失败时返回失败而不是不完整的成功数组', async () => {
    awsMocks.send
      .mockResolvedValueOnce({ Items: [{ eventId: 'partial' }], LastEvaluatedKey: { userId: 'user-a', eventId: 'partial' } })
      .mockRejectedValueOnce(new Error('synthetic continuation failure'));

    const response = await handler(request());
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(500);
    expect(body.message).toBe('Error fetching voice events');
    expect(body.events).toBeUndefined();
    expect(body.complete).toBeUndefined();
    expect(body.debug).toBeUndefined();
    expect(body.error).toBeUndefined();
  });
});
