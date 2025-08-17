import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

/**
 * Uses Gemini to verify if the user's input matches the report content.
 * @param {object} userDetails The user-submitted details from the event.
 * @param {string} reportContent The content extracted from the S3 attachment.
 * @returns {Promise<boolean>} True if the content matches, false otherwise.
 */
const verifyWithGemini = async (userDetails, reportContent) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `
    You are an automated medical report verification system. Your task is to determine if the user-submitted data reasonably matches the content of the attached medical report.
    Please respond with only a single word: "MATCH" or "NO_MATCH".

    --- USER SUBMITTED DATA ---
    ${JSON.stringify(userDetails, null, 2)}

    --- ATTACHED REPORT CONTENT ---
    ${reportContent}
    ---

    Based on the comparison, does the user-submitted data match the report content? Respond with "MATCH" or "NO_MATCH".
  `;

  try {
    console.log("🤖 Calling Gemini for verification...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();
    console.log(`🤖 Gemini verification result: ${responseText}`);
    return responseText === "MATCH";
  } catch (error) {
    console.error("❌ Error during Gemini verification:", error);
    // In case of AI failure, default to not matching to be safe.
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
      // Rule 1: Auto-approve any event that is not a hospital test
      if (newEvent.type !== 'hospital_test') {
        console.log(`👍 Event type is '${newEvent.type}', auto-approving.`);
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
        continue; // Move to the next record
      }

      // Rule 2: For hospital tests, use Gemini for verification
      console.log("🏥 Event type is 'hospital_test', starting verification process.");

      const attachmentKey = newEvent.details?.attachmentKey;
      if (!attachmentKey) {
        console.warn("⚠️ No attachmentKey found in event details. Cannot verify. Event will remain pending.");
        continue;
      }

      const bucketName = process.env.ATTACHMENTS_BUCKET;
      if (!bucketName) {
        console.error("❌ ATTACHMENTS_BUCKET environment variable is not set. Cannot fetch attachment.");
        continue;
      }

      // Get content from S3 and verify with Gemini
      const reportContent = await getS3ObjectContent(bucketName, attachmentKey);
      const isVerified = await verifyWithGemini(newEvent.details, reportContent);

      if (isVerified) {
        console.log("✅ Gemini verification successful. Approving event.");
        await updateEventStatus(newEvent.userId, newEvent.eventId, 'approved');
      } else {
        console.log("❌ Gemini verification failed or indicated no match. Event remains pending for manual review.");
      }

    } catch (error) {
      console.error(`🚨 Failed to process event ${newEvent.eventId}:`, error);
      // It's important to not throw an error here, so the Lambda function can continue processing other records in the batch.
    }
  }

  return { status: "Successfully processed records." };
};
