/**
 * 获取用户公开资料 Lambda函数
 * GET /user/{userId}/public
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
 * 创建标准HTTP响应
 */
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(body),
    };
}

/**
 * 主处理函数
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
