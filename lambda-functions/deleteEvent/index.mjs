/**
 * @file [CN] index.mjs 是一个 AWS Lambda 函数，用于删除指定的嗓音事件及其在 S3 上的关联附件。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createStructuredLogger, describeError, fingerprintIdentifier } from './structuredLogger.mjs';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";
const bucketName = process.env.ATTACHMENTS_BUCKET;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * [CN] 从事件的 Cognito ID Token 中提取经过身份验证的用户 ID。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {string} 经过身份验证的用户的 ID (sub)。
 * @throws {Error} 如果在 token 中找不到用户 ID。
 */
function getAuthenticatedUserId(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims || !claims.sub) {
    throw new TypeError('Unauthorized: Cannot find user ID from token.');
  }
  return claims.sub;
}

/**
 * [CN] 从附件记录中提取当前桶内的 S3 对象键。
 * @param {string} fileUrl - 纯对象键、当前桶的 S3 URI 或 HTTPS 地址。
 * @param {string} configuredBucket - 当前附件桶名称。
 * @returns {string|null} 可删除的对象键；无有效地址时返回 null。
 */
export function attachmentKeyFromFileUrl(fileUrl, configuredBucket) {
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) return null;
  const value = fileUrl.trim();
  const s3Prefix = `s3://${configuredBucket}/`;
  if (value.startsWith(s3Prefix)) return value.slice(s3Prefix.length) || null;
  if (value.startsWith('s3://')) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return decodeURIComponent(new URL(value).pathname.replace(/^\/+/, '')) || null;
    } catch {
      return null;
    }
  }
  return value.replace(/^\/+/, '') || null;
}

/**
 * [CN] 在删除数据库记录前删除全部有效附件；任一 S3 请求失败时抛错，使用户可以重试。
 * @param {object} storedEvent - DynamoDB 中读取到的事件。
 * @returns {Promise<number>} 已向 S3 提交删除的附件数量。
 */
async function deleteAttachments(storedEvent) {
  const attachments = Array.isArray(storedEvent?.attachments) ? storedEvent.attachments : [];
  if (attachments.length === 0) return 0;
  if (!bucketName) throw new Error('ATTACHMENTS_BUCKET environment variable is required to delete event attachments.');

  const commands = attachments
    .map(attachment => attachmentKeyFromFileUrl(attachment?.fileUrl, bucketName))
    .filter(Boolean)
    .map(Key => s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key })));
  await Promise.all(commands);
  return commands.length;
}

/**
 * [CN] Lambda 函数的主处理程序。它先读取事件并删除关联 S3 文件，全部成功后再删除 DynamoDB 记录。
 * @param {object} event - API Gateway Lambda 事件对象，在路径参数中包含 `eventId`。
 * @returns {Promise<object>} 一个 API Gateway 响应对象。
 */
export const handler = async (event, context = {}) => {
  const logger = createStructuredLogger({ service: 'deleteEvent', requestId: context.awsRequestId });
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'OK' }),
    };
  }

  try {
    const authenticatedUserId = getAuthenticatedUserId(event);
    const eventId = event.pathParameters?.eventId;

    if (!eventId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Missing required path parameter: eventId" }),
      };
    }

    const identifiers = {
      userHash: fingerprintIdentifier(authenticatedUserId),
      eventHash: fingerprintIdentifier(eventId),
    };
    logger.info('event_delete_started', identifiers);

    const { Item: storedEvent } = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { userId: authenticatedUserId, eventId },
      ConsistentRead: true,
    }));
    if (!storedEvent) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Event not found or you do not have permission to delete it." }),
      };
    }

    const deletedAttachmentCount = await deleteAttachments(storedEvent);

    const deleteDbEntryCommand = new DeleteCommand({
      TableName: tableName,
      Key: {
        userId: authenticatedUserId,
        eventId: eventId,
      },
      ConditionExpression: "attribute_exists(eventId)",
    });
    await docClient.send(deleteDbEntryCommand);
    logger.info('event_delete_completed', { ...identifiers, deletedAttachmentCount });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Event deleted successfully", deletedAttachmentCount }),
    };

  } catch (error) {
    logger.error('event_delete_failed', describeError(error));

    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Event not found or you do not have permission to delete it." }),
      };
    }

    if (error instanceof TypeError) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Unauthorized: Cannot find user ID from token.' }),
        };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error deleting event" }),
    };
  }
};
