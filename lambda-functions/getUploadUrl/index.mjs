import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Max-Age': '86400'
};

const errorResponse = (statusCode, message, extra = {}) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify({ error: message, ...extra })
});

export const handler = async (event) => {
  // 基础调试日志
  console.log('[getUploadUrl] incoming event meta', {
    httpMethod: event.httpMethod,
    path: event.path,
    hasAuth: !!(event.headers?.Authorization || event.headers?.authorization),
    bucketConfigured: !!BUCKET_NAME
  });

  try {
    // 处理预检
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

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

    // 解析 body
    let parsed;
    try { parsed = JSON.parse(event.body || '{}'); } catch { return errorResponse(400, '请求体不是有效的JSON'); }
    const { fileKey, contentType } = parsed || {};
    if (!fileKey || !contentType) return errorResponse(400, '缺少 fileKey 或 contentType');

    // fileKey 基础格式校验：<folder>/<userId>/filename
    const parts = fileKey.split('/').filter(Boolean);
    if (parts.length < 3) return errorResponse(400, 'fileKey格式不正确，应为 <folder>/<userId>/<filename>');
    const [folder, ownerId] = parts;
    const allowedFolders = ['avatars', 'attachments', 'uploads'];
    if (!allowedFolders.includes(folder)) return errorResponse(403, '禁止的上传目录');
    if (ownerId !== currentUserId) return errorResponse(403, '无权限上传到他人目录');

    // 构造Put命令
    const put = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Metadata: {
        'uploaded-by': currentUserId,
        'upload-time': new Date().toISOString()
      }
    });

    let uploadUrl;
    try {
      uploadUrl = await getSignedUrl(s3Client, put, { expiresIn: 900 });
    } catch (e) {
      console.error('[getUploadUrl] 生成签名失败', e);
      return errorResponse(500, '生成预签名URL失败', { reason: e.message });
    }

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
      const parsed = new URL(uploadUrl);
      parsed.host = cdnHost;
      uploadUrl = parsed.toString();
    } catch (e) {
      // Failed to rewrite host; proceed with original uploadUrl
      console.error('[getUploadUrl] Failed to rewrite uploadUrl host', e);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ uploadUrl, fileKey, expiresIn: 900 })
    };
  } catch (error) {
    console.error('[getUploadUrl] 未捕获异常', error);
    return errorResponse(500, '内部错误', { details: error.message });
  }
};
