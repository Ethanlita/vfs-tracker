# VFS-Tracker Infrastructure

本目录包含 VFS-Tracker 后端基础设施的 IaC (Infrastructure as Code) 定义。

## 🎉 当前状态

> **最后更新**: 2025-11-27

| 资源类型 | 状态 | CloudFormation Stack |
|----------|------|---------------------|
| DynamoDB Tables (3) | ✅ CloudFormation 管理 | `vfs-tracker` |
| Lambda Functions (16) | ✅ CloudFormation 管理 | `vfs-tracker` |
| API Gateway | ✅ CloudFormation 管理 | `vfs-tracker` |
| Lambda Permissions (19) | ✅ CloudFormation 管理 | `vfs-tracker` |

**Stack 信息**:
- Name: `vfs-tracker`
- Region: `us-east-1`
- Status: `UPDATE_COMPLETE`
- Termination Protection: ✅ 已启用
- 总资源数: **41 个**

**API Gateway 信息**:
- API ID: `wg3q2nomc3`
- 自定义域名: `api.vfs-tracker.app`
- Endpoint: `https://api.vfs-tracker.app/dev/`

---

## 📊 资源清单

### Lambda 函数 (16 个)

| 函数名 | 运行时 | 内存 | 超时 | 触发方式 |
|--------|--------|------|------|----------|
| `addVoiceEvent` | nodejs20.x | 128MB | 3s | API Gateway POST /events |
| `getVoiceEvents` | nodejs20.x | 128MB | 3s | API Gateway GET /events/{userId} |
| `getAllPublicEvents` | nodejs20.x | 3008MB | 29s | API Gateway GET /all-events |
| `deleteEvent` | nodejs22.x | 128MB | 3s | API Gateway DELETE /event/{eventId} |
| `autoApproveEvent` | nodejs22.x | 1024MB | 300s | DynamoDB Stream |
| `getUserProfile` | nodejs22.x | 128MB | 3s | API Gateway GET /user/{userId} |
| `getUserPublicProfile` | nodejs22.x | 128MB | 3s | API Gateway GET /user/{userId}/public |
| `updateUserProfile` | nodejs22.x | 128MB | 3s | API Gateway PUT /user/{userId} |
| `vfsTrackerUserProfileSetup` | nodejs22.x | 128MB | 3s | API Gateway POST /user/profile-setup |
| `getUploadUrl` | nodejs22.x | 128MB | 3s | API Gateway POST /upload-url |
| `getFileUrl` | nodejs22.x | 128MB | 3s | API Gateway POST /file-url |
| `getAvatarUrl` | nodejs22.x | 128MB | 3s | API Gateway GET /avatar/{userId} |
| `online-praat-analysis` | Container (Python) | 3008MB | 300s | API Gateway (多个端点) |
| `gemini-proxy` | nodejs22.x | 128MB | 30s | API Gateway POST /gemini-proxy |
| `get-song-recommendations` | nodejs22.x | 128MB | 29s | API Gateway POST /recommend-songs |
| `edge-probe` | nodejs22.x | 128MB | 3s | API Gateway GET/POST /edge-probe |

### API 路由

```
GET    /all-events          → getAllPublicEvents (公开)
GET    /events/{userId}     → getVoiceEvents (需认证)
POST   /events              → addVoiceEvent (需认证)
DELETE /event/{eventId}     → deleteEvent (需认证)
GET    /user/{userId}       → getUserProfile (需认证)
GET    /user/{userId}/public → getUserPublicProfile (公开)
PUT    /user/{userId}       → updateUserProfile (需认证)
POST   /user/profile-setup  → vfsTrackerUserProfileSetup (需认证)
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
| Lambda Functions | 16 | 包括 Node.js 和 Python 容器 |
| DynamoDB Tables | 3 | VoiceFemEvents, VoiceFemUsers, VoiceFemTests |
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
| S3 Bucket | `vfs-tracker-objstor` | 设置 Retain 策略 |
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
     Properties:
       FunctionName: newFunction
       CodeUri: ../lambda-functions/newFunction/
       Handler: index.handler
       Runtime: nodejs22.x
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

