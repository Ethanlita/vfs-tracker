// 多附件解析工具：批量生成临时可访问 URL，失败与有效链接明确分离。
import { getFileUrl } from '../api.js';

/**
 * 解析单个文件访问地址，空标识返回空值；无效响应及服务错误向调用者传播。
 * @param {string} key - 文件对象标识。
 * @returns {Promise<string>} 经验证的 HTTP(S) 访问地址。
 */
export async function resolveAttachmentUrl(key) {
  if (!key) return '';
  const url = await getFileUrl(key);
  return assertAttachmentUrl(url);
}

/**
 * 批量解析文件；单项失败保留原元数据和错误，不伪造可点击的对象 key。
 * @param {Array<{fileUrl:string}>} attachments - 附件集合。
 * @returns {Promise<Array<object>>} 成功项含 downloadUrl，失败项另含 downloadError。
 */
export async function resolveAttachmentLinks(attachments) {
  if (!Array.isArray(attachments)) return [];
  return Promise.all(attachments.filter(a => a?.fileUrl).map(async attachment => {
    try { return { ...attachment, downloadUrl: await resolveAttachmentUrl(attachment.fileUrl) }; }
    catch (downloadError) { return { ...attachment, downloadUrl: '', downloadError }; }
  }));
}

/** 验证访问地址，供上传和报告共用，禁止对象key冒充URL。 */
export function assertAttachmentUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('无法获取文件访问地址，请重试。'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('文件访问地址无效，请重试。');
  return url;
}
