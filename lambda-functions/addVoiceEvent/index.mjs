/**
 * @file [CN] index.mjs 是一个 AWS Lambda 函数，用于向 DynamoDB 中添加新的嗓音事件记录。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { createHash } from 'node:crypto';
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

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

/**
 * [CN] 将JSON值转为稳定表示；对象键顺序不影响比较，数组顺序仍有业务含义。
 * @param {unknown} value - 请求中可序列化的值。
 * @returns {string} 稳定的JSON字符串。
 */
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * [CN] 取创建请求的业务字段用于比较，忽略审核状态及服务端时间戳。
 * @param {object} item - 新请求或已有事件。
 * @returns {string} 可比较的业务内容。
 */
function creationContent(item) {
  return canonicalJson({ type: item.type, date: item.date, details: item.details,
    attachments: item.attachments });
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
 * [CN] 清理和验证附件数组，确保每个附件对象都包含必需的字段。
 * @param {Array<object>} raw - 来自请求体的原始附件数组。
 * @param {object} logger - 当前调用的结构化日志器。
 * @returns {Array<object>|undefined} 一个经过清理的附件对象数组，如果输入无效或为空则返回 undefined。
 */
function sanitizeAttachments(raw, logger) {
  if (!raw) return undefined;
  if (!Array.isArray(raw)) {
    logger.warn('attachments_invalid', { receivedType: typeof raw });
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
 * @param {object} context - AWS Lambda 调用上下文。
 * @returns {Promise<object>} 一个 API Gateway 响应对象。
 */
export const handler = async (event, context = {}) => {
    const logger = createStructuredLogger({ service: 'addVoiceEvent', requestId: context.awsRequestId });
    logger.info('invocation_started', { method: event.httpMethod, route: event.resource });
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
            logger.warn('request_json_invalid');
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
        const userInfo = extractUserFromEvent(event, logger);
        const userId = userInfo.userId;

        const requestId = requestBody.clientRequestId;
        if (requestId !== undefined && (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId))) {
            logger.warn('client_request_id_invalid', { receivedType: typeof requestId });
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({
                message: 'clientRequestId must contain 1–128 letters, digits, underscores or hyphens',
                errorCode: 'INVALID_CLIENT_REQUEST_ID'
            }) };
        }

        // 验证必需字段
        if (!requestBody.type || !requestBody.date || !requestBody.details) {
            logger.warn('request_validation_failed', {
                hasType: !!requestBody.type,
                hasDate: !!requestBody.date,
                hasDetails: !!requestBody.details,
            });
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: "Missing required fields: type, date, details"
                }),
            };
        }

        const attachments = sanitizeAttachments(requestBody.attachments, logger);
        // 同一账号的同一请求映射到同一主键；不同账号的相同标识彼此独立。
        const eventId = requestId === undefined ? generateEventId()
            : 'event_' + createHash('sha256').update(JSON.stringify([userId, requestId])).digest('hex');
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

        try {
            await docClient.send(new PutCommand({
                TableName: tableName, // 使用环境变量
                Item: item,
                ...(requestId === undefined ? {} : {
                    ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(eventId)',
                    ReturnValuesOnConditionCheckFailure: 'ALL_OLD'
                })
            }));
        } catch (error) {
            if (requestId === undefined || error.name !== 'ConditionalCheckFailedException') throw error;
            // SDK异常中的Item仍为AttributeValue格式；缺少旧项时不能误报成功。
            if (!error.Item) throw new Error('Idempotency check did not return the existing event');
            const existing = unmarshall(error.Item);
            if (existing.userId !== userId || existing.eventId !== eventId || creationContent(existing) !== creationContent(item)) {
                logger.warn('idempotency_conflict', {
                    userHash: fingerprintIdentifier(userId),
                    eventHash: fingerprintIdentifier(eventId),
                });
                return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({
                    message: 'This request identifier was already used for different event content',
                    errorCode: 'IDEMPOTENCY_CONFLICT'
                }) };
            }
            // 相同请求直接返回原ID，不重写时间、审核状态或触发第二次插入。
        }

        logger.info('event_write_completed', {
            userHash: fingerprintIdentifier(userId),
            eventHash: fingerprintIdentifier(eventId),
            eventType: requestBody.type,
            attachmentCount: attachments?.length || 0,
            idempotent: requestId !== undefined,
        });
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Event added successfully",
                eventId: eventId
            }),
        };
    } catch (error) {
        logger.error('event_write_failed', describeError(error));
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Error adding event"
            }),
        };
    }
};
