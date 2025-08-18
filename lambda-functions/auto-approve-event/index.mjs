import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI as GoogleGenAI_Modal, createUserContent, createPartFromUri } from '@google/genai';
import { unmarshall } from "@aws-sdk/util-dynamodb";

// Initialize AWS and Google AI clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

/**
 * Updates the status of an event in DynamoDB.
 * @param {string} userId The user ID (partition key).
 * @param {string} eventId The event ID (sort key).
 * @param {string} newStatus The new status to set (e.g., 'approved').
 */
const updateEventStatus = async (userId, eventId, newStatus) => {
  console.log(`🚀 Updating event ${eventId} for user ${userId} to status: ${newStatus}`);
  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      userId,
      eventId,
    },
    UpdateExpression: "set #status = :s, updatedAt = :t",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":s": newStatus,
      ":t": new Date().toISOString(),
    },
    ReturnValues: "UPDATED_NEW",
  });

  try {
    const result = await docClient.send(command);
    console.log("✅ Successfully updated event status in DynamoDB.");
    return result;
  } catch (error) {
    console.error("❌ Error updating event status in DynamoDB:", error);
    throw error;
  }
};

/**
 * Fetches an object from S3 and returns its content as a string.
 * @param {string} bucket The S3 bucket name.
 * @param {string} key The S3 object key.
 * @returns {Promise<string>} The content of the S3 object.
 */
const getS3ObjectContent = async (bucket, key) => {
  console.log(`⬇️ Fetching object from S3: s3://${bucket}/${key}`);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  try {
    const response = await s3Client.send(command);
    const content = await response.Body.transformToString("utf-8");
    console.log(`✅ Successfully fetched S3 object. Content length: ${content.length}`);
    return content;
  } catch (error) {
    console.error(`❌ Failed to fetch S3 object (s3://${bucket}/${key}):`, error);
    throw error;
  }
};

// 保留原文本聚合常量作为回退
const MAX_PER_FILE_CHARS = 20000;
const MAX_TOTAL_CHARS = 80000;

async function fetchAndAggregateAttachments(bucketName, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  const segments = [];
  let total = 0;
  for (const att of attachments) {
    if (!att || !att.fileUrl) continue;
    if (total >= MAX_TOTAL_CHARS) break;
    try {
      const raw = await getS3ObjectContent(bucketName, att.fileUrl);
      // 基础清洗：移除不可打印字符
      let text = raw.replace(/[\u0000-\u001F]/g, ' ');
      if (text.length > MAX_PER_FILE_CHARS) {
        text = text.slice(0, MAX_PER_FILE_CHARS) + `\n...[TRUNCATED ${text.length - MAX_PER_FILE_CHARS} chars]`;
      }
      if (total + text.length > MAX_TOTAL_CHARS) {
        const allowed = MAX_TOTAL_CHARS - total;
        text = text.slice(0, allowed) + `\n...[GLOBAL TRUNCATION ${text.length - allowed} chars]`;
      }
      segments.push(`===== ATTACHMENT START (${att.fileName || att.fileUrl}) =====\n${text}\n===== ATTACHMENT END =====`);
      total += text.length;
    } catch (e) {
      console.warn('⚠️ 读取附件失败，跳过：', att.fileUrl, e.message);
    }
  }
  return segments.length ? segments.join('\n\n') : null;
}

// 新：多模态上传并生成 parts
async function uploadAllAttachmentsMultiModal(bucketName, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const ai = new GoogleGenAI_Modal({ apiKey: process.env.GEMINI_API_KEY });
  const parts = [];
  for (const att of attachments) {
    if (!att?.fileUrl) continue;
    try {
      const obj = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: att.fileUrl }));
      const arrayBuffer = await obj.Body.transformToByteArray();
      // 上传文件（部分 SDK 版本支持直接传 {data,mimeType}，若不支持需落盘临时文件；此处尝试内存方式）
      const uploadRes = await ai.files.upload({
        file: {
          data: Buffer.from(arrayBuffer),
          mimeType: att.fileType || 'application/octet-stream',
          displayName: att.fileName || att.fileUrl.split('/').pop()
        }
      });
      if (uploadRes?.file?.uri) {
        parts.push(createPartFromUri(uploadRes.file.uri, uploadRes.file.mimeType));
      }
    } catch (e) {
      console.warn('⚠️ 多模态上传失败，跳过该附件，尝试继续:', att.fileUrl, e.message);
    }
  }
  return parts;
}

async function verifyMultiModal(userDetails, attachmentsParts) {
  if (!attachmentsParts.length) return null; // 触发回退
  try {
    const ai = new GoogleGenAI_Modal({ apiKey: process.env.GEMINI_API_KEY });
    const model = 'gemini-2.5-flash'; // 示例模型，可用环境变量覆盖
    const userText = `Validate these hospital test details. Respond only with MATCH or NO_MATCH. Details:\n${JSON.stringify(userDetails, null, 2)}`;
    const response = await ai.models.generateContent({
      model,
      contents: [
        createUserContent([
          userText,
          ...attachmentsParts
        ])
      ]
    });
    const r = response?.response?.text?.().trim().toUpperCase();
    if (r === 'MATCH' || r === 'NO_MATCH') return r === 'MATCH';
    return false;
  } catch (e) {
    console.error('❌ 多模态验证失败，将回退文本模式:', e.message);
    return null; // 触发回退策略
  }
}

// 回退文本模式验证（复用之前逻辑）
const verifyWithGeminiMulti = async (userDetails, aggregatedAttachmentsText) => {
  if (!aggregatedAttachmentsText) return false;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  const prompt = `You are an automated medical report verification system. \nReturn ONLY one word: MATCH or NO_MATCH.\nIf insufficient evidence, answer NO_MATCH.\n--- USER SUBMITTED DATA ---\n${JSON.stringify(userDetails, null, 2)}\n--- COMBINED ATTACHMENTS (TEXT SNIPPETS) ---\n${aggregatedAttachmentsText}\n--- END ---\nAnswer:`;
  try {
    console.log('🤖 Gemini text-fallback verification...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();
    console.log('🤖 Gemini result (fallback):', responseText);
    return responseText === 'MATCH';
  } catch (e) {
    console.error('❌ Gemini fallback verification error:', e);
    return false;
  }
};

export const handler = async (event) => {
  console.log(`📬 Received ${event.Records.length} records from DynamoDB stream.`);

  for (const record of event.Records) {
    // Process only new items added to the table
    if (record.eventName !== 'INSERT') {
      console.log(`⏩ Skipping event that is not an INSERT: ${record.eventName}`);
      continue;
    }

    // The actual data is in the NewImage property, need to unmarshall it from DynamoDB format
    const newEvent = unmarshall(record.dynamodb.NewImage);
    console.log("📄 Processing new event:", JSON.stringify(newEvent, null, 2));

    try {
      if (newEvent.type !== 'hospital_test') {
        console.log(`👍 Event type is '${newEvent.type}', auto-approving.`);
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
        continue;
      }
      console.log("🏥 hospital_test: starting multi-modal verification.");
      const bucketName = process.env.ATTACHMENTS_BUCKET;
      if (!bucketName) { console.error('❌ ATTACHMENTS_BUCKET missing'); continue; }

      const parts = await uploadAllAttachmentsMultiModal(bucketName, newEvent.attachments);
      let isVerified = await verifyMultiModal(newEvent.details, parts);

      if (isVerified === null) { // 回退
        console.log('↩️ Falling back to text aggregation strategy');
        const aggregated = await fetchAndAggregateAttachments(bucketName, newEvent.attachments);
        isVerified = await verifyWithGeminiMulti(newEvent.details, aggregated);
      }

      if (isVerified) {
        console.log('✅ Verification success (multi-modal or fallback). Approving.');
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
      } else {
        console.log('❌ Verification failed. Event stays pending.');
      }

    } catch (error) {
      console.error(`🚨 Failed to process event ${newEvent.eventId}:`, error);
    }
  }

  return { status: "Successfully processed records." };
};
