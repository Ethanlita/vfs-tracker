/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于更新用户的个人资料信息。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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
      console.error('❌ 未找到认证claims');
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
 * [CN] Lambda 函数的主处理程序。它接收一个用户的个人资料更新，并将其保存到 DynamoDB。
 * 该函数强制执行一项安全检查，以确保用户只能更新自己的个人资料。它会忽略请求中的 `nickname` 字段，
 * 因为该字段由 Cognito 管理，并在响应中重新注入来自 token 的 `nickname`。
 * @param {object} event - API Gateway Lambda 事件对象。请求体应包含一个 `profile` 对象。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含更新后的用户个人资料或错误消息。
 */
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // 添加详细的调试信息
  console.log('🔍 详细事件分析:', {
    httpMethod: event.httpMethod,
    pathParameters: event.pathParameters,
    pathParametersType: typeof event.pathParameters,
    requestContext: {
      resourcePath: event.requestContext?.resourcePath,
      httpMethod: event.requestContext?.httpMethod,
      path: event.requestContext?.path
    },
    headers: Object.keys(event.headers || {}),
    hasBody: !!event.body
  });

  try {
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }

    // 安全地获取路径参数
    const pathUserId = event.pathParameters?.userId;
    if (!pathUserId) {
      console.error('❌ pathParameters 问题详情:', {
        pathParameters: event.pathParameters,
        requestContext: event.requestContext,
        rawPath: event.path,
        resource: event.resource
      });
      return createResponse(400, {
        message: 'Bad Request: userId path parameter is required',
        debug: {
          pathParameters: event.pathParameters,
          resource: event.resource,
          path: event.path
        }
      });
    }

    const authenticatedUser = extractUserFromEvent(event);
    const requestBody = JSON.parse(event.body);

    // 验证用户只能修改自己的资料
    if (pathUserId !== authenticatedUser.userId) {
      return createResponse(403, {
        message: 'Forbidden: You can only update your own profile'
      });
    }

    // 验证请求体
    if (!requestBody.profile) {
      return createResponse(400, {
        message: 'Bad Request: profile data is required'
      });
    }

    // 过滤掉nickname字段，因为它由Cognito管理
    const { nickname, ...profileData } = requestBody.profile;
    if (nickname) {
      console.log('Warning: nickname field ignored, managed by Cognito');
    }

    const now = new Date().toISOString();

    // 构建更新表达式
    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: pathUserId },
      UpdateExpression: 'SET profile = :profile, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':profile': profileData,
        ':updatedAt': now
      },
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

    return createResponse(200, {
      message: 'Profile updated successfully',
      user: responseProfile
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return createResponse(500, {
      message: 'Error updating user profile',
      error: error.message
    });
  }
};
