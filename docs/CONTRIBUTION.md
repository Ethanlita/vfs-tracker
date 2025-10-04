# Contribution Guide

感谢你为 VFS Tracker 做出贡献！本指南旨在帮助你快速上手，并在协作中保持一致的代码质量与风格。请在提交改动前通读本文件。

## 1. 基本原则

- 数据契约优先：严禁修改 docs/data_structures.md 中既有字段的含义或名称。如需演进仅可新增后向兼容字段。
- 渐进改进：小步提交、原子变更；清晰的 PR 描述与对齐的测试/验证步骤。
- 可读性与一致性：遵循本文档的编码规范、命名与布局规则。

## 2. 技术栈与工具

- 前端：React + Vite + Tailwind CSS
- 图表：chart.js + react-chartjs-2
- 云端（可选）：API Gateway, AWS Lambda, Amazon DynamoDB, Amazon S3
- 代码质量：ESLint（eslint.config.js）

## 3. 代码风格与约定

### 3.1 JavaScript/React
- 使用函数式组件与 React Hooks（useState/useEffect/useMemo/useCallback 等）。
- 避免在渲染期间创建不必要的对象与函数；按需使用 useMemo/useCallback。
- 组件职责单一、拆分合理；将数据处理逻辑提取为纯函数以便测试。
- Props/State 命名清晰，布尔值以 is/has/can 开头。

### 3.2 Lambda 函数 (Node.js & Python)
- **文档**: 所有函数处理程序和公共的辅助函数都必须有完整的中文 JSDoc 或 Python Docstring 文档。
- **结构**: 每个 Lambda 函数都应位于 `lambda-functions/` 下的独立子目录中。

### 3.2 命名与文件布局
- 组件文件：PascalCase（例如 PublicDashboard.jsx, EventForm.jsx）。
- 工具/API 文件：camelCase（api.js, generatePostsList.js）。
- 目录按功能分层：components、hooks、utils、api 等；避免巨石文件。
- 每个文件导出一个默认主组件/主函数，必要时再导出具名子单元。

### 3.3 Tailwind CSS 约定
- 以原子类为主；仅在需要复用复杂样式时使用 src/index.css 的 @layer components/utilities 定义语义类。
- 避免使用 !important；通过层级与结构控制覆盖关系。
- 尽量减少全局样式；避免在多个文件重复定义同名类。
- 组件内 className 从通用到细节排序，便于阅读（布局 -> 间距 -> 边框 -> 颜色 -> 状态）。

### 3.4 无障碍与可用性
- 表单元素确保 label 对应，键盘可达；交互控件添加 focus 样式。
- 图表提供简要文本解释与空状态占位文案。

## 4. 提交与分支策略

### 4.1 提交信息（Conventional Commits）
- 格式：<type>(scope): <subject>
- 常用类型：
  - feat: 新功能
  - fix: 修复缺陷
  - docs: 文档改动
  - style: 代码风格（不影响逻辑）
  - refactor: 重构（非修复/非新功能）
  - perf: 性能优化
  - test: 测试相关
  - build/chore: 构建或杂项
- 示例：
  - feat(dashboard): add aligned f0 multi-user line chart
  - fix(api): handle upload contentType and log errors
  - docs(readme): explain isProductionReady and env vars

### 4.2 分支模型
- main 分支：始终可发布。保护分支，必须通过 PR 合并。
- feature/*：特性开发分支（如 feature/timeline-zoom）。
- fix/*：缺陷修复分支（如 fix/s3-content-type）。
- docs/*：文档类分支。

## 5. Pull Request 流程

- 自查清单：
  - 代码通过 `npm run lint`（若启用 lint 规则）。
  - 自测通过（包含开发与“生产就绪”两种模式下的关键路径）。
  - 不破坏 docs/data_structures.md 定义的数据契约。
  - README/ARCHITECTURE/注释已更新（如涉及行为变化）。
  - UI 变更附前后截图或简要描述。
- PR 描述包含：
  - 变更动机与范围
  - 技术实现要点
  - 风险与回退方案
  - 验证步骤（如何复现/验证）

## 6. 开发与验证流程

1) 安装依赖：`npm i` 或 `pnpm i`
2) 开发模式：`npm run dev`（不配置云端变量也可运行，使用模拟数据）
3) 生产就绪校验：配置以下**所有**必需变量后，重新运行/构建以验证真实调用：
   - `VITE_COGNITO_USER_POOL_ID`
   - `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`
   - `VITE_AWS_REGION`
   - `VITE_API_ENDPOINT`
   - `VITE_S3_BUCKET`
   - `VITE_GOOGLE_GEMINI_API` (可选, 用于 AI 相关功能)
4) 构建：`npm run build`（会复制 posts 与 public，产出 dist）
5) 预览：`npm run preview`

## 7. 安全与隐私
- 提供最小化公开信息。公开仪表板仅呈现匿名聚合数据。
- 禁止提交包含机密的配置/密钥；以 VITE_* 环境变量在部署平台注入。
- 附件在生产环境存储于私有 S3 桶，上传/下载均通过临时授权。

## 8. 代码评审关注点
- 是否遵守数据契约与 Tailwind 约定。
- 是否存在不必要的重渲染与昂贵计算，可否 useMemo/useCallback。
- 错误处理与空状态是否完备（加载、无数据、异常 UI）。
- 日志是否合规且不泄露敏感信息。
- 文档与注释是否同步更新。

## 9. 联系方式
- 如有问题，欢迎提交 Issue 或 PR。感谢你的贡献！
- 如果你没有使用git的经验（或者根本就不是程序员），也可以直接联系丽塔：lita@ethanlita.com
