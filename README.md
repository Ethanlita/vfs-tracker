# VFS Tracker

这是一个用于记录与分析 VFS 相关语音事件的数据跟踪应用。前端基于 React + Vite，样式采用 Tailwind CSS；后端使用 AWS Serverless（Cognito、API Gateway、Lambda、DynamoDB）。

## 新增/变更亮点

- 新版水平时间轴 NewTimeline（src/components/NewTimeline.jsx）
  - 上下配对卡片，居中轴线与圆点
  - 卡片 hover 放大与阴影提升
  - 点击卡片打开详情弹窗
  - 数据源状态指示（演示/实时/加载中）
- 时间轴测试页
  - 访问 `/timeline-test` 可在隔离环境验证新时间轴的交互与样式

## 样式与 Tailwind 约定

- Tailwind 为主，尽量减少全局 CSS。仅当需要复用复杂样式时，才在 src/index.css 中通过 @layer components/ utilities 定义语义类。
- 不使用 `!important`；通过层级（@layer）与结构（isolate、z-index）保证可预期的覆盖。
- 避免在多个文件重复定义同名类。下拉菜单相关样式统一放在 src/index.css 中，已从 src/App.css 移除。
- 渐进替换 "工具类型" 自定义类（如 .nav-spacing*、.dropdown-*），改为 Tailwind 原子类；替换完成再删除定义，确保 UI 稳定。

## 本地开发

- 安装依赖：`pnpm i` 或 `npm i`
- 启动开发：`pnpm dev` 或 `npm run dev`
- 构建：`pnpm build` 或 `npm run build`

Tailwind 扫描范围见 `tailwind.config.js` 的 `content` 配置（包含 `./src/**/*.{js,ts,jsx,tsx}`）。

## 后端与架构

应用采用 AWS 无服务器架构（Cognito、API Gateway、Lambda、DynamoDB）。详情可参见 ARCHITECTURE.md。