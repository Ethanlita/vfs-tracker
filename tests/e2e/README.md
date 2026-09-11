# Playwright 端到端测试

端到端测试分为开发模式浏览器流程与生产 PWA 流程。两者不能互相替代：开发服务器用于快速验证当前组件和路由，生产预览才会注册 Service Worker。

## 开发模式套件

运行 Chromium：

```powershell
npm run test:e2e -- --project=chromium --workers=1
```

运行配置中的全部桌面与手机浏览器：

```powershell
npm run test:e2e
```

`playwright.config.js` 自动启动 `npm run dev:playwright`。公开接口响应在测试中通过 Playwright 路由隔离，不读取或修改真实用户数据。当前套件覆盖：

- 登录/注册表单、受保护路由和完整 `returnUrl`；
- 首页及桌面、手机共用功能侧栏；
- 公开仪表板的空态、失败重试、统计、图表、按需明细和 20 人分页；
- Hz/音名双向转换、输入错误、88 键钢琴和 320px 布局；
- 快速基频与音阶练习的访客入口和麦克风权限拒绝恢复；
- 注册后邮箱确认恢复，以及音阶可视位置计算。

套件不使用条件性 `test.skip()` 来隐藏缺少控件、旧路由或未实现流程。真实登录、云端事件写入、S3 上传及物理麦克风音质属于契约测试和人工验收范围，不能由隔离 E2E 冒充通过。

2026-09-11 的验证结果：Chromium 26/26、Firefox 26/26、iPhone 12 WebKit 26/26；桌面 WebKit 原全套 24/26 通过，修复关闭侧栏后的回焦点并放宽开发冷编译等待后，失败的认证/主页专项 6/6 通过。WebKit 的 Vite 开发模式冷编译约 9–13 秒/页，首个认证代码块约 38 秒，该时间不作为生产性能指标。

## 生产 PWA 套件

```powershell
npm run test:e2e:pwa
```

`playwright.production.config.js` 会构建应用并在 `127.0.0.1:4174` 启动独立预览。桌面 Chromium 与 Pixel 5 视口分别等待 Service Worker 接管，然后断网直达并刷新：首页、文档目录、Markdown 正文、Hz 工具、VFS 效果预览、快速基频测试和音阶练习。测试还检查整页横向溢出和生产构建中的双向 Hz 转换。

开发服务器不注册 Service Worker，因此不能用于宣称 PWA 安装、更新或离线冷启动通过。

## 路由一致性

`tests/unit/infra/spa-route-manifest.test.js` 同时验证：

1. React、Cloudflare Worker 与 ESA Routine 的静态路由清单一致；
2. 两套边缘入口都识别 `/admin/*`；
3. `tests/e2e` 中所有字面量 `page.goto()` 地址都对应当前应用路由。

新增页面时需要同步 `src/App.jsx`、两套边缘路由清单及相关 E2E。引用已删除的 `/events`、`/public-dashboard` 或结果子页面会在单元测试阶段失败。

`.github/workflows/deploy.yml` 在上传 GitHub Pages 产物前依次执行 ESLint、完整单元测试、Chromium 开发模式 E2E 和生产 PWA 离线 E2E。任何一层失败都会阻止该次前端发布。

## 失败产物

失败截图、视频与 trace 写入 `test-results/`，HTML 报告写入 `playwright-report/`。这些目录已被 Git 忽略。调试单项测试可使用：

```powershell
npx playwright test tests/e2e/note-frequency.spec.js --project=chromium --headed
```
