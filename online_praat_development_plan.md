### Online Praat 功能开发计划

---

#### 0. 添加 Mock 数据

*   **目标**: 为前端开发和测试提供模拟数据。
*   **位置**: 在项目中创建或扩充 `src/mock_data/` 目录。
*   **文件**: 创建 `voiceTestResults.json`。
*   **内容**:
    *   根据 `online_praat_detailed_plan.md` 中定义的 `GET /results/{sessionId}` API 的成功 (`status: 'done'`) 返回值，创建一个完整的 JSON 对象。
    *   应包含 `metrics` (及其所有子对象 `sustained`, `vrp`, `reading`, `spontaneous`), `charts` (使用占位符 URL), 和 `reportPdf` (使用占位符 URL) 的模拟数据。
    *   创建另一个表示正在处理状态的模拟响应 (`status: 'processing'`)。

---

#### 1. 前端开发 (React)

*   **目标**: 实现完整的用户交互界面和业务逻辑，在开发模式下对接 Mock 数据。
*   **分支**: 创建一个新的 feature 分支, 例如 `feature/online-praat`。

*   **步骤**:
    1.  **路由设置**:
        *   在 `App.jsx` 或相应的路由配置文件中，添加一个新的路由，例如 `/voice-test`，并将其指向新的 `<VoiceTestWizard/>` 组件。
    2.  **入口点**:
        *   修改 `src/components/MyPage.jsx`，在“管理资料”按钮旁边添加一个新的“启动嗓音测试”按钮。
        *   使用 `react-router-dom` 的 `Link` 或 `useNavigate`，使该按钮导航到 `/voice-test`。
    3.  **API 层 (`src/api.js` 或 `src/api/voiceTest.js`)**:
        *   实现 `online_praat_detailed_plan.md` 中定义的 API 调用函数: `createSession`, `getUploadUrl`, `putToS3`, `requestAnalyze`, `getResults`。
        *   **模式切换**: 使用 `import.meta.env.MODE` (Vite 环境变量) 来区分生产和开发模式。
            *   **生产模式 (`isProductionReady == true`)**: 函数应执行真实的 `fetch` 请求到 API Gateway 端点。
            *   **开发模式 (`isProductionReady != true`)**: 函数应返回 `Promise`，resolve 的值为 `mock_data/voiceTestResults.json` 中的模拟数据，以模拟 API 调用。`putToS3` 可以模拟一个成功的 `Promise`。
    4.  **核心向导组件 (`src/components/VoiceTestWizard.jsx`)**:
        *   使用 `useState` 或 `useReducer` 管理向导的状态，包括 `currentStep`, `sessionId`, `recordedBlobs`, `analysisStatus`, `results` 等。
        *   在组件加载时调用 `api.createSession()`。
        *   根据 `currentStep` 渲染不同的子组件（校准、MPT、滑音等）。
        *   实现 `requestAnalyze` 和轮询 `getResults` 的逻辑。
    5.  **录音组件 (`src/components/Recorder.jsx`)**:
        *   使用 Web Audio API (`MediaRecorder`) 进行录音。
        *   提供开始/停止按钮，并将录制的 `Blob` 通过回调函数传递给父组件 `<VoiceTestWizard/>`。
        *   将 `audioStream` 传递给 `<LiveMeters/>`。
    6.  **实时反馈组件 (`src/components/LiveMeters.jsx`)**:
        *   接收 `audioStream`，使用 `AnalyserNode` 计算实时音量 (电平) 和基频 (F0)，并进行可视化展示。
    7.  **问卷组件**:
        *   创建 `<SurveyRBH.jsx>`, `<SurveyOVHS9.jsx>`, `<SurveyTVQG.jsx>`。
        *   每个组件都是一个受控表单，将其状态提升到 `<VoiceTestWizard/>`。
    8.  **结果展示组件**:
        *   创建 `<Charts.jsx>`，接收图表 URL 并渲染 `<img>` 标签。
        *   创建 `<ReportViewer.jsx>`，提供一个链接用于下载或在新标签页打开 PDF 报告。
    9.  **样式**:
        *   所有新组件都应使用 Tailwind CSS，并确保其外观、颜色、间距等与项目现有 UI 风格保持一致。

---

#### 1.5. 更新项目文档 (前端部分)

*   **目标**: 确保文档与代码实现同步。
*   **文件**:
    *   `README.md`: 如果适用，添加关于如何启动和使用新嗓音测试功能的简要说明。
    *   在 `src/components/` 目录下为新的复杂组件 (如 `VoiceTestWizard.jsx`) 添加 `README.md` 或 JSDoc 注释，解释其 props 和功能。

---

#### 2. 前端测试

*   **目标**: 确保前端逻辑的正确性和 UI 的健壮性。
*   **自动化测试**:
    *   **单元测试 (Vitest/Jest)**:
        *   测试 `api.js` 中的 mock 数据返回逻辑。
        *   测试 `<VoiceTestWizard/>` 中状态管理的 reducer (如果使用)。
        *   测试问卷计分等纯函数逻辑。
*   **手动测试清单**:
    *   **浏览器兼容性**: 在 Chrome, Firefox, Safari (如果可能) 上测试录音功能。
    *   **向导流程**:
        *   完整地走一遍向导流程，确保每一步都能正确录音、重录和进入下一步。
        *   跳过可选的问卷步骤。
        *   完成所有步骤并提交分析。
    *   **结果展示**: 确认在分析“完成”后，模拟的图表和报告链接能正确显示。
    *   **响应式设计**: 检查在不同屏幕尺寸下（手机、平板、桌面）的布局是否正常。
    *   **错误处理**: 模拟 API 返回错误，检查 UI 是否有相应的提示。

---

#### 3. 后端开发 (AWS Lambda)

*   **目标**: 实现所有后端 API 和核心声学分析逻辑。
*   **位置**: 在 `lambda-functions/` 下创建一个新目录，例如 `online-praat-analysis`。
*   **步骤**:
    1.  **项目初始化**:
        *   在该目录下创建一个 Python 项目。
        *   创建 `requirements.txt`，并包含所有依赖: `boto3`, `numpy`, `scipy`, `librosa`, `soundfile`, `webrtcvad`, `matplotlib`, `praat-parselmouth`, `reportlab` (或用于PDF生成的其他库)。
    2.  **Dockerfile**:
        *   创建 `Dockerfile`，基于 `public.ecr.aws/lambda/python:3.13`。
        *   安装系统依赖 (如 `libsndfile`)，然后 `pip install -r requirements.txt`。
        *   将应用代码复制到镜像中。
    3.  **API 处理程序 (`handler.py`)**:
        *   创建一个主处理函数，根据 API Gateway 传入的 `event` 中的路由 (`rawPath`) 来分发请求到不同的处理函数。
        *   实现 `handle_create_session`, `handle_get_upload_url`, `handle_analyze`, `handle_get_results` 函数。
    4.  **核心分析逻辑 (`analysis.py`)**:
        *   实现 `online_praat_detailed_plan.md` 中定义的各个分析函数，如 `analyze_sustained_wav`, `analyze_speech_flow` 等。
        *   **详细日志**: 在每个关键步骤（如：文件读取、指标计算、图表生成、数据库写入）都使用 Python 的 `logging` 模块记录详细日志，包括 `sessionId` 和文件名，以便于在 CloudWatch 中追踪和排查问题。
        *   例如: `logger.info(f"Session {sessionId}: Starting analysis for {s3_key}")`。
    5.  **图表与PDF生成 (`artifacts.py`)**:
        *   **图表**: 使用 `matplotlib` 生成时序图、VRP 图等，并将其保存为 `BytesIO` 对象以便上传 S3。
        *   **PDF**: 使用 `reportlab` 或其他库，根据分析结果动态生成 PDF 报告。
    6.  **IAM 权限**:
        *   在 AWS IAM 中为 Lambda 函数创建一个执行角色，授予其对 S3 存储桶的读写权限、对 `VoiceTests` DynamoDB 表的读写权限，以及写入 CloudWatch Logs 的权限。

---

#### 4. 更新项目文档 (后端部分)

*   **目标**: 记录后端服务的部署和配置细节。
*   **文件**:
    *   在 `lambda-functions/online-praat-analysis/` 目录下创建 `README.md`。
    *   **内容**:
        *   功能描述。
        *   部署步骤（如何构建 Docker 镜像，推送到 ECR，创建 Lambda 函数）。
        *   所需的环境变量 (如 `DDB_TABLE`, `BUCKET`)。
        *   API Gateway 的配置摘要。
        *   IAM 角色的权限要求。

---

#### 5. 后端测试

*   **目标**: 确保后端服务在各种输入下都能正确工作。
*   **自动化测试 (Pytest)**:
    *   为 `analysis.py` 中的每个核心分析函数编写单元测试。
    *   使用本地的 `.wav` 测试文件作为输入。
    *   使用 `moto` 库来 mock `boto3` 对 AWS S3 和 DynamoDB 的调用。
    *   断言计算出的指标在预期范围内。
*   **手动集成测试 (Postman/curl)**:
    1.  部署 Lambda 和 API Gateway 到一个测试环境。
    2.  **Step 1**: 发送 `POST /sessions` 请求，获取 `sessionId`。
    3.  **Step 2**: 发送 `POST /uploads` 请求，获取预签名 URL。
    4.  **Step 3**: 使用 `curl` 或 Postman，用 `PUT` 方法和预签名 URL 上传一个测试 `.wav` 文件。
    5.  **Step 4**: 发送 `POST /analyze` 请求，触发分析。
    6.  **Step 5**: 监控 CloudWatch Logs，检查是否有错误，并确认日志输出符合预期。
    7.  **Step 6**: 轮询 `GET /results/{sessionId}`，直到 `status` 变为 `done`。
    8.  **Step 7**: 验证返回的 JSON 数据结构是否正确。
    9.  **Step 8**: 检查 S3 存储桶，确认图表和 PDF 文件已生成。
    10. **Step 9**: 检查 DynamoDB 表，确认该会话的数据已正确写入。

---

#### 6. 前后端联调

*   **目标**: 确保前后端系统能无缝协作。
*   **步骤**:
    1.  将前端应用的 API 地址指向部署好的后端 API Gateway。
    2.  完整地执行一次用户流程：从点击“启动嗓音测试”按钮开始，到最后查看生成的报告。
    3.  **排查问题**:
        *   **CORS**: 解决跨域资源共享问题。
        *   **数据格式**: 检查前后端交互的数据格式是否完全匹配。
        *   **认证/授权**: 确保前端传递的用户身份信息能被后端正确解析和使用。
        *   **错误处理**: 模拟后端返回错误，检查前端是否能优雅地处理并向用户显示提示。

---

#### 7. 上线

*   **目标**: 将功能发布到生产环境。
*   **步骤**:
    1.  将 Lambda 和 API Gateway 部署到生产环境。
    2.  将前端 `feature/online-praat` 分支合并到主分支。
    3.  触发生产环境的前端部署流程 (例如，GitHub Actions 部署到 GitHub Pages)。
    4.  在生产环境 (`vfs-tracker.app`) 进行最终的健全性测试 (smoke test)，确保核心功能正常。
    5.  在 `TODOList.md` 中将整个任务3标记为完成。

---

| HTTP Method | Resource Path | 描述 | 
| :--- | :--- | :--- | 
| POST | /sessions | 创建嗓音测试会话：这是整个流程的第一步，用于生成一个唯一的 sessionId。 | 
| POST | /uploads | 获取上传URL：为客户端（前端）提供一个安全的、预签名的 S3 URL，以便上传单个音频文件。 | 
| POST | /analyze | 触发分析：在所有文件上传完毕后，客户端调用此端点来启动后端的分析流程。 | 
| GET | /results/{sessionId} | 获取分析结果：客户端通过此端点轮询，以检查分析状态并获取最终的 metrics 和图表/报告链接。 |