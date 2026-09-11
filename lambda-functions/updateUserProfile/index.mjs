/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于更新用户的个人资料信息。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { buildProfileUpdate } from './profile-update.mjs';
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

// 初始化DynamoDB客户端
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// 环境变量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';

// CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
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
      logger.warn('identity_missing');
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
 * [CN] Lambda 函数的主处理程序。它接收一个用户的个人资料更新，并将其保存到 DynamoDB。
 * 该函数强制执行一项安全检查，以确保用户只能更新自己的个人资料。它会忽略请求中的 `nickname` 字段，
 * 因为该字段由 Cognito 管理，并在响应中重新注入来自 token 的 `nickname`。
 * @param {object} event - API Gateway Lambda 事件对象。请求体包含 `profilePatch` 字段补丁；兼容旧客户端的 `profile` 对象。
 * @param {object} context - AWS Lambda 调用上下文。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含更新后的用户个人资料或错误消息。
 */
export const handler = async (event, context = {}) => {
  const logger = createStructuredLogger({ service: 'updateUserProfile', requestId: context.awsRequestId });
  logger.info('invocation_started', {
    method: event.httpMethod,
    route: event.resource,
    hasBody: !!event.body,
  });

  try {
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }

    // 安全地获取路径参数
    const pathUserId = event.pathParameters?.userId;
    if (!pathUserId) {
      logger.warn('target_user_missing', { hasPathParameters: !!event.pathParameters });
      return createResponse(400, {
        message: 'Bad Request: userId path parameter is required'
      });
    }

    const authenticatedUser = extractUserFromEvent(event, logger);
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
      if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) throw new TypeError('object required');
    } catch {
      return createResponse(400, { message: 'Bad Request: JSON object body is required' });
    }

    // 验证用户只能修改自己的资料
    if (pathUserId !== authenticatedUser.userId) {
      logger.warn('profile_update_denied', {
        requesterHash: fingerprintIdentifier(authenticatedUser.userId),
        targetHash: fingerprintIdentifier(pathUserId),
      });
      return createResponse(403, {
        message: 'Forbidden: You can only update your own profile'
      });
    }

    // 验证请求体
    if (!requestBody.profile && !requestBody.profilePatch) {
      return createResponse(400, {
        message: 'Bad Request: profile data is required'
      });
    }

    const now = new Date().toISOString();
    let update;
    try {
      // 新客户端显式发送补丁；兼容已部署旧客户端的profile请求，统一执行字段更新。
      if (requestBody.profile && requestBody.profilePatch) throw new TypeError('Provide profilePatch or legacy profile, not both');
      update = buildProfileUpdate(requestBody.profilePatch ?? requestBody.profile, now);
    } catch (error) {
      return createResponse(400, { message: error.message });
    }

    // 构建更新表达式
    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: pathUserId },
      ...update,
      ReturnValues: 'ALL_NEW'
    });

    const result = await dynamodb.send(command);

    // 返回更新后的用户资料，但保持nickname来自Cognito
    const responseProfile = {
      ...result.Attributes,
      profile: {
        ...result.Attributes.profile,
        nickname: authenticatedUser.nickname // 从ID Token获取
      }
    };

    logger.info('profile_update_completed', {
      userHash: fingerprintIdentifier(authenticatedUser.userId),
      fieldCount: Object.keys(requestBody.profilePatch ?? requestBody.profile).length,
    });
    return createResponse(200, {
      message: 'Profile updated successfully',
      user: responseProfile
    });

  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      logger.warn('profile_update_conflict');
      return createResponse(409, { message: 'Please complete profile setup before updating your profile' });
    }
    logger.error('profile_update_failed', describeError(error));
    return createResponse(500, {
      message: 'Error updating user profile'
    });
  }
};
