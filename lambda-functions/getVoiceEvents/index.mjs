import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = "VoiceFemEvents";

export const handler = async (event) => {
    try {
        // 从路径参数获取userId
        const pathUserId = event.pathParameters?.userId;

        // 从Cognito JWT token中获取认证的用户ID
        const authenticatedUserId = event.requestContext?.authorizer?.claims?.sub;

        // 安全检查：确保用户只能访问自己的数据
        if (!authenticatedUserId) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({ message: "Unauthorized: Missing authentication" }),
            };
        }

        if (pathUserId !== authenticatedUserId) {
            return {
                statusCode: 403,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({ message: "Forbidden: Cannot access other user's data" }),
            };
        }

        const command = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeNames: {
                "#type": "type",    // 处理保留关键字
                "#date": "date",    // 处理保留关键字
                "#status": "status" // 处理保留关键字
            },
            ExpressionAttributeValues: {
                ":userId": authenticatedUserId,
            },
            // 返回用户所有事件（包括pending, approved, rejected）
            // 用户应该能看到自己的所有事件及其状态
            ProjectionExpression: "userId, eventId, #type, #date, details, #status, createdAt, updatedAt"
        });

        const { Items } = await docClient.send(command);

        // 按日期降序排序
        const sortedItems = Items.sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "GET,OPTIONS"
            },
            body: JSON.stringify(sortedItems),
        };
    } catch (error) {
        console.error("Error fetching user events:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Error fetching events",
                error: error.message
            }),
        };
    }
};
