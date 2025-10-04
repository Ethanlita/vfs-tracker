/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于获取特定用户的所有嗓音事件。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = "VoiceFemEvents";

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
 * [CN] Lambda 函数的主处理程序。它通过从授权 token 中提取的用户 ID 查询并返回该用户的所有嗓音事件。
 * 它强制执行一项安全检查，以确保用户只能访问自己的数据。事件按创建日期降序返回。
 * @param {object} event - API Gateway Lambda 事件对象，应在 `pathParameters` 中包含 `userId`。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含用户的嗓音事件列表或错误消息。
 */
export const handler = async (event) => {
    // 调试信息
    const debugInfo = {
        lambdaExecuted: true,
        timestamp: new Date().toISOString(),
        pathUserId: event.pathParameters?.userId,
        hasAuthorizer: !!event.requestContext?.authorizer,
        hasAuthorizerClaims: !!event.requestContext?.authorizer?.claims,
        hasAuthHeader: !!(event.headers?.Authorization || event.headers?.authorization)
    };

    try {
        console.log('🔍 Lambda: 开始执行，调试信息:', debugInfo);

        // 处理OPTIONS预检请求
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'OK' }),
            };
        }

        // 从路径参数获取userId
        const pathUserId = event.pathParameters?.userId;

        // 从ID Token中提取认证的用户信息
        const userInfo = extractUserFromEvent(event);
        const authenticatedUserId = userInfo.userId;

        // 安全检查：确保用户只能访问自己的数据
        if (pathUserId !== authenticatedUserId) {
            console.log('❌ Lambda: 用户id错误', { authenticatedUserId, pathUserId });
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: "Forbidden: Cannot access other user's data",
                    debug: {
                        ...debugInfo,
                        authenticatedUserId,
                        pathUserId,
                        reason: "Path userId does not match authenticated user"
                    }
                }),
            };
        }

        // 查询用户的语音事件
        const command = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": authenticatedUserId,
            },
            // 按创建时间降序排列，最新的在前面
            ScanIndexForward: false
        });

        const { Items } = await docClient.send(command);

        console.log('✅ Lambda: 成功查询到用户事件', {
            userId: authenticatedUserId,
            eventCount: Items.length
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                events: Items,
                debug: {
                    ...debugInfo,
                    success: true,
                    eventCount: Items.length,
                    authenticatedUserId
                }
            }),
        };

    } catch (error) {
        console.error('❌ Lambda执行错误:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Error fetching voice events",
                error: error.message,
                debug: debugInfo
            }),
        };
    }
};
