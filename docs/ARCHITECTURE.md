# Architecture

本文件详细描述 vfs-tracker 的整体架构、目录与组件职责、数据流、以及安全与性能考量。技术与应用两层结构均涵盖。

## 1. 架构总览

- **前端**: React + Vite + Tailwind 构建的单页应用 (SPA)。
- **后端**: AWS Serverless 架构，包含两种类型的 Lambda 函数：
  - **核心服务 (Node.js Lambda)**: 用于处理事件、用户资料、认证和文件管理等核心业务逻辑。
  - **嗓音分析服务 (Python Lambda)**: 一个独立的、基于容器镜像的 Python 函数，专门负责处理计算密集型的嗓音分析任务。
- **数据库**: Amazon DynamoDB，包含 `VoiceFemEvents`, `VoiceFemUsers`, 和 `VoiceTests` 三张表。
- **文件存储**: Amazon S3，用于存储用户上传的附件、录音、生成的图表和PDF报告。
- **API 网关**: Amazon API Gateway，为所有 Lambda 函数提供统一的 RESTful API 入口。
- **认证**: AWS Cognito，负责用户身份验证和授权。
- **构建与托管**: Vite 构建静态文件 (`dist` 目录)，可托管于任何静态网站服务 (如 GitHub Pages, AWS S3, Vercel)。
- **回退策略**: 若前端在初始化时缺失必需的 AWS 环境变量，则启用“开发回退模式”，前端将使用本地 `mock_data.json` 文件并模拟文件上传，以保证开发流程的顺畅。

## 2. 目录结构与职责

- `src/`
  - `api.js`
    - **职责**: 封装所有与后端 API 的交互，并根据环境变量 `isProductionReady` 决定是发起真实请求还是返回模拟数据。
    - **核心能力**: `getAllEvents`, `getEventsByUserId`, `addEvent`, `updateUserProfile`, `getUploadUrl` 等。
    - **新增嗓音测试 API**: 
      - `createVoiceTestSession`: 初始化一个新的测试会话。
      - `getVoiceTestUploadUrl`: 为录音文件获取S3预签名上传URL。
      - `requestVoiceTestAnalyze`: 提交完整的测试会话以供后端分析。
      - `getVoiceTestResults`: 轮询以获取分析结果。
  - `utils/`
    - `attachments.js`: 提供 `resolveAttachmentLinks` 函数，用于将私有S3存储键批量解析为临时的可下载URL。
  - `components/`
    - `EventForm.jsx`: 用于创建和编辑各种事件的动态表单，支持多附件上传。
    - `InteractiveTimeline`, `EventList`, `EventManager`: 用于展示和管理事件列表的核心组件。
    - **新增嗓音测试组件**:
      - `VoiceTestWizard.jsx`: 整个嗓音测试流程的协调器和状态管理器，是功能的核心。
      - `Recorder.jsx`: 可重用的录音组件，封装了 `MediaRecorder` API。
      - `SurveyRBH.jsx`, `SurveyOVHS9.jsx`, `SurveyTVQG.jsx`: 用于步骤7的三个独立问卷组件。
      - `TestResultsDisplay.jsx`: 用于在步骤8美观地展示最终的分析结果。

## 3. 组件关系与调用

### 事件创建与附件上传 (EventForm)

1.  用户在 `EventForm.jsx` 中填写事件的基础字段和 `details` 对象。
2.  每次用户选择文件，一个 `SecureFileUpload` 实例被调用，它负责：
    -   调用 `/upload-url` API 获取一个预签名的S3 PUT URL。
    -   将文件直接上传到S3。
    -   通过回调函数 `onFileUpdate` 返回文件的元数据。
3.  `EventForm` 将返回的元数据组装成 `Attachment` 对象数组。
4.  用户提交表单时，调用 `addEvent` API，将包含 `attachments` 数组的完整事件对象发送到后端。

### 嗓音测试向导调用流程 (VoiceTestWizard)

1.  **启动**: 用户在 `MyPage.jsx` 点击“启动嗓音测试”按钮，导航到 `/voice-test` 路由，渲染 `VoiceTestWizard.jsx`。
2.  **会话初始化**: `VoiceTestWizard` 组件加载时，立即调用 `api.createVoiceTestSession` 来创建后端会话并获取 `sessionId`。
3.  **录音步骤 (Steps 1-6)**: 
    -   `VoiceTestWizard` 根据当前步骤的配置，渲染 `Recorder.jsx`。
    -   `Recorder.jsx` 完成录音后，通过 `onRecordingComplete` 回调返回 `Blob` 数据。
    -   `VoiceTestWizard` 调用 `api.getVoiceTestUploadUrl` 获取预签名URL，然后调用 `api.uploadVoiceTestFileToS3` 将文件上传。上传成功后，更新内部状态 `recordedBlobs`。
4.  **问卷步骤 (Step 7)**:
    -   `VoiceTestWizard` 渲染 `SurveyRBH`, `SurveyOVHS9`, `SurveyTVQG` 组件。
    -   用户填写问卷，通过 `onChange` 回调实时更新 `VoiceTestWizard` 中的 `formData` 状态。
5.  **结果生成与展示 (Step 8)**:
    -   用户点击“生成报告”按钮。
    -   `VoiceTestWizard` 调用 `api.requestVoiceTestAnalyze`，将 `sessionId` 和 `formData` 提交到后端。
    -   `VoiceTestWizard` 进入轮询模式，反复调用 `api.getVoiceTestResults`。
    -   当API返回 `status: 'done'` 时，停止轮询，并将完整的 `results` 对象传递给 `TestResultsDisplay.jsx` 组件进行渲染。

## 4. 数据流序列

### 事件创建（多附件版本）

(此部分保留不变)

### 嗓音测试与分析数据流

这是一个异步、解耦的流程，旨在处理可能耗时较长的分析任务。

1.  **启动会话**: 前端 `POST /sessions` -> API Gateway 触发核心服务 Lambda -> 在 `VoiceTests` 表中创建一条状态为 `pending` 的记录，并返回 `sessionId`。
2.  **上传音频**: 对每个录音，前端 `POST /uploads` 获取预签名 URL -> 前端使用 `PUT` 方法将音频文件直接上传到 S3 的指定路径 (`voice-tests/{userOrAnonId}/{sessionId}/raw/{step}_{index}.wav`)。
3.  **提交分析**: 用户完成所有步骤后，前端 `POST /analyze`，请求体包含 `sessionId` 和完整的 `forms` 数据。
4.  **任务分派 (解耦)**: 
    -   `/analyze` 端点由核心服务 Lambda 处理。该函数接收请求后，将一个包含 `sessionId` 的消息发送到 Amazon SQS 队列（或通过异步方式直接调用分析函数）。
    -   该函数不等待分析完成，而是立即向前端返回 `202 Accepted` 响应，表示任务已接收。
5.  **执行分析 (Python Lambda)**: 
    -   一个独立的 **Python 分析 Lambda** (配置为 SQS 队列的触发器或被异步调用) 被唤醒。
    -   Lambda 从 S3 下载该 `sessionId` 下的所有原始音频文件。
    -   使用 `parselmouth`, `numpy`, `scipy` 等库进行声学计算 (F0, Jitter, Shimmer, HNR, VRP, etc.)。
    -   使用 `matplotlib` 生成图表 (PNG格式) 并上传到 S3 的 `artifacts` 目录。
    -   使用 `reportlab` 或类似库渲染最终的 PDF 报告，并上传到 S3。
    -   将计算出的 `metrics` 对象和 `artifacts` 的 S3 链接更新到 `VoiceTests` 表中对应的会话记录，并将 `status` 设置为 `done`。
6.  **获取结果**: 与此同时，前端在收到 `202 Accepted` 响应后，开始轮询 `GET /results/{sessionId}` 端点。该端点直接查询 `VoiceTests` 表。直到 `status` 变为 `done`，前端获取完整的 `metrics` 和 `artifacts` 数据并进行展示。

## 5. 安全设计

- **S3 访问控制**: S3 存储桶配置为完全私有。所有对 S3 的读写操作都必须通过后端生成的、具有短暂生命周期的预签名 URL 进行。这确保了只有经过授权的用户才能访问或上传文件。
- **API 认证与授权**: 除公共看板 (`/all-events`) 外，所有 API 端点都通过 API Gateway 与 Cognito Authorizer 集成，要求在请求头中提供有效的 JWT。Lambda 函数内部会进一步校验 `userId`，确保用户只能访问自己的数据。

## 6. 部署拓扑

- **前端**: 静态站点 (GitHub Pages/Netlify/Vercel/Cloudflare Pages)。
- **后端**: AWS Serverless
  - **Amazon Cognito**: 用户池，用于用户注册、登录和身份管理。
  - **Amazon API Gateway (REST)**: 统一的 API 入口，处理路由、认证和请求校验。
  - **AWS Lambda**:
    - **Node.js Functions**: 用于处理用户、事件、认证等轻量级、I/O 密集型任务。以 `.zip` 文件格式部署。
    - **Python Function (Container Image)**: 用于处理嗓音分析。该函数在 Docker 容器中运行，包含了 `praat-parselmouth`, `numpy`, `scipy`, `matplotlib` 等大型科学计算库。通过 ECR (Elastic Container Registry) 进行部署。
  - **Amazon DynamoDB**: 三张表 (`VoiceFemEvents`, `VoiceFemUsers`, `VoiceTests`)，提供持久化存储。
  - **Amazon S3**: 用于存储所有用户上传的二进制文件和系统生成的报告。
  - **Amazon SQS (可选但推荐)**: 用于解耦 `/analyze` API 请求和长时间运行的分析任务，提高系统的鲁棒性和响应速度。
- **环境变量 (在托管平台侧配置)**
  - `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_ENDPOINT`, `VITE_S3_BUCKET`（全部配置齐全才视为生产模式）
  - `VITE_GOOGLE_GEMINI_API` (可选)

## 7. 未来演进建议

- 在 `attachments` 元素增加 `size`, `checksum` (完整性校验) 字段。
- 支持附件类型预分类（如 `report` / `audio` / `raw-recording`）。
- 提供批量删除事件时自动清理 S3 对象的后台任务。
- 为嗓音测试功能增加外部校准流程，允许用户通过输入已知声源的 SPL 值来校准录音的绝对声压级。
