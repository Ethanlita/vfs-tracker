import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decode } from 'jsonwebtoken';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME;

// 验证JWT token并提取用户信息（演示环境仅解码，不做签名验证）
const verifyToken = (token) => {
  if (!token) throw new Error('缺少token');
  try {
    const clean = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = decode(clean);
    if (!decoded) throw new Error('无法解码token');
    return decoded;
  } catch (e) {
    throw new Error('无效的token: ' + e.message);
  }
};

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Max-Age': '86400'
};

const errorResponse = (statusCode, message, extra = {}) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ error: message, ...extra })
});

export const handler = async (event) => {
  // 处理预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    if (!BUCKET_NAME) {
      return errorResponse(500, '服务未配置存储桶 BUCKET_NAME');
    }

    // 认证
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) return errorResponse(401, '缺少授权头');
    let userInfo;
    try { userInfo = verifyToken(authHeader); } catch (e) { return errorResponse(401, e.message); }
    const currentUserId = userInfo?.sub || userInfo?.userId;
    if (!currentUserId) return errorResponse(401, 'token中缺少用户标识');

    // 获取 fileKey
    let fileKey;
    if (event.httpMethod === 'GET') {
      fileKey = event.queryStringParameters?.fileKey;
    } else if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      fileKey = body.fileKey;
    }
    if (!fileKey) return errorResponse(400, '缺少fileKey');

    // 权限验证
    const ownerId = fileKey.split('/')?.[1];
    if (ownerId !== currentUserId) return errorResponse(403, '无权限访问此文件');

    // 生成预签名URL
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ url, expiresIn: 3600 })
    };

  } catch (error) {
    console.error('[getFileUrl] 未捕获异常', error);
    return errorResponse(500, '内部错误', { details: error.message });
  }
};
