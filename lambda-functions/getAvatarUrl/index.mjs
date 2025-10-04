/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于为指定的用户头像生成一个预签名的 S3 GET URL。
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME;

/**
 * [CN] 一个 AWS Lambda 处理程序，接收一个用户 ID 作为路径参数，并返回一个预签名的 S3 URL，
 * 该 URL 可用于在 24 小时内公开访问该用户的头像。
 * 它还支持 CDN 主机重写以优化性能。
 * @param {object} event - API Gateway Lambda 事件对象，应在 `pathParameters` 中包含 `userId`。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含头像的预签名 URL 或错误消息。
 */
export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    };

    try {
        // 处理OPTIONS请求
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: headers,
                body: ''
            };
        }

        // 从路径参数获取用户ID
        const userId = event.pathParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ error: '缺少用户ID' })
            };
        }

        // 生成头像文件的S3 key
        const avatarKey = `avatars/${userId}/avatar`;

        // 生成预签名URL（头像允许所有用户访问，有效期较长）
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: avatarKey
        });

        // 头像URL有效期设置为24小时
        let signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
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
            console.error('Failed to parse or modify signedUrl:', err);
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({
                url: signedUrl,
                expiresIn: 86400
            })
        };

    } catch (error) {
        console.error('获取头像URL失败:', error);

        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                error: '获取头像URL失败',
                details: error.message
            })
        };
    }
};
