// 附件处理封装：统一生成可访问 URL，并在开发模式或失败时优雅降级
import { getUrl } from 'aws-amplify/storage';
import { isProductionReady } from '../env.js';

/**
 * 根据存储的对象 key 解析出可直接访问/下载的 URL。
 * - 生产：调用 Amplify Storage getUrl 获取临时签名 URL
 * - 开发：直接返回原始 key（假设为本地或 mock 路径）
 * - 失败：返回原始 key 作为回退
 * @param {string} key S3 对象 key 或本地 mock 路径
 * @param {object} options { download?:boolean, expiresIn?:number(seconds) }
 * @returns {Promise<string>} 可在 <a href> 或 window.open 使用的 URL 字符串
 */
export async function resolveAttachmentUrl(key, options = {}) {
  if (!key) return '';
  const forceReal = !!import.meta.env.VITE_FORCE_REAL;
  if (!isProductionReady() && !forceReal) return key; // 开发/未就绪 & 未强制，直接回传
  try {
    const res = await getUrl({ key, options: { ...options } });
    return res?.url?.toString?.() || key;
  } catch (e) {
    console.warn('[attachments] 获取签名 URL 失败，使用原始 key 回退', e);
    return key;
  }
}
