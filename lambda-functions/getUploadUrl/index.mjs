import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
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

    // 解析请求体
    const body = JSON.parse(event.body || '{}');
    const { fileKey, contentType } = body;

    if (!fileKey || !contentType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '缺少文件key或内容类型' })
      };
    }

    // 验证用户是否有权限上传到该路径
    // 文件路径格式：avatars/{userId}/* 或 attachments/{userId}/* 或 uploads/{userId}/*
    const pathParts = fileKey.split('/');
    const fileOwnerUserId = pathParts[1];

    if (fileOwnerUserId !== currentUserId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: '无权限上传到此路径' })
      };
    }

    // 生成预签名上传URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      // 设置一些安全的元数据
      Metadata: {
        'uploaded-by': currentUserId,
        'upload-time': new Date().toISOString()
      }
    });

    // 上传URL有效期设置为15分钟
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl: signedUrl,
        fileKey: fileKey,
        expiresIn: 900
      })
    };

  } catch (error) {
    console.error('生成上传URL失败:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '生成上传URL失败',
        details: error.message
      })
    };
  }
};
