/** @file 管理后台朗读稿件 DynamoDB 服务测试 */
import { expect, it, vi } from 'vitest';
import { deleteReadingPassage, saveReadingPassage } from '../../../src/admin/services/dynamodb';

it('保存时规范化空白并写入完整稿件', async () => {
  const client = { send: vi.fn().mockResolvedValue({}) };
  const saved = await saveReadingPassage(client, { passageId: 'p1', title: ' 标题 ', author: ' 作者 ', content: ' 正文 ', enabled: true });
  expect(saved).toMatchObject({ passageId: 'p1', title: '标题', author: '作者', content: '正文', enabled: true });
  expect(client.send.mock.calls[0][0].input.TableName).toBe('VoiceFemReadingPassages');
});

it('空字段拒绝写入，删除使用稳定ID', async () => {
  const client = { send: vi.fn().mockResolvedValue({}) };
  await expect(saveReadingPassage(client, { passageId: 'p1', title: '', author: 'a', content: 'c' })).rejects.toThrow('不能为空');
  expect(client.send).not.toHaveBeenCalled();
  await deleteReadingPassage(client, 'p1');
  expect(client.send.mock.calls[0][0].input).toEqual({ TableName: 'VoiceFemReadingPassages', Key: { passageId: 'p1' } });
});
