# VFS Tracker

一个用于记录与分析 VFS（Voice Feminization Surgery）相关语音事件的开源应用。

## 测试 (Testing)

项目使用 **Vitest + jsdom + MSW + React Testing Library** 构建现代化测试框架。

### 快速开始
```bash
# 运行所有测试 (交互式)
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 可视化测试 UI
npm run test:ui

# 只运行单元测试 (快速验证)
npm run test:unit

# 只运行集成测试
npm run test:integration

# 运行契约测试 (需要真实 API 配置)
npm run test:contract
```

### 测试架构
- **Unit Tests** (单元测试): 测试独立函数和 schema 验证
  - ✅ `tests/unit/api/schemas.test.js` - 全部 28 个测试通过
- **Integration Tests** (集成测试): 使用 MSW 模拟 API 调用测试完整流程
  - `tests/integration/api/` - API 层集成测试
  - `tests/integration/components/` - React 组件集成测试
- **Contract Tests** (契约测试): 调用真实 API 验证数据契约
  - `tests/contract/api-contract.test.js`
  - 需要完整的 AWS 环境变量配置

### Playwright / PWA
1. `npm run test:e2e -- --project=chromium --workers=1` 运行开发模式浏览器流程。测试会隔离公开 API，不读取或写入真实用户数据。
2. `npm run test:e2e:pwa` 构建生产版本，在桌面和 Pixel 5 视口验证 Service Worker 接管、断网直达、离线刷新、Markdown 正文与本地工具。
3. 真实登录、云端事件写入、S3 上传及物理麦克风测试必须使用独立测试账号并按人工验收清单执行。
4. 需要手动联调时，执行 `npm run dev:playwright`；开发服务器不会注册 Service Worker，不能用于验收 PWA 离线行为。

### 重要文档
- 📖 **[完整测试指南](docs/TESTING_GUIDE.md)** - 500+ 行详细文档
- 📖 **[契约测试说明](tests/contract/README.md)** - 契约测试使用指南
- 📖 **[S3 存储清理](docs/storage-cleanup.md)** - 孤儿附件与过期原始录音的每日清理策略
- 📊 **[Phase 3.1 状态报告](tests/PHASE3.1_STATUS.md)** - 测试框架实施状态

### 测试数据
- **Schemas** (`src/api/schemas.js`): 使用 Joi 定义所有数据结构的契约
- **Fixtures** (`src/test-utils/fixtures/`): 丰富的测试数据
  - 4 种用户 profiles (complete, minimal, public, private)
  - 5 种事件 fixtures (self_test, surgery, feeling_log 等)
- **MSW Handlers** (`src/test-utils/mocks/`): 模拟 API 响应

完整范围和调试方式见 [Playwright 端到端测试](tests/e2e/README.md)。

## 环境变量配置

项目需要配置 AWS 环境变量才能正常运行：

### 必需变量

这些环境变量必须全部配置才能使用应用：

- `VITE_COGNITO_USER_POOL_ID` - AWS Cognito 用户池 ID
- `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID` - AWS Cognito 应用客户端 ID
- `VITE_AWS_REGION` - AWS 区域（如 us-east-1）
- `VITE_API_ENDPOINT` - 统一 API 入口（如 https://api.vfs-tracker.app）
- `VITE_S3_BUCKET` - 用户文件所使用的 S3 Bucket 名称

### 可选变量

- `VITE_GOOGLE_GEMINI_API` - 用于生成 AI 鼓励消息

### 配置步骤

1. 复制 `.env.example` 为 `.env`
2. 在 AWS Cognito 控制台获取用户池相关信息
3. 在 API Gateway 控制台获取 API 端点
4. 在 S3 控制台获取存储桶名称
5. 填入 `.env` 文件中
6. **重要**: 不要将包含真实值的 `.env` 文件提交到 git

> ⚠️ **注意**: 应用现已移除开发模式，必须配置完整的 AWS 环境变量才能运行。详见 [AWS 环境变量配置指南](docs/lambda-environment-variables.md)。

## 项目简介

VFS Tracker 是一个**声音训练、监测与数据可视化平台**，主要面向跨性别女性（MtF）或其它有嗓音调整需求的用户。前端技术栈为 React + Vite，样式采用 Tailwind CSS；后端通过 AWS Serverless（Cognito、API Gateway、Lambda、DynamoDB）提供鉴权、API 与存储。

- **在线演示与文档**: 请参考本仓库主页、[架构文档](ARCHITECTURE.md)和[API文档](API_Gateway_Documentation.md)。
- **代码许可与贡献**: 参见 [CONTRIBUTION.md](CONTRIBUTION.md)。

## 功能概览

- 事件记录与管理
  - 支持事件类型：self_test、自我测试；hospital_test、医院检测；voice_training、嗓音训练；self_practice、自我练习；surgery、手术；feeling_log、感受记录
  - 文件上传（生产环境经 S3，开发环境返回模拟 Key）
  - 表单字段动态变化，严格遵循数据契约（见 docs/data_structures.md）
- **在线嗓音测试 (Online Praat)**
  - **新增功能**: 提供一个多步骤向导，引导用户完成一系列标准化声学测试（如：持续元音、朗读、自发音等）。
  - **后端分析**: 使用新的 `online-praat-analysis` Lambda 函数，通过 `praat-parselmouth` 等库进行专业的声学分析。
  - **结果生成**: 自动计算基频 (F0)、Jitter、Shimmer、HNR 等核心指标，并生成图表和 PDF 报告。
  - **中断恢复**: 测试会话、已上传片段、量表和报告查询按账号保留 60 分钟；待上传原始录音仅临时保存在浏览器 IndexedDB。详见 [嗓音测试刷新恢复](docs/voice-test-recovery.md)。
- 个人时间轴与指标
  - 基于 Chart.js 的时间序列可视化
  - AI 鼓励消息（生产环境启用 Gemini API，否则回退为默认消息）
- 公开仪表板
  - 汇总匿名事件统计、事件类型分布柱状图
  - VFS 对齐的多用户基频变化折线图与统计指标（平均提升、方差、二倍方差）
  - 用户列表与轻量档案抽屉
- Hz-音符转换工具
  - 新增无需登录即可访问的 Hz ↔ 音名转换器，支持 88 键钢琴高亮与频率提示
  - 在线时自动加载 soundfont 钢琴音色，离线时回退到合成器以保证 PWA 可用性
  - 适配手机等窄屏设备，提供可滑动的全键盘视图
- 文章/帖子支持
  - 构建时自动生成 posts.json；构建产物复制 posts 目录到 dist/posts
- **PWA 支持**
  - 使用 `vite-plugin-pwa` 自动生成 Service Worker，支持离线访问与自动更新。
  - 首页按路由加载图表、文档和音频工具；WORLD 只在效果预览页初始化，并由生产构建体积预算防止首屏回退。详见 [前端加载性能](docs/frontend-loading-performance.md)。
  - 自动缓存静态资源与 Google Fonts。
  - 激活更新前会检查所有本站标签页中的未完成表单、上传、录音和练习进度；存在未保存工作时保留等待中的版本并提示处理。详见 [PWA 跨标签页更新协调](docs/pwa-update-coordination.md)。

## 目录结构（摘录）

- src/components
  - VoiceTestWizard.jsx: 在线嗓音测试的轻量页面外壳；XState 状态图、上传和分析服务见 [嗓音测试前端状态机](docs/voice-test-state-machine.md)。
  - PublicDashboard.jsx：公开仪表板，聚合全体用户匿名数据与可视化
  - EventForm.jsx：事件录入表单，支持文件上传与动态字段
  - Timeline.jsx：个人时间轴与图表展示
  - PostList.jsx / PostViewer.jsx / PostsDropdown.jsx：帖子列表与阅读
- `src/api.js`: 封装所有与后端 API 的交互
- `lambda-functions/`: 包含所有后端 Lambda 函数的源代码。
- `docs/`: 包含项目的主要文档。
- scripts/generate-posts-list.js：生成 public/posts.json
- docs/data_structures.md：数据结构契约（禁止修改）
- docs/: 这个文件夹里面的是技术文档（README和AGENTS除外）
- posts/: 这个文件夹里面是向用户展示的文档

## 快速开始

1) 克隆与安装依赖
- 使用 npm：
  - npm i
- 使用 pnpm：
  - pnpm i

2) 配置环境变量
- 复制 `.env.example` 为 `.env`
- 填入你的 AWS 凭证（见上方"环境变量配置"部分）

3) 本地开发
- npm run dev（或 pnpm dev）
- 浏览器访问 http://localhost:3000

3) 生产构建
- npm run build（或 pnpm build）
- 产出目录：dist（包含 posts 复制与 public 目录复制）

4) 本地预览构建产物
- npm run preview

## 数据契约（Data Contract）

请严格遵循 docs/data_structures.md 中定义的结构：
- User、Profile、SocialAccount 对象结构
- Event 基础结构与各 type 对应的 details 字段要求
- 所有后端/前端交互数据必须匹配该契约；如需演进，请新增兼容字段，避免破坏已定义的结构

更多请阅读 docs/data_structures.md（该文件不应在本项目中被修改）

## 部署

- 构建：npm run build
- 静态托管：
  - GitHub Pages：本仓库包含 CNAME 与 vite.config.js base:'/'，可直接将 dist 发布到 gh-pages 或任何静态托管
  - 其他平台（Netlify、Vercel、Cloudflare Pages）均可直接指向 dist
- 后端（若启用）：
  - 需在托管平台配置上述所有 VITE_* 环境变量。
  - AWS 侧需准备 Cognito, API Gateway, Lambda, 和 DynamoDB 服务。
  - `online-praat-analysis` Lambda 函数需要作为容器镜像单独部署。

## FAQ

- Q: 没有 AWS 账号能否运行？
  - A: 不可以。应用现已移除开发模式，必须配置完整的 AWS 环境变量才能运行。
- Q: 图表没有数据或显示"暂无可绘制的基频数据"？
  - A: 请检查是否有足够的事件数据，以及事件中是否包含基频（fundamentalFrequency）字段。
- Q: 上传失败如何排查？
  - A: 请检查 S3 权限、API Gateway 配置以及浏览器控制台的网络请求和日志。确保 VITE_S3_BUCKET 环境变量配置正确。
- Q: 帖子列表为什么自动生成？
  - A: 开发与构建时 scripts/generate-posts-list.js 会扫描 posts 目录，生成 public/posts.json，vite 插件会将 posts 复制到 dist/posts。
