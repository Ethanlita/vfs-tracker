#!/usr/bin/env node
/**
 * @file Cloudflare 缓存刷新脚本。
 * @description 在 GitHub Pages 发布完成后清空 vfs-tracker.app 的 Cloudflare 边缘缓存。
 * Cloudflare 会按源站 max-age 缓存 sw.js 与非哈希资源；不清缓存时，部署后一段时间内浏览器的
 * Service Worker 更新检查仍会拿到旧 sw.js，用户既收不到更新，首访者还可能装上旧版本。
 * 与 .cn 侧的 purge-esa-cache.mjs 对称，二者都在 Pages 部署成功后执行。
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

/** Cloudflare API 地址。 */
const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

/**
 * 清空指定 Zone 的全部缓存。
 * @param {{zoneId: string, token: string, fetchImpl?: typeof fetch}} options - Zone ID、具有"清除缓存"权限的 API Token，
 *   以及可替换的 fetch（测试用）。
 * @returns {Promise<object>} Cloudflare API 的成功响应体。
 * @throws {Error} 缺少配置或 Cloudflare 返回失败时抛出，让工作流显式失败。
 */
export async function purgeCloudflareCache({ zoneId, token, fetchImpl = fetch }) {
  if (!zoneId || !token) {
    throw new Error('缺少 CLOUDFLARE_ZONE_ID 或 CLOUDFLARE_API_TOKEN，无法刷新 Cloudflare 缓存。');
  }

  const response = await fetchImpl(`${CLOUDFLARE_API}/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purge_everything: true }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    // 只输出 Cloudflare 的错误码与说明，不回显 Token。
    const errors = JSON.stringify(body?.errors ?? []);
    throw new Error(`Cloudflare 缓存刷新失败：HTTP ${response.status} ${errors}`);
  }
  return body;
}

// 作为脚本直接运行时读取工作流注入的环境变量。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await purgeCloudflareCache({
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  });
  console.log('[cloudflare-cache] Purged all Cloudflare cache for vfs-tracker.app.');
}
