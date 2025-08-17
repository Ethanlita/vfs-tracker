import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.EVENTS_TABLE || "VoiceFemEvents";

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
  // Handler for DELETE /event/{eventId}
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

    console.log(`Attempting to delete event ${eventId} for user ${authenticatedUserId} via ${event.httpMethod} ${event.path}`);

    const command = new DeleteCommand({
      TableName: tableName,
      Key: {
        // IMPORTANT: The partition key is the user ID from the token, not from the path.
        // This ensures a user can only ever attempt to delete their own events.
        userId: authenticatedUserId,
        eventId: eventId,
      },
      // ConditionExpression ensures that the item exists before trying to delete it.
      ConditionExpression: "attribute_exists(eventId)",
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Event deleted successfully" }),
    };

  } catch (error) {
    console.error("Error deleting event:", error);

    // Handle the case where the item does not exist or the condition check fails
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
