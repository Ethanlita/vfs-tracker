/**
 * 用户资料设置 Lambda函数
 * POST /user/profile-setup
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

// 初始化DynamoDB客户端
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// 环境变量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';

// CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key',
};

/**
 * 从JWT token中提取用户信息 - 专门处理ID Token
 */
function extractUserFromEvent(event) {
  try {
    console.log('🔍 开始提取用户信息，优先处理ID Token');
    console.log('🔍 事件详情:', {
      hasRequestContext: !!event.requestContext,
      hasAuthorizer: !!event.requestContext?.authorizer,
      authorizerKeys: event.requestContext?.authorizer ? Object.keys(event.requestContext.authorizer) : [],
      hasHeaders: !!event.headers,
      headerKeys: event.headers ? Object.keys(event.headers) : []
    });

    // 尝试多种方式获取用户信息
    let claims = null;

    // 方法1：从API Gateway Cognito授权器 (如果设置了)
    if (event.requestContext?.authorizer?.claims) {
      claims = event.requestContext.authorizer.claims;
      console.log('✅ 使用API Gateway授权器提供的claims');
    }
    // 方法1.5：检查authorizer的其他可能位置
    else if (event.requestContext?.authorizer && typeof event.requestContext.authorizer === 'object') {
      // 有时claims直接在authorizer对象中
      const authorizer = event.requestContext.authorizer;
      if (authorizer.sub || authorizer.email) {
        claims = authorizer;
        console.log('✅ 使用API Gateway授权器对象作为claims');
      }
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
        authorizerContent: event.requestContext?.authorizer,
        hasAuthHeader: !!(event.headers?.Authorization || event.headers?.authorization),
        headers: Object.keys(event.headers || {}),
        authHeaderPreview: (event.headers?.Authorization || event.headers?.authorization)?.substring(0, 30) + '...'
      });
      throw new Error('Invalid authentication token');
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
      tokenType: claims.token_use || 'unknown'
    });

    return userInfo;

  } catch (error) {
    console.error('❌ 从事件中提取用户信息失败:', error);
    throw new Error(`Invalid authentication token`);
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

  try {
    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }

    const authenticatedUser = extractUserFromEvent(event);
    const requestBody = JSON.parse(event.body);

    console.log('📋 请求体内容:', JSON.stringify(requestBody, null, 2));
    console.log('📋 请求体中的profile字段:', requestBody.profile);

    const now = new Date().toISOString();

    // 确保有profile数据，如果没有则使用默认值
    const profileData = requestBody.profile || {};
    console.log('📋 处理后的profileData:', profileData);

    // 过滤掉nickname字段，使用Cognito的nickname
    const { nickname, ...cleanProfileData } = profileData;
    if (nickname) {
      console.log('Warning: nickname field ignored, using Cognito nickname');
    }

    const profile = {
      nickname: authenticatedUser.nickname, // 添加Cognito的nickname到profile中
      name: cleanProfileData.name || '',
      bio: cleanProfileData.bio || '',
      isNamePublic: cleanProfileData.isNamePublic !== undefined ? cleanProfileData.isNamePublic : false,
      socials: cleanProfileData.socials || [],
      areSocialsPublic: cleanProfileData.areSocialsPublic !== undefined ? cleanProfileData.areSocialsPublic : false
    };

    console.log('📋 最终的profile对象:', JSON.stringify(profile, null, 2));

    // 首先检查用户是否已存在
    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId: authenticatedUser.userId }
    });

    const existingUser = await dynamodb.send(getCommand);
    const isNewUser = !existingUser.Item;

    console.log('🔍 用户状态检查:', {
      isNewUser,
      hasExistingUser: !!existingUser.Item,
      existingUserProfile: existingUser.Item?.profile
    });

    // 准备用户数据
    const userData = {
      userId: authenticatedUser.userId,
      email: authenticatedUser.email,
      profile: profile,
      updatedAt: now
    };

    if (isNewUser) {
      userData.createdAt = now;
    } else {
      userData.createdAt = existingUser.Item.createdAt;
    }

    console.log('💾 准备写入的用户数据:', JSON.stringify(userData, null, 2));

    // 使用PUT操作创建或更新用户记录
    const putCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: userData
    });

    await dynamodb.send(putCommand);

    console.log('✅ 数据已成功写入DynamoDB');

    // 返回结果中的用户数据
    const responseUser = {
      ...userData
    };

    const statusCode = isNewUser ? 201 : 200;
    const response = createResponse(statusCode, {
      message: 'User profile setup completed successfully',
      user: responseUser,
      isNewUser: isNewUser
    });

    console.log('📤 返回响应:', JSON.stringify(response, null, 2));

    return response;

  } catch (error) {
    console.error('Error setting up user profile:', error);
    return createResponse(500, {
      message: 'Error setting up user profile',
      error: error.message
    });
  }
};
