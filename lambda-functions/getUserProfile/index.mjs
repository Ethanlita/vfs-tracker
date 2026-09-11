/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于获取用户的个人资料信息。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

// 初始化DynamoDB客户端
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// 环境变量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';

// CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key',
};

/**
 * [CN] 从 API Gateway 事件对象中提取用户信息，优先解析 Authorization 头中的 ID Token。
 * 此函数会尝试从 API Gateway 的授权方上下文中获取 claims，如果失败，则会手动解析 Bearer token。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {{userId: string, email: string, username: string, nickname: string}} 提取出的用户信息对象。
 * @throws {Error} 如果在请求中找不到有效的 ID token 或解析失败。
 */
function extractUserFromEvent(event, logger) {
  try {
    // 尝试多种方式获取用户信息
    let claims = null;

    // 方法1：从API Gateway Cognito授权器 (如果设置了)
    if (event.requestContext?.authorizer?.claims) {
      claims = event.requestContext.authorizer.claims;
      logger.debug('identity_source_selected', { source: 'authorizer' });
    }

    // 方法2：手动解析Authorization头中的ID Token
    if (!claims) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

          // 验证这是ID Token
          if (payload.token_use === 'id') {
            claims = payload;
            logger.debug('identity_source_selected', { source: 'bearer', tokenUse: payload.token_use });
          } else {
            logger.warn('token_type_invalid', { receivedTokenUse: payload.token_use });
            throw new Error(`Expected ID token, but received: ${payload.token_use}`);
          }
        } catch (parseError) {
          logger.warn('token_parse_failed', describeError(parseError));
          throw new Error(`ID Token parsing failed: ${parseError.message}`);
        }
      }
    }

    if (!claims) {
      logger.warn('identity_missing', {
        hasAuthorizer: !!event.requestContext?.authorizer,
        hasAuthHeader: !!(event.headers?.Authorization || event.headers?.authorization),
        headerCount: Object.keys(event.headers || {}).length,
      });
      throw new Error('No ID token found in request');
    }

    // 从ID Token中提取用户信息
    const userInfo = {
      userId: claims.sub,
      email: claims.email,
      username: claims.username || claims['cognito:username'],
      nickname: claims.nickname || claims.name || claims['cognito:username'] || claims.email?.split('@')[0] || 'Unknown'
    };

    logger.debug('identity_extracted', {
      userHash: fingerprintIdentifier(userInfo.userId),
      tokenType: claims.token_use,
    });

    return userInfo;

  } catch (error) {
    logger.warn('identity_extraction_failed', describeError(error));
    throw new TypeError('Invalid ID token');
  }
}

/**
 * [CN] 创建一个标准化的、包含 CORS 头的 API Gateway 响应对象。
 * @param {number} statusCode - HTTP 状态码。
 * @param {object} body - 要在响应体中进行 JSON 字符串化的对象。
 * @returns {object} 格式化后的 API Gateway 响应对象。
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

/**
 * [CN] Lambda 函数的主处理程序。它通过从授权 token 中提取用户 ID 来获取用户的个人资料。
 * 它验证请求者只能访问自己的个人资料。如果数据库中不存在该用户的个人资料，
 * 它会根据 token 中的信息返回一个基本的默认个人资料。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @param {object} context - AWS Lambda 调用上下文。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含用户的个人资料信息或错误消息。
 */
export const handler = async (event, context = {}) => {
  const logger = createStructuredLogger({ service: 'getUserProfile', requestId: context.awsRequestId });
  logger.info('invocation_started', { method: event.httpMethod, route: event.resource });

  try {
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }

    // 从JWT Token获取认证用户信息
    const authenticatedUser = extractUserFromEvent(event, logger);

    // 安全地获取路径参数
    const pathUserId = event.pathParameters?.userId;

    // 如果路径参数不存在，使用JWT中的用户ID（临时解决方案）
    const targetUserId = pathUserId || authenticatedUser.userId;

    if (!targetUserId) {
      logger.warn('target_user_missing', { hasPathParameters: !!event.pathParameters });
      return createResponse(400, {
        message: 'Bad Request: Unable to determine user ID'
      });
    }

    // 安全验证：确保用户只能访问自己的资料
    if (pathUserId && pathUserId !== authenticatedUser.userId) {
      logger.warn('profile_access_denied', {
        requesterHash: fingerprintIdentifier(authenticatedUser.userId),
        targetHash: fingerprintIdentifier(pathUserId),
      });
      return createResponse(403, {
        message: 'Forbidden: You can only access your own profile'
      });
    }

    // 使用目标用户ID进行查询
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: targetUserId }
    });

    const result = await dynamodb.send(command);

    if (!result.Item) {
      // 用户不存在于 DynamoDB 中，只返回 exists: false 和 userId
      // 不再返回虚构的默认数据，避免前端无法区分"不存在"和"存在但为空"
      logger.info('profile_read_completed', {
        userHash: fingerprintIdentifier(authenticatedUser.userId),
        exists: false,
      });
      return createResponse(200, {
        exists: false,
        userId: authenticatedUser.userId
      });
    }

    // 用户存在，返回真实数据并标记 exists: true
    // 确保返回的数据包含来自 Cognito token 的 nickname 信息
    const userProfile = {
      exists: true,
      ...result.Item,
      profile: {
        nickname: authenticatedUser.nickname,
        ...result.Item.profile
      }
    };

    logger.info('profile_read_completed', {
      userHash: fingerprintIdentifier(authenticatedUser.userId),
      exists: true,
    });
    return createResponse(200, userProfile);

  } catch (error) {
    logger.error('profile_read_failed', describeError(error));
    return createResponse(500, {
      message: 'Error fetching user profile'
    });
  }
};
