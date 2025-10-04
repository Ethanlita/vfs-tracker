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
 * @returns {Promise<void>}
 */
const updateEventStatus = async (userId, eventId, newStatus) => {
  console.log(`🚀 Updating event ${eventId} for user ${userId} to status: ${newStatus}`);
  const command = new UpdateCommand({
    TableName: tableName,
    Key: { userId, eventId },
    UpdateExpression: "set #status = :s, updatedAt = :t",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":s": newStatus, ":t": new Date().toISOString() },
  });
  try {
    await docClient.send(command);
    console.log("✅ Successfully updated event status.");
  } catch (error) {
    console.error("❌ Error updating event status:", error);
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
 * @returns {Promise<Array<object>>} 一个解析为包含 Gemini 文件部分以用于 API 调用的 Promise。
 */
async function uploadAllAttachmentsMultiModal(bucketName, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const parts = [];
  for (const att of attachments) {
    if (!att?.fileUrl || !att?.fileType) {
      console.warn('⚠️ Attachment missing fileUrl or fileType, skipping:', att);
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
      console.log(`⬆️ Uploading ${tempFilePath} to Gemini File API...`);
      const uploadRes = await genAI_modal.files.upload({
        file: tempFilePath,
        config: {
          mimeType: att.fileType,
          displayName: att.fileName,
        },
      });
      
      console.log('📄 Gemini File API raw response:', JSON.stringify(uploadRes, null, 2));

      // CORRECTED & ENHANCED: Check the file state is ACTIVE and access properties directly from the response object.
      if (uploadRes?.uri && uploadRes.state === 'ACTIVE') {
        parts.push(createPartFromUri(uploadRes.uri, uploadRes.mimeType));
        console.log(`✅ Successfully uploaded ${att.fileName}. URI: ${uploadRes.uri}`);
      } else {
        console.warn('⚠️ Gemini upload did not result in an ACTIVE file with a URI.', { response: uploadRes });
      }
    } catch (e) {
      console.error(`❌ Full error during multi-modal upload for: ${att.fileUrl}`, JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    } finally {
      // 4. Clean up the temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkErr) {
        console.warn(`⚠️ Failed to clean up temporary file: ${tempFilePath}`, unlinkErr);
      }
    }
  }
  return parts;
}

/**
 * [CN] 使用 Gemini API 验证用户提交的数据是否与附件内容匹配。
 * @param {object} userDetails - 来自事件的用户提交的详细信息。
 * @param {Array<object>} attachmentsParts - 来自 `uploadAllAttachmentsMultiModal` 的 Gemini 文件部分数组。
 * @returns {Promise<boolean>} 一个解析为 `true`（如果验证成功匹配）或 `false` 的 Promise。
 */
async function verifyMultiModal(userDetails, attachmentsParts) {
  if (!attachmentsParts || attachmentsParts.length === 0) {
    console.log('No attachments were successfully uploaded for multi-modal verification. Verification fails.');
    return false;
  }

  try {
    console.log('🤖 Calling Gemini with multi-modal data...');
    const model = 'gemini-2.5-flash';
    const userContent = `User-submitted data:\n${JSON.stringify(userDetails, null, 2)}`;
    
    const response = await genAI_modal.models.generateContent({
      model,
      contents: [createUserContent([userContent, ...attachmentsParts])],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    console.log('🤖 Gemini multi-modal response-to-json:', JSON.stringify(response));
    // 1. 转换为 JS 对象
    const obj = JSON.parse(JSON.stringify(response));
    // 2. 提取出 "NO_MATCH"
    const resultText = obj.candidates[0].content.parts[0].text;

    if (resultText === 'MATCH') {
      return true;
    }
    // Any other response (NO_MATCH, or unexpected) is considered a failure.
    return false; 
  } catch (e) {
    console.error('❌ Multi-modal verification API call failed:', e.message);
    return false; // Any API error is a verification failure.
  }
}

/**
 * [CN] Lambda 函数的主处理程序。由 DynamoDB 流触发，处理新插入的事件记录。
 * @param {object} event - DynamoDB 流事件。
 * @returns {Promise<{status: string}>} 一个表示处理完成的状态对象。
 */
export const handler = async (event) => {
  console.log(`📬 Received ${event.Records.length} records from DynamoDB stream.`);

  for (const record of event.Records) {
    if (record.eventName !== 'INSERT') {
      console.log(`⏩ Skipping non-INSERT event: ${record.eventName}`);
      continue;
    }

    const newEvent = unmarshall(record.dynamodb.NewImage);
    console.log("📄 Processing new event:", JSON.stringify(newEvent, null, 2));

    try {
      if (newEvent.type !== 'hospital_test') {
        console.log(`👍 Event type is '${newEvent.type}', auto-approving.`);
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
        continue;
      }

      console.log("🏥 Event is a hospital_test, starting verification.");
      const bucketName = process.env.ATTACHMENTS_BUCKET;
      if (!bucketName) {
        console.error('❌ ATTACHMENTS_BUCKET env var is not set. Cannot process attachments.');
        continue;
      }

      // Attempt multi-modal verification. Any failure in the process will result in `isVerified` being false.
      const parts = await uploadAllAttachmentsMultiModal(bucketName, newEvent.attachments);
      const isVerified = await verifyMultiModal(newEvent.details, parts);

      // Final Decision
      if (isVerified) {
        console.log('✅ Verification SUCCEEDED. Approving event.');
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
      } else {
        console.log('❌ Verification FAILED. Event will remain pending.');
      }

    } catch (error) {
      console.error(`🚨 An unhandled error occurred while processing event ${newEvent.eventId}:`, error);
    }
  }

  return { status: "Successfully processed records." };
};