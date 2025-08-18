import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 使用环境变量或默认表名
const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

// 原生UUID生成函数（无需外部依赖）
function generateEventId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `event_${timestamp}_${randomPart}`;
}

// 完整的CORS头部配置
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
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

function sanitizeAttachments(raw) {
  if (!raw) return undefined;
  if (!Array.isArray(raw)) {
    console.warn('attachments 字段不是数组，忽略');
    return undefined;
  }
  // 仅保留允许字段并确保 fileUrl 存在
  const sanitized = raw
    .filter(a => a && typeof a === 'object' && typeof a.fileUrl === 'string' && a.fileUrl.trim())
    .map(a => ({
      fileUrl: a.fileUrl,
      fileType: typeof a.fileType === 'string' ? a.fileType : undefined,
      fileName: typeof a.fileName === 'string' ? a.fileName : undefined
    }));
  return sanitized.length ? sanitized : undefined;
}

export const handler = async (event) => {
    try {
        // 处理OPTIONS预检请求
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'OK' }),
            };
        }

        // 解析请求体
        const requestBody = JSON.parse(event.body || '{}');

        // 从ID Token中提取用户信息
        const userInfo = extractUserFromEvent(event);
        const userId = userInfo.userId;

        // 验证必需字段
        if (!requestBody.type || !requestBody.date || !requestBody.details) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: "Missing required fields: type, date, details"
                }),
            };
        }

        const attachments = sanitizeAttachments(requestBody.attachments);
        const eventId = generateEventId(); // 使用原生方法代替uuid
        const timestamp = new Date().toISOString();

        const item = {
            userId,           // 从ID Token获取
            eventId,          // 生成UUID
            type: requestBody.type,
            date: requestBody.date,
            details: requestBody.details,
            status: "pending", // 新事件默认为pending状态
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        if (attachments) item.attachments = attachments;

        await docClient.send(new PutCommand({
            TableName: tableName, // 使用环境变量
            Item: item,
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Event added successfully",
                eventId: eventId
            }),
        };
    } catch (error) {
        console.error("Error adding voice event:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Error adding event",
                error: error.message
            }),
        };
    }
};
