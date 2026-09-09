/**
 * @file [CN] index.mjs 是一个 AWS Lambda 函数，用于向 DynamoDB 中添加新的嗓音事件记录。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 使用环境变量或默认表名
const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

/**
 * [CN] 生成一个唯一的事件 ID。
 * @returns {string} 一个唯一的事件 ID 字符串。
 */
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
 * [CN] 从 API Gateway 事件对象中提取用户信息，优先解析 Authorization 头中的 ID Token。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {{userId: string, email: string, username: string, nickname: string}} 提取出的用户信息。
 * @throws {Error} 如果未找到有效的 ID token。
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
 * [CN] 清理和验证附件数组，确保每个附件对象都包含必需的字段。
 * @param {Array<object>} raw - 来自请求体的原始附件数组。
 * @returns {Array<object>|undefined} 一个经过清理的附件对象数组，如果输入无效或为空则返回 undefined。
 */
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

/**
 * [CN] 解析 API Gateway 请求体并确保顶层数据为 JSON 对象。
 * @param {string} body - 原始 JSON 请求体。
 * @returns {object} 已解析的事件请求对象。
 * @throws {SyntaxError|TypeError} 请求体缺失、格式错误或顶层不是对象。
 */
function parseRequestBody(body) {
  if (typeof body !== 'string' || !body.trim()) {
    throw new TypeError('Request body must be a non-empty JSON string');
  }
  const parsed = JSON.parse(body);
  // null、数组及原始值都不能作为事件对象读取字段。
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Request body must be a JSON object');
  }
  return parsed;
}

/**
 * [CN] Lambda 函数的主处理程序。它处理 CORS 预检请求，验证输入，并将新事件写入 DynamoDB。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {Promise<object>} 一个 API Gateway 响应对象。
 */
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
        let requestBody;
        try {
            requestBody = parseRequestBody(event.body);
        } catch {
            // 只在请求体解析阶段映射 400，数据库等服务故障仍由外层返回 500。
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: 'Request body must be a valid JSON object',
                    errorCode: 'INVALID_REQUEST_BODY'
                }),
            };
        }

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
