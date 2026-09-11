#!/usr/bin/env node
/**
 * @file ESA 主站压缩发布验证。
 * @description 通过真实 GET 请求检查入口脚本的压缩协商、Vary 和 identity 正文，
 * 供部署流水线在清缓存后确认规则已经在最终站点生效。
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_ORIGIN = 'https://vfs-tracker.cn';
const COMPRESSED_ENCODINGS = new Set(['gzip', 'br', 'zstd']);

/**
 * 从 Vite 首页 HTML 中提取入口脚本地址。
 * @param {string} html - 首页 HTML。
 * @param {string} origin - 站点源地址。
 * @returns {URL} 入口脚本 URL。
 */
export function extractEntryScript(html, origin = DEFAULT_ORIGIN) {
  const match = html.match(/<script\b[^>]*\bsrc=["']([^"']*\/assets\/[^"']+\.js)["'][^>]*>/i);
  if (!match) throw new Error('Cannot find the Vite entry script in ESA homepage HTML.');
  return new URL(match[1], origin);
}

/**
 * 判断响应是否按请求完成压缩并正确声明缓存变体。
 * @param {Response} response - 静态资源响应。
 * @returns {void}
 */
export function assertCompressedResponse(response) {
  if (!response.ok) throw new Error(`Compressed asset request failed with ${response.status}.`);

  const encoding = response.headers.get('content-encoding')?.toLowerCase();
  const vary = response.headers.get('vary')?.toLowerCase() || '';
  if (!COMPRESSED_ENCODINGS.has(encoding)) {
    throw new Error(`ESA asset is not compressed; Content-Encoding=${encoding || 'missing'}.`);
  }
  if (!vary.split(',').some((value) => value.trim() === 'accept-encoding')) {
    throw new Error(`ESA asset does not vary by Accept-Encoding; Vary=${vary || 'missing'}.`);
  }
}

/**
 * 执行一次最终站点压缩验证。
 * @param {{ origin?: string, fetchImpl?: typeof fetch, cacheKey?: string }} options - 请求参数。
 * @returns {Promise<{ assetUrl: string, encoding: string, compressedBytes: number, identityBytes: number }>} 验证结果。
 */
export async function verifyCompression({
  origin = DEFAULT_ORIGIN,
  fetchImpl = fetch,
  cacheKey = Date.now().toString(),
} = {}) {
  const homeResponse = await fetchImpl(`${origin}/?compression-check=${cacheKey}`, {
    headers: { 'cache-control': 'no-cache' },
  });
  if (!homeResponse.ok) throw new Error(`ESA homepage request failed with ${homeResponse.status}.`);

  const assetUrl = extractEntryScript(await homeResponse.text(), origin);
  assetUrl.searchParams.set('compression-check', cacheKey);
  const compressedResponse = await fetchImpl(assetUrl, {
    headers: {
      'accept-encoding': 'gzip, br, zstd',
      'cache-control': 'no-cache',
    },
  });
  assertCompressedResponse(compressedResponse);
  const encoding = compressedResponse.headers.get('content-encoding').toLowerCase();
  const compressedBytes = (await compressedResponse.arrayBuffer()).byteLength;

  const identityResponse = await fetchImpl(assetUrl, {
    headers: {
      'accept-encoding': 'identity',
      'cache-control': 'no-cache',
    },
  });
  if (!identityResponse.ok) throw new Error(`Identity asset request failed with ${identityResponse.status}.`);
  if (identityResponse.headers.has('content-encoding')) {
    throw new Error(`Identity request received Content-Encoding=${identityResponse.headers.get('content-encoding')}.`);
  }
  const identityBytes = (await identityResponse.arrayBuffer()).byteLength;
  if (compressedBytes === 0 || identityBytes === 0) throw new Error('ESA returned an empty entry script.');

  return {
    assetUrl: assetUrl.toString(),
    encoding,
    compressedBytes,
    identityBytes,
  };
}

/**
 * 等待 ESA 配置传播，并在有限次数内验证最终站点。
 * @param {{ attempts?: number, intervalMs?: number }} options - 重试参数。
 * @returns {Promise<Awaited<ReturnType<typeof verifyCompression>>>} 首次成功结果。
 */
export async function waitForCompression({ attempts = 12, intervalMs = 5000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await verifyCompression({ cacheKey: `${Date.now()}-${attempt}` });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
    }
  }
  throw lastError;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const result = await waitForCompression();
  console.log(`[esa-compression] Verified ${result.encoding}: ${result.assetUrl}`);
}
