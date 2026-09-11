/** @file 朗读稿件读取 Lambda 单元测试 */
import { beforeEach, expect, it, vi } from 'vitest';

const send = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  ScanCommand: class ScanCommand { constructor(input) { this.input = input; } },
}));

const { handler } = await import('../../../lambda-functions/getReadingPassages/index.mjs');

beforeEach(() => { send.mockReset(); process.env.READING_PASSAGES_TABLE_NAME = 'Passages'; });

it('只读取启用稿件并按中文标题稳定排序', async () => {
  send.mockResolvedValue({ Items: [
    { passageId: 'b', title: '春天', author: '乙', content: '正文乙' },
    { passageId: 'a', title: '晨曦', author: '甲', content: '正文甲' },
  ] });
  const result = await handler();
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body).map(item => item.passageId)).toEqual(['a', 'b']);
  expect(send.mock.calls[0][0].input).toMatchObject({ TableName: 'Passages', FilterExpression: '#enabled = :enabled' });
});

it('DynamoDB失败时返回不暴露内部信息的500', async () => {
  send.mockRejectedValue(new Error('secret detail'));
  const result = await handler();
  expect(result.statusCode).toBe(500);
  expect(JSON.parse(result.body)).toEqual({ message: '暂时无法读取朗读稿件' });
  expect(result.body).not.toContain('secret detail');
});
