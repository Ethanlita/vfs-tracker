/** @file 资料设置 Lambda 的严格协议、字段保留及乐观并发测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const aws = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn(function DynamoDBClient() {}) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: aws.send })) },
  GetCommand: vi.fn(function GetCommand(input) { this.input = input; this.kind = 'get'; }),
  PutCommand: vi.fn(function PutCommand(input) { this.input = input; this.kind = 'put'; }),
  UpdateCommand: vi.fn(function UpdateCommand(input) { this.input = input; this.kind = 'update'; }),
}));
const { handler } = await import('../../../lambda-functions/vfsTrackerUserProfileSetup/index.mjs');

const complete = { name: '新资料', bio: '', isNamePublic: false, socials: [{ platform: 'Discord', handle: 'new-user' }], areSocialsPublic: true };
const event = body => ({
  httpMethod: 'POST', body: JSON.stringify(body), headers: {},
  requestContext: { authorizer: { claims: { sub: 'user-a', email: 'a@example.test', nickname: 'Cognito名' } } },
});

beforeEach(() => aws.send.mockReset());

describe('资料设置版本保护', () => {
  it('新用户用条件Put创建完整资料', async () => {
    aws.send.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const response = await handler(event({ profile: complete, baseVersion: { exists: false, updatedAt: null } }));
    const put = aws.send.mock.calls[1][0].input;
    expect(response.statusCode).toBe(201);
    expect(aws.send.mock.calls[0][0].input.ConsistentRead).toBe(true);
    expect(put.ConditionExpression).toBe('attribute_not_exists(#userId)');
    expect(put.Item.profile).toMatchObject({ name: '新资料', nickname: 'Cognito名', setupSkipped: false });
  });

  it('已有资料只更新向导字段并保留其他字段', async () => {
    const current = { userId: 'user-a', updatedAt: '2026-01-01T00:00:00.000Z', profile: { avatarKey: 'keep.png', name: '旧资料' } };
    const updated = { ...current, updatedAt: 'later', profile: { ...current.profile, ...complete } };
    aws.send.mockResolvedValueOnce({ Item: current }).mockResolvedValueOnce({ Attributes: updated });
    const response = await handler(event({ profile: complete, baseVersion: { exists: true, updatedAt: current.updatedAt } }));
    const command = aws.send.mock.calls[1][0];
    expect(response.statusCode).toBe(200);
    expect(command.kind).toBe('update');
    expect(command.input.ConditionExpression).toContain('#updatedAt = :expectedUpdatedAt');
    expect(command.input.UpdateExpression).not.toContain('avatarKey');
    expect(command.input.ExpressionAttributeValues[':expectedUpdatedAt']).toBe(current.updatedAt);
  });

  it('跳过已有资料时只更新setupSkipped和版本', async () => {
    const current = { userId: 'user-a', updatedAt: '2026-01-01T00:00:00.000Z', profile: { name: '保留资料' } };
    aws.send.mockResolvedValueOnce({ Item: current }).mockResolvedValueOnce({ Attributes: { ...current, profile: { ...current.profile, setupSkipped: true } } });
    const response = await handler(event({ profile: { setupSkipped: true }, baseVersion: { exists: true, updatedAt: current.updatedAt } }));
    const update = aws.send.mock.calls[1][0].input;
    expect(response.statusCode).toBe(200);
    expect(update.UpdateExpression).toBe('SET #profile.#setupSkipped = :skipped, #updatedAt = :now');
  });

  it('读取时已变化会返回409且不写数据库', async () => {
    aws.send.mockResolvedValueOnce({ Item: { userId: 'user-a', updatedAt: '2026-01-02T00:00:00.000Z', profile: {} } });
    const response = await handler(event({ profile: complete, baseVersion: { exists: true, updatedAt: '2026-01-01T00:00:00.000Z' } }));
    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).errorCode).toBe('PROFILE_SETUP_CONFLICT');
    expect(aws.send).toHaveBeenCalledOnce();
  });

  it('条件写入竞态返回409', async () => {
    const current = { userId: 'user-a', updatedAt: '2026-01-01T00:00:00.000Z', profile: {} };
    aws.send.mockResolvedValueOnce({ Item: current }).mockRejectedValueOnce(Object.assign(new Error('race'), { name: 'ConditionalCheckFailedException' }));
    expect((await handler(event({ profile: complete, baseVersion: { exists: true, updatedAt: current.updatedAt } }))).statusCode).toBe(409);
  });

  it('已有记录缺少profile时保留顶层字段并受版本保护', async () => {
    const current = { userId: 'user-a', email: 'old@example.test', isAdmin: true, updatedAt: null, createdAt: 'old' };
    aws.send.mockResolvedValueOnce({ Item: current }).mockResolvedValueOnce({});
    const response = await handler(event({ profile: complete, baseVersion: { exists: true, updatedAt: null } }));
    const put = aws.send.mock.calls[1][0].input;
    expect(response.statusCode).toBe(200);
    expect(put.Item).toMatchObject({ isAdmin: true, email: 'old@example.test', createdAt: 'old' });
    expect(put.ConditionExpression).toContain('attribute_type(#updatedAt, :nullType)');
    expect(put.ExpressionAttributeValues[':nullType']).toBe('NULL');
  });

  it.each([
    { profile: complete },
    { profile: complete, baseVersion: { exists: false, updatedAt: 'impossible' } },
    { profile: complete, baseVersion: { exists: true, updatedAt: 'not-a-date' } },
    { profile: { ...complete, unknown: true }, baseVersion: { exists: false, updatedAt: null } },
    { profile: { setupSkipped: true, name: '混合' }, baseVersion: { exists: false, updatedAt: null } },
  ])('非法协议不访问数据库：%j', async body => {
    const response = await handler(event(body));
    expect(response.statusCode).toBe(400);
    expect(aws.send).not.toHaveBeenCalled();
  });
});
