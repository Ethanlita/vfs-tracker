# CDN 架构说明

## 概述

为了优化全球用户的访问速度并适应不同地区的网络环境，VFS Tracker 采用了一套基于 `.app` 和 `.cn` 双域名的 CDN（内容分发网络）架构。这确保了无论用户身在何处，都能以最快的速度加载应用的前端资源和存储在 S3 上的文件。

## 架构组成

1.  **`.app` 域名 (`vfs-tracker.app`)**:
    -   **目标用户**: 全球（中国大陆以外）用户。
    -   **CDN 服务**: 通常配置为 AWS CloudFront、Vercel、Netlify 或 Cloudflare 等全球性的 CDN 服务。
    -   **作用**: 加速全球范围内对前端静态资源（HTML, JS, CSS）的访问。

2.  **`.cn` 域名 (`vfs-tracker.cn`)**:
    -   **目标用户**: 中国大陆用户。
    -   **CDN 服务**: 配置为有中国节点的 CDN 服务（例如，已备案的 AWS CloudFront 中国区、阿里云 CDN、腾讯云 CDN 等）。
    -   **作用**: 解决中国大陆访问海外资源的延迟和不稳定性问题，显著提升加载速度。

3.  **存储域名 (`storage.vfs-tracker.app` / `storage.vfs-tracker.cn`)**:
    -   **作用**: 这些是专门用于加速 S3 对象（如用户头像、附件、报告）访问的 CDN 域名。
    -   **实现**: 后端 Lambda 函数在生成 S3 预签名 URL 后，会根据请求来源（`.app` 或 `.cn`）动态地将 S3 的原始主机名 (`*.s3.amazonaws.com`) 重写为对应的 CDN 主机名。

## 工作流程：动态 CDN 主机名重写

这是实现双 CDN 架构的核心机制，主要发生在后端生成预签名 URL 的环节：

1.  **前端请求**: 客户端（浏览器）向 API Gateway 发起请求，例如获取一个文件的访问链接。
2.  **来源识别**: 后端 Lambda 函数检查请求头中的 `x-forwarded-host` 或 `Host` 字段，以确定请求是从哪个域名发起的（`.app` 或 `.cn`）。
3.  **生成原始 URL**: Lambda 函数首先调用 AWS SDK，生成一个标准的、指向 S3 原始服务器的预签名 URL。
    -   例如: `https://vfs-tracker-files.s3.us-east-1.amazonaws.com/avatars/...`
4.  **动态重写**:
    -   如果请求来源是 `.cn` 域名，Lambda 会将 URL 的主机名部分替换为 `storage.vfs-tracker.cn`。
    -   如果请求来源是 `.app` 域名（或任何其他域名），则替换为 `storage.vfs-tracker.app`。
5.  **返回重写后的 URL**: 最终返回给前端的是经过 CDN 优化的 URL。
    -   例如: `https://storage.vfs-tracker.cn/avatars/...`

### 示例代码 (Lambda 函数逻辑)

```javascript
// 从事件头中获取请求来源主机
const normalizedHost = String(
  event.headers?.['x-forwarded-host'] ||
  event.headers?.Host ||
  event.requestContext?.domainName ||
  ''
).toLowerCase();

// 根据来源主机选择对应的 CDN 域名
const cdnHost = normalizedHost.endsWith('.cn')
  ? 'storage.vfs-tracker.cn'
  : 'storage.vfs-tracker.app';

// 生成原始 S3 预签名 URL
let signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

// 尝试重写主机名
try {
  const parsed = new URL(signedUrl);
  parsed.host = cdnHost;
  signedUrl = parsed.toString();
} catch (err) {
  console.error('Failed to parse or modify signedUrl:', err);
  // 如果失败，则回退到原始 S3 URL
}

// 返回最终的 URL 给客户端
return { url: signedUrl };
```

## SPA 路由处理 (Cloudflare Worker)

### 背景问题

由于前端托管在 GitHub Pages（静态文件服务器），直接访问非首页路径（如 `/dashboard`）时会返回 HTTP 404，这会导致：
- SEO 问题：搜索引擎无法索引非首页路由
- 用户体验差：页面会先显示"正在跳转..."再加载

### 解决方案

使用 Cloudflare Worker 在 CDN 边缘层拦截请求，对 SPA 路由返回 `index.html` + HTTP 200。

### Worker 配置

**Cloudflare Workers Routes：**

| Route | Worker | 用途 |
|-------|--------|------|
| `storage.vfs-tracker.app/*` | storage-worker | S3 对象 CDN 加速 |
| `vfs-tracker.app/*` | `vfs-tracker-spa-router` | SPA 路由处理（主域名） |
| `www.vfs-tracker.app/*` | `vfs-tracker-spa-router` | SPA 路由处理（www 子域名） |

> ⚠️ **注意**：
> - 使用 `vfs-tracker.app/*` 而不是 `*.vfs-tracker.app/*`，以避免影响 `storage.vfs-tracker.app` 子域名
> - `www.vfs-tracker.app` 需要单独添加路由，确保通过 www 访问的用户也能正常使用 SPA 路由

### Worker 代码位置

```
infra/cloudflare-worker/
├── spa-router.js    # Worker 代码
└── wrangler.toml    # Wrangler 配置
```

### CI/CD 自动部署

Worker 代码变更后会通过 GitHub Actions 自动部署到 Cloudflare。

**首次配置步骤：**

1. **创建 Cloudflare API Token**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - 点击 "Create Token"
   - 使用 "Edit Cloudflare Workers" 模板
   - 选择 Account Resources: 你的账户
   - 选择 Zone Resources: All zones（或指定 vfs-tracker.app）
   - 创建并复制 Token

2. **获取 Account ID**
   - 在 Cloudflare Dashboard 右侧边栏可以找到 Account ID

3. **添加 GitHub Secrets**
   - 在 GitHub 仓库 Settings → Secrets and variables → Actions
   - 添加 `CLOUDFLARE_API_TOKEN`
   - 添加 `CLOUDFLARE_ACCOUNT_ID`

4. **首次部署后手动配置 Routes**
   - Worker 部署后，需要在 Cloudflare Dashboard 手动添加路由
   - `vfs-tracker.app/*` → `vfs-tracker-spa-router`
   - `www.vfs-tracker.app/*` → `vfs-tracker-spa-router`

**后续更新：**
- 修改 `infra/cloudflare-worker/spa-router.js` 并推送到 master
- GitHub Actions 会自动部署更新
- 也可以在 Actions 页面手动触发 "Deploy Cloudflare Worker" 工作流

### 工作原理

1. **静态资源**（`.js`, `.css`, `.png` 等）→ 直接放行到 GitHub Pages
2. **已知 SPA 路由**（`/dashboard`, `/mypage` 等）→ 返回 `index.html` + 200
3. **未知路由** → 返回 `index.html` + 200，让 React Router 显示 404 页面

### ⚠️ 开发者注意事项

**添加新路由时，必须同步更新 Cloudflare Worker！**

当你在 `src/App.jsx` 中添加新的 `<Route>` 时，需要同时更新 `infra/cloudflare-worker/spa-router.js` 中的 `knownRoutes` 数组：

```javascript
// infra/cloudflare-worker/spa-router.js
const knownRoutes = [
  '/',
  '/dashboard',
  '/mypage',
  // ... 添加新路由到这里
  '/your-new-route',  // ← 新增
];
```

然后在 Cloudflare Dashboard 中重新部署 Worker。

**不更新 Worker 的后果**：新路由虽然能工作（因为有 fallback 机制），但会被标记为 `X-SPA-Fallback` 而不是 `X-SPA-Route`，可能影响缓存策略和调试。

---

## 优势

- **性能优化**: 用户可以从地理位置最近的 CDN 边缘节点加载资源，大大减少了延迟。
- **高可用性**: 即使某个区域的 CDN 服务出现问题，另一区域的用户仍然可以正常访问。
- **无缝体验**: 动态主机名重写对前端是透明的，前端代码无需关心底层 CDN 的切换逻辑。
- **合规性**: 允许在中国大陆使用符合当地法规的 CDN 服务。
- **SEO 友好**: Cloudflare Worker 确保所有 SPA 路由返回 HTTP 200，使搜索引擎能正确索引。