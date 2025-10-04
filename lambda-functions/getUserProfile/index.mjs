/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于获取用户的个人资料信息。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

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
function extractUserFromEvent(event) {
  try {
    console.log('🔍 开始提取用户信息，优先处理ID Token');

    // 尝试多种方式获取用户信息
    let claims = null;

    // 方法1：从API Gateway Cognito授权器 (如果设置了)
    if (event.requestContext?.authorizer?.claims) {
      claims = event.requestContext.authorizer.claims;
      console.log('✅ 使用API Gateway授权器提供的claims');
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
            console.log('✅ 成功解析ID Token，token_use:', payload.token_use);
          } else {
            console.warn('⚠️ 收到的不是ID Token，token_use:', payload.token_use);
            throw new Error(`Expected ID token, but received: ${payload.token_use}`);
          }
        } catch (parseError) {
          console.error('❌ JWT Token解析失败:', parseError);
          throw new Error(`ID Token parsing failed: ${parseError.message}`);
        }
      }
    }

    if (!claims) {
      console.error('❌ 未找到认证claims，事件详情:', {
        hasAuthorizer: !!event.requestContext?.authorizer,
        hasAuthHeader: !!(event.headers?.Authorization || event.headers?.authorization),
        headers: Object.keys(event.headers || {}),
        authHeaderPreview: (event.headers?.Authorization || event.headers?.authorization)?.substring(0, 30) + '...'
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

    console.log('✅ 成功提取用户信息:', {
      userId: userInfo.userId,
      email: userInfo.email,
      username: userInfo.username,
      tokenType: claims.token_use
    });

    return userInfo;

  } catch (error) {
    console.error('❌ 从事件中提取用户信息失败:', error);
    throw new Error(`Invalid ID token: ${error.message}`);
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
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含用户的个人资料信息或错误消息。
 */
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }

    // 从JWT Token获取认证用户信息
    const authenticatedUser = extractUserFromEvent(event);

    // 安全地获取路径参数
    const pathUserId = event.pathParameters?.userId;

    // 如果路径参数不存在，使用JWT中的用户ID（临时解决方案）
    const targetUserId = pathUserId || authenticatedUser.userId;

    if (!targetUserId) {
      console.error('❌ 无法获取用户ID，详情:', {
        pathParameters: event.pathParameters,
        authenticatedUserId: authenticatedUser.userId,
        requestContext: event.requestContext,
        rawPath: event.path,
        resource: event.resource
      });
      return createResponse(400, {
        message: 'Bad Request: Unable to determine user ID',
        debug: {
          pathParameters: event.pathParameters,
          hasAuthenticatedUser: !!authenticatedUser.userId,
          resource: event.resource,
          path: event.path
        }
      });
    }

    // 安全验证：确保用户只能访问自己的资料
    if (pathUserId && pathUserId !== authenticatedUser.userId) {
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
      // 如果用户不存在，返回基本信息
      const basicProfile = {
        userId: authenticatedUser.userId,
        email: authenticatedUser.email,
        profile: {
          nickname: authenticatedUser.nickname,
          name: '',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return createResponse(200, basicProfile);
    }

    // 确保返回的数据包含nickname信息
    const userProfile = {
      ...result.Item,
      profile: {
        nickname: authenticatedUser.nickname,
        ...result.Item.profile
      }
    };

    return createResponse(200, userProfile);

  } catch (error) {
    console.error('Error getting user profile:', error);
    return createResponse(500, {
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};
