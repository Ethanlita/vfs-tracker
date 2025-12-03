/**
 * Cloudflare Worker: VFS Tracker SPA 路由处理器
 * 
 * 用途：解决 GitHub Pages 托管的 SPA 应用在非首页路径直接访问时返回 404 的问题
 * 
 * 工作原理：
 * 1. 静态资源（js, css, 图片等）直接放行到源站
 * 2. 已知的 SPA 路由返回 index.html + HTTP 200
 * 3. 未知路由也返回 index.html，让 React Router 显示 404 页面
 * 
 * 部署步骤：
 * 1. 登录 Cloudflare Dashboard
 * 2. 进入 Workers & Pages
 * 3. 创建新 Worker，命名为 vfs-tracker-spa-router
 * 4. 粘贴此代码并部署
 * 5. 在 vfs-tracker.app 域名设置中添加 Worker Route: vfs-tracker.app/*
 * 
 * @see https://github.com/Ethanlita/vfs-tracker/issues/61
 */

export default {
  /**
   * 处理传入的 HTTP 请求
   * @param {Request} request - 传入的请求对象
   * @param {Object} env - 环境变量
   * @returns {Promise<Response>} 响应对象
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // ========================================
    // 1. 静态资源 - 直接放行到源站
    // ========================================
    const staticExtensions = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json|webp|mp3|wav|ttf|eot|map|wasm|md|txt|xml)$/i;
    if (pathname.match(staticExtensions)) {
      return fetch(request);
    }

    // ========================================
    // 2. 特殊路径 - 直接放行
    // ========================================
    // robots.txt, sitemap.xml 等 SEO 相关文件
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      return fetch(request);
    }
    
    // /posts/ 目录下的 Markdown 文件（实际存在的静态文件）
    if (pathname.startsWith('/posts/') && pathname.endsWith('.md')) {
      return fetch(request);
    }

    // ========================================
    // 3. 已知的 SPA 路由列表
    // ========================================
    // 注意：添加新路由时需要同步更新此列表
    const knownRoutes = [
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

    // 已知的路由前缀（用于动态路由）
    const knownPrefixes = [
      '/admin',  // 管理后台 /admin/*
    ];

    // 检查是否为已知路由
    const isKnownRoute = knownRoutes.includes(pathname) ||
      knownPrefixes.some(prefix => pathname.startsWith(prefix + '/') || pathname === prefix);

    // ========================================
    // 4. SPA 路由处理
    // ========================================
    if (isKnownRoute) {
      // 已知路由：返回 index.html + 200 状态码
      const indexResponse = await fetch(new URL('/', url.origin));
      return new Response(indexResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-SPA-Route': 'true',  // 标记这是 SPA 路由
        },
      });
    }

    // ========================================
    // 5. 未知路由处理
    // ========================================
    // 先尝试从源站获取资源
    const response = await fetch(request);

    // 如果源站返回 404，返回 index.html 让 React Router 处理
    // React Router 会显示 NotFoundPage 组件
    if (response.status === 404) {
      const indexResponse = await fetch(new URL('/', url.origin));
      return new Response(indexResponse.body, {
        status: 200,  // 返回 200 以避免 SEO 问题
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-SPA-Fallback': 'true',  // 标记这是 SPA fallback
        },
      });
    }

    // 其他情况直接返回源站响应
    return response;
  },
};
