/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于获取用户的公开个人资料信息。
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// 初始化DynamoDB客户端
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// 环境变量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';

// CORS头部
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key',
};

/**
 * [CN] 创建一个标准化的、包含 CORS 头的 API Gateway 响应对象。
 * @param {number} statusCode - HTTP 状态码。
 * @param {object} body - 要在响应体中进行 JSON 字符串化的对象。
 * @returns {object} 格式化后的 API Gateway 响应对象。
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(body),
    };
}

/**
 * [CN] Lambda 函数的主处理程序。它根据用户的隐私设置，获取并返回一个经过筛选的公开版本的用户个人资料。
 * 只有当 `isNamePublic` 或 `areSocialsPublic` 标志设置为 true 时，相应的字段才会被包含在响应中。
 * @param {object} event - API Gateway Lambda 事件对象，应在 `pathParameters` 中包含 `userId`。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含用户的公开个人资料信息或错误消息。
 */
export const handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // 处理OPTIONS预检请求
        if (event.httpMethod === 'OPTIONS') {
            return createResponse(200, { message: 'OK' });
        }

        const userId = event.pathParameters.userId;

        const command = new GetCommand({
            TableName: USERS_TABLE,
            Key: { userId }
        });

        const result = await dynamodb.send(command);

        if (!result.Item) {
            return createResponse(404, {
                message: 'User not found'
            });
        }

        const user = result.Item;
        const profile = user.profile || {};

        // 构建公开资料响应
        const publicProfile = {
            userId: user.userId,
            profile: {
                nickname: '（非公开）', // 公开资料中不显示nickname，由Cognito管理
                name: profile.isNamePublic ? (profile.name || '（未设置）') : '（非公开）',
                bio: profile.bio || '',
                socials: profile.areSocialsPublic ? (profile.socials || []) : []
            }
        };

        return createResponse(200, publicProfile);

    } catch (error) {
        console.error('Error getting public user profile:', error);
        return createResponse(500, {
            message: 'Error fetching public user profile',
            error: error.message
        });
    }
};
