# 中国大陆站静态资源压缩（#124）

`vfs-tracker.cn` 和 `www.vfs-tracker.cn` 的网页请求由 ESA EdgeRoutine 处理。2026-09-11 发布前基线中，入口 JavaScript 对携带 `Accept-Encoding: gzip, br, zstd` 的 GET 请求返回 `Vary: Accept-Encoding`，但没有 `Content-Encoding`，正文仍为完整解码体积。仓库原部署任务只更新 Routine 和刷新缓存，没有把 ESA 内容优化规则声明为发布配置。

## 唯一配置路径

`.github/workflows/deploy.yml` 在部署 Routine 后执行 `scripts/configure-esa-compression.mjs`。脚本读取当前站点规则，并按固定名称 `cn-main-static-compression` 创建或更新同一条规则；规则只匹配 `.cn` 两个网页主机，启用 Gzip、Brotli 和 Zstd。API 与存储子域名不匹配该规则。

不要在 Routine 中再次压缩响应。ESA 官方说明 Routine 后仍会执行站点性能优化配置，由内容优化层统一完成协商和缓存变体，避免应用代码与平台各维护一条压缩路径：

- [ESA 文件压缩](https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/file-compression)
- [ESA EdgeRoutine](https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/user-guide/edge-functions-overview/)
- [CreateCompressionRule API](https://www.alibabacloud.com/help/en/edge-security-acceleration/esa/api-esa-2024-09-10-createcompressionrule)

配置和 Routine 部署完成后，流水线刷新 ESA 缓存，再运行 `scripts/verify-esa-compression.mjs`。验证脚本使用最终 `.cn` 域名做真实 GET：从首页发现当前 Vite 入口文件，先要求 `gzip, br, zstd` 并核对 `Content-Encoding` 和 `Vary`，再使用 `identity` 确认不支持压缩的客户端仍能读取非压缩正文。规则传播期间最多等待约一分钟，超过后让发布失败，防止未压缩版本静默上线。

配置、线上验证和既有 Routine 发布脚本共 10 项聚焦测试通过；完整单元测试 99 个文件、1322 项，以及完整集成测试 32 个文件、618 项全部通过。

本地没有 Alibaba Cloud 凭据时只能运行脚本单元测试，不能声称线上已经修复。规则随下一次合入 `master` 的发布应用，届时流水线的最终站点验证才构成 #124 的线上验收；中国大陆实体网络的 LCP、INP 和传输耗时仍需另行采样。
