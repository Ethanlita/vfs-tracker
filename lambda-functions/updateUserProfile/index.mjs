/**
 * 更新用户资料 Lambda函数
 * PUT /user/{userId}
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
 * 从JWT token中提取用户信息 - 专门处理ID Token
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
 * 创建标准HTTP响应
 */
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

/**
 * 主处理函数
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
