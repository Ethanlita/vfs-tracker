/** @file 文档加载的统一网络路径；生产离线内容由Service Worker预缓存提供。 */
import { ApiError, ClientError } from './apiError';

/**
 * 读取公开文档资源，缺少离线副本时提供可操作的中文提示。
 * @param {string} path - 文档目录或Markdown资源路径。
 * @param {'text'|'json'} format - 返回内容格式。
 * @returns {Promise<string|object>} 解析后的正文或目录。
 */
export async function readDocumentation(path, format = 'text') {
  try {
    const response = await fetch(path);
    if (!response.ok) throw await ApiError.fromResponse(response, { requestMethod: 'GET', requestPath: path });
    return await (format === 'json' ? response.json() : response.text());
  } catch (cause) {
    if (!navigator.onLine) throw new ClientError('当前离线，所需文档尚未缓存。请联网后点击重试。', {
      cause, requestMethod: 'GET', requestPath: path, errorCode: 'DOCUMENT_NOT_AVAILABLE_OFFLINE'
    });
    throw cause;
  }
}
