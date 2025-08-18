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
 * Extracts user information from the Cognito ID token in the event.
 */
function getAuthenticatedUserId(event) {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims || !claims.sub) {
    throw new Error('Unauthorized: Cannot find user ID from token.');
  }
  return claims.sub;
}

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
      ReturnValues: "ALL_OLD", // Return the item that was deleted
    });

    const { Attributes: deletedEvent } = await docClient.send(deleteDbEntryCommand);

    // If the event had attachments, delete them from S3
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

          // Handle three possible formats: S3 URI, HTTPS URL, or just the key
          if (att.fileUrl.startsWith(s3Prefix)) {
            key = att.fileUrl.substring(s3Prefix.length);
          } else if (att.fileUrl.startsWith('http')) {
            const url = new URL(att.fileUrl);
            key = decodeURIComponent(url.pathname.substring(1)); 
          } else {
            // Assume it's the key itself
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

          // Return the promise, logging errors individually without failing the whole batch
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
