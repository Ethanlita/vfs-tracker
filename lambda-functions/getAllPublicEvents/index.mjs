import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const eventsTableName = "VoiceFemEvents";
const usersTableName = "VoiceFemUsers";

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
        TableName: eventsTableName,
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
        ProjectionExpression: "userId, eventId, #type, #date, details, createdAt, attachments",
    });

    try {
        const { Items } = await docClient.send(command);

        // 获取所有唯一的用户ID
        const uniqueUserIds = [...new Set(Items.map(item => item.userId))];

        // 批量查询用户信息以获取显示名称
        const userDisplayNames = await getUserDisplayNames(uniqueUserIds);

        // 为每个事件添加用户显示名称
        const eventsWithUserNames = Items.map(event => {
            const { attachments, ...rest } = event; // 从公共响应剥离附件
            return {
                ...rest,
                userName: userDisplayNames[event.userId] || '（非公开）'
            }
        });

        // 按事件发生日期降序排序，最新事件在前
        const sortedItems = eventsWithUserNames.sort((a, b) => new Date(b.date) - new Date(a.date));

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

/**
 * 批量获取用户显示名称
 * @param {string[]} userIds - 用户ID数组
 * @returns {Object} userId到显示名称的映射
 */
async function getUserDisplayNames(userIds) {
    if (userIds.length === 0) return {};

    try {
        // DynamoDB BatchGet最多支持100个项目，如果超过需要分批处理
        const batchSize = 100;
        const userDisplayNames = {};

        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);

            const batchCommand = new BatchGetCommand({
                RequestItems: {
                    [usersTableName]: {
                        Keys: batch.map(userId => ({ userId })),
                        ProjectionExpression: "userId, profile"
                    }
                }
            });

            const result = await docClient.send(batchCommand);
            const users = result.Responses[usersTableName] || [];

            // 处理每个用户的显示名称
            users.forEach(user => {
                const profile = user.profile || {};
                // 如果用户设置姓名为公开，显示真实姓名（空则显示"（未设置）"）；否则显示"（非公开）"
                userDisplayNames[user.userId] = profile.isNamePublic
                    ? (profile.name || '（未设置）')
                    : '（非公开）';
            });

            // 对于未找到的用户，设置默认显示名称
            batch.forEach(userId => {
                if (!userDisplayNames[userId]) {
                    userDisplayNames[userId] = '（非公开）';
                }
            });
        }

        return userDisplayNames;
    } catch (error) {
        console.error("Error fetching user display names:", error);
        // 如果查询用户信息失败，返回默认显示名称
        const fallbackNames = {};
        userIds.forEach(userId => {
            fallbackNames[userId] = '（非公开）';
        });
        return fallbackNames;
    }
}
