/**
 * @file [CN] index.mjs 是一个由 DynamoDB 流触发的 AWS Lambda 函数。
 * 它会自动批准新创建的嗓音事件。对于 'hospital_test' 类型的事件，它会使用 Google Gemini API 进行多模态验证，将用户提交的数据与上传的报告文件进行比较。
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI as GoogleGenAI_Modal, createUserContent, createPartFromUri } from '@google/genai';
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { promises as fs } from 'fs';
import path from 'path';
import {
  createStructuredLogger,
  describeError,
  fingerprintIdentifier,
} from './structuredLogger.mjs';

// Initialize clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const genAI_modal = new GoogleGenAI_Modal({ apiKey: process.env.GEMINI_API_KEY });

const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

/**
 * [CN] 更新 DynamoDB 中指定事件的状态。
 * @param {string} userId - 用户 ID。
 * @param {string} eventId - 事件 ID。
 * @param {string} newStatus - 要设置的新状态 (例如, 'approved')。
 * @param {object} logger - 当前 Lambda 调用的结构化日志器。
 * @returns {Promise<void>}
 */
const updateEventStatus = async (userId, eventId, newStatus, logger) => {
  const identifiers = {
    userHash: fingerprintIdentifier(userId),
    eventHash: fingerprintIdentifier(eventId),
  };
  logger.info('event_status_update_started', { ...identifiers, newStatus });
  const command = new UpdateCommand({
    TableName: tableName,
    Key: { userId, eventId },
    UpdateExpression: "set #status = :s, updatedAt = :t",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":s": newStatus, ":t": new Date().toISOString() },
  });
  try {
    await docClient.send(command);
    logger.info('event_status_updated', { ...identifiers, newStatus });
  } catch (error) {
    logger.error('event_status_update_failed', { ...identifiers, ...describeError(error) });
    throw error;
  }
};

/**
 * [CN] 提供给 Gemini 模型的系统指令，指导其如何分析报告。
 * @type {string}
 */
const SYSTEM_INSTRUCTION = `You are an intelligent medical report analysis assistant. Your task is to compare the user-submitted structured data with the content of the provided attachments, which should be medical reports. Based on your analysis, you must respond with a single word: MATCH or NO_MATCH. If the information is generally consistent, return MATCH. If there are significant discrepancies, or the attachments do not seem to be valid medical reports related to the data, return NO_MATCH.`;

/**
 * [CN] 将所有附件从 S3 下载，写入 Lambda 的临时存储，然后上传到 Gemini File API 以进行多模态分析。
 * @param {string} bucketName - S3 存储桶名称。
 * @param {Array<object>} attachments - 来自事件的附件对象数组。
 * @param {object} logger - 当前 Lambda 调用的结构化日志器。
 * @returns {Promise<Array<object>>} 一个解析为包含 Gemini 文件部分以用于 API 调用的 Promise。
 */
async function uploadAllAttachmentsMultiModal(bucketName, attachments, logger) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const parts = [];
  for (const [attachmentIndex, att] of attachments.entries()) {
    if (!att?.fileUrl || !att?.fileType) {
      logger.warn('attachment_invalid', { attachmentIndex });
      continue;
    }

    const tempFileName = `${Date.now()}_${path.basename(att.fileName || att.fileUrl)}`;
    const tempFilePath = path.join('/tmp', tempFileName);

    try {
      // 1. Download from S3
      const s3Object = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: att.fileUrl }));
      const fileBuffer = Buffer.from(await s3Object.Body.transformToByteArray());

      // 2. Write to temporary file in Lambda /tmp
      await fs.writeFile(tempFilePath, fileBuffer);

      // 3. Upload to Gemini using File API with the file path
      logger.info('attachment_ai_upload_started', {
        attachmentIndex,
        mimeType: att.fileType,
        sizeBytes: fileBuffer.length,
      });
      const uploadRes = await genAI_modal.files.upload({
        file: tempFilePath,
        config: {
          mimeType: att.fileType,
          displayName: att.fileName,
        },
      });
      
      // CORRECTED & ENHANCED: Check the file state is ACTIVE and access properties directly from the response object.
      if (uploadRes?.uri && uploadRes.state === 'ACTIVE') {
        parts.push(createPartFromUri(uploadRes.uri, uploadRes.mimeType));
        logger.info('attachment_ai_upload_completed', { attachmentIndex, mimeType: uploadRes.mimeType });
      } else {
        logger.warn('attachment_ai_upload_inactive', { attachmentIndex, state: uploadRes?.state });
      }
    } catch (e) {
      logger.error('attachment_ai_upload_failed', { attachmentIndex, ...describeError(e) });
    } finally {
      // 4. Clean up the temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkErr) {
        logger.warn('temporary_attachment_cleanup_failed', { attachmentIndex, ...describeError(unlinkErr) });
      }
    }
  }
  return parts;
}

/**
 * [CN] 使用 Gemini API 验证用户提交的数据是否与附件内容匹配。
 * @param {object} userDetails - 来自事件的用户提交的详细信息。
 * @param {Array<object>} attachmentsParts - 来自 `uploadAllAttachmentsMultiModal` 的 Gemini 文件部分数组。
 * @param {object} logger - 当前 Lambda 调用的结构化日志器。
 * @returns {Promise<boolean>} 一个解析为 `true`（如果验证成功匹配）或 `false` 的 Promise。
 */
async function verifyMultiModal(userDetails, attachmentsParts, logger) {
  if (!attachmentsParts || attachmentsParts.length === 0) {
    logger.warn('verification_skipped_no_attachments');
    return false;
  }

  try {
    const model = 'gemini-2.5-flash';
    const userContent = `User-submitted data:\n${JSON.stringify(userDetails, null, 2)}`;
    logger.info('verification_ai_request_started', {
      model,
      attachmentCount: attachmentsParts.length,
      inputCharacters: userContent.length,
    });
    
    const response = await genAI_modal.models.generateContent({
      model,
      contents: [createUserContent([userContent, ...attachmentsParts])],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    // 1. 转换为 JS 对象
    const obj = JSON.parse(JSON.stringify(response));
    // 2. 提取出 "NO_MATCH"
    const resultText = obj.candidates[0].content.parts[0].text;

    if (resultText === 'MATCH') {
      logger.info('verification_ai_result', { matched: true });
      return true;
    }
    // Any other response (NO_MATCH, or unexpected) is considered a failure.
    logger.info('verification_ai_result', { matched: false });
    return false; 
  } catch (e) {
    logger.error('verification_ai_request_failed', describeError(e));
    return false; // Any API error is a verification failure.
  }
}

/**
 * [CN] Lambda 函数的主处理程序。由 DynamoDB 流触发，处理新插入的事件记录。
 * @param {object} event - DynamoDB 流事件。
 * @param {object} context - AWS Lambda 调用上下文。
 * @returns {Promise<{status: string}>} 一个表示处理完成的状态对象。
 */
export const handler = async (event, context = {}) => {
  const logger = createStructuredLogger({
    service: 'auto-approve-event',
    requestId: context.awsRequestId,
  });
  const records = Array.isArray(event.Records) ? event.Records : [];
  logger.info('stream_batch_started', { recordCount: records.length });

  for (const record of records) {
    if (record.eventName !== 'INSERT') {
      logger.debug('stream_record_skipped', { eventName: record.eventName });
      continue;
    }

    const newEvent = unmarshall(record.dynamodb.NewImage);
    const identifiers = {
      userHash: fingerprintIdentifier(newEvent.userId),
      eventHash: fingerprintIdentifier(newEvent.eventId),
    };
    logger.info('stream_record_started', {
      ...identifiers,
      eventType: newEvent.type,
      attachmentCount: Array.isArray(newEvent.attachments) ? newEvent.attachments.length : 0,
    });

    try {
      if (newEvent.type !== 'hospital_test') {
        logger.info('event_auto_approval_selected', { ...identifiers, eventType: newEvent.type });
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved', logger);
        continue;
      }

      logger.info('hospital_event_verification_started', identifiers);
      const bucketName = process.env.ATTACHMENTS_BUCKET;
      if (!bucketName) {
        logger.error('configuration_missing', { variable: 'ATTACHMENTS_BUCKET', ...identifiers });
        continue;
      }

      // Attempt multi-modal verification. Any failure in the process will result in `isVerified` being false.
      const parts = await uploadAllAttachmentsMultiModal(bucketName, newEvent.attachments, logger);
      const isVerified = await verifyMultiModal(newEvent.details, parts, logger);

      // Final Decision
      if (isVerified) {
        logger.info('hospital_event_verification_completed', { ...identifiers, matched: true });
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved', logger);
      } else {
        logger.warn('hospital_event_verification_completed', { ...identifiers, matched: false });
      }

    } catch (error) {
      logger.error('stream_record_failed', { ...identifiers, ...describeError(error) });
    }
  }

  return { status: "Successfully processed records." };
};
