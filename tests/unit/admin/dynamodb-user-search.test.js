/**
 * @file 管理用户搜索服务测试
 * @description 验证跨 DynamoDB 扫描页的 ID、邮箱、姓名和昵称搜索及真实游标。
 */

import { describe, expect, it, vi } from 'vitest';
import { searchUsers } from '../../../src/admin/services/dynamodb.js';

describe('管理用户跨页搜索服务', () => {
  it('无搜索词时返回普通列表的真实分页结果', async () => {
    const lastKey = { userId: 'user-20' };
    const client = { send: vi.fn().mockResolvedValue({ Items: [{ userId: 'user-1' }], LastEvaluatedKey: lastKey }) };

    await expect(searchUsers(client, { limit: 20 })).resolves.toEqual({
      items: [{ userId: 'user-1' }],
      lastEvaluatedKey: lastKey,
      scannedCount: 0,
    });
    expect(client.send.mock.calls[0][0].input).toEqual(expect.objectContaining({ TableName: 'VoiceFemUsers', Limit: 20 }));
  });

  it.each([
    ['ID', 'TARGET-user', { userId: 'prefix-target-user-suffix' }],
    ['邮箱', 'TARGET@EXAMPLE.COM', { userId: 'email-user', email: 'target@example.com' }],
    ['姓名', 'TARGET NAME', { userId: 'name-user', profile: { name: 'Target Name' } }],
    ['昵称', 'TARGET NICK', { userId: 'nickname-user', profile: { nickname: 'Target Nick' } }],
  ])('第一页无匹配时继续扫描并按%s找到后续页目标', async (_field, query, target) => {
    const client = {
      send: vi.fn()
        .mockResolvedValueOnce({ Items: [{ userId: 'unrelated-user' }], LastEvaluatedKey: { userId: 'page-1' } })
        .mockResolvedValueOnce({ Items: [target] }),
    };

    await expect(searchUsers(client, { query, limit: 20 })).resolves.toEqual({
      items: [target],
      lastEvaluatedKey: null,
    });
    expect(client.send).toHaveBeenCalledTimes(2);
    expect(client.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ userId: 'page-1' });
  });

  it('收集满一页匹配项后返回最后一次扫描的真实游标', async () => {
    const users = Array.from({ length: 20 }, (_, index) => ({ userId: `target-${index}` }));
    const lastKey = { userId: 'target-19' };
    const client = { send: vi.fn().mockResolvedValue({ Items: users, LastEvaluatedKey: lastKey }) };

    const result = await searchUsers(client, { query: 'target', limit: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.lastEvaluatedKey).toEqual(lastKey);
    expect(client.send).toHaveBeenCalledOnce();
  });

  it('后续扫描失败时不返回不完整的搜索结果', async () => {
    const failure = new Error('synthetic second page failure');
    const client = {
      send: vi.fn()
        .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { userId: 'page-1' } })
        .mockRejectedValueOnce(failure),
    };

    await expect(searchUsers(client, { query: 'target', limit: 20 })).rejects.toBe(failure);
  });
});
