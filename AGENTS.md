# Agent Notes / 代理说明

## 基本原则 / General Principles
- **验证双模式 / Verify Both Modes**: 确保任何修改在开发和生产模式下都能正常工作。最后你应该尽量进行端到端的测试。
- **全面测试 / Comprehensive Testing**: 为所有新功能或错误修复实现详细的单元测试和视觉测试。
- **善用工具 / Resourcefulness**: 有效利用可用工具。当不确定如何实现时，请查阅相关文档。
- **文档同步 / Documentation Sync**: 对代码的任何修改都必须同步更新相关文档。
- **完整注释**: 修改时一定要同时添加规范的docstring和中文注释，不要单独删除原有的注释。（除非是原本的代码也被一起删除了）

## 项目约定 / Project Conventions
- **开发模式 / Development Mode**: 开发模式的检测依赖于 AWS 环境变量的完整性。缺少任一必需变量时，`isProductionReady` 会返回 `false` 并触发开发模式逻辑。
- **必需变量 / Mandatory Variables**: 这些配置必须全部存在，应用才会按生产模式执行真实云端请求：`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_ENDPOINT`, `VITE_S3_BUCKET`。
- **错误处理 / Error Handling**: 本项目的错误处理约定整理在 `docs/error-handling-guide.md`，涉及构造函数、上下文、工具方法与双语示例，修改 `src/utils/apiError.js` 或相关测试前请先阅读。

## Lambda 函数 / Lambda Functions
- **文档标准 / Documentation Standard**: `lambda-functions/` 目录下的所有 Lambda 函数都必须有完整的中文 JSDoc 或 Python Docstring 文档。文档应清晰说明文件、函数、参数和返回值的用途。
- **结构约定 / Structural Convention**: 每个 Lambda 函数都位于其独立的子目录中，例如 `lambda-functions/addVoiceEvent/`。该目录应包含 `index.mjs` (或 `handler.py`) 以及任何必要的配置文件，如 `package.json`。
- **功能多样性 / Functional Diversity**: 这些函数处理各种后端任务，包括但不限于：
    - **API 网关处理程序**: 响应前端的 HTTP 请求 (例如, `getUserProfile`, `getUploadUrl`)。
    - **异步任务与触发器**: 由 S3 事件或 DynamoDB 流触发的后台进程 (例如, `autoApproveEvent`)。
    - **外部服务集成**: 与第三方 API（如 Google Gemini）交互 (例如, `gemini-proxy`, `get-song-recommendations`)。
  
## 前端组件
- **样式**: 注意UI的美观，创建和修改页面组件时要确保其外观风格和这个项目中其他地方一致。样式要符合Tailwind CSS的最佳实践。