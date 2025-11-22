# Contract Tests (契约测试)

## ⚠️ 重要提醒 / Important Notice

### 🔴 数据写入风险 / Data Write Risk

**契约测试会向真实的 AWS 环境写入数据！**

当前测试会执行以下操作：
- ✅ 创建测试事件（2 个 self-test 事件）
- ✅ 更新测试账号的个人资料（Bio 字段）
- ✅ 请求 S3 预签名 URL（可能产生访问记录）
- ✅ 读取真实的用户和事件数据

**⚠️ 当前状态**: 测试后**不会自动清理数据**

**潜在风险**:
- 🗑️ 长期运行会在数据库中积累垃圾测试数据
- 📝 测试账号资料会被反复修改
- 💰 可能产生 AWS 使用费用（特别是 DynamoDB 读写和 S3 操作）
- 🔍 影响数据分析的准确性（混入测试数据）

**建议措施**:
1. ✅ **使用独立的测试环境**（dev/test，不是 production）
2. 🕒 定期手动清理测试数据（使用 AWS Console 或脚本）
3. 📊 监控 AWS 使用情况，避免意外费用
4. 📋 参考 [ROADMAP Phase 5.3.4](../../ROADMAP.md#p534-契约测试自动清理-1h) 的自动清理计划

**未来改进**:
Phase 5.3.4 计划实现测试后自动清理机制，包括：
- 记录创建的事件 ID
- 在 `afterAll` 中调用删除 API
- 恢复修改的用户资料
- 详见 [CODE_REVIEW_ROUND3_RESPONSE.md](../../CODE_REVIEW_ROUND3_RESPONSE.md#p1-契约测试数据清理)

---

## 什么是 Contract Tests?

Contract Tests（契约测试）是一种测试方法，用于验证真实的 API 实现是否符合预定义的"契约"（在我们的案例中是 Joi schemas）。与单元测试和集成测试使用 mock 数据不同，契约测试会调用真实的后端 API。

## 为什么需要 Contract Tests?

1. **验证真实 API 行为**：确保后端 API 的实际响应与前端期望一致
2. **及早发现接口变更**：当后端修改 API 时，契约测试会立即失败
3. **文档即代码**：Schema 定义同时作为 API 文档和验证规则
4. **跨团队协作**：前后端团队可以基于 schema 独立开发

## 当前测试状态 ✅

**完整版本** (2025-01-20 更新):
- ✅ **16/16 测试通过 (100%)**
- ✅ 验证了 100/102 个公共事件
- ✅ 包含完整的 CRUD 操作测试
- ✅ 包含数据一致性验证
- ✅ 包含错误处理测试
- 🔒 备份文件: `api-contract.test.js.backup`

## 运行前提

契约测试需要真实的 AWS 环境配置。请确保以下环境变量已设置：

### 快速开始

复制示例文件并填写真实值：

```bash
cp .env.contract.example .env.contract
```

编辑 `.env.contract`，填写以下必需变量：

```ini
# AWS Cognito 配置
VITE_COGNITO_USER_POOL_ID=us-east-1_YourPoolId
VITE_COGNITO_USER_POOL_WEB_CLIENT_ID=YourClientId
VITE_AWS_REGION=us-east-1

# API Gateway 配置
VITE_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com
VITE_API_STAGE=dev

# 测试用户凭证（用于认证测试）
TEST_USER_EMAIL=test-user@example.com
TEST_USER_PASSWORD=YourTestPassword

# S3 配置（用于上传测试）
VITE_S3_BUCKET=your-bucket-name
```

### 环境变量详解

**必需变量**:
- `VITE_COGNITO_USER_POOL_ID` - Cognito 用户池 ID
- `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID` - Cognito Web 客户端 ID
- `VITE_AWS_REGION` - AWS 区域（如 `us-east-1`）
- `VITE_API_ENDPOINT` - API Gateway 端点

**可选变量**:
- `VITE_API_STAGE` - API 阶段（默认为空）
- `TEST_USER_EMAIL` - 测试账户邮箱（未设置则跳过认证测试）
- `TEST_USER_PASSWORD` - 测试账户密码
- `VITE_S3_BUCKET` - S3 存储桶（未设置则跳过上传测试）
- `CONTRACT_AVATAR_USER_ID` - (可选) 具有已知头像的用户 ID，用于 GET /avatar 契约测试
- `CONTRACT_AVATAR_KEY` - (可选) 上述用户头像在 S3 中的对象键，形如 `avatars/{userId}/{timestamp}-{userId}.png`

如果环境变量未配置，契约测试会自动跳过（使用 `it.skip`）。

## 运行方式

```bash
# 运行所有契约测试
npm run test:contract

# 运行契约测试并查看详细输出
npm run test:contract -- --reporter=verbose

# 运行特定的契约测试文件
npm run test:contract tests/contract/api-contract.test.js
```

## 测试覆盖

契约测试现在包含以下完整测试套件：

### 1. 健康检查 (1 测试)
- ✅ API 端点可访问性验证

### 2. 公共端点 (2 测试)
- ✅ GET /all-events - 获取所有公共事件 (验证 100/102 事件)
- ✅ GET /user/{userId}/public - 获取用户公共资料

### 3. 用户事件 CRUD (2 测试)
- ✅ GET /events/{userId} - 获取用户事件列表
- ✅ POST /events - 创建新事件
- ✅ DELETE /event/{eventId} - 删除事件

### 4. 用户资料 CRUD (2 测试)
- ✅ GET /user/{userId} - 获取用户完整资料
- ✅ PUT /user/{userId} - 更新用户资料

### 5. 文件管理 (3 测试)
- ✅ POST /upload-url - 获取 S3 预签名上传 URL
- ✅ POST /file-url - 获取文件访问 URL
- ✅ GET /avatar/{userId}?key=... - 获取用户头像 URL（需要配置 CONTRACT_AVATAR_USER_ID/KEY）

### 6. 错误处理 (3 测试)
- ✅ 未授权请求返回 401/403
- ✅ 无效数据返回 400
- ✅ 删除不存在资源返回 404

### 7. 数据一致性 (2 测试)
- ✅ 创建的事件立即可在列表中找到
- ✅ 更新的资料立即可读取

**总计: 16 个测试，覆盖 10 个 API 端点**

## 注意事项

### 测试数据清理
契约测试会在真实环境中创建数据。测试完成后应该清理：

```javascript
// 创建测试事件
const createdEvent = await createEvent(testData);

// 运行测试
expect(createdEvent).toMatchSchema(eventSchema);

// 清理
try {
  await deleteEvent(createdEvent.eventId);
  console.log('✓ 测试数据已清理');
} catch (error) {
  console.warn('⚠️  清理失败:', error.message);
}
```

### 网络问题处理
契约测试依赖网络连接，可能会因为网络问题失败：

```javascript
try {
  const result = await callApi();
  expect(result).toMatchSchema(schema);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    console.warn('⚠️  网络错误，跳过测试');
    return;
  }
  throw error;
}
```

### 认证要求
大部分契约测试需要用户认证。建议创建一个专门的测试账号：

```javascript
beforeAll(async () => {
  // 登录测试账号
  await signIn('test@example.com', 'test-password');
});

afterAll(async () => {
  // 登出
  await signOut();
});
```

## 在 CI/CD 中运行

建议在 CI/CD 流程中定期运行契约测试，但不作为每次提交的必需步骤：

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests
on:
  schedule:
    - cron: '0 */6 * * *'  # 每6小时运行一次
  workflow_dispatch:  # 允许手动触发

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:contract
        env:
          VITE_COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_POOL_ID }}
          VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
          VITE_AWS_REGION: us-east-1
          VITE_API_ENDPOINT: ${{ secrets.API_ENDPOINT }}
          VITE_S3_BUCKET: ${{ secrets.S3_BUCKET }}
```

## 调试技巧

### 查看完整的 API 响应
```javascript
const response = await callApi();
console.log('API Response:', JSON.stringify(response, null, 2));
```

### 验证特定字段
```javascript
const { error, value } = schema.validate(data);
if (error) {
  console.error('Validation failed:', error.details);
  error.details.forEach(detail => {
    console.error(`  - ${detail.path.join('.')}: ${detail.message}`);
  });
}
```

### 使用 verbose 模式
```bash
npm run test:contract -- --reporter=verbose --bail
```

## 故障排除

### 问题 1: 契约测试全部跳过

**症状**: `⚠️  契约测试已跳过：缺少必需的环境变量`

**解决方案**:
1. 检查 `.env.contract` 文件是否存在
2. 验证环境变量是否正确加载（在测试中添加 `console.log`）
3. 确认 `vitest.contract.config.js` 中的 `envFiles` 配置正确

### 问题 2: 测试超时或连接失败

**症状**: `Error: connect ETIMEDOUT` 或 `Request timeout`

**解决方案**:
1. 验证 API 端点可访问：`curl https://your-api-endpoint/dev/all-events`
2. 检查 `VITE_AWS_REGION` 与 API Gateway 部署区域一致
3. 增加超时时间：`it('test', async () => {...}, { timeout: 30000 })`

### 问题 3: 认证失败

**症状**: `Error: Unauthorized` 或 `Invalid credentials`

**解决方案**:
1. 确认 `TEST_USER_EMAIL` 和 `TEST_USER_PASSWORD` 正确
2. 验证测试账户在 Cognito User Pool 中存在
3. 使用 AWS CLI 测试认证：`aws cognito-idp describe-user-pool-client`

### 问题 4: DynamoDB 数据过期或不一致

**症状**: `Expected 10 events, received 0` 或 `User profile not found`

**解决方案**:
1. 刷新测试数据：`node scripts/refresh-dynamo-fixtures.js`（如果存在）
2. 手动检查 DynamoDB：`aws dynamodb scan --table-name VoiceFemUsers`
3. 跳过依赖特定数据的测试（添加数据验证）

### 问题 5: Schema 验证失败

**症状**: `ValidationError: "field" is required`

**解决方案**:
1. 查看实际 API 响应：在测试中添加 `console.log(JSON.stringify(response, null, 2))`
2. 更新 Schema（如果 API 行为正确）：修改 `src/api/schemas.js`
3. 修复 API（如果 Schema 正确）：检查 Lambda 函数返回格式
4. 记录为已知问题（如果是临时不一致）

## 常见问题

### Q: 契约测试失败了，是前端还是后端的问题？
A: 首先检查 schema 定义是否正确。如果 schema 正确但测试失败，说明后端 API 的响应与预期不符，需要与后端团队沟通。

### Q: 如何处理 API 版本变更？
A: 
1. 更新 schema 定义以匹配新的 API 响应
2. 如果是 breaking change，考虑同时支持新旧版本
3. 更新相关的业务代码和测试

### Q: 契约测试运行很慢怎么办？
A: 
1. 使用并行测试（Vitest 默认支持）
2. 只在必要时运行完整的契约测试
3. 考虑使用测试环境而非生产环境

### Q: 测试数据清理失败了怎么办？
A: 
1. 检查清理逻辑是否正确
2. 考虑使用定时任务清理测试数据
3. 为测试数据添加特殊标记，便于批量清理

## 最佳实践

### 使用独立的测试账户
**不要**使用生产环境账户运行契约测试。建议：
- ✅ 创建专用的测试环境（dev/test）
- ✅ 使用独立的 Cognito User Pool
- ✅ 使用独立的 DynamoDB 表

### 最小化 API 调用
契约测试应该：
- ✅ 验证关键 API 端点
- ✅ 检查响应格式是否符合 Schema
- ❌ 避免大量重复调用
- ❌ 避免创建大量测试数据

### 定期刷新测试数据
建议每周运行一次数据刷新脚本，确保测试数据与 API 行为一致。

### 监控 AWS 费用
契约测试会产生 API Gateway、DynamoDB 和 Cognito 费用。建议设置 AWS Budgets 和 Billing Alarms。

## 关键发现与最佳实践

### 🔐 Amplify v6 认证模式 (重要!)

Amplify v6 的 REST API **不会**自动附加 Cognito 令牌。必须手动添加 Authorization 头:

```javascript
const session = await fetchAuthSession();
const idToken = session.tokens.idToken.toString();

const operation = get({
  apiName: 'api',
  path: '/events/user-id',
  options: {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
  }
});
```

参考 `src/api.js` 中的 `authenticatedGet/Post/Put` 函数查看生产实现。

### 📡 实际 API 路径

测试必须使用实际的 API 路径，而非理想化的 REST 约定:

| 功能 | 实际路径 | ❌ 错误路径 |
|------|----------|-----------|
| 获取用户事件 | `GET /events/{userId}` | `/user/events` |
| 获取用户资料 | `GET /user/{userId}` | `/user/profile` |
| 创建事件 | `POST /events` | `/user/events` |
| 更新资料 | `PUT /user/{userId}` | `/user/profile` |
| 删除事件 | `DELETE /event/{eventId}` | `/events/{eventId}` |

### 📦 API 响应格式

真实 API 返回的数据结构与 schema 定义可能不同:

```javascript
// GET /user/{userId} 返回嵌套结构
{
  userId: "...",
  profile: {
    nickname: "...",
    name: "...",
    bio: "..."
  }
}

// POST /events 返回消息格式
{
  message: "Event added successfully",
  eventId: "event_..."
}

// POST /upload-url 返回 URL
{
  uploadUrl: "https://storage.vfs-tracker.app/...",
  fileKey: "attachments/userId/filename"
}
```

### 🔄 数据格式兼容性

数据库包含混合格式,需要向后兼容:

- **事件类型**: `'self-test'` (旧) 和 `'self_test'` (新)
- **感受日志**: `{feeling, note}` (旧) 和 `{content}` (新)

Schema 已扩展为接受两种格式,待 Phase 3.2 数据迁移后统一。

### 🗂️ S3 文件路径格式

上传文件时,`fileKey` 必须遵循格式:

```
<folder>/<userId>/<filename>
```

例如: `attachments/44e8a4b8-e081-701d-e859-20f7ddbf1d94/report.pdf`

### 🌐 S3 自定义域名

API 使用自定义域名而非 AWS 默认域名:
- ✅ `storage.vfs-tracker.app`
- ❌ `s3.amazonaws.com`

### 💾 会话缓存

测试使用会话缓存避免重复登录:

```javascript
let currentSession = null;

async function signInTestUser() {
  if (currentSession) {
    console.log('♻️  使用缓存的用户会话');
    return currentSession;
  }
  
  // 首次登录
  const { isSignedIn } = await signIn({...});
  const session = await fetchAuthSession();
  currentSession = session;
  return session;
}
```

这将测试运行时间从 30+ 秒减少到 16 秒。

## 通用最佳实践

1. **独立性**：每个测试应该独立，不依赖其他测试的结果
2. **清理**：测试后必须清理创建的数据 (当前部分实现)
3. **幂等性**：测试应该可以重复运行
4. **详细日志**：记录详细的测试过程，便于调试
5. **超时设置**：为网络请求设置合理的超时时间
6. **错误处理**：区分网络错误、认证错误和业务错误
7. **安全备份**：修改测试文件前先创建备份

## 扩展阅读

- [Joi Schema Documentation](https://joi.dev/api/)
- [Contract Testing Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html)
- [AWS Amplify API Documentation](https://docs.amplify.aws/javascript/build-a-backend/restapi/)
