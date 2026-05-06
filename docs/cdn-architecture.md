# CDN 架构说明

## 概述

本文档描述的是当前线上已经验证过的 CDN 与域名链路，而不是抽象设计图。

截至 2026-05-06，以下事实已经通过 DNS、HTTP 探针和阿里云 ESA CLI 验证：

- .app 主站当前走 Cloudflare，源站是 GitHub Pages。
- .cn 主站当前不是独立部署的一套前端，而是阿里云 ESA 站点在边缘代理到上游 .app 主站、AWS API Gateway 和 S3。
- 文件类接口仍然依赖后端按请求来源动态改写预签名链接主机名，在 .app 和 .cn 之间切换存储域名。
- Cloudflare MCP 已确认当前账号下只有 2 个与本站相关的 Worker 脚本：vfs-tracker-spa-router 和 vfs-tracker-trans-router。

## 当前真实链路

### 1. .app 主站

- 公网域名：vfs-tracker.app
- 仓库中的 GitHub Pages 自定义域名配置：仓库根目录 CNAME 文件为 vfs-tracker.app
- 当前请求链路：浏览器 -> Cloudflare -> Cloudflare Worker -> GitHub Pages
- 作用：全球默认前端入口，也是 .cn 主站当前使用的上游源站
- Cloudflare MCP 已验证：当前 Cloudflare 账户内存在 vfs-tracker.app 这个 zone；未发现 vfs-tracker.cn 这个 zone

### 2. .cn 主站

- 公网域名：vfs-tracker.cn
- 当前接入方式：阿里云 ESA 站点
- 已验证站点信息：
  - SiteName：vfs-tracker.cn
  - SiteId：929690936461856
  - Status：active
  - AccessType：CNAME
  - Plan：basic
- 当前请求链路：浏览器 -> 阿里云 ESA -> vfs-tracker.app -> Cloudflare Worker -> GitHub Pages

这意味着 .cn 主站当前的价值主要是“在中国大陆侧新增一层边缘代理与证书终止”，而不是提供一套独立的前端源站。

### 3. API 域名

- .app 前端在运行时默认调用 api.vfs-tracker.app
- .cn 前端在运行时默认调用 api.vfs-tracker.cn
- 前端切换逻辑由 src/env.js 中的 hostname 检测决定，而不是通过构建两套前端产物实现

当前 .cn API 的实际链路已经验证为：浏览器 -> 阿里云 ESA -> wg3q2nomc3.execute-api.us-east-1.amazonaws.com

探针结果表明：

- 对 api.vfs-tracker.cn 发起请求时，Lambda 收到的 receivedHost 为 AWS execute-api 默认域名
- x-forwarded-host 仍然保留 api.vfs-tracker.cn

这正是后端能继续根据 .cn 请求来源切换存储域名的关键前提。

### 4. 存储域名

- 应用层使用的存储域名为 storage.vfs-tracker.app 和 storage.vfs-tracker.cn
- 文件上传、下载、头像和在线分析相关接口都会根据请求来源把预签名 S3 链接重写到对应存储域名
- 当前 .cn 存储链路已经验证为：浏览器 -> 阿里云 ESA -> vfs-tracker-objstor.s3.us-east-1.amazonaws.com

## ESA 已验证配置

下列配置来自对 ESA 站点 vfs-tracker.cn 的实际 CLI 查询。

### 站点与记录

已确认的关键记录如下：

| 公网主机 | 上游目标 | 代理状态 | 说明 |
| -------- | -------- | -------- | ---- |
| `vfs-tracker.cn` | `vfs-tracker.app` | Proxied | .cn 主站直接代理到 .app 主站 |
| `api.vfs-tracker.cn` | `wg3q2nomc3.execute-api.us-east-1.amazonaws.com` | Proxied | .cn API 直接代理到 AWS API Gateway 默认域名 |
| `storage.vfs-tracker.cn` | `vfs-tracker-objstor.s3.us-east-1.amazonaws.com` | Proxied | .cn 存储入口直接代理到 S3 |

### 回源与缓存

已确认的关键规则如下：

- 存在一条用于 storage 域名的回源规则，回源 Host 明确设置为 vfs-tracker-objstor.s3.us-east-1.amazonaws.com
- 存在一条用于 api 和 storage 域名的缓存绕过规则，行为为 bypass_all

当前可以确认的结论是：

- .cn API 默认不走缓存，这对动态接口是合理配置
- .cn 存储入口也被明确设置为不走 ESA 缓存；这意味着它当前更像“大陆侧加速代理入口”，而不是对象分发缓存层

### HTTPS 与证书

当前 ESA 站点已经配置有效证书：

- 证书类型：Let's Encrypt 免费证书
- 覆盖范围：*.vfs-tracker.cn 和 vfs-tracker.cn

## 动态存储主机名重写

双域名架构的核心逻辑仍然发生在后端生成预签名 URL 的环节：

1. 前端向 API 请求文件访问或上传链接
2. Lambda 根据 x-forwarded-host、host 或 requestContext.domainName 识别来源域名
3. Lambda 先生成标准 S3 预签名 URL
4. 如果来源是 .cn，则把主机名重写为 storage.vfs-tracker.cn；否则重写为 storage.vfs-tracker.app
5. 前端最终拿到的是面向对应边缘入口的 URL，而不是直接访问 S3

当前实现的关键点是：.cn API 链路虽然上游被 ESA 转发到了 AWS execute-api 默认域名，但仍然保留了 x-forwarded-host，因此域名分流逻辑仍然成立。

### 示例代码

```javascript
const normalizedHost = String(
  event.headers?.['x-forwarded-host'] ||
  event.headers?.['X-Forwarded-Host'] ||
  event.headers?.host ||
  event.headers?.Host ||
  event.requestContext?.domainName ||
  ''
).toLowerCase();

const cdnHost = normalizedHost.endsWith('.cn')
  ? 'storage.vfs-tracker.cn'
  : 'storage.vfs-tracker.app';

let signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

try {
  const parsed = new URL(signedUrl);
  parsed.host = cdnHost;
  signedUrl = parsed.toString();
} catch (err) {
  console.error('Failed to parse or modify signedUrl:', err);
}
```

## SPA 路由处理

### 当前事实

当前线上至少存在两类 Cloudflare Worker 能力：

- 仓库中可见并由 GitHub Actions 自动部署的 Worker：infra/cloudflare-worker/spa-router.js，对应脚本名 vfs-tracker-spa-router
- Cloudflare MCP 已验证：线上还存在一个单独的存储 Worker，脚本名为 vfs-tracker-trans-router，绑定在 storage.vfs-tracker.app/*
- 当前仓库内不存在 .cn 专用 Worker 配置

需要特别注意：旧文档里写的 storage-worker 更接近“用途描述”，而不是当前线上脚本名。Cloudflare 上真实存在的脚本名是 vfs-tracker-trans-router。

因此，当前线上行为应理解为：

- vfs-tracker.app 的 SPA 路由由 Cloudflare Worker 处理
- storage.vfs-tracker.app 也有独立的 Cloudflare Worker 处理中转逻辑
- vfs-tracker.cn 因为把主站请求代理到了 vfs-tracker.app，所以会继承上游 Worker 的 SPA 路由处理结果
- 这也是为什么对 .cn 的 SPA 路由探测仍然能观察到 X-SPA-Route 响应头

### Worker 职责

当前已知的两个 Cloudflare Worker 分工如下：

#### vfs-tracker-spa-router

- 绑定域名：`vfs-tracker.app/*` 与 `www.vfs-tracker.app/*`
- 主要职责：为 GitHub Pages 上的 SPA 提供路由回退
- 关键行为：
  - 放行静态资源、robots.txt、sitemap.xml 和 /posts/*.md
  - 对已知前端路由直接返回 index.html 和 200
  - 对源站 404 的未知路径返回 index.html 和 200，让 React Router 接管 404 页面
  - 使用 X-SPA-Route 与 X-SPA-Fallback 标记命中的处理路径

#### vfs-tracker-trans-router

- 绑定域名：storage.vfs-tracker.app/*
- 主要职责：把存储域名请求转发到 S3 REST 端点，统一处理 CORS 和边缘头
- 关键行为：
  - 仅接受 storage.vfs-tracker.app 主机名，请求到其他主机直接返回 404
  - 使用绑定变量 S3_HOST 组装上游 S3 URL
  - 转发时删除 host、content-length、cf-ray、cf-connecting-ip、x-forwarded-host 等不应透传给上游的头
  - 对 OPTIONS 预检请求直接返回 204，并回写 access-control-allow-* 头
  - 对实际回源请求显式禁用 Cloudflare 缓存
  - 为响应补充 access-control-allow-origin、vary: origin 和 x-vfs-worker: storage-proxy

### 背景问题

GitHub Pages 是静态文件托管，直接访问非首页路径时会返回 404。为了让 React Router 的前端路由可直接访问，必须在边缘层把这些请求改写为 index.html。

### 当前 .app 侧 Worker 配置

根据 Cloudflare MCP 的实际查询结果，当前已生效的 Worker Route 为：

| Route | Worker | 用途 |
| ----- | ------ | ---- |
| `storage.vfs-tracker.app/*` | `vfs-tracker-trans-router` | 存储入口的转发/中转逻辑 |
| `vfs-tracker.app/*` | `vfs-tracker-spa-router` | .app 主站 SPA 路由处理 |
| `www.vfs-tracker.app/*` | `vfs-tracker-spa-router` | .app 的 www 子域名 SPA 路由处理 |

注意：

- 当前仓库中的 deploy-cloudflare-worker workflow 现在会同时部署 infra/cloudflare-worker 与 infra/cloudflare-trans-router
- Cloudflare MCP 显示 vfs-tracker-trans-router 当前线上的 last_deployed_from 为 quick_editor；在本次收编后，后续可通过仓库 CI 接管部署来源
- 如果未来 .cn 主站不再代理到 vfs-tracker.app，而是切换为独立源站或独立 ESA 规则，则必须在 ESA 或新源站侧重新实现 SPA fallback

### 开发者注意事项

添加新前端路由时，仍然必须同步更新 infra/cloudflare-worker/spa-router.js 中的 knownRoutes。否则：

- .app 主站会退化为 fallback 逻辑
- 当前依赖 .app 上游 Worker 的 .cn 主站也会一起受到影响

## 当前架构的优点与限制

### 优点

- 配置简单：.cn 站点不需要单独维护一套前端部署产物
- 复用现有能力：直接复用 .app 侧 Cloudflare Worker 和 GitHub Pages 发布流程
- API 与存储拆分清晰：.cn 下的 api 和 storage 已经各自指向独立上游，不与主站混在同一个源站里
- 应用逻辑透明：前端只依赖当前 hostname，后端只依赖请求头，不需要额外的环境分叉

### 限制

- .cn 主站当前多了一跳上游：ESA -> Cloudflare -> GitHub Pages，这会增加链路复杂度
- .cn 主站的 SPA 路由能力依赖 .app 上游 Worker，不具备独立故障隔离
- 主站是否真正受益于大陆缓存，取决于 ESA 对 vfs-tracker.cn -> vfs-tracker.app 这一跳的缓存策略；当前已验证信息还不足以证明这层缓存收益明显
- 存储域名虽然走了 .cn 入口，但当前规则是 bypass_all，因此更偏向安全代理和可达性优化，而不是对象缓存加速

## 维护建议

- 把 ESA 站点配置视为当前线上架构的一部分，不要再把 .cn 仅描述成“一个泛指的中国 CDN”
- 如果新增或调整 .cn 记录、回源、缓存和 HTTPS 配置，应同步更新本文档
- 如果未来要让 .cn 成为真正独立、可优化的大陆前端入口，应优先评估是否把主站源站从 vfs-tracker.app 解耦
