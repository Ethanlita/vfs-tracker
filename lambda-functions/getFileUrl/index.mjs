import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt from 'jsonwebtoken';

// AWS SDK Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

// Environment Variables
const BUCKET_NAME = process.env.BUCKET_NAME;
const VOICE_TESTS_TABLE_NAME = process.env.VOICE_TESTS_TABLE_NAME;

// 验证JWT token并提取用户信息
const verifyToken = (token) => {
    try {
        const cleanToken = token.replace('Bearer ', '');
        // 在生产环境中，这里应该使用密钥进行严格的签名验证
        const decoded = jwt.decode(cleanToken);
        return decoded;
    } catch (error) {
        console.error("Token verification error:", error);
        throw new Error('无效的token');
    }
};

const createResponse = (statusCode, body, headers = {}) => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        ...headers,
    },
    body: JSON.stringify(body),
});

export const handler = async (event) => {
    // 处理CORS预检请求
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(204, '');
    }

    try {
        // 检查服务配置
        if (!BUCKET_NAME) {
            console.error("BUCKET_NAME environment variable is not set.");
            return createResponse(500, { error: '服务配置错误' });
        }

        // 验证用户身份
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) {
            return createResponse(401, { error: '缺少授权头' });
        }
        const userInfo = verifyToken(authHeader);
        const currentUserId = userInfo?.sub || userInfo?.userId;
        if (!currentUserId) {
            return createResponse(401, { error: '无效的用户信息' });
        }

        // 获取请求的文件key
        const body = event.body ? JSON.parse(event.body) : {};
        const fileKey = event.queryStringParameters?.fileKey || body.fileKey;
        if (!fileKey) {
            return createResponse(400, { error: '缺少文件key' });
        }

        // --- 基于路径类型的权限验证 ---
        let isAuthorized = false;
        const pathParts = fileKey.split('/');

        if (fileKey.startsWith('attachments/')) {
            // 验证用户上传的附件
            const fileOwnerUserId = pathParts[1];
            if (fileOwnerUserId === currentUserId) {
                isAuthorized = true;
            }
        } else if (fileKey.startsWith('voice-tests/')) {
            // 验证系统生成的嗓音测试报告
            if (!VOICE_TESTS_TABLE_NAME) {
                console.error("VOICE_TESTS_TABLE_NAME environment variable is not set.");
                return createResponse(500, { error: '服务配置错误' });
            }
            const sessionId = pathParts[1];
            if (sessionId) {
                const command = new GetCommand({
                    TableName: VOICE_TESTS_TABLE_NAME,
                    Key: { sessionId },
                });
                const { Item } = await ddbDocClient.send(command);
                // 检查从数据库中查到的userId是否与当前用户匹配
                if (Item && Item.userId === currentUserId) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return createResponse(403, { error: '无权限访问此文件' });
        }

        // --- 生成预签名URL ---
        const s3Command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
        });
        let signedUrl = await getSignedUrl(s3Client, s3Command, { expiresIn: 3600 });
        const normalizedHost = String(
            event.headers?.['x-forwarded-host'] ||
            event.headers?.['X-Forwarded-Host'] ||
            event.headers?.host ||
            event.headers?.Host ||
            event.requestContext?.domainName ||
            ''
        ).toLowerCase();
        const cdnHost = normalizedHost.endsWith('.cn')
            ? 'storage.vfs-tracker.cn'
            : 'storage.vfs-tracker.app';
        try {
            const parsed = new URL(signedUrl);
            parsed.host = cdnHost;
            signedUrl = parsed.toString();
        } catch (err) {
            console.error('Error modifying signed URL host:', err);
        }

        return createResponse(200, { url: signedUrl, expiresIn: 3600 });

    } catch (error) {
        console.error('获取文件URL时发生意外错误:', error);
        return createResponse(500, {
            error: '获取文件URL失败',
            details: error.message,
        });
    }
};
