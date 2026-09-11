/**
 * @file 朗读稿件公开读取 Lambda
 * @description 从 DynamoDB 稿件库读取已启用内容，供嗓音测试朗读步骤使用。
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createStructuredLogger, describeError } from './structuredLogger.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/** 构造 API Gateway JSON 响应。 */
function response(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) };
}

/**
 * 读取全部启用稿件并按标题稳定排序。
 * @returns {Promise<object>} API Gateway 响应。
 */
export async function handler(_event, context = {}) {
  const logger = createStructuredLogger({ service: 'getReadingPassages', requestId: context.awsRequestId });
  try {
    const result = await db.send(new ScanCommand({
      TableName: process.env.READING_PASSAGES_TABLE_NAME,
      FilterExpression: '#enabled = :enabled',
      ExpressionAttributeNames: { '#enabled': 'enabled' },
      ExpressionAttributeValues: { ':enabled': true },
      ProjectionExpression: 'passageId, title, author, content',
    }));
    const passages = (result.Items || []).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    logger.info('reading_passages_read', { passageCount: passages.length });
    return response(200, passages);
  } catch (error) {
    logger.error('reading_passages_read_failed', describeError(error));
    return response(500, { message: '暂时无法读取朗读稿件' });
  }
}
