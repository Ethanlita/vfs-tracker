/** @file 事件删除 Lambda 的附件优先清理与基础设施配置测试。 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const aws = vi.hoisted(() => {
  process.env.ATTACHMENTS_BUCKET = 'test-attachments';
  return { ddbSend: vi.fn(), s3Send: vi.fn() };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: aws.ddbSend }) },
  GetCommand: class { constructor(input) { this.input = input; this.kind = 'get'; } },
  DeleteCommand: class { constructor(input) { this.input = input; this.kind = 'delete'; } },
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send(command) { return aws.s3Send(command); } },
  DeleteObjectCommand: class { constructor(input) { this.input = input; } },
}));

import { attachmentKeyFromFileUrl, handler } from '../../../lambda-functions/deleteEvent/index.mjs';

/** 构造经过 API Gateway Cognito 授权的删除请求。 */
const request = () => ({
  httpMethod: 'DELETE',
  pathParameters: { eventId: 'event-1' },
  requestContext: { authorizer: { claims: { sub: 'user-1' } } },
});

beforeEach(() => {
  aws.ddbSend.mockReset();
  aws.s3Send.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  delete process.env.ATTACHMENTS_BUCKET;
  vi.restoreAllMocks();
});

describe('事件附件删除', () => {
  it.each([
    ['attachments/user/report.pdf', 'attachments/user/report.pdf'],
    ['s3://test-attachments/attachments/user/report.pdf', 'attachments/user/report.pdf'],
    ['https://storage.example.test/attachments/user/report%20one.pdf', 'attachments/user/report one.pdf'],
    ['s3://another-bucket/private.pdf', null],
    ['', null],
  ])('从 %s 提取当前桶对象键', (value, expected) => {
    expect(attachmentKeyFromFileUrl(value, 'test-attachments')).toBe(expected);
  });

  it('先删除全部可识别附件，再条件删除事件记录', async () => {
    aws.ddbSend
      .mockResolvedValueOnce({ Item: { attachments: [
        { fileUrl: 'attachments/user/a.pdf' },
        { fileUrl: 'https://storage.example.test/attachments/user/b.png' },
      ] } })
      .mockResolvedValueOnce({});
    aws.s3Send.mockResolvedValue({});

    const response = await handler(request());

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).deletedAttachmentCount).toBe(2);
    expect(aws.s3Send.mock.calls.map(([command]) => command.input.Key)).toEqual([
      'attachments/user/a.pdf',
      'attachments/user/b.png',
    ]);
    expect(aws.ddbSend.mock.calls.map(([command]) => command.kind)).toEqual(['get', 'delete']);
  });

  it('附件删除失败时保留事件记录以便重试', async () => {
    aws.ddbSend.mockResolvedValueOnce({ Item: { attachments: [{ fileUrl: 'attachments/user/a.pdf' }] } });
    aws.s3Send.mockRejectedValueOnce(new Error('synthetic S3 failure'));

    const response = await handler(request());

    expect(response.statusCode).toBe(500);
    expect(aws.ddbSend).toHaveBeenCalledTimes(1);
  });

  it('生产模板为删除和自动审核函数注入唯一附件桶变量', async () => {
    const template = await readFile(path.join(process.cwd(), 'infra/template-production.yaml'), 'utf8');
    const deleteBlock = template.match(/DeleteEventFunction:[\s\S]*?(?=\n[ ]{2}AutoApproveEventFunction:)/)?.[0];
    const approveBlock = template.match(/AutoApproveEventFunction:[\s\S]*?(?=\n[ ]{2}# ==========================================\n[ ]{2}# Lambda Functions - Users)/)?.[0];
    expect(deleteBlock).toContain('ATTACHMENTS_BUCKET: !Ref ExistingS3BucketName');
    expect(approveBlock).toContain('ATTACHMENTS_BUCKET: !Ref ExistingS3BucketName');
    expect(approveBlock).toContain("GEMINI_API_KEY: '{{resolve:ssm:/vfs-tracker/gemini-api-key}}'");
    expect(template).not.toContain('ATTACHMENTS_BUCKET_NAME');
  });
});
