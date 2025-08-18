// 多附件解析工具：批量生成临时可访问 URL
import { getFileUrl } from '../api.js';

/**
 * 批量解析附件数组，返回附带 downloadUrl 的新数组
 * @param {Array<{fileUrl:string,fileType?:string,fileName?:string}>} attachments
 * @returns {Promise<Array<{fileUrl:string,fileType?:string,fileName?:string,downloadUrl:string}>>}
 */
export async function resolveAttachmentLinks(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  const results = await Promise.all(attachments.map(async (a) => {
    if (!a?.fileUrl) return null;
    try {
      // 统一使用 api.js 中的函数获取文件URL
      const downloadUrl = await getFileUrl(a.fileUrl);
      // 如果获取失败，则回退到原始 fileUrl 以免链接完全断开
      return { ...a, downloadUrl: downloadUrl || a.fileUrl };
    } catch (e) {
      console.warn(`[attachments] 获取签名URL失败 for ${a.fileUrl}，回退到原始key`, e);
      return { ...a, downloadUrl: a.fileUrl }; // 发生错误时回退
    }
  }));

  return results.filter(Boolean);
}

/**
 * 兼容旧单文件函数（返回字符串 URL）
 * @param {string} key
 * @returns {Promise<string>}
 */
export async function resolveAttachmentUrl(key) {
  if (!key) return '';
  const arr = await resolveAttachmentLinks([{ fileUrl: key }]);
  return arr[0]?.downloadUrl || '';
}
