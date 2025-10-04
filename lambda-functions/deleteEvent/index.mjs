/**
 * @file [CN] index.mjs 是一个 AWS Lambda 函数，用于删除指定的嗓音事件及其在 S3 上的关联附件。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";
const bucketName = process.env.ATTACHMENTS_BUCKET_NAME;

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
    throw new Error('Unauthorized: Cannot find user ID from token.');
  }
  return claims.sub;
}

/**
 * [CN] Lambda 函数的主处理程序。它负责删除 DynamoDB 中的事件记录，并同时删除 S3 中所有关联的附件文件。
 * @param {object} event - API Gateway Lambda 事件对象，在路径参数中包含 `eventId`。
 * @returns {Promise<object>} 一个 API Gateway 响应对象。
 */
export const handler = async (event) => {
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

    console.log(`Attempting to delete event ${eventId} for user ${authenticatedUserId}`);

    const deleteDbEntryCommand = new DeleteCommand({
      TableName: tableName,
      Key: {
        userId: authenticatedUserId,
        eventId: eventId,
      },
      ConditionExpression: "attribute_exists(eventId)",
      ReturnValues: "ALL_OLD", // 返回被删除的项
    });

    const { Attributes: deletedEvent } = await docClient.send(deleteDbEntryCommand);

    // 如果事件有附件，则从 S3 删除它们
    if (bucketName && deletedEvent && Array.isArray(deletedEvent.attachments) && deletedEvent.attachments.length > 0) {
      console.log(`Event ${eventId} has ${deletedEvent.attachments.length} attachments. Deleting from S3 bucket: ${bucketName}`);

      const deletePromises = deletedEvent.attachments.map(att => {
        if (!att.fileUrl) {
          console.warn('Attachment object is missing fileUrl, skipping:', att);
          return null;
        }
        try {
          let key;
          const s3Prefix = `s3://${bucketName}/`;

          // 处理三种可能的格式：S3 URI、HTTPS URL 或仅 key 本身
          if (att.fileUrl.startsWith(s3Prefix)) {
            key = att.fileUrl.substring(s3Prefix.length);
          } else if (att.fileUrl.startsWith('http')) {
            const url = new URL(att.fileUrl);
            key = decodeURIComponent(url.pathname.substring(1)); 
          } else {
            // 假设它就是 key
            key = att.fileUrl;
          }
          
          if (!key) {
            console.warn('Could not determine S3 key from fileUrl, skipping:', att.fileUrl);
            return null;
          }

          console.log(`Queueing deletion for S3 object with key: ${key}`);
          const deleteS3Command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
          });

          // 返回 promise，单独记录错误而不使整个批次失败
          return s3Client.send(deleteS3Command).catch(err => {
            console.error(`Failed to delete S3 object ${key}:`, err);
          });
        } catch (e) {
          console.error('Error processing attachment for deletion:', att.fileUrl, e);
          return null;
        }
      }).filter(Boolean);

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`Successfully processed S3 deletion for ${deletePromises.length} attachments.`);
      }
    } else if (!bucketName) {
      console.warn("ATTACHMENTS_BUCKET_NAME environment variable not set. Skipping attachment deletion.");
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Event deleted successfully" }),
    };

  } catch (error) {
    console.error("Error deleting event:", error);

    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Event not found or you do not have permission to delete it." }),
      };
    }

    if (error.message.startsWith('Unauthorized')) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ message: error.message }),
        };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error deleting event", error: error.message }),
    };
  }
};