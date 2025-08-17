# Architecture

本文件详细描述 vfs-tracker 的整体架构、目录与组件职责、数据流、以及安全与性能考量。技术与应用两层结构均涵盖。

## 1. 架构总览

- 前端：React + Vite + Tailwind 的静态 SPA
- 后端（可选）：AWS Serverless（Cognito 鉴权，API Gateway + Lambda 提供 REST API，DynamoDB 存储事件，S3 存储附件）
- 构建与托管：Vite 构建到 dist；可托管于 GitHub Pages/任意静态平台；CNAME 已配置；vite.config.js base:'/'
- 回退策略：若缺失必需环境变量，则启用“开发回退模式”，前端使用本地模拟数据与假上传

## 2. 目录结构与职责

- src/
  - api.js
    - 对接 Amplify API/Storage；提供 isProductionReady() 检查
    - 核心能力：getAllEvents、getEventsByUserId、addEvent、uploadFile、getEncouragingMessage
    - 在未就绪时读取本地 mock_data.json、模拟上传、返回默认 AI 文案
  - components/
    - PublicDashboard.jsx
      - 汇总匿名数据、事件类型分布柱状图、VFS 对齐的多用户基频折线图
      - 统计平均提升/方差/二倍方差；用户列表与抽屉式档案
    - EventForm.jsx
      - 动态表单按事件类型渲染字段；遵循数据契约
      - 调用 uploadFile（生产环境 S3）、addEvent（API）
    - Timeline.jsx
      - 个人时间轴与图表（Chart.js）；可结合 getEventsByUserId
    - PostList.jsx / PostViewer.jsx / PostsDropdown.jsx
      - 帖子列表与查看，依赖构建阶段生成的 public/posts.json 与复制到 dist/posts 的静态内容
- scripts/generate-posts-list.js
  - 在 dev/prebuild 阶段扫描 posts 目录，生成 public/posts.json
- vite.config.js
  - 自定义插件在构建后复制 posts 到 dist/posts；base 设置为 '/'
- docs/data_structures.md
  - 数据契约单一来源；前后端需严格遵循（禁止修改）

## 3. 组件关系与调用

- EventForm.jsx -> src/api.js
  - addEvent(eventData,userId) 提交事件
  - uploadFile(file,userId) 上传附件（生产）或返回模拟 key（开发）
- Timeline.jsx -> src/api.js
  - getEventsByUserId(userId) 拉取个人事件时间序列
- PublicDashboard.jsx -> src/api.js
  - getAllEvents() 拉取汇总事件
  - 本地不足时会调用 generateMockEvents() 生成演示数据
- AI 提示：Timeline 或页面逻辑 -> getEncouragingMessage(userData)
  - 生产环境需 VITE_GOOGLE_GEMINI_API；否则回退默认文案

## 4. 数据流序列（简化）

- 事件创建（EventForm）
  1) 用户在 EventForm 选择 type 并填写 details（契约见 docs/data_structures.md）
  2) 可选上传文件：uploadFile -> S3（生产）/返回模拟 key（开发）
  3) addEvent -> API Gateway -> Lambda -> DynamoDB 写入（生产）；开发模式直接返回拼装的 item

- 个人时间轴（Timeline）
  1) getEventsByUserId(userId) 从 API（生产）或 mock_data.json（开发）获取事件
  2) 前端按日期归并/排序，生成 Chart.js 数据集

- 公共仪表板（PublicDashboard）
  1) getAllEvents() 获取全体匿名事件（生产/开发）
  2) 计算类型分布、按用户聚合，提取含 pitch 的点相对 hospital_test（VFS=0）对齐
  3) 统计平均提升与方差，渲染柱状图/折线图/统计卡片/用户抽屉

## 5. 数据契约

- 文件：docs/data_structures.md（禁止修改）
- 含：User、Profile、SocialAccount、Event 基础结构；各 Event.type 的 details 规范（如 self_test、hospital_test、voice_training、self_practice、surgery、feeling_log）
- 前后端必须兼容该契约。若演进：仅新增字段、保持向后兼容；避免删除/重命名现有字段

## 6. 安全设计

- 鉴权/授权（生产）
  - Cognito User Pools 提供用户目录；Amplify 自动附带 JWT 到 API 请求
  - S3 使用私有桶与临时权限（Amplify Storage），按用户“文件夹”分隔
- API
  - API Gateway + Lambda 层将前端与数据库解耦，限制直接访问
  - 仅暴露必要端点：POST /events、GET /events/{userId}、GET /all-events
- 数据
  - 公开仪表板仅使用匿名化聚合数据；用户详情抽屉只显示最小必要信息
  - 客户端在生产前端打包时不泄露私钥，仅注入必要 VITE_* 环境变量

## 7. 性能与可用性

- 构建优化
  - Vite 生产模式按需打包；vite 插件复制 posts；public 目录自动拷贝
- UI 性能
  - Chart.js 注册子模块以减小体积；折线图 parsing:false 以使用 {x,y} 原生点
  - useMemo/useEffect 控制计算与渲染
- 数据回退
  - isProductionReady() 控制真实调用/模拟数据，确保开发/演示可用
  - PublicDashboard 在数据不足时生成额外演示用户，保障图表展示

## 8. 部署拓扑

- 前端：静态站点（GitHub Pages/Netlify/Vercel/Cloudflare Pages）
- 后端：AWS（可选）
  - Cognito（User Pool）
  - API Gateway（REST） -> Lambda（Node.js）
  - DynamoDB（事件存储，分区键 userId，排序键 eventId）
  - S3（附件）
- 环境变量（托管平台侧）
  - VITE_COGNITO_USER_POOL_ID、VITE_COGNITO_USER_POOL_WEB_CLIENT_ID、VITE_AWS_REGION（必需）
  - VITE_GOOGLE_GEMINI_API（可选）

## 9. 未来演进建议

- 后端为事件字段新增 schema 验证与版本化策略（保持向后兼容）
- 引入分页/增量加载，优化仪表板大数据集时的首次渲染
- 增加 E2E 测试（Playwright）与可观测性（前端埋点、API 指标）
