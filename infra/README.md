# VFS-Tracker Infrastructure

本目录包含 VFS-Tracker 后端基础设施的 IaC (Infrastructure as Code) 定义。

## 离线同步幂等发布（待部署）

`POST /events` 新增可选 `clientRequestId`。先部署 `addVoiceEvent` 及其依赖，再发布前端；旧后端忽略该字段，不能保证去重。相同账号和标识使用稳定事件主键及条件PutItem，条件失败通过 `ReturnValuesOnConditionCheckFailure=ALL_OLD` 比较原记录，不需要额外表、索引或GetItem请求。确认执行角色允许返回条件失败旧值。重复相同内容返回原eventId，不同内容返回409。部署后用隔离测试账号核对重复请求只新增一条事件及一次插入触发，不以本地协议模拟代替真实云端验收。边界和测试见 [离线队列说明](../docs/offline-events.md)。

## 🎉 当前状态

> **最后更新**: 2026-05-06

| 资源类型 | 状态 | CloudFormation Stack |
|----------|------|---------------------|
| DynamoDB Tables (4) | ✅ CloudFormation 管理 | `vfs-tracker` |
| Lambda Functions (18) | ✅ CloudFormation 管理 | `vfs-tracker` |
| API Gateway | ✅ CloudFormation 管理 | `vfs-tracker` |
| Lambda Permissions (19) | ✅ CloudFormation 管理 | `vfs-tracker` |
| S3 Deployment Bucket | ✅ CloudFormation 管理 | `vfs-tracker` |

**Stack 信息**:
- Name: `vfs-tracker`
- Region: `us-east-1`
- Status: `UPDATE_COMPLETE`
- Termination Protection: ✅ 已启用
- 总资源数: **42 个**

**API Gateway 信息**:
- API ID: `wg3q2nomc3`
- 自定义域名: `api.vfs-tracker.app`
- Endpoint: `https://api.vfs-tracker.app/dev/`

---

## 📊 资源清单

### Lambda 函数 (18 个)

| 函数名 | 运行时 | 内存 | 超时 | 触发方式 |
|--------|--------|------|------|----------|
| `addVoiceEvent` | nodejs24.x | 128MB | 3s | API Gateway POST /events |
| `getVoiceEvents` | nodejs24.x | 128MB | 10s | API Gateway GET /events/{userId}，完整消费 Query 游标 |
| `getAllPublicEvents` | nodejs24.x | 3008MB | 29s | API Gateway GET /all-events |
| `getReadingPassages` | nodejs24.x | 128MB | 5s | API Gateway GET /reading-passages |
| `deleteEvent` | nodejs24.x | 128MB | 3s | API Gateway DELETE /event/{eventId} |
| `autoApproveEvent` | nodejs24.x | 1024MB | 300s | DynamoDB Stream |
| `getUserProfile` | nodejs24.x | 128MB | 3s | API Gateway GET /user/{userId} |
| `getUserPublicProfile` | nodejs24.x | 128MB | 3s | API Gateway GET /user/{userId}/public |
| `updateUserProfile` | nodejs24.x | 128MB | 3s | API Gateway PUT /user/{userId} |
| `vfsTrackerUserProfileSetup` | nodejs24.x | 128MB | 3s | API Gateway POST /user/profile-setup |
| `getUploadUrl` | nodejs24.x | 128MB | 3s | API Gateway POST /upload-url |
| `getFileUrl` | nodejs24.x | 128MB | 3s | API Gateway POST /file-url |
| `getAvatarUrl` | nodejs24.x | 128MB | 3s | API Gateway GET /avatar/{userId} |
| `online-praat-analysis` | Container (Python) | 3008MB | 300s | API Gateway (多个端点) |
| `gemini-proxy` | nodejs24.x | 128MB | 30s | API Gateway POST /gemini-proxy |
| `get-song-recommendations` | nodejs24.x | 128MB | 29s | API Gateway POST /recommend-songs |
| `edge-probe` | nodejs24.x | 128MB | 3s | API Gateway GET/POST /edge-probe |
| `cleanupStorage` | nodejs24.x | 256MB | 900s | EventBridge 每日 03:15 UTC |

`cleanupStorage` 只删除未被事件引用且已超过宽限期的附件，以及过期会话的 `voice-tests/*/raw/` 录音；报告和图表继续保留。保留期、演练模式与上线检查见 [S3 存储清理](../docs/storage-cleanup.md)。

### API 路由

```
GET    /all-events          → getAllPublicEvents (公开)
GET    /public/dashboard    → getAllPublicEvents (公开轻量首屏，15 秒缓存)
GET    /reading-passages    → getReadingPassages (公开启用稿件)
GET    /public/users/{userId}/events?ids=[...] → getAllPublicEvents (公开明细，每页最多 20 个 ID)
GET    /events/{userId}     → getVoiceEvents (需认证)
POST   /events              → addVoiceEvent (需认证)
DELETE /event/{eventId}     → deleteEvent (需认证)
GET    /user/{userId}       → getUserProfile (需认证)
GET    /user/{userId}/public → getUserPublicProfile (公开)
PUT    /user/{userId}       → updateUserProfile (需认证)
POST   /user/profile-setup  → vfsTrackerUserProfileSetup (需认证，baseVersion 条件写入)
POST   /upload-url          → getUploadUrl (需认证)
POST   /file-url            → getFileUrl (需认证)
GET    /avatar/{userId}     → getAvatarUrl (需认证)
POST   /sessions            → online-praat-analysis (需认证)
POST   /uploads             → online-praat-analysis (需认证)
POST   /analyze             → online-praat-analysis (需认证)
GET    /results/{sessionId} → online-praat-analysis (需认证)
POST   /gemini-proxy        → gemini-proxy (需认证)
POST   /recommend-songs     → get-song-recommendations (需认证)
GET/POST /edge-probe        → edge-probe (公开)
```

### DynamoDB 表

| 表名 | 分区键 | 排序键 | 计费模式 | 特殊配置 |
|------|--------|--------|----------|----------|
| `VoiceFemEvents` | userId (S) | eventId (S) | PAY_PER_REQUEST | Stream (NEW_IMAGE) |
| `VoiceFemUsers` | userId (S) | - | PAY_PER_REQUEST | - |
| `VoiceFemTests` | sessionId (S) | - | PAY_PER_REQUEST | - |
| `VoiceFemReadingPassages` | passageId (S) | - | PAY_PER_REQUEST | 启用状态由 enabled 字段控制 |

### IAM 角色

| 角色名 | 使用的 Lambda |
|--------|---------------|
| `addVoiceEvent-role-l30o387r` | 大部分 Lambda (12个) |
| `getAllPublicEvents-role-33fp67ha` | getUserProfile, vfsTrackerUserProfileSetup |
| `gemini-proxy-role-cegcoi6x` | gemini-proxy |
| `edge-probe-role-ttc3yql4` | edge-probe |

---

## 🎛️ 资源管理分工

### CloudFormation 管理的资源

通过 `template-production.yaml` 定义，可使用 `npm run deploy:backend` 更新：

| 资源 | 数量 | 说明 |
|------|------|------|
| Lambda Functions | 18 | 包括 Node.js 和 Python 容器 |
| DynamoDB Tables | 4 | VoiceFemEvents, VoiceFemUsers, VoiceFemTests, VoiceFemReadingPassages |
| IAM Roles | 1 | getReadingPassages 的最小 DynamoDB 只读角色 |
| S3 Bucket | 1 | vfs-tracker-sam-deployments (部署产物存储) |
| API Gateway REST API | 1 | VoiceFemApi |
| API Gateway Deployment | 1 | dev 阶段 |
| API Gateway Stage | 1 | dev |
| Lambda Permissions | 19 | API Gateway 调用权限 |

### 控制台管理的资源

以下资源通过 ARN 引用，不纳入 CloudFormation：

| 资源 | ID/名称 | 原因 |
|------|---------|------|
| IAM Roles | 4 个执行角色 | 导入风险高，现有策略复杂 |
| Cognito User Pool | `us-east-1_Bz6JC9ko9` | 包含用户数据 |
| S3 Bucket (业务数据) | `vfs-tracker-objstor` | 用于用户上传的文件 |
| ECR Repository | `vfs-tracker-images` | 通过 --resolve-image-repos 管理 |
| 自定义域名 | `api.vfs-tracker.app` | Base Path Mapping 需手动切换 |
| DynamoDB Stream Mapping | autoApproveEvent 触发器 | 已存在于堆栈外部 |

---

## 🚀 快速开始

### 本地部署

```powershell
# 一键部署后端
npm run deploy:backend
```

部署命令会在 CloudFormation 成功后幂等初始化两篇朗读稿件；已存在的 `passageId` 不会被覆盖，管理员编辑内容会保留。

### 自动发布顺序与门禁

推送到 `master` 后固定执行一条发布路径：`Deploy Backend` 先判断本次提交是否包含后端改动；存在改动时，先运行 ESLint、Lambda/基础设施单元测试与 API 集成测试，再构建 Python 镜像并执行其中的完整 `pytest` 声学测试。镜像阶段只推送标签并返回不可变 SHA 地址；SAM validate/build/deploy 成功后，统一工作流才将该 SHA 地址发布到 Python Lambda，随后初始化朗读稿件。没有后端改动时该工作流只完成变更分类，不写入 AWS。

只有同一提交的 `Deploy Backend` 工作流成功后，`Deploy to GitHub Pages` 才会检出该工作流的 `head_sha`，执行前端单元测试、浏览器测试和生产 PWA 离线测试并发布。后端失败会阻止依赖新协议的前端版本上线；前端工作流不提供绕过顺序的独立手动发布入口，需要重跑时从后端工作流开始。

面向 `master` 的 PR 会先运行 `Verify Pull Request`：完整前端单元/集成/Chromium/PWA/构建门禁、后端与基础设施测试及 SAM validate/build。PR 代码只获得固定隔离配置，不读取生产 Secrets。修改 Python 声学函数时还会在原生 ARM64 runner 上复用同一镜像工作流，但设置 `publish: false`，因此完整构建和 `pytest` 会执行，不会登录 ECR、更新 Lambda 或写入 AWS。

> Node.js Lambda 统一使用 `nodejs24.x`。本地部署前请确认 AWS SAM CLI 版本不低于 `1.147.1`，旧版本会在 `sam build` 阶段报 `nodejs24.x runtime is not supported`。

> 每个 Node.js Lambda 的 `CodeUri` 都提交独立 `package-lock.json`，两套 SAM 模板通过 `Metadata.BuildProperties.UseNpmCi: true` 强制使用 `npm ci`。源码新增第三方 import 时必须同步更新该函数的 `package.json` 与锁文件，不能依赖根目录或本地残留的 `node_modules`。

> Node.js Lambda 默认使用 `LOG_LEVEL=INFO`，并由 Lambda Advanced Logging Controls 输出 JSON。AI 与医院报告函数不得记录完整请求、模型正文、附件地址或原始用户标识；详见 `docs/backend-structured-logging.md`。

### 添加新 Lambda 函数

1. **创建函数代码**：
   ```bash
   mkdir lambda-functions/newFunction
   # 创建 index.mjs 和 package.json
   ```

2. **更新 SAM 模板** (`template-production.yaml`)：
   ```yaml
   NewFunction:
     Type: AWS::Serverless::Function
     Metadata:
       BuildProperties:
         UseNpmCi: true
     Properties:
       FunctionName: newFunction
       CodeUri: ../lambda-functions/newFunction/
       Handler: index.handler
       Runtime: nodejs24.x
       Role: arn:aws:iam::296821242554:role/service-role/addVoiceEvent-role-l30o387r
       Events:
         ApiEvent:
           Type: Api
           Properties:
             RestApiId: !Ref VoiceFemApi
             Path: /new-endpoint
             Method: POST
             Auth:
               Authorizer: CognitoAuthorizer
   ```

   同时提交 `lambda-functions/newFunction/package-lock.json`，并在 `template.yaml` 中添加同等的资源、权限、环境变量和路由声明。

3. **部署**：
   ```powershell
   npm run deploy:backend
   ```

### 添加新 API 路由

只需在 Lambda 函数的 `Events` 部分添加新的 API 事件。SAM 会自动创建：
- API Gateway Resource
- API Gateway Method  
- Lambda Permission

### 本地测试

```powershell
cd infra
sam build --template template-production.yaml
sam local invoke FunctionName --event events/test.json
```

---

## 📁 目录结构

```
infra/
├── README.md                   # 本文件
├── template-production.yaml    # 生产 SAM 模板 (用于更新部署)
├── template.yaml               # 开发 SAM 模板 (带环境后缀)
├── import-all-template.yaml    # 导入模板 (初始导入用，已完成)
├── import-all-resources.json   # 资源导入映射文件 (已完成)
├── samconfig.toml              # SAM CLI 配置
├── parameters/
│   ├── dev.json                # 开发环境参数
│   └── prod.json               # 生产环境参数
├── scripts/
│   └── ...                     # 辅助脚本
└── backup/                     # 配置备份（不提交到 Git）
```

---

## 🔒 安全注意事项

1. **SSM Parameter Store**：敏感信息（如 GEMINI_API_KEY）存储在 SSM Parameter Store (`/vfs-tracker/gemini-api-key`)
2. **DeletionPolicy**：所有数据资源设置为 `Retain`，防止意外删除
3. **IAM 角色**：Lambda 使用现有的 4 个 IAM 角色，通过 ARN 引用
4. **Termination Protection**：Stack 已启用终止保护
5. **医院报告处理**：`autoApproveEvent` 和 `deleteEvent` 从 `ExistingS3BucketName` 统一取得 `ATTACHMENTS_BUCKET`；自动审核函数从 SSM 取得 Gemini 密钥。删除事件时先清理 S3 附件，成功后再删除 DynamoDB 记录

医院报告会发送副本到 Google Gemini Files API 做自动一致性审核，授权管理员或运维人员也可通过独立 AWS 权限在管理后台生成附件限时链接。用户可见口径与验证范围见[医院报告处理与访问边界](../docs/hospital-report-access.md)。

---

## 📝 后续优化建议

1. **多环境支持**：创建 staging 环境进行测试
2. **监控和告警**：添加 CloudWatch Alarms、配置 X-Ray 追踪
3. **安全加固**：实现最小权限 IAM 策略、使用 AWS WAF 保护 API
4. **成本优化**：配置 Lambda Provisioned Concurrency

---

## 🔗 相关文档

- [AWS SAM 文档](https://docs.aws.amazon.com/serverless-application-model/)
- [CloudFormation 文档](https://docs.aws.amazon.com/cloudformation/)

## 资料字段补丁部署顺序（#171）

更新资料使用显式profilePatch请求及DynamoDB嵌套字段更新。先部署updateUserProfile后端，再发布前端；新前端请求旧后端会被拒绝，避免部分资料被整体替换。详情见[资料字段更新](../docs/profile-field-updates.md)。
