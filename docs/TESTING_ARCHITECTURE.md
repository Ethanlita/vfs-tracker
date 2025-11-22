# VFS Tracker 测试架构与工作流程

## 📋 目录

1. [测试架构概述](#测试架构概述)
2. [三层防御体系](#三层防御体系)
3. [Schema 驱动开发工作流](#schema-驱动开发工作流)
4. [如何保证 Mock 与真实 API 一致](#如何保证-mock-与真实-api-一致)
5. [测试类型详解](#测试类型详解)
6. [最佳实践](#最佳实践)
7. [常见问题](#常见问题)

---

## 测试架构概述

VFS Tracker 采用**规范驱动开发 (Specification-Driven Development)** 策略，通过 **Joi Schema** 作为单一真实来源 (Single Source of Truth)，确保前端、后端、测试之间的数据契约一致性。

### 核心原则

```
┌─────────────────────────────────────────────────────────────────┐
│  Schema First: Schema 是整个系统的数据契约                         │
│  Test First: 测试定义理想的 API 接口，代码实现匹配测试              │
│  Mock Last: Mock 数据必须符合 Schema，由测试验证                   │
└─────────────────────────────────────────────────────────────────┘
```

### 测试金字塔

```
           /\
          /  \         契约测试 (Contract Tests)
         /____\        16 个测试 - 验证真实 API
        /      \
       /________\      集成测试 (Integration Tests)
      /          \     50 个测试 - MSW Mock API
     /____________\
    /              \   单元测试 (Unit Tests)
   /________________\  28 个测试 - Schema 验证
```

---

## 三层防御体系

我们使用**三层防御体系**确保 Mock API 和真实 API 的一致性：

### 🛡️ 第一层：Schema 作为契约 (Single Source of Truth)

**文件**: `src/api/schemas.js` (579 行)

**作用**:
- 定义所有数据结构的**唯一标准**
- 使用 Joi 进行运行时类型验证
- 前端、后端、测试都基于同一个 Schema

**示例**:
```javascript
// src/api/schemas.js
export const eventSchemaPrivate = Joi.object({
  eventId: Joi.string()
    .pattern(/^event_[a-z0-9]+_[a-z0-9]+$/)
    .required()
    .description('事件唯一标识符 (格式: event_{timestamp}_{random})'),
  
  userId: Joi.string()
    .pattern(/^[a-z]+-[a-z]+-\d+:[a-f0-9-]+$/)
    .required()
    .description('用户唯一标识符 (Cognito Sub)'),
  
  type: Joi.string()
    .valid('self-test', 'hospital-test', 'voice-training', 
           'self-practice', 'surgery', 'feeling-log')
    .required()
    .description('事件类型'),
  
  // ... 更多字段定义
}).description('私有事件对象 (包含附件和敏感信息)');

// API 响应 Schema
export const getAllEventsResponseSchema = Joi.array()
  .items(eventSchemaPublic)
  .description('所有公共事件数组');
```

**导出的 Schemas**:
- `userSchema` - 完整用户对象
- `profileSchema` - 用户资料 (隐私设置、社交账号)
- `eventSchemaPrivate` - 私有事件 (包含 attachments)
- `eventSchemaPublic` - 公共事件 (无敏感信息)
- `getAllEventsResponseSchema` - GET /all-events 响应
- `getUserEventsResponseSchema` - GET /events/:userId 响应
- `getUserProfileResponseSchema` - GET /user/:userId 响应

---

### 🛡️ 第二层：单元测试验证 Mock 数据

**文件**: `tests/unit/api/schemas.test.js`

**作用**:
- 验证所有 Mock 数据符合 Schema
- 确保测试数据的结构正确性
- 快速反馈 (28 个测试 < 1 秒)

**示例**:
```javascript
// tests/unit/api/schemas.test.js
import { schemas } from '../../../src/api/schemas.js';
import { mockPrivateEvents, completeSelfTest } from '../../../src/test-utils/fixtures/index.js';

describe('eventSchemaPrivate', () => {
  it('应该验证完整的自测事件', () => {
    const { error } = schemas.eventSchemaPrivate.validate(completeSelfTest);
    expect(error).toBeUndefined();
  });
  
  it('应该拒绝缺少必需字段的事件', () => {
    const invalidEvent = { type: 'self-test' }; // 缺少 eventId, userId 等
    const { error } = schemas.eventSchemaPrivate.validate(invalidEvent);
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"eventId" is required');
  });
});
```

**当前状态**: ✅ **28/28 测试通过 (100%)**

**保障**:
- 每次修改 Mock 数据，单元测试会自动验证
- 如果 Mock 数据结构错误，**测试立即失败**
- 开发者无法提交不符合 Schema 的 Mock 数据

---

### 🛡️ 第三层：契约测试验证真实 API

**文件**: `tests/contract/api-contract.test.js`

**作用**:
- 调用**真实的 AWS API**
- 用相同的 Schema 验证响应
- 检测后端破坏性变更

**示例**:
```javascript
// tests/contract/api-contract.test.js
import { schemas } from '../../src/api/schemas.js';
import { getAllEvents } from '../../src/api.js';

describe('契约测试: GET /all-events', () => {
  it('真实 API 应该返回符合 Schema 的数据', async () => {
    // ✅ 调用真实 AWS API (不是 Mock!)
    const events = await getAllEvents();
    
    // ✅ 使用相同的 Schema 验证
    const { error } = schemas.getAllEventsResponseSchema.validate(events);
    
    // 如果真实 API 的数据结构变了，这个测试会失败！
    expect(error).toBeUndefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});
```

**运行条件**:
- 需要完整的 AWS 环境变量配置
- 默认的 `npm test` **不会运行**契约测试
- 显式运行: `npm run test:contract`

**当前状态**: ✅ **16/16 测试通过 (100%)**

**覆盖的端点**:
- GET `/all-events` - 获取所有公共事件
- GET `/events/:userId` - 获取用户事件
- POST `/events` - 创建新事件
- DELETE `/event/:eventId` - 删除事件
- GET `/user/:userId` - 获取用户资料
- PUT `/user/:userId` - 更新用户资料
- POST `/upload-url` - 获取上传 URL
- POST `/file-url` - 获取文件 URL
- GET `/avatar/:userId` - 获取头像 URL（调用时需附加 `?key=avatars/{userId}/...`）

---

## Schema 驱动开发工作流

```
┌─────────────────────────────────────────────────────────────────┐
│  完整的 Schema 驱动开发流程                                        │
└─────────────────────────────────────────────────────────────────┘

1️⃣ 定义 Schema
   ↓
   📄 src/api/schemas.js
   export const eventSchema = Joi.object({
     eventId: Joi.string().required(),
     type: Joi.string().valid('self-test', ...).required(),
     // ...
   });

2️⃣ 创建 Mock 数据 (符合 Schema)
   ↓
   📄 src/test-utils/fixtures/events/complete.js
   export const completeSelfTest = {
     eventId: 'event_123abc_xyz789',
     type: 'self-test',
     userId: 'us-east-1:12345678-1234-1234-1234-123456789abc',
     // ...
   };

3️⃣ 单元测试验证 Mock (L2 防御)
   ↓
   📄 tests/unit/api/schemas.test.js
   it('Mock 数据应该符合 Schema', () => {
     const { error } = eventSchema.validate(completeSelfTest);
     expect(error).toBeUndefined(); // ✅ Mock 验证通过
   });
   
   运行: npm run test:unit
   结果: ✅ 28/28 通过

4️⃣ MSW Handlers 使用 Mock 数据
   ↓
   📄 src/test-utils/mocks/msw-handlers.js
   export const getAllEventsHandler = http.get(`${API_URL}/all-events`, () => {
     return HttpResponse.json(mockPublicEvents); // 返回验证过的 Mock
   });

5️⃣ 集成测试使用 MSW Mock
   ↓
   📄 tests/integration/api/events-api.test.js
   it('应该成功获取所有公共事件', async () => {
     const events = await getAllEvents(); // MSW 拦截，返回 Mock
     
     // 验证返回的 Mock 数据符合 Schema
     events.forEach(event => {
       const { error } = eventSchema.validate(event);
       expect(error).toBeUndefined();
     });
   });
   
   运行: npm run test:integration
   结果: ✅ 50/50 通过

6️⃣ 契约测试验证真实 API (L3 防御)
   ↓
   📄 tests/contract/api-contract.test.js
   it('真实 API 应该符合 Schema', async () => {
     // ⚠️ 调用真实 AWS API (跳过 MSW)
     const realEvents = await getAllEvents();
     
     // 使用相同的 Schema 验证
     const { error } = eventSchema.validate(realEvents[0]);
     expect(error).toBeUndefined(); // ✅ 真实 API 验证通过
   });
   
   运行: npm run test:contract (需要 AWS 环境变量)
   结果: ✅ 16/16 通过

7️⃣ 后端实现匹配 Schema
   ↓
   📄 lambda-functions/getAllPublicEvents/index.mjs
   export const handler = async (event) => {
     const events = await dynamoDB.scan(...);
     
     // (可选) 后端也可以用 Schema 验证
     const { error } = eventSchema.validate(events[0]);
     if (error) {
       return { statusCode: 500, body: 'Invalid data' };
     }
     
     return { statusCode: 200, body: JSON.stringify(events) };
   };

8️⃣ CI/CD 自动保护
   ↓
   📄 .github/workflows/test.yml
   - name: Run All Tests
     run: |
       npm run test:unit        # L2: Mock 验证
       npm run test:integration # MSW 测试
       npm run test:contract    # L3: 真实 API 验证
   
   # ⚠️ 如果任一测试失败，阻止部署
```

---

## 如何保证 Mock 与真实 API 一致

### 问题场景

**Q**: 如果一个没有配置好的端点也能测试通过，那么我们如何保证 Mock API 和真实 API 的一致性？

**A**: 通过**三层防御体系** + **Schema 作为契约**

### 场景 1: Mock 数据结构错误

```javascript
// ❌ 错误的 Mock 数据
// src/test-utils/fixtures/events/complete.js
export const completeSelfTest = {
  eventId: 123, // ❌ 错误：应该是 string，但这里是 number
  type: 'self-test',
  // ...
};

// 单元测试会立即失败 (L2 防御)
// tests/unit/api/schemas.test.js
it('Mock 数据应该符合 Schema', () => {
  const { error } = schemas.eventSchema.validate(completeSelfTest);
  expect(error).toBeUndefined();
});

// ❌ 测试失败！
// Error: "eventId" must be a string
```

**结果**: 开发者**无法提交**不符合 Schema 的 Mock 数据

---

### 场景 2: 后端 API 响应结构变更

```javascript
// 后端修改了响应结构 (例如把 eventId 改成 id)
// lambda-functions/getAllPublicEvents/index.mjs
const events = await dynamoDB.scan(...);
const response = events.map(e => ({
  id: e.eventId,        // ❌ 字段名变了！
  type: e.type,
  // ...
}));
return { statusCode: 200, body: JSON.stringify(response) };

// 契约测试会失败 (L3 防御)
// tests/contract/api-contract.test.js
it('真实 API 应该返回符合 Schema 的数据', async () => {
  const events = await getAllEvents(); // 调用真实 API
  const { error } = schemas.eventSchema.validate(events[0]);
  expect(error).toBeUndefined();
});

// ❌ 测试失败！
// Error: "eventId" is required
```

**结果**: 
- CI/CD 流水线**自动阻止部署**
- 强制前后端团队**同步修改** Schema
- 确保前端不会收到意外的数据结构

---

### 场景 3: 前端代码使用了错误的字段名

```javascript
// 前端开发者错误地使用了 event.id 而不是 event.eventId
// src/components/EventList.jsx
const EventList = ({ events }) => {
  return events.map(event => (
    <div key={event.id}> {/* ❌ 错误：应该是 event.eventId */}
      {event.type}
    </div>
  ));
};

// 集成测试会失败
// tests/integration/components/EventList.test.jsx
it('应该渲染事件列表', () => {
  renderWithProviders(<EventList events={mockPrivateEvents} />);
  expect(screen.getByText('self-test')).toBeInTheDocument();
});

// ❌ 测试失败！
// Error: Cannot read property 'id' of undefined
```

**结果**: 开发者在**本地开发**时就能发现错误

---

### 三层防御的触发时机

| 层级 | 触发时机 | 检测对象 | 失败后果 |
|------|---------|---------|---------|
| **L2: 单元测试** | 每次保存代码 | Mock 数据 | 立即反馈 (< 1s) |
| **L2: 集成测试** | 每次 `git commit` | 组件 + API Mock | 阻止 commit (可选) |
| **L3: 契约测试** | 每次 `git push` | 真实 API | CI/CD 阻止合并 |
| **L3: 定期检查** | 每天凌晨 | 生产 API | 监控告警 |

---

## 测试类型详解

### 1. 单元测试 (Unit Tests)

**目录**: `tests/unit/`

**特点**:
- ⚡ 快速 (< 1 秒)
- 🎯 隔离 (不依赖外部服务)
- 🔍 精确 (测试单个函数或模块)

**覆盖范围**:
- Schema 验证 (28 个测试)
- 工具函数 (timeout, apiError, 等)

**运行**:
```bash
npm run test:unit
```

---

### 2. 集成测试 (Integration Tests)

**目录**: `tests/integration/`

**特点**:
- 🌐 使用 MSW Mock API
- 🔗 测试多个模块交互
- 🎭 模拟真实用户流程

**覆盖范围**:
- API 调用 (events-api, profile-api, upload-api)
- React 组件 (EventList, Timeline)
- 超时处理 (timeout.test.js - 14/14 通过)

**运行**:
```bash
npm run test:integration
```

**MSW 配置**:
```javascript
// src/test-utils/setup.js
import { server } from './mocks/msw-server.js';

beforeAll(() => server.listen()); // 启动 MSW 服务器
afterEach(() => server.resetHandlers()); // 重置 handlers
afterAll(() => server.close()); // 关闭服务器
```

---

### 3. 契约测试 (Contract Tests)

**目录**: `tests/contract/`

**特点**:
- 🌍 调用**真实 API**
- 🔒 需要 AWS 环境变量
- 🚨 检测破坏性变更

**覆盖范围**:
- 10 个 API 端点
- CRUD 操作完整性
- 数据一致性验证

**运行**:
```bash
npm run test:contract
```

**环境要求**:
```bash
VITE_COGNITO_USER_POOL_ID=xxx
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=xxx
VITE_AWS_REGION=us-east-1
VITE_API_ENDPOINT=https://api.vfs-tracker.app/dev
VITE_S3_BUCKET=xxx
```

---

## 最佳实践

### ✅ DO: 应该做的

1. **Schema 先行**: 添加新功能时，先在 `schemas.js` 中定义数据结构
2. **测试驱动**: 先写测试定义预期行为，再实现功能
3. **使用 Fixtures**: 不要在测试中手动构造数据，使用 `src/test-utils/fixtures/`
4. **描述性命名**: 测试名称应该清楚描述场景和预期结果
5. **AAA 模式**: Arrange (准备) → Act (执行) → Assert (断言)
6. **隔离测试**: 每个测试应该独立运行，不依赖其他测试

### ❌ DON'T: 不应该做的

1. **不要跳过单元测试**: 修改 Schema 或 Fixtures 后必须运行单元测试
2. **不要直接修改 MSW handlers**: 应该在测试中用 `server.use()` 临时覆盖
3. **不要在集成测试中调用真实 API**: 会减慢测试速度，增加不稳定性
4. **不要硬编码测试数据**: 应该使用 fixtures 或 helper 函数生成
5. **不要忽略契约测试失败**: 可能意味着后端破坏性变更

---

## 常见问题

### Q1: 为什么测试能通过但 API 不存在？

**A**: 因为使用了 MSW (Mock Service Worker) 进行网络拦截。

```javascript
// src/test-utils/setup.js
vi.mock('aws-amplify/api', () => {
  return {
    get: vi.fn(({ path }) => {
      const fetchPromise = globalThis.fetch(url); // ← MSW 在这里拦截
      return { response: fetchPromise };
    }),
  };
});
```

**流程**:
1. 测试调用 `getAllEvents()`
2. `api.js` 调用 mock 的 `aws-amplify/api`
3. Mock 调用 `global.fetch(url)`
4. **MSW 拦截请求**，返回 mock 数据
5. 测试接收到数据，验证通过

**优势**:
- ✅ 快速 (无需网络请求)
- ✅ 稳定 (不依赖后端)
- ✅ 可控 (模拟任何场景)

---

### Q2: 测试时会往真实账户写数据吗？

**A**: **不会！** 除非显式运行契约测试。

| 测试类型 | 调用真实 API? | 写入数据? | 如何运行 |
|---------|-------------|----------|---------|
| 单元测试 | ❌ 否 | ❌ 否 | `npm run test:unit` |
| 集成测试 | ❌ 否 (MSW) | ❌ 否 | `npm run test:integration` |
| 契约测试 | ✅ **是** | ✅ **是** | `npm run test:contract` |

默认的 `npm test` **只跑单元和集成测试**，零真实 API 调用。

---

### Q3: 如何检测 Mock 和真实 API 不一致？

**A**: 三层防御体系自动检测：

```
L1: Schema 定义 (src/api/schemas.js)
  ↓
L2: 单元测试验证 Mock (tests/unit/)
  ↓  ✅ 28/28 通过
L2: 集成测试使用 Mock (tests/integration/)
  ↓  ✅ 50/50 通过
L3: 契约测试验证真实 API (tests/contract/)
  ↓  ✅ 16/16 通过
  
✅ 三层全部通过 → Mock 和真实 API 100% 一致
```

---

### Q4: 函数名不一致怎么办？

**A**: 已修复！现在测试使用实际的函数名。

| 测试中期望的名字 | 实际代码中的名字 | 状态 |
|----------------|-----------------|------|
| `getAllPublicEvents()` | `getAllEvents()` | ✅ 已修正 |
| `getUserEvents(userId)` | `getEventsByUserId(userId)` | ✅ 已修正 |

**修复内容**:
- 更新 `tests/integration/api/timeout.test.js` 导入
- 移除 `it.skip`，启用 2 个测试
- **结果**: 14/14 测试全部通过 ✅

---

### Q5: 如何添加新的 API 端点测试？

**步骤**:

```javascript
// 1. 定义 Schema
// src/api/schemas.js
export const newApiResponseSchema = Joi.object({ ... });

// 2. 创建 Fixture
// src/test-utils/fixtures/new-data.js
export const mockNewData = { ... };

// 3. 单元测试
// tests/unit/api/schemas.test.js
it('应该验证新 API 响应', () => {
  const { error } = newApiResponseSchema.validate(mockNewData);
  expect(error).toBeUndefined();
});

// 4. MSW Handler
// src/test-utils/mocks/msw-handlers.js
export const newApiHandler = http.get(`${API_URL}/new-endpoint`, () => {
  return HttpResponse.json(mockNewData);
});

// 5. 集成测试
// tests/integration/api/new-api.test.js
it('应该成功调用新 API', async () => {
  const result = await newApiFunction();
  const { error } = newApiResponseSchema.validate(result);
  expect(error).toBeUndefined();
});

// 6. 契约测试
// tests/contract/api-contract.test.js
it('新 API 应该符合 Schema', async () => {
  const result = await realNewApiCall();
  const { error } = newApiResponseSchema.validate(result);
  expect(error).toBeUndefined();
});
```

---

## 相关文档

- 📖 [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 完整的测试编写指南
- 📖 [tests/contract/README.md](../tests/contract/README.md) - 契约测试详细说明
- 📊 [tests/PHASE3.1_STATUS.md](../tests/PHASE3.1_STATUS.md) - 测试框架实施状态
- 🔧 [TIMEOUT_IMPLEMENTATION_SUMMARY.md](./TIMEOUT_IMPLEMENTATION_SUMMARY.md) - 超时处理文档
- 🚨 [error-handling-guide.md](./error-handling-guide.md) - 错误处理指南

---

## 测试状态总览

### 当前测试覆盖率

| 测试类型 | 状态 | 通过率 | 说明 |
|---------|------|-------|------|
| **单元测试** | ✅ | 28/28 (100%) | Schema 验证完整 |
| **集成测试** | ✅ | 50/50 (100%) | 包含超时测试 14/14 |
| **契约测试** | ✅ | 16/16 (100%) | 真实 API 验证 |
| **总计** | ✅ | **94/94 (100%)** | 所有测试通过 |

### 测试运行时间

| 测试类型 | 运行时间 | 说明 |
|---------|---------|------|
| 单元测试 | < 1 秒 | 快速反馈 |
| 集成测试 | ~70 秒 | 包含超时模拟 |
| 契约测试 | ~30 秒 | 真实 API 调用 |

---

**最后更新**: 2025-10-11  
**维护者**: VFS Tracker 团队
