import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = "VoiceFemEvents";

export const handler = async (event) => {
    // 添加CORS头部配置 - 确保在Lambda代理集成下CORS正常工作
    const corsHeaders = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
    };

    // 处理OPTIONS预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'OK' })
        };
    }

    const command = new ScanCommand({
        TableName: tableName,
        // 只返回已批准的事件供公共仪表板显示
        FilterExpression: "#st = :status_approved",
        ExpressionAttributeNames: {
            "#st": "status",      // 事件审核状态
            "#type": "type",      // 事件类型 (DynamoDB保留关键字)
            "#date": "date"       // 事件发生日期 (DynamoDB保留关键字)
        },
        ExpressionAttributeValues: {
            ":status_approved": "approved",
        },
        // 返回公共仪表板需要的完整字段，符合数据结构文档规范
        ProjectionExpression: "userId, eventId, #type, #date, details, createdAt",
    });

    try {
        const { Items } = await docClient.send(command);

        // 按事件发生日期降序排序，最新事件在前
        const sortedItems = Items.sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(sortedItems),
        };
    } catch (error) {
        console.error("Error fetching approved events:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                message: "Error fetching all events",
                error: error.message
            }),
        };
    }
};
