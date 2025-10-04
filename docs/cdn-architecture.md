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

## 优势

- **性能优化**: 用户可以从地理位置最近的 CDN 边缘节点加载资源，大大减少了延迟。
- **高可用性**: 即使某个区域的 CDN 服务出现问题，另一区域的用户仍然可以正常访问。
- **无缝体验**: 动态主机名重写对前端是透明的，前端代码无需关心底层 CDN 的切换逻辑。
- **合规性**: 允许在中国大陆使用符合当地法规的 CDN 服务。