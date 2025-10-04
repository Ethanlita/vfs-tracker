# Lambda 函数环境变量配置指南

## 概述

本指南详细列出了 VFS Tracker 项目中所有 Lambda 函数所需的环境变量。正确的配置是确保后端服务正常运行的关键。

---

## 1. 核心服务 (Core Services)

这些函数处理核心的业务逻辑，如用户资料、事件管理和文件权限。

### a. 用户管理
- **函数**: `getUserProfile`, `updateUserProfile`, `getUserPublicProfile`, `vfsTrackerUserProfileSetup`
- **环境变量**:
  - `USERS_TABLE`: 用户资料 DynamoDB 表的名称。 (例如: `VoiceFemUsers`)

### b. 事件管理
- **函数**: `addVoiceEvent`, `getVoiceEvents`, `getAllPublicEvents`, `deleteEvent`, `autoApproveEvent`
- **环境变量**:
  - `EVENTS_TABLE`: 嗓音事件 DynamoDB 表的名称。 (例如: `VoiceFemEvents`)
  - `USERS_TABLE`: (仅 `getAllPublicEvents` 需要) 用户资料 DynamoDB 表的名称，用于获取用户名。
  - `ATTACHMENTS_BUCKET`: (仅 `autoApproveEvent` 和 `deleteEvent` 需要) 存储附件的 S3 存储桶名称。
  - `GEMINI_API_KEY`: (仅 `autoApproveEvent` 需要) 用于多模态验证。

### c. 文件管理 (预签名 URL)
- **函数**: `getUploadUrl`, `getFileUrl`, `getAvatarUrl`
- **环境变量**:
  - `BUCKET_NAME`: 存储文件的 S3 存储桶名称。
  - `VOICE_TESTS_TABLE_NAME`: (仅 `getFileUrl` 需要) 嗓音测试表的名称，用于验证私有报告的访问权限。

---

## 2. AI 与服务集成 (AI & Services)

这些函数与第三方服务（如 Google Gemini）集成，提供增值功能。

### a. Gemini 代理
- **函数**: `gemini-proxy`
- **环境变量**:
  - `GEMINI_API_KEY`: Google Gemini API 的密钥。

### b. 歌曲推荐
- **函数**: `get-song-recommendations`
- **环境变量**:
  - `GEMINI_API_KEY`: Google Gemini API 的密钥。

---

## 3. 在线嗓音分析服务 (Online Praat Analysis)

这是一个独立的、功能复杂的 Lambda 函数，负责执行所有声学分析任务。

- **函数**: `online-praat-analysis`
- **环境变量**:
  - `DDB_TABLE`: **主会话表**的名称，用于存储嗓音测试的状态和结果。(例如: `VoiceTests`)
  - `BUCKET`: **主存储桶**的名称，用于读取原始录音和写入分析产物（图表、报告）。
  - `EVENTS_TABLE`: **事件表**的名称，用于在分析成功后自动创建一条 `self_test` 事件记录。
  - `AWS_LAMBDA_FUNCTION_NAME`: Lambda 函数自身的名称。这是**必需的**，因为该函数会通过异步方式自我调用来处理耗时任务。
  - `AWS_REGION`: AWS 区域。(通常由 Lambda 运行时自动提供，但建议明确设置)

---

## 部署与配置建议

### CloudFormation/SAM 模板示例
在您的 IaC (Infrastructure as Code) 模板中，为每个函数定义其所需的环境变量。

```yaml
Parameters:
  S3BucketName:
    Type: String
    Default: vfs-tracker-files
  UsersTableName:
    Type: String
    Default: VoiceFemUsers
  EventsTableName:
    Type: String
    Default: VoiceFemEvents
  VoiceTestsTableName:
    Type: String
    Default: VoiceTests
  GeminiApiKey:
    Type: String
    NoEcho: true

Resources:
  # 核心服务示例
  UpdateUserProfileFunction:
    Type: AWS::Lambda::Function
    Properties:
      # ... 其他配置
      Environment:
        Variables:
          USERS_TABLE: !Ref UsersTableName

  # AI 服务示例
  GeminiProxyFunction:
    Type: AWS::Lambda::Function
    Properties:
      # ... 其他配置
      Environment:
        Variables:
          GEMINI_API_KEY: !Ref GeminiApiKey

  # 分析服务
  OnlinePraatAnalysisFunction:
    Type: AWS::Lambda::Function
    Properties:
      # ... 其他配置 (如容器镜像)
      FunctionName: !Sub '${AWS::StackName}-OnlinePraatAnalysis'
      Environment:
        Variables:
          DDB_TABLE: !Ref VoiceTestsTableName
          BUCKET: !Ref S3BucketName
          EVENTS_TABLE: !Ref EventsTableName
          AWS_LAMBDA_FUNCTION_NAME: !Ref OnlinePraatAnalysisFunction # 引用自身
```

### 手动配置检查清单
- [ ] `online-praat-analysis` 函数是否已配置所有四个必需的环境变量？
- [ ] 所有需要访问 Gemini 的函数是否已配置 `GEMINI_API_KEY`？
- [ ] 所有数据库和 S3 的表名/桶名是否与实际部署的资源名称一致？
- [ ] IAM 角色是否授予了对这些环境变量所指向资源的相应权限？