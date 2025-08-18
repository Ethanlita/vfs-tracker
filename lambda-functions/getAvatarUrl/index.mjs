import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME;

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
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

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
