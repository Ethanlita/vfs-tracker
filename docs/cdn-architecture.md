# CDN 架构说明

## 概述

本文档描述的是当前线上已经验证过的 CDN 与域名链路，而不是抽象设计图。

截至 2026-05-06，以下事实已经通过 DNS、HTTP 探针和阿里云 ESA CLI 验证：

- .app 主站当前走 Cloudflare，源站是 GitHub Pages。
- .cn 主站当前由阿里云 ESA EdgeRoutine 关联记录处理，Routine 显式读取 origin-probe.vfs-tracker.cn 上游；API 和 storage 仍分别代理到 AWS API Gateway 与 S3。
- 文件类接口仍然依赖后端按请求来源动态改写预签名链接主机名，在 .app 和 .cn 之间切换存储域名。
- Cloudflare MCP 已确认当前账号下只有 2 个与本站相关的 Worker 脚本：vfs-tracker-spa-router 和 vfs-tracker-trans-router。
- ESA EdgeRoutine 能力已开通，`vfstrackercn` 已接管 `vfs-tracker.cn` 与 `www.vfs-tracker.cn` 主站流量；`origin-probe` 和 `routine-probe` 保留为验证入口。

## 当前真实链路

### 1. .app 主站

- 公网域名：vfs-tracker.app
- 仓库中的 GitHub Pages 自定义域名配置：仓库根目录 CNAME 文件为 vfs-tracker.app
- 当前请求链路：浏览器 -> Cloudflare -> Cloudflare Worker -> GitHub Pages
- 作用：全球默认前端入口；.cn 主站已不再经由该域名继承 Cloudflare Worker
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
- 当前请求链路：浏览器 -> 阿里云 ESA Routine 关联记录 -> vfstrackercn -> origin-probe.vfs-tracker.cn -> ESA 普通 CNAME/OriginRule -> GitHub Pages

这意味着 .cn 主站当前已经从 .app 的 Cloudflare Worker 链路解耦，但仍然复用同一份 GitHub Pages 前端产物，不需要维护第二套构建输出。

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
| `vfs-tracker.cn` | ESA Routine 关联记录 `vfstrackercn` | Proxied | .cn 主站由 EdgeRoutine 接管并回源到 origin-probe |
| `www.vfs-tracker.cn` | ESA Routine 关联记录 `vfstrackercn` | Proxied | www 主站同样由 EdgeRoutine 接管 |
| `api.vfs-tracker.cn` | `wg3q2nomc3.execute-api.us-east-1.amazonaws.com` | Proxied | .cn API 直接代理到 AWS API Gateway 默认域名 |
| `storage.vfs-tracker.cn` | `vfs-tracker-objstor.s3.us-east-1.amazonaws.com` | Proxied | .cn 存储入口直接代理到 S3 |
| `origin-probe.vfs-tracker.cn` | `ethanlita.github.io` | Proxied | .cn Routine 使用的 GitHub Pages 上游测试/源站入口 |
| `routine-probe.vfs-tracker.cn` | ESA Routine 关联记录 `vfstrackercn` | Proxied | Routine 执行路径测试入口 |

### 回源与缓存

已确认的关键规则如下：

- 存在一条用于 storage 域名的回源规则，回源 Host 明确设置为 vfs-tracker-objstor.s3.us-east-1.amazonaws.com
- 存在一条用于 api 和 storage 域名的缓存绕过规则，行为为 bypass_all

当前可以确认的结论是：

- .cn 主站 HTML 线上观测为 `cache-control: max-age=60`
- .cn 主站 `/assets/` 哈希资源线上观测为 `cache-control: max-age=31536000`
- .cn API 默认不走缓存，这对动态接口是合理配置
- .cn 存储入口也被明确设置为不走 ESA 缓存；这意味着它当前更像“大陆侧加速代理入口”，而不是对象分发缓存层
- ESA 的全站刷新 API `PurgeCaches` 使用 `purgeall` 时必须传入对象格式的 Content，例如 `{"PurgeAll":true}`；只传 `--Type purgeall` 会失败。

### EdgeRoutine 与 GitHub Pages 直连尝试

2026-05-06 已完成一次受控验证：

- 已创建账号级 ESA Routine：`vfstrackercn`
- Routine 代码已收编到仓库：`infra/esa-routine/cn-spa-fallback.js`
- 部署脚本已收编到仓库：`scripts/deploy-esa-routine.mjs`
- GitHub Pages 发布 workflow 已追加 ESA Routine 部署与 ESA 缓存刷新步骤
- GitHub Actions Secrets 已配置：`ALIBABA_CLOUD_ACCESS_KEY_ID` 与 `ALIBABA_CLOUD_ACCESS_KEY_SECRET`

同时验证过一个错误的目标架构配置：`vfs-tracker.cn -> ESA -> ethanlita.github.io`，并在回源规则里设置了如下参数：

- `DnsRecord=ethanlita.github.io`
- `OriginHost=vfs-tracker.app`
- `OriginSni=ethanlita.github.io`
- `OriginVerify=on`
- `OriginScheme=https`

该方案在线上返回 `502 Bad Gateway`，ESA 错误为 `destination_not_found`。后续使用 `origin-probe.vfs-tracker.cn` 复测后，定位到关键原因不是 GitHub Pages 本身不可用，而是把 `ethanlita.github.io` 写入 OriginRule 的 `DnsRecord` 会触发 ESA 的 destination_not_found。即使把 `DnsRecord` 改成 `vfs-tracker.app`，同样会触发 502。

已验证可行的配置模型是：

- CNAME 记录本身指向 `ethanlita.github.io`
- 记录 `HostPolicy=follow_origin_domain`
- OriginRule 不设置 `DnsRecord`
- OriginRule 设置 `OriginHost=vfs-tracker.app`
- OriginRule 设置 `OriginSni=ethanlita.github.io`
- OriginRule 设置 `OriginVerify=on`
- OriginRule 设置 `OriginScheme=https`

当前保留 `https://origin-probe.vfs-tracker.cn/` 作为测试入口。该入口已验证在上述模型下返回 200。

随后继续验证 EdgeRoutine，得到第二个关键结论：普通 CNAME 记录不会因为 `CreateRoutineRoute` 自动触发 Routine。ESA Routine 需要创建关联记录，相关 API 是 `CreateRoutineRelatedRecord`。因此主站如果要真正走 EdgeRoutine，不能只把普通 CNAME 指到 GitHub Pages 再创建 RoutineRoute，而需要把主站记录替换为 Routine 关联记录，并由 Routine 显式读取一个独立上游。

当前保留的测试入口如下：

| 测试域名 | 类型 | 用途 | 当前结论 |
| -------- | ---- | ---- | -------- |
| `origin-probe.vfs-tracker.cn` | 普通 CNAME + OriginRule | 验证 ESA 直连 GitHub Pages 的上游模型 | 根路径和静态资源可正常返回 200 |
| `routine-probe.vfs-tracker.cn` | Routine 关联记录 | 验证 ESA EdgeRoutine 真实执行路径 | `/scale-practice` 返回 200，带 `x-esa-spa-route: true` |

Routine 运行时也已经验证：ESA EdgeRoutine 使用模块入口格式 `export default { fetch(request) {} }`。Cloudflare Worker 风格的 `addEventListener('fetch', ...)` 虽然可以上传和部署，但在线上会返回 `599 Error: Load user script error`。

当前仓库中的 `infra/esa-routine/cn-spa-fallback.js` 已改为 ESA 模块入口，并显式从 `origin-probe.vfs-tracker.cn` 读取上游内容。静态资源会被放行到上游，同时由 Routine 补充长期缓存头；SPA 深链返回上游首页 HTML，并用 `x-esa-spa-route` 或 `x-esa-spa-fallback` 标记。

最终切换结果：

- `vfs-tracker.cn` 与 `www.vfs-tracker.cn` 已切换为 `vfstrackercn` Routine 关联记录
- `页面回源规则` 保持关闭，避免旧的 OriginRule `DnsRecord` 逻辑重新介入
- `cn-hashed-assets-long-cache` 与 `cn-html-short-cache` 已由脚本创建；Routine 自身也会在响应头上明确写入对应缓存策略
- `https://vfs-tracker.cn/` 返回 200，带 `x-esa-spa-route: true`
- `https://vfs-tracker.cn/scale-practice` 返回 200，带 `x-esa-spa-route: true`
- `https://vfs-tracker.cn/assets/index-*.js` 返回 200，`content-type` 为 JavaScript，且没有 `x-esa-spa-route`
- `api.vfs-tracker.cn` 与 `storage.vfs-tracker.cn` 未被主站 Routine 误处理，验证时分别返回后端 JSON/XML 错误响应且没有 `x-esa-spa-route`

因此，当前不要使用 OriginRule 的 `DnsRecord` 来把 .cn 主站切换到 GitHub Pages，也不要只依赖普通 CNAME + RoutineRoute 来触发 EdgeRoutine。`scripts/configure-esa-cn-origin.mjs` 使用 Routine 关联记录模型；再次应用仍需要显式设置 `ESA_CONFIRM_GITHUB_ORIGIN=yes` 与 `ESA_CONFIRM_REPLACE_MAIN_RECORD=yes`。

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
- 当前仓库内新增了 .cn 专用 ESA Routine：`infra/esa-routine/cn-spa-fallback.js`

需要特别注意：旧文档里写的 storage-worker 更接近“用途描述”，而不是当前线上脚本名。Cloudflare 上真实存在的脚本名是 vfs-tracker-trans-router。

因此，当前线上行为应理解为：

- vfs-tracker.app 的 SPA 路由由 Cloudflare Worker 处理
- storage.vfs-tracker.app 也有独立的 Cloudflare Worker 处理中转逻辑
- vfs-tracker.cn 的 SPA 路由由 ESA Routine 处理，不再继承 .app 上游 Worker
- 对 .cn 的 SPA 路由探测会观察到 `x-esa-spa-route` 或 `x-esa-spa-fallback` 响应头

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
- .cn 主站已经切换为 ESA Routine 关联记录；修改 Routine 前应先用 routine-probe.vfs-tracker.cn 验证真实边缘行为

### 开发者注意事项

添加新前端路由时，必须同步更新 `infra/cloudflare-worker/spa-router.js` 和 `infra/esa-routine/cn-spa-fallback.js` 中的已知路由列表。否则：

- .app 主站会退化为 fallback 逻辑
- .cn 主站会退化为 ESA Routine 的 404 fallback 逻辑

## 当前架构的优点与限制

### 优点

- 配置仍然保持单源：.cn 站点不需要单独维护一套前端部署产物
- 主站解耦：.cn 已不再通过 .app 的 Cloudflare Worker 才能获得 SPA fallback
- 自动化发布：GitHub Pages 发布后会继续部署 ESA Routine 并刷新 ESA 缓存
- API 与存储拆分清晰：.cn 下的 api 和 storage 已经各自指向独立上游，不与主站混在同一个源站里
- 应用逻辑透明：前端只依赖当前 hostname，后端只依赖请求头，不需要额外的环境分叉

### 限制

- .cn 主站当前链路依赖 `origin-probe.vfs-tracker.cn` 作为 GitHub Pages 上游入口，应把该记录视为生产依赖而不是随手清理的临时项
- .cn 与 .app 各有一份 SPA fallback 路由列表，新增前端路由时必须同步更新两处
- ESA Routine 运行时与 Cloudflare Worker 不完全相同，不能直接复用 `addEventListener('fetch')` 风格代码
- 存储域名虽然走了 .cn 入口，但当前规则是 bypass_all，因此更偏向安全代理和可达性优化，而不是对象缓存加速

## 维护建议

- 把 ESA 站点配置视为当前线上架构的一部分，不要再把 .cn 仅描述成“一个泛指的中国 CDN”
- 如果新增或调整 .cn 记录、回源、缓存和 HTTPS 配置，应同步更新本文档
- 如果未来要让 .cn 成为真正独立、可优化的大陆前端入口，应优先评估是否把主站源站从 vfs-tracker.app 解耦
