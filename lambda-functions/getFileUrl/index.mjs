import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jwt from 'jsonwebtoken';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME;

// 验证JWT token并提取用户信息
const verifyToken = (token) => {
  try {
    // 移除 "Bearer " 前缀
    const cleanToken = token.replace('Bearer ', '');
    // 这里需要根据实际的JWT secret或公钥来验证
    // 暂时返回解码后的payload（生产环境需要proper验证）
    const decoded = jwt.decode(cleanToken);
    return decoded;
  } catch (error) {
    throw new Error('无效的token');
  }
};

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  try {
    // 处理OPTIONS请求
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    // 验证授权
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '缺少授权头' })
      };
    }

    const userInfo = verifyToken(authHeader);
    const currentUserId = userInfo?.sub || userInfo?.userId;

    if (!currentUserId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: '无效的用户信息' })
      };
    }

    // 获取请求的文件key
    let fileKey;
    if (event.httpMethod === 'GET') {
      fileKey = event.queryStringParameters?.fileKey;
    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      fileKey = body.fileKey;
    }

    if (!fileKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少文件key' })
      };
    }

    // 验证用户是否有权限访问该文件
    // 文件路径格式：attachments/{userId}/{filename} 或 uploads/{userId}/{filename}
    const pathParts = fileKey.split('/');
    const fileOwnerUserId = pathParts[1];

    if (fileOwnerUserId !== currentUserId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权限访问此文件' })
      };
    }

    // 生成预签名URL
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey
    });

    // 附件URL有效期设置为1小时
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: signedUrl,
        expiresIn: 3600
      })
    };

  } catch (error) {
    console.error('获取文件URL失败:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '获取文件URL失败',
        details: error.message
      })
    };
  }
};
