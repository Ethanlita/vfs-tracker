/**
 * @file 用户首次资料设置 Lambda。
 * @description 创建或更新当前 Cognito 用户的资料，并通过 baseVersion 阻止离线草稿静默覆盖较新的服务端资料。
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key',
};

/** 创建 API Gateway 代理响应。 */
function createResponse(statusCode, body) {
  return { statusCode, headers: corsHeaders, body: JSON.stringify(body) };
}

/** 判断值是否为普通 JSON 对象。 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 从 API Gateway Cognito claims 或 Bearer ID token 中提取当前用户。
 * @param {object} event API Gateway 请求事件。
 * @returns {{userId:string,email:string|undefined,nickname:string}} 当前用户资料。
 * @throws {TypeError} 身份不存在或 token 不是 ID token。
 */
function extractUserFromEvent(event) {
  let claims = event.requestContext?.authorizer?.claims;
  if (!claims && isObject(event.requestContext?.authorizer) && event.requestContext.authorizer.sub) {
    claims = event.requestContext.authorizer;
  }
  if (!claims) {
    const authorization = event.headers?.Authorization || event.headers?.authorization;
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      const part = token.split('.')[1];
      if (!part) throw new TypeError('Invalid ID token');
      claims = JSON.parse(Buffer.from(part, 'base64url').toString());
      if (claims.token_use !== 'id') throw new TypeError('Expected ID token');
    }
  }
  if (!claims?.sub) throw new TypeError('Invalid authentication token');
  return {
    userId: claims.sub,
    email: claims.email,
    nickname: claims.nickname || claims.name || claims['cognito:username'] || claims.email?.split('@')[0] || 'Unknown',
  };
}

/**
 * 严格校验资料设置协议，拒绝旧客户端缺少并发版本的写入。
 * @param {string|undefined} rawBody API Gateway 原始请求体。
 * @returns {{profile:object,baseVersion:{exists:boolean,updatedAt:string|null},isSkip:boolean}} 已规范化请求。
 * @throws {TypeError} JSON、字段或类型不符合协议。
 */
function parseRequest(rawBody) {
  let body;
  try { body = JSON.parse(rawBody); } catch { throw new TypeError('Request body must be valid JSON'); }
  if (!isObject(body) || Object.keys(body).some(key => !['profile', 'baseVersion'].includes(key))) {
    throw new TypeError('Request body contains unsupported fields');
  }
  const { profile, baseVersion } = body;
  if (!isObject(profile) || !isObject(baseVersion) || typeof baseVersion.exists !== 'boolean' ||
      !Object.hasOwn(baseVersion, 'updatedAt') || (baseVersion.updatedAt !== null && typeof baseVersion.updatedAt !== 'string') ||
      Object.keys(baseVersion).some(key => !['exists', 'updatedAt'].includes(key))) {
    throw new TypeError('baseVersion is required');
  }
  if (baseVersion.exists === false && baseVersion.updatedAt !== null) throw new TypeError('A missing profile cannot have updatedAt');
  if (baseVersion.updatedAt !== null && (!Number.isFinite(Date.parse(baseVersion.updatedAt)) || !baseVersion.updatedAt.includes('T'))) {
    throw new TypeError('baseVersion.updatedAt must be an ISO timestamp');
  }
  const keys = Object.keys(profile);
  const isSkip = keys.length === 1 && profile.setupSkipped === true;
  if (!isSkip) {
    const expected = ['name', 'bio', 'isNamePublic', 'socials', 'areSocialsPublic'];
    if (keys.length !== expected.length || keys.some(key => !expected.includes(key)) ||
        typeof profile.name !== 'string' || !profile.name.trim() || typeof profile.bio !== 'string' ||
        typeof profile.isNamePublic !== 'boolean' || typeof profile.areSocialsPublic !== 'boolean' ||
        !Array.isArray(profile.socials) || profile.socials.some(social => !isObject(social) ||
          Object.keys(social).some(key => !['platform', 'handle'].includes(key)) ||
          typeof social.platform !== 'string' || !social.platform.trim() ||
          typeof social.handle !== 'string' || !social.handle.trim())) {
      throw new TypeError('Profile setup fields are invalid');
    }
  }
  return {
    profile: isSkip ? { setupSkipped: true } : {
      name: profile.name.trim(), bio: profile.bio, isNamePublic: profile.isNamePublic,
      socials: profile.socials.map(social => ({ platform: social.platform.trim(), handle: social.handle.trim() })),
      areSocialsPublic: profile.areSocialsPublic,
    },
    baseVersion,
    isSkip,
  };
}

/** 判断读取到的资料是否仍与客户端保存草稿时的版本一致。 */
function versionMatches(item, baseVersion) {
  if (Boolean(item) !== baseVersion.exists) return false;
  return !item || (item.updatedAt || null) === baseVersion.updatedAt;
}

/** 构造针对现有资料的条件表达式，写入时再次检查版本以关闭读写竞态。 */
function versionCondition(baseVersion) {
  return baseVersion.updatedAt === null
    ? {
        expression: 'attribute_exists(#userId) AND (attribute_not_exists(#updatedAt) OR attribute_type(#updatedAt, :nullType))',
        values: { ':nullType': 'NULL' },
      }
    : { expression: 'attribute_exists(#userId) AND #updatedAt = :expectedUpdatedAt', values: { ':expectedUpdatedAt': baseVersion.updatedAt } };
}

/**
 * 处理资料设置请求。
 * @param {object} event API Gateway 请求事件。
 * @returns {Promise<object>} API Gateway 代理响应。
 */
export async function handler(event, context = {}) {
  const logger = createStructuredLogger({ service: 'vfsTrackerUserProfileSetup', requestId: context.awsRequestId });
  if (event.httpMethod === 'OPTIONS') return createResponse(200, { message: 'OK' });
  try {
    const authenticatedUser = extractUserFromEvent(event);
    const { profile, baseVersion, isSkip } = parseRequest(event.body);
    const existing = await dynamodb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: authenticatedUser.userId },
      ConsistentRead: true,
    }));
    if (!versionMatches(existing.Item, baseVersion)) {
      logger.warn('profile_setup_conflict', { userHash: fingerprintIdentifier(authenticatedUser.userId), phase: 'read' });
      return createResponse(409, { message: 'User profile changed after this draft was saved', errorCode: 'PROFILE_SETUP_CONFLICT' });
    }

    const now = new Date().toISOString();
    let responseUser;
    let statusCode;
    try {
      if (!existing.Item) {
        const createdProfile = isSkip
          ? { nickname: authenticatedUser.nickname, setupSkipped: true }
          : { nickname: authenticatedUser.nickname, ...profile, setupSkipped: false };
        responseUser = {
          userId: authenticatedUser.userId,
          email: authenticatedUser.email,
          profile: createdProfile,
          createdAt: now,
          updatedAt: now,
        };
        await dynamodb.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: responseUser,
          ConditionExpression: 'attribute_not_exists(#userId)',
          ExpressionAttributeNames: { '#userId': 'userId' },
        }));
        statusCode = 201;
      } else if (!existing.Item.profile) {
        // 损坏的旧记录没有 profile map；保留所有顶层字段并受 updatedAt 条件保护。
        const condition = versionCondition(baseVersion);
        responseUser = {
          ...existing.Item,
          email: existing.Item.email || authenticatedUser.email,
          profile: isSkip
            ? { nickname: authenticatedUser.nickname, setupSkipped: true }
            : { nickname: authenticatedUser.nickname, ...profile, setupSkipped: false },
          updatedAt: now,
        };
        await dynamodb.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: responseUser,
          ConditionExpression: condition.expression,
          ExpressionAttributeNames: { '#userId': 'userId', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: condition.values,
        }));
        statusCode = 200;
      } else {
        const condition = versionCondition(baseVersion);
        const names = { '#userId': 'userId', '#updatedAt': 'updatedAt', '#profile': 'profile', '#setupSkipped': 'setupSkipped' };
        const values = { ...condition.values, ':now': now, ':skipped': isSkip };
        const assignments = ['#profile.#setupSkipped = :skipped', '#updatedAt = :now'];
        if (!isSkip) {
          for (const [index, field] of ['name', 'bio', 'isNamePublic', 'socials', 'areSocialsPublic'].entries()) {
            names[`#field${index}`] = field;
            values[`:value${index}`] = profile[field];
            assignments.unshift(`#profile.#field${index} = :value${index}`);
          }
        }
        const updated = await dynamodb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: authenticatedUser.userId },
          UpdateExpression: `SET ${assignments.join(', ')}`,
          ConditionExpression: condition.expression,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }));
        responseUser = updated.Attributes;
        statusCode = 200;
      }
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') {
        logger.warn('profile_setup_conflict', { userHash: fingerprintIdentifier(authenticatedUser.userId), phase: 'write' });
        return createResponse(409, { message: 'User profile changed while applying this draft', errorCode: 'PROFILE_SETUP_CONFLICT' });
      }
      throw error;
    }

    logger.info('profile_setup_completed', {
      userHash: fingerprintIdentifier(authenticatedUser.userId),
      isNewUser: !existing.Item,
      setupSkipped: isSkip,
    });
    return createResponse(statusCode, {
      message: 'User profile setup completed successfully',
      user: responseUser,
      isNewUser: !existing.Item,
    });
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return createResponse(400, { message: error.message, errorCode: 'INVALID_PROFILE_SETUP_REQUEST' });
    }
    logger.error('profile_setup_failed', describeError(error));
    return createResponse(500, { message: 'Error setting up user profile' });
  }
}
