/**
 * @file 存储签名与公开资料 Lambda 的错误边界测试。
 * @description 验证第三方异常正文不会进入 API 响应或结构化日志。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signedUrl: vi.fn(),
  documentSend: vi.fn(),
  decode: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function S3Client() {}),
  GetObjectCommand: vi.fn(function GetObjectCommand(input) { this.input = input; }),
  PutObjectCommand: vi.fn(function PutObjectCommand(input) { this.input = input; }),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.signedUrl }));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn(function DynamoDBClient() {}) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mocks.documentSend })) },
  GetCommand: vi.fn(function GetCommand(input) { this.input = input; }),
}));
vi.mock('jsonwebtoken', () => ({
  default: { decode: mocks.decode },
  decode: mocks.decode,
}));

const privateFailure = 'token=secret https://private.example/user-a.wav';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('BUCKET_NAME', 'test-bucket');
  vi.stubEnv('VOICE_TESTS_TABLE_NAME', 'test-sessions');
  vi.stubEnv('USERS_TABLE', 'test-users');
  vi.stubEnv('LOG_LEVEL', 'INFO');
  mocks.signedUrl.mockReset();
  mocks.documentSend.mockReset();
  mocks.decode.mockReset().mockReturnValue({ sub: 'user-a' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('存储 URL 与公开资料错误响应', () => {
  it('头像签名失败时不返回或记录对象相关异常正文', async () => {
    mocks.signedUrl.mockRejectedValue(new Error(privateFailure));
    const { handler } = await import('../../../lambda-functions/getAvatarUrl/index.mjs');
    const response = await handler({
      httpMethod: 'GET',
      pathParameters: { userId: 'user-a' },
      queryStringParameters: { key: 'avatars/user-a/avatar.png' },
      headers: {},
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(privateFailure);
    expect(response.body).not.toContain('details');
    expect(console.error.mock.calls.flat().join(' ')).not.toContain(privateFailure);
  });

  it('公开资料读取失败时只返回稳定的服务错误', async () => {
    mocks.documentSend.mockRejectedValue(new Error(privateFailure));
    const { handler } = await import('../../../lambda-functions/getUserPublicProfile/index.mjs');
    const response = await handler({ httpMethod: 'GET', pathParameters: { userId: 'user-a' } });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain(privateFailure);
    expect(JSON.parse(response.body)).toEqual({ message: 'Error fetching public user profile' });
    expect(console.error.mock.calls.flat().join(' ')).not.toContain(privateFailure);
  });
});
