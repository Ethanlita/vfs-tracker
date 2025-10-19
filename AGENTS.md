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

## 测试框架 / Testing Framework
- **测试技术栈 / Testing Stack**: 
  - **Vitest**: 测试运行器,使用 jsdom 环境模拟浏览器 DOM
  - **React Testing Library**: React 组件测试
  - **MSW (Mock Service Worker)**: 网络级请求拦截和模拟
  - **Joi**: Schema 定义和数据验证
  
- **测试类型 / Test Types**:
  - **单元测试 / Unit Tests** (`tests/unit/`): 测试独立函数、schema 验证
    - 运行: `npm run test:unit`
    - 所有单元测试应该通过 ✅
  - **集成测试 / Integration Tests** (`tests/integration/`): 测试 API 和组件的完整流程
    - 运行: `npm run test:integration`
    - ⚠️ 部分失败是预期的 - 这些测试定义了 Phase 3.2 的重构规范
  - **契约测试 / Contract Tests** (`tests/contract/`): 验证真实 API 遵守数据契约
    - 运行: `npm run test:contract`
    - ⚠️ 需要完整的 AWS 环境变量配置（见 `docs/CONTRACT_TEST_ENVIRONMENT.md`）
    - ⚠️ `.env.contract` 中的测试账户是**真实有效的**，不是占位符！

- **Schema 定义 / Schema Definitions** (`src/api/schemas.js`):
  - 使用 Joi 定义所有数据结构
  - Schemas 是整个项目的数据契约,必须先更新 schemas 再修改 API
  - 包括: User, Profile, Event (所有类型), API Responses
  - 提供 `validateData(data, schema)` 辅助函数

- **测试数据 / Test Fixtures** (`src/test-utils/fixtures/`):
  - **用户 fixtures**: complete-profile, minimal-profile, public-profile, private-profile
  - **事件 fixtures**: self-test (complete, minimal), surgery, feeling-log 等
  - 所有 fixtures 必须符合对应的 schema 定义
  - 中央导出: `import { fixtures } from 'src/test-utils/fixtures'`

- **MSW Handlers** (`src/test-utils/mocks/msw-handlers.js`):
  - 定义了 9 个 API 端点的 mock handlers
  - 在测试中自动拦截网络请求
  - 可以在单个测试中使用 `server.use()` 覆盖默认行为

- **编写测试的规则 / Test Writing Rules**:
  1. **新功能必须有测试**: 添加新 API 或组件时,同时创建对应的测试
  2. **Schema 先行**: 先在 `schemas.js` 中定义数据结构,然后编写验证测试
  3. **使用 fixtures**: 不要在测试中手动构造测试数据,使用或创建 fixtures
  4. **测试独立性**: 每个测试应该独立运行,不依赖其他测试的状态
  5. **描述性命名**: 测试名称应该清楚描述测试的场景和预期结果
  6. **AAA 模式**: Arrange (准备) → Act (执行) → Assert (断言)
  7. **全局对象清理**: 修改全局对象（如 `window.innerWidth`）时,使用 `beforeEach/afterEach` 恢复原始值
  8. **测试行为而非实现**: 不要测试 `console.log` 输出、内部状态或性能计时
  9. **避免不稳定的测试**: 不使用 `performance.now()` 进行时间断言,不依赖测试执行顺序

- **测试工具函数 / Test Utilities**:
  - `src/test-utils/test-helpers.js`: 通用测试辅助函数
  - `src/test-utils/custom-render.jsx`: React 组件渲染包装器
  - `src/test-utils/mocks/amplify-auth.js`: Amplify Auth mock

- **重要文档 / Important Docs**:
  - 📖 [测试架构与工作流程](docs/TESTING_ARCHITECTURE.md) - **三层防御体系**和 Schema 驱动开发完整说明
  - 📖 [完整测试指南](docs/TESTING_GUIDE.md) - 详细的测试编写和运行指南
  - 📖 [契约测试说明](tests/contract/README.md) - 契约测试最佳实践
  - 🔒 [契约测试环境配置](docs/CONTRACT_TEST_ENVIRONMENT.md) - **真实测试环境详情** (重要！)
  - 📊 [Phase 3.1 状态报告](tests/PHASE3.1_STATUS.md) - 测试框架实施状态

- **规范驱动开发 / Specification-Driven Development**:
  - Phase 3.1 的集成测试定义了**理想的 API 和组件接口**
  - ✅ **当前状态**: 所有测试通过 (94/94, 100%)
  - 函数命名已统一: 测试使用实际的函数名 (`getAllEvents`, `getEventsByUserId`)
  - Schema 作为单一真实来源，确保 Mock 和真实 API 100% 一致

- **测试前检查 / Pre-Test Checklist**:
  ```bash
  # 1. 运行单元测试确保 schemas 正确
  npm run test:unit
  
  # 2. 如果修改了 API,运行相关集成测试
  npm test -- tests/integration/api/
  
  # 3. 如果修改了组件,运行组件测试
  npm test -- tests/integration/components/
  
  # 4. 查看覆盖率报告
  npm run test:coverage
  ```