/** @file 公共读取回归：分页完整性、限流重试、轻量投影、公开状态及缓存失效。 */
import { describe, it, expect, vi } from 'vitest';
import { createHandler } from '../../../lambda-functions/getAllPublicEvents/index.mjs';
import { dashboardFixture } from '../../../src/test-utils/fixtures/index.js';
import { publicDashboardResponseSchema, publicEventDetailsResponseSchema } from '../../../src/api/schemas.js';

const request = { httpMethod: 'GET', resource: '/public/dashboard' };
const fixture = dashboardFixture(3);
const records = fixture.details.map(event => ({ ...event, status: 'approved' }));
const users = { Responses: { VoiceFemUsers: [{ userId: 'user1', profile: { isNamePublic: true, name: '用户1' } }] } };

/**
 * 创建独立数据库及缓存实例，避免跨测试污染。
 * @param {Function} implementation 模拟数据库协议。
 * @param {object} extra 可控制的时钟等依赖。
 * @returns {object} 处理器及数据库 spy。
 */
function setup(implementation, extra = {}) {
  const send = vi.fn(implementation || (command => command.input.TableName ? { Items: records } : users));
  return { send, handler: createHandler({ db: { send }, sleep: async () => {}, ...extra }) };
}

describe('公共事件读取', () => {
  it('没有公开事件时返回空数组，不读取用户表', async () => {
    const { handler, send } = setup(() => ({ Items: [] }));
    expect(JSON.parse((await handler(request)).body)).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('遍历超过 1 MB 的分页，包括被过滤为空的中间页', async () => {
    const { handler, send } = setup();
    send.mockResolvedValueOnce({ Items: [records[0]], LastEvaluatedKey: { userId: 'cursor1' } })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { userId: 'cursor2' } })
      .mockResolvedValueOnce({ Items: records.slice(1) }).mockResolvedValueOnce(users);
    const result = await handler(request);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveLength(3);
    expect(send.mock.calls[2][0].input.ExclusiveStartKey).toEqual({ userId: 'cursor2' });
    expect(publicDashboardResponseSchema.validate(JSON.parse(result.body)).error).toBeUndefined();
  });

  it('BatchGet 重试未处理用户并保留已返回结果', async () => {
    const { handler, send } = setup();
    send.mockResolvedValueOnce({ Items: records }).mockResolvedValueOnce({ Responses: { VoiceFemUsers: [] },
      UnprocessedKeys: { VoiceFemUsers: { Keys: [{ userId: 'user1' }], ConsistentRead: true } } }).mockResolvedValueOnce(users);
    const result = await handler(request);
    expect(JSON.parse(result.body).every(event => event.userName === '用户1')).toBe(true);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('重试耗尽返回 503，不缓存伪完整结果', async () => {
    const { handler, send } = setup(command => command.input.TableName ? { Items: records }
      : { UnprocessedKeys: { VoiceFemUsers: { Keys: [{ userId: 'user1' }] } } });
    expect((await handler(request)).statusCode).toBe(503);
    expect(send).toHaveBeenCalledTimes(6);
    send.mockImplementation(command => command.input.TableName ? { Items: records } : users);
    expect((await handler(request)).statusCode).toBe(200);
  });

  it('超过 100 个用户分批读取，未找到或私密姓名保持隐藏', async () => {
    const many = Array.from({ length: 101 }, (_, index) => ({ ...records[0], userId: `user${index}` }));
    const { handler, send } = setup(command => command.input.TableName ? { Items: many }
      : { Responses: { VoiceFemUsers: [{ userId: 'user0', profile: { name: '不可公开', isNamePublic: false } }] } });
    const result = await handler(request);
    expect(JSON.parse(result.body)).toHaveLength(101);
    expect(result.body).not.toContain('不可公开');
    expect(send.mock.calls[1][0].input.RequestItems.VoiceFemUsers.Keys).toHaveLength(100);
    expect(send.mock.calls[2][0].input.RequestItems.VoiceFemUsers.Keys).toHaveLength(1);
  });

  it('首屏移除文本、附件和 full_metrics，规范历史类型及空基频', async () => {
    const { handler } = setup(command => command.input.TableName ? { Items: [{ ...records[0], type: 'self-test',
      attachments: ['private'], details: { full_metrics: 'large', notes: 'secret', fundamentalFrequency: null } }] } : users);
    const result = await handler(request);
    expect(JSON.parse(result.body)[0]).toMatchObject({ type: 'self_test', details: {} });
    expect(result.body).not.toMatch(/full_metrics|secret|private|fundamentalFrequency/);
  });

  it('兼容旧 all-events 路由的完整数组与日期排序', async () => {
    const { handler } = setup();
    const result = await handler({ ...request, resource: '/all-events' });
    expect(JSON.parse(result.body).map(event => event.eventId)).toEqual([...records].reverse().map(event => event.eventId));
    expect(JSON.parse(result.body)[0].details.notes).toBe('明细 3');
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('缓存复用、ETag 验证、到期重读且不叠加 TTL', async () => {
    let time = 0;
    const { handler, send } = setup(undefined, { now: () => time });
    const first = await handler(request);
    time = 10_000;
    const cached = await handler(request);
    expect(cached.headers['Cache-Control']).toContain('max-age=5');
    expect(send).toHaveBeenCalledTimes(2);
    expect((await handler({ ...request, headers: { 'If-None-Match': first.headers.ETag } })).statusCode).toBe(304);
    time = 15_000;
    await handler(request);
    expect(send).toHaveBeenCalledTimes(4);
  });

  it('并发冷请求共用读取，强制刷新生效，过期错误不返回旧数据', async () => {
    let time = 0;
    const { handler, send } = setup(undefined, { now: () => time });
    await Promise.all([handler(request), handler(request)]);
    expect(send).toHaveBeenCalledTimes(2);
    await handler({ ...request, headers: { 'Cache-Control': 'no-cache' } });
    expect(send).toHaveBeenCalledTimes(4);
    time = 16_000;
    send.mockRejectedValue(new Error('unavailable'));
    const result = await handler(request);
    expect(result.statusCode).toBe(503);
    expect(result.headers['Cache-Control']).toBe('no-store');
  });

  it('缓存到期重新读取公开状态并改变 ETag', async () => {
    let time = 0;
    const { handler, send } = setup(undefined, { now: () => time });
    const first = await handler(request);
    time = 15_000;
    send.mockResolvedValue({ Items: [] });
    const refreshed = await handler({ ...request, headers: { 'If-None-Match': first.headers.ETag } });
    expect(refreshed.statusCode).toBe(200);
    expect(JSON.parse(refreshed.body)).toEqual([]);
    expect(refreshed.headers.ETag).not.toBe(first.headers.ETag);
  });

  it('缺失类型和无效日期仍计数，但不生成虚假的基频', async () => {
    const { handler } = setup(command => command.input.TableName
      ? { Items: [{ ...records[0], type: undefined, date: 'invalid', details: { fundamentalFrequency: '' } }] } : users);
    const data = JSON.parse((await handler(request)).body);
    expect(data[0]).toMatchObject({ type: 'unknown', date: null, details: {} });
    expect(publicDashboardResponseSchema.validate(data).error).toBeUndefined();
  });

  it('明细只返回仍 approved 的当前用户记录，按请求顺序返回且不缓存', async () => {
    const { handler, send } = setup(() => ({ Responses: { VoiceFemEvents: [records[2],
      { ...records[1], status: 'pending' }, { ...records[0], details: { ...records[0].details, full_metrics: 'large' } }] } }));
    const result = await handler({ ...request, resource: '/public/users/{userId}/events',
      pathParameters: { userId: 'user1' }, queryStringParameters: { ids: JSON.stringify(records.map(event => event.eventId)) } });
    expect(JSON.parse(result.body).map(event => event.eventId)).toEqual([records[0].eventId, records[2].eventId]);
    expect(publicEventDetailsResponseSchema.validate(JSON.parse(result.body)).error).toBeUndefined();
    expect(result.body).not.toContain('full_metrics');
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(send.mock.calls[0][0].input.RequestItems.VoiceFemEvents.ConsistentRead).toBe(true);
    expect(send.mock.calls[0][0].input.RequestItems.VoiceFemEvents.Keys.every(key => key.userId === 'user1')).toBe(true);
  });

  it.each([undefined, 'bad', '{}', '[]', '[null]', '["a","a"]', JSON.stringify(Array.from({ length: 21 }, (_, i) => `${i}`))])('拒绝非法明细页 %s', async ids => {
    const { handler, send } = setup();
    expect((await handler({ ...request, resource: '/public/users/{userId}/events', pathParameters: { userId: 'user1' },
      queryStringParameters: { ids } })).statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});
