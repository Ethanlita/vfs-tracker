import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    try {
        // 解析请求体
        const requestBody = JSON.parse(event.body);

        // 从Cognito JWT token中提取用户ID
        const userId = event.requestContext.authorizer.claims.sub;

        // 验证必需字段
        if (!requestBody.type || !requestBody.date || !requestBody.details) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Missing required fields: type, date, details"
                }),
            };
        }

        // 生成完整的事件项，符合数据结构规范
        const eventId = uuidv4();
        const timestamp = new Date().toISOString();

        const item = {
            userId,           // 从Cognito token获取
            eventId,          // 生成UUID
            type: requestBody.type,
            date: requestBody.date,
            details: requestBody.details,
            status: "pending", // 新事件默认为pending状态
            createdAt: timestamp,
            updatedAt: timestamp
        };

        const command = new PutCommand({
            TableName: "VoiceFemEvents",
            Item: item,
        });

        await docClient.send(command);

        return {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            body: JSON.stringify({
                message: "Event added successfully",
                item
            }),
        };
    } catch (error) {
        console.error("Error adding event:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Error adding event",
                error: error.message
            }),
        };
    }
};
