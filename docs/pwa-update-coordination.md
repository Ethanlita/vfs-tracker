# PWA 版本与更新

本文说明 VFS Tracker 如何标识版本、发现新版本、激活并切换到新版本，以及多个标签页之间如何协调，避免更新时丢失未保存的工作。实现集中在：

- `src/pwa/updateController.js`：注册 Service Worker，检测新版本、定时检查、静默或手动激活，激活后刷新
- `src/utils/pwaUpdateCoordinator.js`：跨标签页的阻塞检查与激活通知
- `src/components/ServiceWorkerUpdateBanner.jsx`：只负责渲染更新状态的横幅（挂在 `main.jsx` 根节点）
- `config/appVersion.js`：构建期版本号

`sw.js` 仍由 `vite-plugin-pwa` 以 `registerType: 'prompt'` 生成：预缓存全部静态资源，导航请求由预缓存的 `index.html` 响应；新的 Service Worker 不会自动 `skipWaiting`，只在收到 `{ type: 'SKIP_WAITING' }` 消息时激活。`injectRegister: false`，不使用 `virtual:pwa-register`。

## 版本号

构建时把 `__APP_VERSION__` 注入前端，取值为**最后一次改动前端相关路径的提交**（短哈希 + 提交日期，路径列表见 `FRONTEND_VERSION_PATHS`）。只改后端或仓库文档的提交不会改变前端产物，也就不会让用户收到更新。页脚显示"版本 e057653（2026-11-08）"，开发服务器显示 `dev`。生产构建若无法从 git 历史得到提交会直接失败，因此发布工作流以 `fetch-depth: 0` 检出。

## 发现新版本

"有新版本"只以一个条件判断：`registration.waiting && registration.active`（首次安装没有 active，不提示）。新版本通过以下途径被发现：

| 触发 | 说明 |
|---|---|
| 整页加载 | 浏览器自己在导航后约 2 秒检查一次 `sw.js` |
| 每 30 分钟 | 页面可见时调用 `registration.update()` |
| 切回前台 | 距上次检查超过 5 分钟时检查 |
| 恢复联网 | `online` 事件时检查 |

站内路由跳转不会触发浏览器的检查，所以长时间打开的页面和常驻的手机 PWA 依赖后三种触发。

部署后 Cloudflare 会缓存 `sw.js`（源站 `max-age=600`），因此发布工作流在 GitHub Pages 部署成功后清空 Cloudflare 缓存（.cn 侧清空 ESA 缓存），详见 [CDN 架构说明](cdn-architecture.md)。

## 激活与刷新

| 情况 | 行为 |
|---|---|
| 页面打开 15 秒内、用户还没点击/按键/滚轮/触摸，且没有其他本站标签页 | **静默更新**：直接激活并刷新，不显示横幅 |
| 其他情况 | 显示横幅"检测到应用有新版本可用。" |
| 点"立即刷新" | 检查所有标签页的未完成工作 → 发送 `SKIP_WAITING` → 等新版本进入 `activated`（最多 10 秒）→ 通知其他标签页 → 刷新本页 |
| 点"下次打开时更新" | 本页不再提示；下次打开时在无操作阶段静默完成 |
| 激活超时或失败 | 横幅恢复可点击并说明原因，可重试；不会一直停在"正在更新…" |

激活后由控制器自己刷新页面，不依赖 `controllerchange`。因此首访标签页、强制刷新（绕过 Service Worker）后的页面等**不受 Service Worker 控制的页面**也能完成更新。

更新状态保存在可订阅的 store 中（`useSyncExternalStore`），横幅挂在登录状态之外的根节点，认证加载期间也能显示，横幅晚挂载也不会错过提示。

## 跨标签页协调

页面通过 `BroadcastChannel` 的 `vfs-pwa-update-coordinator:v1` 频道共享工作状态。频道只传输固定的工作类型名称和随机标签页标识，不传输表单字段、账号信息、音频或附件内容。每个页面启动时就加入频道并响应探测。

| 消息 | 方向 | 作用 |
|---|---|---|
| `probe` / `state` | 发起方 → 所有标签页 → 发起方 | 收集各标签页的未完成工作；应答者即视为"其他标签页" |
| `state-change` | 任一标签页 → 所有标签页 | 探测窗口内新开始的工作也会阻止激活 |
| `update-activated` | 发起方 → 所有标签页 | 新版本已激活，其他标签页刷新到同一版本 |

用户点击"立即刷新"后，当前标签页先广播探测请求，并在 350 ms 探测窗口内收集所有标签页的阻止项。只要任一标签页仍有未完成工作，等待中的 Service Worker 就不会激活，横幅会列出需要先保存、完成或放弃的工作。静默更新还要求没有任何其他标签页应答，否则改为显示横幅。

收到 `update-activated` 的标签页如果没有未完成工作会立即刷新；如果还有，横幅提示"新版本已在其他标签页启用"，工作结束（阻止项清空）后自动刷新。

当前登记的阻止项包括：

- 新增事件表单及附件处理
- 文件或头像上传
- 录音任务与嗓音测试向导
- 个人资料编辑与首次资料设置
- 快速基频测试与音阶练习

浏览器不支持 `BroadcastChannel` 时，应用不会在页面内直接激活更新，而是提示用户关闭本站其他标签页后重新打开应用。

## 旧页面加载已删除的资源

GitHub Pages 每次部署都会删除旧的哈希资源。仍在运行旧代码的页面切到懒加载路由时会加载失败；控制器监听 Vite 的 `vite:preloadError`，自动刷新一次取得当前版本。60 秒内再次失败说明资源确实缺失，交回原错误路径，避免循环刷新。

## 生命周期边界

本机制只对已经加载这版代码的页面生效。用户从旧版本升级到包含本机制的版本时，旧页面仍按旧逻辑（`virtual:pwa-register` + 旧横幅）完成这一次升级；由于 `sw.js` 的生成方式与 `SKIP_WAITING` 协议不变，旧页面仍能正常激活新版本。之后的更新全部走新逻辑。

阻止项保护的是当前页面中尚未持久化的工作。已经存入 `pendingEvents:v1` 的离线事件继续由离线队列协议负责；更新协调器不会复制、修改或清理该队列。

## 验证

- 单元测试：`tests/unit/pwa/updateController.test.js`（检测、静默/手动激活、超时、其他标签页通知、定时检查、旧资源恢复）、`tests/unit/utils/pwaUpdateCoordinator.test.js`、`tests/unit/components/ServiceWorkerUpdateBanner.test.jsx`、`tests/unit/app-version.test.js`、`tests/unit/scripts/purge-cloudflare-cache.test.js`
- 生产端到端测试：`tests/e2e-production/pwa-update.spec.js` 构建 A、B 两个版本，用可切换的静态服务器模拟部署，在真实 Chromium Service Worker 下验证：
  1. 部署后打开（唯一标签页、未操作）静默切到新版本，不显示横幅
  2. 还有其他标签页时显示横幅，点击后所有标签页都切到新版本
  3. 首访（未受控）标签页点击更新也能完成
  4. 强制刷新后的页面点击更新也能完成
  5. 登录状态需要联网刷新时，加载期间也能看到更新提示
  6. 部署后仍运行旧代码的页面打开懒加载路由时自动恢复，不白屏
  7. 长时间打开的页面每 30 分钟检查新版本

  这 7 个场景在修复前的代码上逐一复现过对应问题（打开即显示旧版并弹横幅、未受控页面点击后无限"正在检查…"、横幅在登录加载期间丢失、旧页面懒加载白屏、站内跳转 90 秒内零次检查）。

### 历史验收（2026-09，跨标签页阻塞）

生产 PWA 端到端验收使用两个内容不同且都有真实 Service Worker 的构建版本，在 390px 和 1440px 的 Chromium 中分别执行：版本 A 的事件页保留未提交草稿及一条持久化离线队列记录；第二个标签页下载版本 B 并尝试立即刷新；核对版本 B 保持 waiting、事件页没有导航、草稿和离线队列完全不变；保存事件后再次更新，核对两个标签页都受版本 B 控制、waiting worker 消失、离线队列仍完全不变。测试使用合成账号和本地拦截接口，没有写入真实 Cognito、API Gateway、DynamoDB 或 S3。
