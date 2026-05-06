/**
 * @file Cloudflare Worker: storage.vfs-tracker.app 存储转发器。
 * @description 该 Worker 负责将存储域名的请求安全地转发到 S3 REST 端点，
 * 同时统一处理 CORS 预检、透传头清理与缓存禁用策略。
 */

/**
 * 需要透传到上游前删除的请求头。
 * 这些头要么由运行时自动生成，要么会影响上游主机名和签名逻辑。
 */
const STRIPPED_HEADERS = [
  'host',
  'content-length',
  'cf-ray',
  'cf-connecting-ip',
  'x-forwarded-host',
];

/**
 * 创建 CORS 预检响应。
 * @param {Request} request - 原始请求对象。
 * @returns {Response} 204 预检响应。
 */
const createPreflightResponse = (request) => {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': request.headers.get('origin') || '*',
      'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') || '*',
      'access-control-max-age': '86400',
    },
  });
};

/**
 * 复制并清理需要转发到上游的请求头。
 * @param {Headers} incomingHeaders - 原始请求头。
 * @returns {Headers} 清理后的请求头。
 */
const createForwardHeaders = (incomingHeaders) => {
  const forwardedHeaders = new Headers(incomingHeaders);
  STRIPPED_HEADERS.forEach((headerName) => forwardedHeaders.delete(headerName));
  return forwardedHeaders;
};

/**
 * 根据外部请求构造上游 S3 请求。
 * @param {Request} request - 外部请求。
 * @param {{ S3_HOST: string }} env - Worker 绑定变量。
 * @returns {Request} 发往 S3 的请求对象。
 */
const createUpstreamRequest = (request, env) => {
  const url = new URL(request.url);
  const targetUrl = `https://${env.S3_HOST}${url.pathname}${url.search}`;

  return new Request(targetUrl, {
    method: request.method,
    headers: createForwardHeaders(request.headers),
    body: ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ? undefined : request.body,
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });
};

/**
 * 为上游响应补充跨域与调试头。
 * @param {Response} upstreamResponse - 上游 S3 响应。
 * @param {Request} request - 原始外部请求。
 * @returns {Response} 加工后的响应。
 */
const createClientResponse = (upstreamResponse, request) => {
  const response = new Response(upstreamResponse.body, upstreamResponse);
  response.headers.set('access-control-allow-origin', request.headers.get('origin') || '*');
  response.headers.append('vary', 'origin');
  response.headers.set('x-vfs-worker', 'storage-proxy');
  return response;
};

export default {
  /**
   * 处理所有进入 storage.vfs-tracker.app 的请求。
   * @param {Request} request - 外部请求对象。
   * @param {{ S3_HOST: string }} env - Worker 环境变量。
   * @returns {Promise<Response>} 返回给客户端的响应。
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const isStorageHost = url.hostname === 'storage.vfs-tracker.app';

    if (!isStorageHost) {
      return new Response('Not found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return createPreflightResponse(request);
    }

    const upstreamRequest = createUpstreamRequest(request, env);
    const upstreamResponse = await fetch(upstreamRequest);
    return createClientResponse(upstreamResponse, request);
  },
};
