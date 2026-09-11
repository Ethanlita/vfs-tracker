/**
 * @file 管理端音频对象读取测试
 * @description 验证真实空列表、分页读取和任意分页失败均保留明确语义。
 */

import { describe, expect, it, vi } from 'vitest';
import { getTestSessionFiles } from '../../../src/admin/services/s3.js';

describe('管理端音频对象读取', () => {
  it('成功的空列表返回空数组', async () => {
    const client = { send: vi.fn().mockResolvedValue({ Contents: [], IsTruncated: false }) };

    await expect(getTestSessionFiles(client, 'session-empty')).resolves.toEqual([]);
    expect(client.send).toHaveBeenCalledOnce();
  });

  it('读取全部分页并只返回音频对象', async () => {
    const client = {
      send: vi.fn()
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'voice-tests/session-pages/raw/reading.wav', Size: 12 },
            { Key: 'voice-tests/session-pages/artifacts/result.json', Size: 20 },
          ],
          IsTruncated: true,
          NextContinuationToken: 'page-2',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'voice-tests/session-pages/raw/sustained.webm', Size: 24 }],
          IsTruncated: false,
        }),
    };

    await expect(getTestSessionFiles(client, 'session-pages')).resolves.toEqual([
      expect.objectContaining({ name: 'reading.wav', size: 12 }),
      expect.objectContaining({ name: 'sustained.webm', size: 24 }),
    ]);
    expect(client.send.mock.calls[1][0].input.ContinuationToken).toBe('page-2');
  });

  it('第一页读取失败时向调用方抛出原错误', async () => {
    const failure = new Error('synthetic first page failure');
    const client = { send: vi.fn().mockRejectedValue(failure) };

    await expect(getTestSessionFiles(client, 'session-failure')).rejects.toBe(failure);
  });

  it('后续分页失败时不会返回不完整的文件列表', async () => {
    const failure = new Error('synthetic continuation failure');
    const client = {
      send: vi.fn()
        .mockResolvedValueOnce({
          Contents: [{ Key: 'voice-tests/session-partial/raw/first.wav', Size: 10 }],
          IsTruncated: true,
          NextContinuationToken: 'page-2',
        })
        .mockRejectedValueOnce(failure),
    };

    await expect(getTestSessionFiles(client, 'session-partial')).rejects.toBe(failure);
  });

  it('缺少会话或客户端时抛出参数错误', async () => {
    await expect(getTestSessionFiles({ send: vi.fn() }, '')).rejects.toThrow('Session ID is required');
    await expect(getTestSessionFiles(null, 'session-a')).rejects.toThrow('S3 client is required');
  });
});
