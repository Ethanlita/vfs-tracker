# 后端结构化日志与敏感数据边界

## 本轮范围

Issue #39 已覆盖全部会产生日志的 Lambda。十六个 Node.js CodeUri 使用同一套日志规则：

- `gemini-proxy`
- `get-song-recommendations`
- `autoApproveEvent`
- `addVoiceEvent`
- `getVoiceEvents`
- `getUserProfile`
- `updateUserProfile`
- `deleteEvent`
- `getAllPublicEvents`
- `getAvatarUrl`
- `getFileUrl`
- `getUploadUrl`
- `getUserPublicProfile`
- `getReadingPassages`
- `vfsTrackerUserProfileSetup`
- `cleanupStorage`

两个 AI 限速模块及未直接部署的共享源也使用同一日志规则。`edge-probe` 没有应用日志。Python `online-praat-analysis` 使用功能等价的 `structured_logging.py`，覆盖入口、声学分析、v2 管线、图表和 PDF 生成。

## 日志格式

`structuredLogger.mjs` 每次只写一行 JSON，固定包含 `timestamp`、`level`、`service` 和 `event`，有调用上下文时包含 `requestId`。最低级别读取 `LOG_LEVEL`，非法或缺失配置按 `INFO` 处理；SAM 的开发和生产模板均设置 `LOG_LEVEL: INFO`，AWS Lambda Advanced Logging Controls 同时设置应用级 `INFO` 和系统级 `WARN`。

Node.js 运行时记录以下可聚合信息：

- 请求方法、路由和 AWS request ID；
- 限速次数、上限、是否管理员和下次可用时间；
- 模型名、输入/输出字符数和附件数量；
- 操作结果、错误类型/错误码/HTTP 状态；
- 用户和事件 ID 的 SHA-256 前 12 位指纹。

日志器会递归清理 `authorization`、cookie、token、secret、password、API key、body、prompt、response、payload、content、email、URI、URL、文件和附件字段。以 `Count`、`Length` 或 `Size` 结尾的数字聚合字段可以保留。错误只保留 `name`、`code`、`status` 和 `retryable`；不记录 `message` 或 `stack`，因为第三方异常可能包含请求地址、模型响应或用户内容。

十六个 Node.js Lambda 具有独立 `CodeUri`，所以每个部署目录包含相同的运行时日志文件；`lambda-functions/shared/structuredLogger.mjs` 是审阅源，单元测试要求十六个部署副本逐字一致。这是打包约束，运行时仍只有 `./structuredLogger.mjs` 一条导入路径。

Python 日志额外把 session/user 标识转换为十二位 SHA-256 指纹，清理本地路径、S3 URI、对象键、文件名和报告内容。声学 F0、共振峰等个人测量值不进入日志；只保留帧数、缺失项数、分析阶段和错误类型。异步失败写入 DynamoDB 的 `errorMessage` 使用固定文本，不持久化第三方异常正文。

## 已删除的内容

- 完整 API Gateway event、来源 IP、user agent 和 Cognito identity；
- 原始用户 ID、事件 ID 和事件对象；
- Gemini 完整 prompt、原始 response 和解析失败正文；
- S3 对象键、临时路径、文件名、Gemini URI 和上传响应；
- 完整异常对象、message 和 stack。
- 资料与事件接口响应中的调试上下文、认证用户 ID 和原始异常消息。
- Python 分析中的会话 ID、S3 URI、本地音频路径、文件名、精确声学测量、异常正文和 traceback。

## 验证

Vitest 覆盖单行 JSON、级别过滤、嵌套敏感字段清理、安全聚合计数、错误最小化、标识指纹、CodeUri 副本一致性、SAM 日志配置，以及处理程序/限速模块不直接调用 `console`。事件与资料函数的既有行为测试继续覆盖分页、幂等写入、字段补丁及错误响应。Python 标准库测试覆盖单行 JSON、异常清理、指纹/计数，以及禁止重新引入 `print`、插值异常和 traceback。

本机 SAM CLI 仍不识别项目使用的 Node.js 24 runtime，因此正式 `sam build` 需要使用 `infra/README.md` 要求的新版本 SAM CLI 或交由 CI 执行。

正式镜像验证仍应在包含 `requirements.txt` 依赖的 CI 或 Docker 环境运行完整 Python pytest 套件；轻量隐私边界测试不依赖声学库，可以直接用 `python -m unittest` 执行。
