# VFS Tracker

一个用于记录与分析 VFS（Voice Feminization Surgery）相关语音事件的开源应用。前端基于 React + Vite，样式采用 Tailwind CSS；在具备云配置时通过 AWS Serverless（Cognito、API Gateway、Lambda、DynamoDB）提供鉴权、API 与存储。缺省情况下使用本地模拟数据运行，无需云账号即可体验。

- 在线演示与文档：请参考本仓库主页与 ARCHITECTURE.md、docs/data_structures.md
- 代码许可与贡献：参见 CONTRIBUTION.md

## 功能概览

- 事件记录与管理
  - 支持事件类型：self_test、自我测试；hospital_test、医院检测；voice_training、嗓音训练；self_practice、自我练习；surgery、手术；feeling_log、感受记录
  - 文件上传（生产环境经 S3，开发环境返回模拟 Key）
  - 表单字段动态变化，严格遵循数据契约（见 docs/data_structures.md）
- **在线嗓音测试 (Online Praat)**
  - **新增功能**: 提供一个多步骤向导，引导用户完成一系列标准化声学测试（如：持续元音、朗读、自发音等）。
  - **后端分析**: 使用新的 `online-praat-analysis` Lambda 函数，通过 `praat-parselmouth` 等库进行专业的声学分析。
  - **结果生成**: 自动计算基频 (F0)、Jitter、Shimmer、HNR 等核心指标，并生成图表和 PDF 报告。
- 个人时间轴与指标
  - 基于 Chart.js 的时间序列可视化
  - AI 鼓励消息（生产环境启用 Gemini API，否则回退为默认消息）
- 公开仪表板
  - 汇总匿名事件统计、事件类型分布柱状图
  - VFS 对齐的多用户基频变化折线图与统计指标（平均提升、方差、二倍方差）
  - 用户列表与轻量档案抽屉
- 文章/帖子支持
  - 构建时自动生成 posts.json；构建产物复制 posts 目录到 dist/posts

## 目录结构（摘录）

- src/components
  - VoiceTestWizard.jsx: 在线嗓音测试向导核心组件。
  - PublicDashboard.jsx：公开仪表板，聚合全体用户匿名数据与可视化
  - EventForm.jsx：事件录入表单，支持文件上传与动态字段
  - Timeline.jsx：个人时间轴与图表展示
  - PostList.jsx / PostViewer.jsx / PostsDropdown.jsx：帖子列表与阅读
- src/api.js：对接 AWS Amplify（API/Storage），提供开发环境回退逻辑
- lambda-functions/online-praat-analysis: 新增的嗓音分析后端服务。
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

2) 本地开发（含模拟数据，无需云配置）
- npm run dev（或 pnpm dev）
- 浏览器访问 http://localhost:3000

3) 生产构建
- npm run build（或 pnpm build）
- 产出目录：dist（包含 posts 复制与 public 目录复制）

4) 本地预览构建产物
- npm run preview

## 环境变量与 isProductionReady

项目通过 isProductionReady 决定是否启用真实云服务：
- 必需变量（全部存在且非空才视为“生产就绪” Production Ready）：
  - VITE_COGNITO_USER_POOL_ID
  - VITE_COGNITO_USER_POOL_WEB_CLIENT_ID
  - VITE_AWS_REGION
  - VITE_API_ENDPOINT（统一 API 入口，例如 https://api.vfs-tracker.app）
  - VITE_S3_BUCKET（用户文件所使用的 S3 Bucket 名称）
- 可选变量：
  - VITE_GOOGLE_GEMINI_API（用于生成 AI 鼓励消息，仅生产环境使用）

> isProductionReady 会在上述任意一个配置缺失时返回 `false`，前端自动落入“开发模式”。只要全部配置齐全，就会被视为生产模式并走真实云端流程。

行为差异：
- 开发模式（未就绪）：
  - API 返回 mock_data.json 中的模拟事件
  - 上传文件返回模拟 Key（不调用 S3）
  - AI 鼓励消息使用静态默认文案
- 生产模式（就绪）：
  - 通过 Amplify API 调用 API Gateway/Lambda
  - 通过 Amplify Storage 上传文件至 S3
  - 可调用 Gemini API 生成鼓励消息

代码位置：
- src/api.js 中的 isProductionReady() 与各 API 方法（getAllEvents、getEventsByUserId、addEvent、uploadFile、getEncouragingMessage）
- 组件内也会基于上述变量决定鉴权与 UI 行为（如 EventForm、PublicDashboard）

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
  - 需在托管平台配置上述 VITE_* 环境变量
  - AWS 侧需准备 Cognito、API Gateway、Lambda、DynamoDB、S3，并在 Amplify 配置中与之对应
  - **新增**: `online-praat-analysis` Lambda 函数需要单独部署，详情参见其目录下的 `README.md`。

## FAQ

- Q: 没有 AWS 账号能否运行？
  - A: 可以。未配置必需环境变量时，应用使用本地模拟数据与回退逻辑。
- Q: 图表没有数据或显示“暂无可绘制的基频数据”？
  - A: 仪表板会在数据不足时生成额外演示数据；若仍为空，请检查 mock_data.json 或真实 API 返回。
- Q: 上传失败如何排查？
  - A: 在开发模式不会真的上传；生产模式请检查 S3 权限、Amplify 配置与浏览器控制台日志。
- Q: 帖子列表为什么自动生成？
  - A: 开发与构建时 scripts/generate-posts-list.js 会扫描 posts 目录，生成 public/posts.json，vite 插件会将 posts 复制到 dist/posts。
