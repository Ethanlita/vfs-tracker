/**
 * @file S3 操作服务
 * 封装管理员页面所需的 S3 操作
 */

import { 
  GetObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 存储桶名称
 */
const BUCKET_NAME = 'vfs-tracker-objstor';

/**
 * 获取文件的预签名 URL（用于下载/查看）
 * @param {S3Client} client - S3 客户端
 * @param {string} key - S3 对象键
 * @param {number} [expiresIn=3600] - URL 有效期（秒），默认 1 小时
 * @returns {Promise<string>} 预签名 URL
 */
export async function getPresignedUrl(client, key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * 获取文件元信息
 * @param {S3Client} client
 * @param {string} key
 * @returns {Promise<{contentType: string, contentLength: number, lastModified: Date} | null>}
 */
export async function getObjectMetadata(client, key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const result = await client.send(command);
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
    };
  } catch (err) {
    if (err.name === 'NotFound') {
      return null;
    }
    throw err;
  }
}

/**
 * 列出指定前缀下的所有对象
 * @param {S3Client} client - S3 客户端
 * @param {string} prefix - 前缀，如 'voice-tests/sessionId/'
 * @param {number} [maxKeys=1000] - 最大返回数量
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
export async function listObjects(client, prefix, maxKeys = 1000) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const result = await client.send(command);
  
  return (result.Contents || []).map(item => ({
    key: item.Key,
    size: item.Size,
    lastModified: item.LastModified,
  }));
}

/**
 * 列出所有对象（自动处理分页）
 * @param {S3Client} client
 * @param {string} prefix
 * @returns {Promise<Array>}
 */
export async function listAllObjects(client, prefix) {
  console.log('[S3] listAllObjects 开始', { prefix, hasClient: !!client });
  
  if (!client) {
    console.error('[S3] listAllObjects: 客户端未初始化');
    return [];
  }
  
  const allObjects = [];
  let continuationToken = null;

  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      console.log('[S3] 发送 ListObjectsV2Command', { bucket: BUCKET_NAME, prefix });
      const result = await client.send(command);
      console.log('[S3] ListObjectsV2 返回', { 
        contentsCount: result.Contents?.length || 0,
        isTruncated: result.IsTruncated 
      });
      
      allObjects.push(...(result.Contents || []));
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return allObjects.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    }));
  } catch (err) {
    console.error('[S3] listAllObjects 失败:', err);
    throw err;
  }
}

/**
 * 获取文件内容作为 Blob（用于音频播放等）
 * @param {S3Client} client
 * @param {string} key
 * @returns {Promise<Blob>}
 */
export async function getObjectAsBlob(client, key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);
  const bytes = await response.Body.transformToByteArray();
  
  return new Blob([bytes], { 
    type: response.ContentType || 'application/octet-stream',
  });
}

/**
 * 获取测试会话的所有相关文件
 * 音频文件存储路径: voice-tests/{sessionId}/raw/{step}/{step}_{subIndex}.wav
 * @param {S3Client} client
 * @param {string} sessionId - 会话 ID
 * @param {object} test - 测试数据对象（可选）
 * @returns {Promise<Array<{key: string, name: string, size: number, lastModified: Date}>>}
 */
export async function getTestSessionFiles(client, sessionId, test = null) {
  if (!sessionId) {
    console.warn('[S3] getTestSessionFiles: sessionId 为空');
    return [];
  }

  if (!client) {
    console.error('[S3] getTestSessionFiles: S3 客户端未初始化');
    return [];
  }

  try {
    // 直接列出 S3 中该 session 的所有文件
    const prefix = `voice-tests/${sessionId}/`;
    console.log('[S3] 正在列出文件，前缀:', prefix);
    
    const objects = await listAllObjects(client, prefix);
    console.log('[S3] 找到对象数量:', objects.length, '列表:', objects.map(o => o.key));
    
    // 过滤出音频文件（wav, mp3, webm）
    const audioFiles = objects.filter(f => {
      const key = f.key.toLowerCase();
      // 音频文件通常在 raw/ 目录下
      return (key.includes('/raw/') || !key.includes('/artifacts/')) && 
             (key.endsWith('.wav') || key.endsWith('.mp3') || key.endsWith('.webm')) &&
             !key.endsWith('/');
    });

    console.log('[S3] 过滤后音频文件数量:', audioFiles.length);

    return audioFiles.map(f => ({
      key: f.key,
      name: f.key.split('/').pop() || f.key,
      size: f.size,
      lastModified: f.lastModified,
    }));
  } catch (err) {
    console.error(`[S3] 获取测试文件失败 (${sessionId}):`, err);
    return [];
  }
}

/**
 * 获取用户头像 URL
 * @param {S3Client} client
 * @param {string} avatarKey - 头像在 S3 中的 key
 * @returns {Promise<string|null>} 预签名 URL 或 null
 */
export async function getAvatarUrl(client, avatarKey) {
  if (!avatarKey) return null;
  
  try {
    return await getPresignedUrl(client, avatarKey, 86400); // 24小时有效
  } catch {
    return null;
  }
}

/**
 * 获取事件附件的预签名 URL
 * @param {S3Client} client
 * @param {Array<{fileUrl: string}>} attachments - 附件列表
 * @returns {Promise<Array<{...attachment, signedUrl: string}>>}
 */
export async function getAttachmentUrls(client, attachments) {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  return Promise.all(
    attachments.map(async (attachment) => {
      try {
        const signedUrl = await getPresignedUrl(client, attachment.fileUrl);
        return { ...attachment, signedUrl };
      } catch (err) {
        console.error(`获取附件 URL 失败: ${attachment.fileUrl}`, err);
        return { ...attachment, signedUrl: null, error: err.message };
      }
    })
  );
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
