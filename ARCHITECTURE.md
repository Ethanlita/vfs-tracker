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
  - utils/attachments.js
    - 现已提供 `resolveAttachmentLinks(attachments)`：批量解析私有存储 key -> 临时可下载 URL
  - components/
    - EventForm.jsx
      - 动态表单；支持多附件（`attachments` 数组），使用多个 SecureFileUpload 实例；表单提交时顶层携带 `attachments`
    - InteractiveTimeline / EventList / EventManager 等
      - 使用 `resolveAttachmentLinks` 将每个 attachment 的 `fileUrl`（内部key）转换为临时访问 URL（新增 `downloadUrl`）

## 3. 组件关系与调用（更新后）

- EventForm.jsx -> SecureFileUpload x N -> (获取 fileKey, presigned 访问URL) -> 组装 Attachment 对象：
  ```json
  { "fileUrl": "attachments/<userId>/<...>.png", "fileType": "image/png", "fileName": "original.png" }
  ```
  -> addEvent({ type, date, details, attachments })
- 私有事件读取：getEventsByUserId -> 返回包含 attachments 数组
- 公共事件读取：getAllEvents -> (Lambda 端剥离 attachments) -> 前端无该字段

## 4. 数据流序列（多附件版本）

### 事件创建（多附件）
1. 用户在 EventForm 填写基础字段与 details。
2. 每次选择文件：SecureFileUpload 执行：
   - 调用 `/upload-url` 获取 PUT 预签名URL
   - 上传文件到 S3 (key: `attachments/{userId}/{timestamp}_{originalName}`)
   - 回调 onFileUpdate(fileUrl[临时访问], fileKey, meta)
3. EventForm 将 meta 转换为 Attachment（以 fileKey 作为 attachment.fileUrl 内部存储引用）。
4. 调用 addEvent -> POST /events -> Lambda addVoiceEvent 写入 DynamoDB (attachments list + details)。
5. DynamoDB Stream 触发 auto-approve-event：
   - 非 hospital_test -> 直接 Approved
   - hospital_test -> 选取第一个附件(或符合规则的) 验证 -> 更新状态

### 附件访问
- 私有页面渲染时：调用 resolveAttachmentLinks(attachments)
  - 为每个 attachment.fileUrl (S3 key) 获取临时访问 URL（或开发模式直接回传 key）
  - 返回增强数组：[{...attachment, downloadUrl}]

## 5. 数据契约（与 docs/data_structures.md 保持单一来源）
- `attachments: Array<Attachment>` 顶级字段；公共接口不返回。

## 6. 安全设计（更新）
- S3 Key 仅存储在 DynamoDB；公共接口剥离 attachments 避免泄露私密文件元信息。
- 访问附件必须在私有上下文里通过 Storage / file-url 重新获取临时签名 URL。

## 7. 性能与可用性
- 多附件解析批量化：`resolveAttachmentLinks` 并发 Promise.all。
- 仅在需要展示时解析；避免加载列表时即批量请求所有预签名 URL（可后续懒加载）。

## 8. 部署拓扑（未变）

- 前端：静态站点（GitHub Pages/Netlify/Vercel/Cloudflare Pages）
- 后端：AWS（可选）
  - Cognito（User Pool）
  - API Gateway（REST） -> Lambda（Node.js）
  - DynamoDB（事件存储，分区键 userId，排序键 eventId）
  - S3（附件）
- 环境变量（托管平台侧）
  - VITE_COGNITO_USER_POOL_ID、VITE_COGNITO_USER_POOL_WEB_CLIENT_ID、VITE_AWS_REGION（必需）
  - VITE_GOOGLE_GEMINI_API（可选）

## 9. 未来演进建议（新增）
- 在 attachments 元素增加 `size`, `checksum` (完整性校验) 字段
- 支持附件类型预分类（如 report / audio / raw-recording）
- 提供批量删除事件时自动清理 S3 对象的后台任务
