# VFS Tracker 测试指南

本文档详细说明了 VFS Tracker 项目的测试架构、测试策略和最佳实践。

## 目录

1. [测试哲学](#测试哲学)
2. [测试架构](#测试架构)
3. [快速开始](#快速开始)
4. [测试类型](#测试类型)
5. [编写测试](#编写测试)
6. [测试工具](#测试工具)
7. [测试数据管理](#测试数据管理)
8. [最佳实践](#最佳实践)
9. [故障排查](#故障排查)

---

## 测试哲学

VFS Tracker 采用**Schema 驱动的测试策略**：

- **Schema 作为单一真实来源**：所有数据结构通过 Joi schema 定义
- **三层测试金字塔**：单元测试 → 集成测试 → 契约测试
- **Mock Service Worker (MSW)**：在网络层 mock API 请求
- **测试与开发模式分离**：Phase 3.1 引入测试框架，Phase 3.2 移除开发模式

### 核心原则

1. **测试应该快速运行**：使用 MSW 而非真实 API 调用
2. **测试应该可靠**：不依赖外部服务或网络状态
3. **测试应该易于维护**：Schema 定义即文档，测试即规范
4. **测试应该覆盖全面**：单元测试覆盖逻辑，集成测试覆盖流程，契约测试验证真实 API

---

## 测试架构

```
tests/
├── unit/                    # 单元测试
│   ├── api/
│   │   └── schemas.test.js  # Schema 验证测试
│   ├── utils/
│   └── components/
├── integration/             # 集成测试
│   ├── api/
│   │   ├── events-api.test.js
│   │   ├── profile-api.test.js
│   │   └── upload-api.test.js
│   └── components/
│       ├── EventList.test.jsx
│       └── Timeline.test.jsx
├── contract/                # 契约测试（调用真实 API）
│   ├── api-contract.test.js
│   └── README.md
└── legacy/                  # 遗留测试
    └── apiError.test.mjs

src/test-utils/
├── setup.js                 # Vitest 全局配置
├── custom-render.jsx        # 自定义渲染函数
├── test-helpers.js          # 测试辅助函数
├── mocks/                   # Mock 实现
│   ├── amplify-auth.js
│   ├── msw-handlers.js
│   └── msw-server.js
└── fixtures/                # 测试数据
    ├── users/
    ├── events/
    └── index.js
```

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行契约测试（需要配置环境变量）
npm run test:contract

# 查看测试 UI
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

### 开发模式

```bash
# 监视模式运行测试
npm test

# 监视特定文件
npm test -- schemas.test.js
```

---

## 测试类型

### 1. 单元测试 (Unit Tests)

**目的**：测试独立的函数、方法或组件。

**特点**：
- 快速执行
- 不依赖外部服务
- 覆盖边界情况和错误处理

**示例**：

```javascript
// tests/unit/api/schemas.test.js
import { describe, it, expect } from 'vitest';
import { schemas } from '../../../src/api/schemas.js';

describe('userSchema', () => {
  it('应该验证有效的用户数据', () => {
    const validUser = {
      userId: 'us-east-1:12345678-1234-1234-1234-123456789abc',
      email: 'test@example.com',
      nickname: 'testuser',
    };
    
    const { error } = schemas.userSchema.validate(validUser);
    expect(error).toBeUndefined();
  });
  
  it('应该拒绝无效的 userId 格式', () => {
    const invalidUser = {
      userId: 'invalid-id',
      email: 'test@example.com',
      nickname: 'testuser',
    };
    
    const { error } = schemas.userSchema.validate(invalidUser);
    expect(error).toBeDefined();
  });
});
```

### 2. 集成测试 (Integration Tests)

**目的**：测试多个模块或组件之间的交互。

**特点**：
- 使用 MSW mock API 请求
- 测试真实的用户流程
- 验证组件间的数据流

**示例**：

```javascript
// tests/integration/api/events-api.test.js
import { describe, it, expect, vi } from 'vitest';
import { getAllEvents } from '../../../src/api.js';
import { schemas } from '../../../src/api/schemas.js';

describe('Events API 集成测试', () => {
  it('应该成功获取所有公共事件', async () => {
    const events = await getAllEvents();
    
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    
    // 验证每个事件符合 schema
    events.forEach(event => {
      const { error } = schemas.eventSchemaPublic.validate(event);
      expect(error).toBeUndefined();
    });
  });
});
```

### 3. 组件集成测试

**目的**：测试 React 组件的渲染和用户交互。

**示例**：

```javascript
// tests/integration/components/EventList.test.jsx
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../src/test-utils/custom-render.jsx';
import EventList from '../../../src/components/EventList.jsx';
import { mockPrivateEvents } from '../../../src/test-utils/fixtures/index.js';

describe('EventList 组件', () => {
  it('应该渲染事件列表', async () => {
    renderWithProviders(<EventList events={mockPrivateEvents} />);
    
    await waitFor(() => {
      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });
  });
  
  it('点击事件应该触发回调', async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();
    
    renderWithProviders(
      <EventList events={mockPrivateEvents} onEventClick={onEventClick} />
    );
    
    const firstEvent = screen.getAllByRole('listitem')[0];
    await user.click(firstEvent);
    
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });
});
```

### 4. 契约测试 (Contract Tests)

**目的**：验证真实 API 是否符合预定义的 schema。

**特点**：
- 调用真实的后端 API
- 需要配置环境变量
- 适合在 CI/CD 中定期运行

**详细说明**：参见 [tests/contract/README.md](../tests/contract/README.md)

---

### 5. E2E 测试 (End-to-End Tests) - 当前状态

**位置**：`tests/e2e/`

**当前状态**：⚠️ **所有 E2E 测试当前被跳过**

**测试文件**：
- `auth.spec.js` - 认证流程端到端测试
- `home.spec.js` - 首页端到端测试

**为什么被跳过**：
1. **环境依赖**：E2E 测试需要完整的 AWS 环境配置（Cognito, API Gateway, DynamoDB, S3）
2. **项目阶段**：当前处于 Phase 3.1（测试补充）阶段，重点是单元测试、集成测试和契约测试
3. **基础设施**：E2E 测试需要专门的测试环境和 CI/CD 配置

**计划**：
- **Phase 4**：E2E 测试基础设施搭建
  - 配置专用测试环境
  - 建立 CI/CD E2E 测试流程
  - 实现测试数据清理机制
  - 添加视觉回归测试

**如何运行**（需要配置）：
```bash
# 当前会跳过所有测试
npm run test:e2e

# 未来配置完成后
# 1. 配置 .env.e2e 文件
# 2. 启动测试环境
# 3. 运行 E2E 测试
```

**注意事项**：
- E2E 测试不包含在代码覆盖率统计中
- 使用 Playwright 作为 E2E 测试框架
- 配置文件：`playwright.config.js`

---

## 编写测试

### 使用 Schema 验证

所有数据验证应该使用定义好的 Joi schema：

```javascript
import { schemas } from '../../../src/api/schemas.js';

// 验证用户数据
const { error, value } = schemas.profileSchema.validate(userData);
expect(error).toBeUndefined();

// 验证事件数据
const { error: eventError } = schemas.eventSchemaPrivate.validate(eventData);
expect(eventError).toBeUndefined();
```

### 使用测试工具函数

`src/test-utils/test-helpers.js` 提供了丰富的工具函数：

```javascript
import { 
  wait,
  createMockResponse,
  createMockAuthSession,
  assertValidSchema,
  generateTestId,
  mockConsole,
} from '../../../src/test-utils/test-helpers.js';

// 等待一段时间
await wait(100);

// 创建 mock 响应
const response = createMockResponse({ data: 'test' }, 200);

// 验证 schema
assertValidSchema(data, schemas.eventSchema);

// 生成测试 ID
const testEventId = generateTestId('event');
```

### 使用 Fixtures

Fixtures 提供了预定义的测试数据：

```javascript
import { 
  completeProfile,
  minimalProfile,
  mockPrivateEvents,
  mockPublicEvents,
  completeSelfTest,
  minimalSelfTest,
} from '../../../src/test-utils/fixtures/index.js';

// 使用完整的用户资料
test('with complete profile', () => {
  const result = processProfile(completeProfile);
  expect(result).toBeDefined();
});

// 使用最小的用户资料
test('with minimal profile', () => {
  const result = processProfile(minimalProfile);
  expect(result).toBeDefined();
});
```

### 自定义渲染函数

测试 React 组件时使用自定义渲染函数，它会自动包装必要的 Provider：

```javascript
import { renderWithProviders } from '../../../src/test-utils/custom-render.jsx';

// 包含所有 Provider（Router, Auth, Theme 等）
const { rerender, unmount } = renderWithProviders(<MyComponent />);

// 只包含 Router
import { renderWithRouter } from '../../../src/test-utils/custom-render.jsx';
const { container } = renderWithRouter(<MyComponent />);
```

### Mock Amplify Auth

测试需要认证的功能时：

```javascript
import { vi } from 'vitest';
import { setAuthenticated, setUnauthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';

// 设置为已认证状态
beforeEach(() => {
  setAuthenticated({
    userId: 'us-east-1:test-user-001',
    email: 'test@example.com',
    nickname: 'testuser',
  });
});

// 设置为未认证状态
beforeEach(() => {
  setUnauthenticated();
});
```

---

## 测试工具

### Vitest

主要测试运行器，提供快速的测试执行和优秀的开发体验。

**配置**：`vite.config.js`

```javascript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        'tests/',
        '**/*.test.{js,jsx,ts,tsx}',
      ],
    },
  },
});
```

**常用命令**：

```bash
# 运行测试
npm test

# 监视模式
npm test -- --watch

# UI 模式
npm run test:ui

# 覆盖率
npm run test:coverage
```

### React Testing Library

用于测试 React 组件的渲染和用户交互。

**核心 API**：

```javascript
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// 查询元素
screen.getByRole('button', { name: /submit/i });
screen.getByText(/hello world/i);
screen.getByLabelText(/username/i);

// 用户交互
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'Hello');

// 等待异步操作
await waitFor(() => {
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

### Mock Service Worker (MSW)

在网络层拦截和 mock API 请求。

**配置**：`src/test-utils/mocks/msw-server.js`

**添加新的 handler**：

```javascript
// src/test-utils/mocks/msw-handlers.js
import { http, HttpResponse } from 'msw';

export const newEndpointHandler = http.get(
  'https://api.vfs-tracker.app/dev/new-endpoint',
  () => {
    return HttpResponse.json({
      data: 'test response',
    });
  }
);

// 添加到 handlers 数组
export const handlers = [
  // ... 其他 handlers
  newEndpointHandler,
];
```

**在测试中覆盖 handler**：

```javascript
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { http, HttpResponse } from 'msw';

test('handle error response', async () => {
  server.use(
    http.get('https://api.vfs-tracker.app/dev/events', () => {
      return HttpResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    })
  );
  
  await expect(getAllEvents()).rejects.toThrow();
});
```

### Joi Schema 验证

用于定义和验证数据结构。

**定义 Schema**：

```javascript
// src/api/schemas.js
import Joi from 'joi';

export const mySchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().min(1).max(100).required(),
  age: Joi.number().integer().min(0).optional(),
  email: Joi.string().email().optional(),
});
```

**验证数据**：

```javascript
const { error, value } = mySchema.validate(data);

if (error) {
  console.error('Validation failed:', error.details);
}
```

---

## 测试数据管理

### Fixtures 结构

```
src/test-utils/fixtures/
├── users/
│   ├── complete-profile.js    # 完整资料
│   ├── minimal-profile.js     # 最小资料
│   ├── public-profile.js      # 公开资料
│   ├── private-profile.js     # 私密资料
│   └── index.js
├── events/
│   ├── self-test/
│   │   ├── complete.js        # 完整自测
│   │   └── minimal.js         # 最小自测
│   ├── surgery/
│   │   └── complete.js        # 手术记录
│   ├── feeling-log/
│   │   └── complete.js        # 感受日志
│   ├── index.js
│   └── events.js              # 混合事件列表
└── index.js                   # 导出所有 fixtures
```

### 创建新的 Fixture

```javascript
// src/test-utils/fixtures/events/new-type/complete.js

/**
 * 完整的新类型事件数据
 */
export const completeNewType = {
  userId: 'us-east-1:complete-user-001',
  eventId: 'evt_new_type_complete_001',
  type: 'new_type',
  timestamp: '2024-03-15T10:30:00.000Z',
  title: '新类型事件',
  description: '这是一个新类型的事件',
  details: {
    // 新类型特定的字段
    customField1: 'value1',
    customField2: 123,
  },
  attachments: [],
  isPublic: false,
};
```

### 使用 Fixtures

```javascript
import { completeNewType } from '../../../src/test-utils/fixtures/index.js';

test('process new type event', () => {
  const result = processEvent(completeNewType);
  expect(result).toBeDefined();
});
```

### 动态生成测试数据

```javascript
import { generateTestId, generateUserId } from '../../../src/test-utils/test-helpers.js';

function createTestEvent(overrides = {}) {
  return {
    userId: generateUserId(),
    eventId: generateTestId('event'),
    type: 'self_test',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

test('with generated data', () => {
  const event1 = createTestEvent();
  const event2 = createTestEvent({ type: 'surgery' });
  
  expect(event1.eventId).not.toBe(event2.eventId);
});
```

---

## 最佳实践

### 1. 测试命名

使用描述性的测试名称：

```javascript
// ❌ 不好
test('test1', () => { ... });

// ✅ 好
test('应该在用户未登录时返回 401 错误', () => { ... });

// ✅ 更好（使用 describe 分组）
describe('getUserProfile', () => {
  describe('当用户已认证时', () => {
    it('应该返回完整的用户资料', () => { ... });
  });
  
  describe('当用户未认证时', () => {
    it('应该抛出认证错误', () => { ... });
  });
});
```

### 2. AAA 模式

遵循 Arrange-Act-Assert 模式：

```javascript
test('should update user profile', async () => {
  // Arrange - 准备测试数据
  const userId = 'us-east-1:test-user';
  const updateData = { nickname: 'newname' };
  
  // Act - 执行操作
  const result = await updateUserProfile(updateData);
  
  // Assert - 验证结果
  expect(result.nickname).toBe('newname');
  expect(result.userId).toBe(userId);
});
```

### 3. 避免测试实现细节

测试应该关注行为而非实现：

```javascript
// ❌ 测试实现细节
test('should call setState with correct arguments', () => {
  const setState = vi.fn();
  // 测试内部实现
});

// ✅ 测试行为
test('should display updated value after change', async () => {
  const user = userEvent.setup();
  renderWithProviders(<MyComponent />);
  
  await user.type(screen.getByRole('textbox'), 'new value');
  
  expect(screen.getByText('new value')).toBeInTheDocument();
});
```

### 4. 使用 data-testid 谨慎

优先使用语义化的查询方法：

```javascript
// ✅ 优先使用 role 和 label
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/username/i);
screen.getByText(/welcome/i);

// ⚠️ 其次使用 testid
screen.getByTestId('submit-button');
```

### 5. 清理副作用

确保测试之间相互独立：

```javascript
import { afterEach, beforeEach } from 'vitest';

let server;

beforeEach(() => {
  server = startMockServer();
});

afterEach(() => {
  server.close();
  localStorage.clear();
  sessionStorage.clear();
});
```

### 6. 全局对象清理规范

**问题背景**：测试中修改全局对象（如 `window.innerWidth`）会污染全局状态，导致后续测试失败。

**解决方案**：使用 `beforeEach` 和 `afterEach` 保存和恢复全局对象：

```javascript
describe('响应式组件测试', () => {
  let originalInnerWidth;

  // 保存原始值
  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
  });

  // 每个测试后恢复原始值
  afterEach(() => {
    window.innerWidth = originalInnerWidth;
  });

  it('应该在移动端显示简化视图', () => {
    // 修改全局对象进行测试
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    
    // 测试逻辑...
  });

  it('应该在桌面端显示完整视图', () => {
    // 修改全局对象进行测试
    window.innerWidth = 1024;
    window.dispatchEvent(new Event('resize'));
    
    // 测试逻辑...
    // afterEach 会自动恢复 innerWidth
  });
});
```

**常见需要清理的全局对象**：
- `window.innerWidth` / `window.innerHeight`
- `window.matchMedia`
- `navigator.userAgent`
- `document.cookie`
- `performance.now`（注意：避免在测试中依赖性能计时）

**最佳实践**：
1. ✅ **总是恢复全局状态**：防止测试间污染
2. ✅ **使用 beforeEach/afterEach**：自动化清理过程
3. ✅ **测试行为而非性能**：避免使用 `performance.now()` 进行时间断言
4. ❌ **不要依赖测试执行顺序**：每个测试应该独立运行

### 7. 合理使用 Mock

只 mock 必要的部分：

```javascript
// ✅ Mock 外部依赖
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

// ❌ 不要过度 mock
// 避免 mock 被测试的代码本身
```

### 8. 测试行为而非实现细节

**问题背景**：测试实现细节（如 console.log 输出）会导致脆弱的测试，代码重构时容易失败。

**反模式**：

```javascript
// ❌ 不要测试 console.log 输出
it('应该记录调试信息', () => {
  const consoleSpy = vi.spyOn(console, 'log');
  
  myFunction();
  
  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining('debug info')
  );
});
```

**正确做法**：

```javascript
// ✅ 测试实际行为和结果
it('应该正确处理用户数据', () => {
  const result = myFunction(userData);
  
  // 验证函数的输出或副作用
  expect(result.userId).toBe(userData.userId);
  expect(result.isValid).toBe(true);
});

// ✅ 如果需要验证日志，使用专门的日志库并 mock
const logger = {
  debug: vi.fn(),
  error: vi.fn()
};

it('应该记录错误', () => {
  processData(invalidData, logger);
  
  expect(logger.error).toHaveBeenCalledWith(
    expect.objectContaining({ code: 'INVALID_DATA' })
  );
});
```

**最佳实践**：
1. ✅ **测试公共 API**：组件的 props、返回值、DOM 输出
2. ✅ **测试用户可见的行为**：屏幕上显示的内容、交互响应
3. ❌ **不要测试内部状态**：私有变量、内部函数调用
4. ❌ **不要测试 console 输出**：除非是专门的日志功能
5. ❌ **不要依赖性能计时**：`performance.now()` 测试在不同环境下不稳定

### 9. 异步测试

正确处理异步操作：

```javascript
// ✅ 使用 async/await
test('async operation', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// ✅ 使用 waitFor
test('wait for element', async () => {
  renderWithProviders(<MyComponent />);
  
  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});

// ❌ 不使用 await
test('wrong async test', () => {
  fetchData().then(result => {
    expect(result).toBeDefined(); // 可能不会执行
  });
});
```

### 10. 测试覆盖率

追求有意义的覆盖率，而非 100%：

- **Lines**: 目标 > 80%
- **Functions**: 目标 > 80%
- **Branches**: 目标 > 70%
- **Statements**: 目标 > 80%

重点覆盖：
- 核心业务逻辑
- 错误处理路径
- 边界情况

可以忽略：
- 第三方库代码
- 配置文件
- 类型定义

---

## 开发工作流程

### 日常开发流程

```bash
# 1. 修改代码
# 2. 运行单元测试（秒级反馈）
npm run test:unit

# 3. 运行集成测试（分钟级反馈）
npm run test:integration

# 4. 提交代码
git commit -m "feat: add new feature"
```

### 验证 API 对齐流程（每周 or API 变更后）

```bash
# 1. 确保有真实环境变量
# .env.contract 文件已存在

# 2. 运行契约测试
npm run test:contract

# 3. 如果测试失败，检查失败原因：
# - API 返回格式变了？更新 MSW handlers
# - Schema 定义错了？更新 schemas.js
# - 测试断言错了？更新集成测试

# 4. 修复后重新运行
npm run test:integration  # 验证 mock 修复
npm run test:contract     # 验证与真实 API 对齐
```

### 添加新 API 端点检查清单

- [ ] 在 `src/api/schemas.js` 中定义 schema
- [ ] 编写契约测试 `tests/contract/`
- [ ] 实现后端 Lambda
- [ ] 运行契约测试，确认格式
- [ ] 创建 MSW handler（格式与真实 API 一致）
- [ ] 编写集成测试
- [ ] 运行所有测试通过

### 修改现有 API 检查清单

- [ ] 更新 schema 定义
- [ ] 更新契约测试
- [ ] 修改后端实现
- [ ] 运行契约测试，记录新格式
- [ ] 更新 MSW handler
- [ ] 更新集成测试断言
- [ ] 运行所有测试通过

### 发现测试失败处理流程

- [ ] 是单元测试失败？→ 修复业务逻辑
- [ ] 是集成测试失败？→ 检查 mock 数据或断言
- [ ] 是契约测试失败？→ **优先级最高**，说明 mock 不对齐
- [ ] 修复后重新运行所有相关测试

---

## Mock 与真实 API 对齐

### 三层测试架构

我们的测试框架采用三层架构，每层有不同的目的和运行方式：

```
┌─────────────────────────────────────────────────────────────┐
│                  1. Unit Tests (单元测试)                     │
│  - 测试: Schemas, Utils, Pure Functions                      │
│  - Mock: 无                                                  │
│  - 速度: 极快 (~1s)                                          │
│  - 频率: 每次提交                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              2. Integration Tests (集成测试)                  │
│  - 测试: API Functions + React Components                    │
│  - Mock: MSW (拦截 HTTP 请求)                                │
│  - 速度: 快 (~10s)                                           │
│  - 频率: 每次提交                                             │
│  - 目标: 验证前端逻辑和组件交互                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               3. Contract Tests (契约测试)                    │
│  - 测试: Real API Endpoints                                  │
│  - Mock: 无 - 真实 AWS 后端                                  │
│  - 速度: 慢 (~30s-60s)                                       │
│  - 频率: 每日/每周 or CI/CD                                   │
│  - 目标: 验证 Mock 与真实 API 的对齐                          │
└─────────────────────────────────────────────────────────────┘
```

### 契约测试驱动开发

#### 问题：Mock API 和真实 API 不对齐

**症状**：
- Upload API 测试失败：测试期望对象 `{uploadUrl, fileKey}`，但真实 API 返回字符串
- Profile API 之前也有类似问题（已修复）

**根本原因**：
集成测试的断言是基于**假设**而不是**真实 API 文档**编写的。

#### 解决方案：契约测试验证流程

**步骤 1: 运行契约测试验证真实 API**

```bash
# 1. 配置真实环境变量（使用 .env.contract 文件）
# 文件已存在，包含真实 AWS 配置

# 2. 运行契约测试（会调用真实 API）
npm run test:contract

# 3. 查看失败的测试，了解真实 API 的返回格式
```

**步骤 2: 根据契约测试结果更新 MSW Handlers**

```javascript
// 示例：修复 getUploadUrl handler
// 错误的 handler (返回对象)
const getUploadUrlHandler = http.post(`${API_URL}/upload-url`, async ({ request }) => {
  const { fileKey, contentType } = await request.json();
  return HttpResponse.json({
    uploadUrl: mockUploadUrl,  // ❌ 错误：返回对象
    fileKey: fileKey,
  });
});

// 正确的 handler (返回与真实 API 一致的格式)
const getUploadUrlHandler = http.post(`${API_URL}/upload-url`, async ({ request }) => {
  const { fileKey, contentType } = await request.json();
  return HttpResponse.json({
    uploadUrl: mockUploadUrl  // ✅ 正确：只返回 uploadUrl 字符串
  });
});
```

**步骤 3: 更新集成测试断言**

```javascript
// 错误的测试断言
it('应该返回上传 URL', async () => {
  const response = await getUploadUrl('test.mp3', 'audio/mpeg');
  expect(response.uploadUrl).toBeDefined();  // ❌ 期望对象
  expect(response.fileKey).toBe('test.mp3');
});

// 正确的测试断言（基于真实 API）
it('应该返回上传 URL', async () => {
  const uploadUrl = await getUploadUrl('test.mp3', 'audio/mpeg');
  expect(typeof uploadUrl).toBe('string');  // ✅ API 返回字符串
  expect(uploadUrl).toContain('https://');
});
```

### Schema 驱动开发工作流

**核心理念**：Schema 是单一真相来源 (Single Source of Truth)

```
           ┌──────────────────┐
           │   Schema 定义     │
           │  (schemas.js)    │
           └────────┬─────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────┐
│  后端 Lambda   │       │   前端 API    │
│  返回数据格式   │       │   期望格式    │
└───────┬───────┘       └──────┬───────┘
        │                       │
        │    ┌──────────────┐   │
        └───→│ 契约测试验证  │←──┘
             └──────────────┘
```

#### 开发新功能的标准流程

1. **定义 Schema**（前后端协商）
   ```javascript
   // src/api/schemas.js
   export const newFeatureSchema = Joi.object({
     id: Joi.string().required(),
     data: Joi.object().required(),
   });
   ```

2. **编写契约测试**（测试先行）
   ```javascript
   // tests/contract/new-feature.test.js
   it('POST /new-feature 应该符合 schema', async () => {
     const response = await apiCall();
     const { error } = newFeatureSchema.validate(response);
     expect(error).toBeUndefined();
   });
   ```

3. **后端实现 Lambda**
   ```javascript
   // lambda-functions/newFeature/index.mjs
   export const handler = async (event) => {
     // 实现逻辑
     return {
       statusCode: 200,
       body: JSON.stringify({
         id: 'xxx',
         data: {...}
       })
     };
   };
   ```

4. **创建 MSW Handler**（基于真实 API）
   ```javascript
   // src/test-utils/mocks/msw-handlers.js
   const newFeatureHandler = http.post(`${API_URL}/new-feature`, async ({ request }) => {
     // 返回格式必须与真实 API 一致
     return HttpResponse.json({
       id: 'mock-id',
       data: {...}
     });
   });
   ```

5. **编写集成测试**
   ```javascript
   // tests/integration/api/new-feature.test.js
   it('应该调用 API 并返回正确格式', async () => {
     const result = await callNewFeatureAPI();
     expect(result.id).toBeDefined();
   });
   ```

6. **验证对齐**
   ```bash
   npm run test:contract     # 验证真实 API
   npm run test:integration  # 验证 Mock API
   ```

---

## Amplify V6 + MSW 集成模式

### Phase 1.1 经验教训

在 Phase 1.1 测试中，我们遇到了 **Amplify V6** 与 **MSW 2.x** 的冲突问题，通过三个解决方案实现了 100% 测试通过率。

#### 问题：Amplify V6 破坏 MSW Mock

**症状**：
- 19 个上传 API 测试失败
- 错误：`TypeError: Cannot read properties of undefined (reading 'clone')`
- MSW 无法正确拦截 Amplify 的 fetch 请求

**根本原因**：
1. Amplify V6 内部保存了 `globalThis.fetch` 的引用
2. MSW 在测试启动时替换了 `globalThis.fetch`
3. Amplify 使用的是旧的 fetch 引用，绕过了 MSW 的拦截
4. MSW 的 response handler 期望 cloned request，但收到了原始 request
5. 导致 `request.clone()` 失败

#### 解决方案 1：Fetch 恢复机制

在每个测试前强制恢复原生 fetch：

```javascript
// src/test-utils/setup.js
import { beforeEach } from 'vitest';

// 保存原生 fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // 恢复原生 fetch，让 MSW 重新拦截
  globalThis.fetch = originalFetch;
  
  // 重新配置 Amplify
  Amplify.configure({
    Auth: { /* ... */ },
    API: { /* ... */ }
  });
});
```

#### 解决方案 2：Request Clone 保护

在 MSW handlers 中安全地克隆 request：

```javascript
// src/test-utils/mocks/msw-handlers.js
export const getUploadUrlHandler = http.post(
  `${API_URL}/upload-url`,
  async ({ request }) => {
    let body;
    try {
      // 安全地读取 request body
      const clonedRequest = request.clone();
      body = await clonedRequest.json();
    } catch (error) {
      console.warn('无法克隆 request，使用原始 request');
      body = await request.json();
    }
    
    const { fileKey, contentType } = body;
    return HttpResponse.json({ uploadUrl: `https://mock-url/${fileKey}` });
  }
);
```

#### 解决方案 3：三阶段测试模式

将测试分为三个阶段，确保每个阶段都正确初始化：

```javascript
describe('Upload API 集成测试', () => {
  beforeEach(async () => {
    // Phase 1: 重置环境
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
    
    // Phase 2: 配置 Amplify
    Amplify.configure({ /* ... */ });
    
    // Phase 3: 设置认证状态
    setAuthenticated({ userId: 'test-user-001' });
  });
  
  it('应该成功获取上传 URL', async () => {
    const uploadUrl = await getUploadUrl('test.mp3', 'audio/mpeg');
    expect(uploadUrl).toContain('https://');
  });
});
```

#### 最佳实践总结

1. **始终在 beforeEach 中恢复 fetch**：确保 MSW 能正确拦截
2. **使用 try-catch 保护 request.clone()**：处理边缘情况
3. **测试文件使用三阶段模式**：重置 → 配置 → 认证
4. **避免在测试中直接修改 globalThis**：使用 setup.js 统一管理

**结果**：
- 从 19 个失败 → 0 个失败
- 68 个上传 API 测试 100% 通过
- MSW 和 Amplify V6 完美协作

---

## AWS 后端配置与测试

### 环境变量配置

项目使用 `.env.contract` 文件存储真实 AWS 后端配置：

```bash
# .env.contract - 契约测试环境配置
VITE_COGNITO_USER_POOL_ID=us-east-1_Bz6JC9ko9
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=1nkup2vppbuk3n2d4575vbcoa0
VITE_AWS_REGION=us-east-1
VITE_API_ENDPOINT=https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com
VITE_API_STAGE=dev
VITE_S3_BUCKET=vfs-tracker-objstor

# 测试用户凭证
TEST_USER_EMAIL=test-contract@yourdomain.com
TEST_USER_PASSWORD=YourSecurePassword123!
```

### 运行契约测试

契约测试会调用**真实的 AWS API**，验证后端是否符合预期：

```bash
# 使用 .env.contract 配置运行
npm run test:contract

# 开发模式（监视文件变化）
npm run test:contract:dev
```

### 测试覆盖的 AWS 服务

契约测试验证以下 AWS 服务的集成：

#### 1. Cognito 认证

```javascript
// tests/contract/api-contract.test.js
it('应该能使用 Cognito 登录', async () => {
  const session = await signIn({
    username: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  expect(session.tokens.accessToken).toBeDefined();
});
```

#### 2. API Gateway 端点

测试的端点：
- `GET /all-events` - 获取所有公共事件
- `GET /events/:userId` - 获取用户事件
- `POST /events` - 创建新事件
- `DELETE /event/:eventId` - 删除事件
- `GET /user/:userId` - 获取用户资料
- `PUT /user/:userId` - 更新用户资料
- `POST /upload-url` - 获取 S3 上传 URL
- `POST /file-url` - 获取文件下载 URL

#### 3. S3 存储

```javascript
it('应该能生成有效的 S3 上传 URL', async () => {
  const uploadUrl = await getUploadUrl('test-file.mp3', 'audio/mpeg');
  
  // 验证 URL 格式
  expect(uploadUrl).toContain('vfs-tracker-objstor');
  expect(uploadUrl).toContain('X-Amz-Signature');
  
  // (可选) 测试实际上传
  // const uploadResponse = await fetch(uploadUrl, {
  //   method: 'PUT',
  //   body: mockAudioFile,
  // });
  // expect(uploadResponse.ok).toBe(true);
});
```

### 测试用户管理

#### 创建测试用户

如果测试用户不存在，需要在 AWS Cognito 中创建：

1. 登录 AWS Console
2. 进入 Cognito User Pools
3. 选择 Pool ID: `us-east-1_Bz6JC9ko9`
4. 创建新用户：
   - Email: `test-contract@yourdomain.com`
   - Temporary password: 系统生成
   - 确认用户并设置永久密码: `YourSecurePassword123!`

#### 测试用户权限

测试用户需要以下权限：
- 读取公共事件
- 创建/读取/更新/删除自己的事件
- 读取/更新自己的用户资料
- 生成 S3 上传/下载 URL

### 故障排查

#### 问题 1：环境变量未加载

**症状**：测试报错 "Missing required environment variables"

**解决方案**：
```bash
# 确保 .env.contract 文件存在
ls .env.contract

# 检查 package.json 中的脚本
cat package.json | grep test:contract
# 应该包含: "dotenv -e .env.contract -- vitest run tests/contract/"
```

#### 问题 2：Cognito 认证失败

**症状**：测试报错 "UserNotFoundException" 或 "NotAuthorizedException"

**解决方案**：
1. 验证测试用户存在于 Cognito User Pool
2. 确认密码正确（不是临时密码）
3. 检查 User Pool ID 和 Client ID 配置

#### 问题 3：API 请求超时

**症状**：测试运行超过 30 秒后超时

**解决方案**：
```javascript
// vitest.contract.config.js
export default defineConfig({
  test: {
    testTimeout: 60000,  // 增加到 60 秒
  },
});
```

#### 问题 4：S3 权限错误

**症状**：上传 URL 返回 403 Forbidden

**解决方案**：
1. 检查 S3 bucket 的 CORS 配置
2. 验证 IAM 角色权限
3. 确认 presigned URL 未过期

### CI/CD 集成

在 GitHub Actions 中运行契约测试：

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on:
  schedule:
    - cron: '0 0 * * *'  # 每天运行一次
  workflow_dispatch:      # 支持手动触发

jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run contract tests
        env:
          VITE_COGNITO_USER_POOL_ID: ${{ secrets.TEST_USER_POOL_ID }}
          VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: ${{ secrets.TEST_CLIENT_ID }}
          VITE_AWS_REGION: us-east-1
          VITE_API_ENDPOINT: ${{ secrets.TEST_API_ENDPOINT }}
          VITE_S3_BUCKET: ${{ secrets.TEST_S3_BUCKET }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: npm run test:contract
```

---

## 故障排查

### 常见问题

#### 1. 测试超时

**症状**：测试运行缓慢或超时

**解决方案**：

```javascript
// 增加单个测试的超时时间
test('slow test', async () => {
  // ...
}, { timeout: 10000 }); // 10 秒

// 或在 vite.config.js 中全局设置
export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});
```

#### 2. MSW 未拦截请求

**症状**：实际发送了 HTTP 请求而非使用 mock

**解决方案**：

```javascript
// 检查 MSW server 是否正确初始化
// src/test-utils/setup.js
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/msw-server.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

#### 3. React 组件未渲染

**症状**：`screen.getByRole` 找不到元素

**解决方案**：

```javascript
// 1. 使用 debug 查看 DOM
import { screen } from '@testing-library/react';
screen.debug(); // 打印整个 DOM
screen.debug(screen.getByRole('button')); // 打印特定元素

// 2. 使用 waitFor 等待异步渲染
await waitFor(() => {
  expect(screen.getByRole('button')).toBeInTheDocument();
});

// 3. 检查是否使用了正确的渲染函数
renderWithProviders(<MyComponent />); // 而非 render()
```

#### 4. Schema 验证失败

**症状**：Joi 验证报错

**解决方案**：

```javascript
// 打印详细的验证错误
const { error, value } = schema.validate(data);
if (error) {
  console.error('Validation errors:');
  error.details.forEach(detail => {
    console.error(`  ${detail.path.join('.')}: ${detail.message}`);
  });
}

// 使用 { abortEarly: false } 查看所有错误
const { error } = schema.validate(data, { abortEarly: false });
```

#### 5. 测试隔离问题

**症状**：单独运行测试通过，一起运行失败

**解决方案**：

```javascript
// 确保每个测试都清理副作用
afterEach(() => {
  // 清理 DOM
  document.body.innerHTML = '';
  
  // 清理存储
  localStorage.clear();
  sessionStorage.clear();
  
  // 重置 mocks
  vi.clearAllMocks();
  
  // 重置 MSW handlers
  server.resetHandlers();
});
```

### 调试技巧

#### 使用 Vitest UI

```bash
npm run test:ui
```

在浏览器中查看测试结果，支持：
- 可视化测试树
- 查看失败原因
- 重新运行单个测试
- 查看覆盖率

#### 使用 --bail 快速失败

```bash
npm test -- --bail
```

遇到第一个失败的测试就停止。

#### 运行特定测试

```bash
# 运行特定文件
npm test -- schemas.test.js

# 运行匹配的测试
npm test -- -t "should validate user data"

# 只运行标记为 .only 的测试
test.only('this test', () => { ... });
```

#### 查看覆盖率

```bash
npm run test:coverage
```

覆盖率报告生成在 `coverage/` 目录，使用浏览器打开 `coverage/index.html` 查看详细报告。

---

## 测试最佳实践总结

### ✅ DO (应该做)

1. **Schema 先行**：先定义 schema，再实现功能
2. **定期运行契约测试**：至少每周一次
3. **契约测试失败后立即修复**：说明 mock 和真实 API 不对齐
4. **保持 MSW handlers 简单**：只返回符合 schema 的数据
5. **使用真实的测试账号**：契约测试需要真实凭证
6. **在 beforeEach 中恢复 fetch**：确保 Amplify + MSW 正确协作
7. **使用三阶段测试模式**：重置 → 配置 → 认证

### ❌ DON'T (不应该做)

1. **不要在集成测试中猜测 API 格式**：先运行契约测试确认
2. **不要跳过契约测试**：即使麻烦也要定期运行
3. **不要在生产环境运行契约测试**：使用专门的测试环境
4. **不要手动同步 mock**：基于契约测试结果自动化更新
5. **不要忽略 schema 验证错误**：这是 API 不一致的信号
6. **不要直接修改 globalThis.fetch**：使用 setup.js 统一管理
7. **不要在测试中使用硬编码的环境变量**：使用配置文件

---

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW 文档](https://mswjs.io/docs/)
- [Joi 文档](https://joi.dev/api/)
- [测试最佳实践](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [测试架构详解](./TESTING_ARCHITECTURE.md)
- [契约测试指南](../tests/contract/README.md)

---

## 更新日志

- **2025-01-12**: 文档整合与增强
  - 合并 TESTING_STRATEGY.md 内容
  - 添加 Amplify V6 + MSW 集成模式
  - 添加 AWS 后端配置与测试章节
  - 添加 Schema 驱动开发工作流
  - 添加契约测试驱动开发流程
  - 重新组织最佳实践和工作流程

- **2024-03-15**: Phase 3.1 完成，测试框架全面引入
  - 添加 Vitest, jsdom, RTL, MSW
  - 创建 Schema 定义和验证
  - 建立 Fixtures 系统
  - 编写单元测试、集成测试和契约测试
  - 编写完整的测试文档

---

如有问题或建议，请在项目 issue 中讨论。
