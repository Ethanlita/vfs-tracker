/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于获取特定用户的所有嗓音事件。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

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
 * [CN] Lambda 函数的主处理程序。它通过从授权 token 中提取的用户 ID 查询并返回该用户的所有嗓音事件。
 * 它强制执行一项安全检查，以确保用户只能访问自己的数据。事件按创建日期降序返回。
 * @param {object} event - API Gateway Lambda 事件对象，应在 `pathParameters` 中包含 `userId`。
 * @param {object} context - AWS Lambda 调用上下文。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含用户的嗓音事件列表或错误消息。
 */
export const handler = async (event, context = {}) => {
    const logger = createStructuredLogger({ service: 'getVoiceEvents', requestId: context.awsRequestId });
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

        // 从路径参数获取userId
        const pathUserId = event.pathParameters?.userId;

        // 从ID Token中提取认证的用户信息
        const userInfo = extractUserFromEvent(event, logger);
        const authenticatedUserId = userInfo.userId;

        // 安全检查：确保用户只能访问自己的数据
        if (pathUserId !== authenticatedUserId) {
            logger.warn('event_access_denied', {
                requesterHash: fingerprintIdentifier(authenticatedUserId),
                targetHash: fingerprintIdentifier(pathUserId),
            });
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: "Forbidden: Cannot access other user's data"
                }),
            };
        }

        // 完整消费 DynamoDB Query 游标；空结果页也可能带有下一页游标。
        const items = [];
        let lastEvaluatedKey;
        let pageCount = 0;
        do {
            const command = new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {
                    ":userId": authenticatedUserId,
                },
                // 分区内先按 eventId 降序读取，汇总后再按真实创建时间统一排序。
                ScanIndexForward: false,
                ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {})
            });
            const result = await docClient.send(command);
            items.push(...(result.Items || []));
            lastEvaluatedKey = result.LastEvaluatedKey;
            pageCount += 1;
        } while (lastEvaluatedKey);

        // API 文档承诺按创建时间降序；eventId 排序不能替代业务时间排序。
        items.sort((left, right) => {
            const leftTime = Date.parse(left.createdAt || left.date || '') || 0;
            const rightTime = Date.parse(right.createdAt || right.date || '') || 0;
            return rightTime - leftTime || String(right.eventId || '').localeCompare(String(left.eventId || ''));
        });

        logger.info('events_read_completed', {
            userHash: fingerprintIdentifier(authenticatedUserId),
            eventCount: items.length,
            pageCount
        });

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                events: items,
                complete: true
            }),
        };

    } catch (error) {
        logger.error('events_read_failed', describeError(error));
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Error fetching voice events",
            }),
        };
    }
};
