/**
 * @file ESA EdgeRoutine: vfs-tracker.cn SPA 路由回退处理器。
 * @description 该脚本运行在阿里云 ESA 边缘侧，负责让 vfs-tracker.cn 在直连
 * GitHub Pages 源站时也能正确处理 React Router 的前端路由。
 */

/** 静态资源扩展名，命中后直接回源，不参与 SPA fallback。 */
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json|webp|mp3|wav|ttf|eot|map|wasm|md|txt|xml)$/i;

/** 已知前端路由列表，应与 Cloudflare spa-router.js 保持同步。 */
const KNOWN_ROUTES = [
  '/',
  '/dashboard',
  '/mypage',
  '/voice-test',
  '/quick-f0-test',
  '/scale-practice',
  '/posts',
  '/docs',
  '/login',
  '/add-event',
  '/event-manager',
  '/api-test',
  '/profile-manager',
  '/profile-setup-wizard',
  '/note-frequency-tool',
  '/vfs-effect-preview',
];

/** 已知动态路由前缀。 */
const KNOWN_PREFIXES = [
  '/admin',
];

/** 允许执行 SPA fallback 的 .cn 主站和测试主机。 */
const SPA_HOSTS = new Set([
  'vfs-tracker.cn',
  'www.vfs-tracker.cn',
  'origin-probe.vfs-tracker.cn',
  'routine-probe.vfs-tracker.cn',
]);

/** ESA Routine 关联记录没有普通源站，显式使用该测试源站读取 GitHub Pages 内容。 */
const UPSTREAM_HOST = 'origin-probe.vfs-tracker.cn';

/** Vite 哈希资源的长期缓存策略。 */
const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * 判断请求是否应直接回源。
 * @param {URL} url - 请求 URL。
 * @returns {boolean} 是否应跳过 SPA fallback。
 */
function shouldPassThrough(url) {
  const { pathname } = url;

  if (STATIC_EXTENSIONS.test(pathname)) {
    return true;
  }

  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }

  return pathname.startsWith('/posts/') && pathname.endsWith('.md');
}

/**
 * 判断请求路径是否为已知前端路由。
 * @param {string} pathname - 请求路径。
 * @returns {boolean} 是否为已知前端路由。
 */
function isKnownSpaRoute(pathname) {
  return KNOWN_ROUTES.includes(pathname) ||
    KNOWN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * 判断是否为可以长期缓存的 Vite 哈希静态资源。
 * @param {URL} url - 请求 URL。
 * @returns {boolean} 若属于 /assets/ 资源则返回 true。
 */
function shouldUseLongCache(url) {
  return url.pathname.startsWith('/assets/');
}

/**
 * 读取上游内容，并为哈希静态资源补齐长期缓存头。
 * @param {Request} upstreamRequest - 指向上游的请求。
 * @param {URL} originalUrl - 浏览器请求 URL。
 * @returns {Promise<Response>} 上游响应。
 */
async function fetchUpstream(upstreamRequest, originalUrl) {
  const response = await fetch(upstreamRequest);

  if (!shouldUseLongCache(originalUrl)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('cache-control', HASHED_ASSET_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * 从源站获取首页并包装成 SPA 响应。
 * @param {Request} request - 原始请求。
 * @param {string} markerHeader - 标记响应来源的调试头名称。
 * @returns {Promise<Response>} 首页 HTML 响应。
 */
async function createIndexResponse(request, markerHeader) {
  const url = new URL(request.url);
  const indexUrl = new URL('/', `https://${UPSTREAM_HOST}`);
  const indexRequest = new Request(indexUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });
  const indexResponse = await fetch(indexRequest);
  const headers = new Headers(indexResponse.headers);

  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=60');
  headers.set(markerHeader, 'true');

  return new Response(indexResponse.body, {
    status: 200,
    headers,
  });
}

/**
 * 处理进入 vfs-tracker.cn 的请求。
 * @param {Request} request - ESA 传入的请求。
 * @returns {Promise<Response>} 返回给浏览器的响应。
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const isCnSite = SPA_HOSTS.has(url.hostname);
  const upstreamUrl = new URL(`${url.pathname}${url.search}`, `https://${UPSTREAM_HOST}`);
  const upstreamRequest = new Request(upstreamUrl.toString(), request);

  if (!isCnSite) {
    return fetch(request);
  }

  if (shouldPassThrough(url)) {
    return fetchUpstream(upstreamRequest, url);
  }

  if (isKnownSpaRoute(url.pathname)) {
    return createIndexResponse(request, 'x-esa-spa-route');
  }

  const response = await fetchUpstream(upstreamRequest, url);
  if (response.status === 404) {
    return createIndexResponse(request, 'x-esa-spa-fallback');
  }

  return response;
}

export default {
  /**
   * ESA EdgeRoutine 模块入口。
   * @param {Request} request - ESA 传入的请求。
   * @returns {Promise<Response>} 返回给浏览器的响应。
   */
  fetch(request) {
    return handleRequest(request);
  },
};
