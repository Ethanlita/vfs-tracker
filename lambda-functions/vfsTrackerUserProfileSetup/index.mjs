/**
 * VFS Tracker 用户管理 Lambda函数
 * 处理用户资料的CRUD操作
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// 初始化DynamoDB客户端
const dynamodb = new AWS.DynamoDB.DocumentClient();

// 环境变量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';
const EVENTS_TABLE = process.env.EVENTS_TABLE || 'VoiceFemEvents';

// CORS头部
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key',
};

/**
 * 从JWT token中提取用户信息
 */
function extractUserFromEvent(event) {
  try {
    const claims = event.requestContext.authorizer.claims;
    return {
      userId: claims.sub,
      email: claims.email
    };
  } catch (error) {
    console.error('Error extracting user from JWT:', error);
    throw new Error('Invalid authentication token');
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
 * 处理OPTIONS预检请求
 */
function handleOptions() {
  return createResponse(200, { message: 'OK' });
}

/**
 * GET /user/{userId} - 获取用户资料（私有）
 */
async function getUserProfile(event) {
  try {
    const pathUserId = event.pathParameters.userId;
    const authenticatedUser = extractUserFromEvent(event);

    // 验证用户只能访问自己的资料
    if (pathUserId !== authenticatedUser.userId) {
      return createResponse(403, {
        message: 'Forbidden: You can only access your own profile'
      });
    }

    const params = {
      TableName: USERS_TABLE,
      Key: { userId: pathUserId }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return createResponse(404, {
        message: 'User profile not found'
      });
    }

    return createResponse(200, result.Item);

  } catch (error) {
    console.error('Error getting user profile:', error);
    return createResponse(500, {
      message: 'Error fetching user profile',
      error: error.message
    });
  }
}

/**
 * GET /user/{userId}/public - 获取用户公开资料（公用）
 */
async function getUserPublicProfile(event) {
  try {
    const userId = event.pathParameters.userId;

    const params = {
      TableName: USERS_TABLE,
      Key: { userId }
    };

    const result = await dynamodb.get(params).promise();

    if (!result.Item) {
      return createResponse(404, {
        message: 'User not found'
      });
    }

    const user = result.Item;
    const profile = user.profile || {};

    // 构建公开资料响应
    const publicProfile = {
      userId: user.userId,
      profile: {
        name: profile.isNamePublic ? profile.name : '（非公开）',
        socials: profile.areSocialsPublic ? (profile.socials || []) : []
      }
    };

    return createResponse(200, publicProfile);

  } catch (error) {
    console.error('Error getting public user profile:', error);
    return createResponse(500, {
      message: 'Error fetching public user profile',
      error: error.message
    });
  }
}

/**
 * PUT /user/{userId} - 更新用户资料（私有）
 */
async function updateUserProfile(event) {
  try {
    const pathUserId = event.pathParameters.userId;
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

    const now = new Date().toISOString();

    // 构建更新表达式
    const params = {
      TableName: USERS_TABLE,
      Key: { userId: pathUserId },
      UpdateExpression: 'SET profile = :profile, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':profile': requestBody.profile,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(params).promise();

    return createResponse(200, {
      message: 'User profile updated successfully',
      user: result.Attributes
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return createResponse(500, {
      message: 'Error updating user profile',
      error: error.message
    });
  }
}

/**
 * POST /user/profile-setup - 新用户资料完善（私有）
 */
async function setupUserProfile(event) {
  try {
    const authenticatedUser = extractUserFromEvent(event);
    const requestBody = JSON.parse(event.body);

    const now = new Date().toISOString();
    const profile = requestBody.profile || {
      name: '',
      isNamePublic: false,
      socials: [],
      areSocialsPublic: false
    };

    // 首先检查用户是否已存在
    const getParams = {
      TableName: USERS_TABLE,
      Key: { userId: authenticatedUser.userId }
    };

    const existingUser = await dynamodb.get(getParams).promise();
    const isNewUser = !existingUser.Item;

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

    // 使用PUT操作创建或更新用户记录
    const putParams = {
      TableName: USERS_TABLE,
      Item: userData
    };

    await dynamodb.put(putParams).promise();

    const statusCode = isNewUser ? 201 : 200;
    return createResponse(statusCode, {
      message: 'User profile setup completed successfully',
      user: userData,
      isNewUser: isNewUser
    });

  } catch (error) {
    console.error('Error setting up user profile:', error);
    return createResponse(500, {
      message: 'Error setting up user profile',
      error: error.message
    });
  }
}

/**
 * 主处理函数
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const httpMethod = event.httpMethod;
    const resource = event.resource;

    // 处理OPTIONS预检请求
    if (httpMethod === 'OPTIONS') {
      return handleOptions();
    }

    // 路由分发
    if (httpMethod === 'GET' && resource === '/user/{userId}') {
      return await getUserProfile(event);
    } else if (httpMethod === 'GET' && resource === '/user/{userId}/public') {
      return await getUserPublicProfile(event);
    } else if (httpMethod === 'PUT' && resource === '/user/{userId}') {
      return await updateUserProfile(event);
    } else if (httpMethod === 'POST' && resource === '/user/profile-setup') {
      return await setupUserProfile(event);
    } else {
      return createResponse(404, {
        message: 'Not Found: Resource not found'
      });
    }

  } catch (error) {
    console.error('Unhandled error:', error);
    return createResponse(500, {
      message: 'Internal Server Error',
      error: error.message
    });
  }
};
