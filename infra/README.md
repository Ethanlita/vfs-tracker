# VFS-Tracker Infrastructure

本目录包含 VFS-Tracker 后端基础设施的 IaC (Infrastructure as Code) 定义。

## 目录结构

```
infra/
├── README.md                  # 本文件
├── template.yaml              # 主 SAM 模板
├── samconfig.toml             # SAM CLI 配置
├── parameters/
│   ├── dev.json               # 开发环境参数
│   └── prod.json              # 生产环境参数
├── scripts/
│   ├── backup-config.ps1      # 备份现有配置
│   ├── deploy.ps1             # 部署脚本
│   └── validate.ps1           # 验证脚本
└── backup/                    # 配置备份（不提交到 Git）
    ├── lambda-functions.json
    ├── api-gateway.json
    ├── dynamodb-*.json
    └── ...
```

## 设计原则

### Windows 兼容性

由于开发环境是 Windows，我们**不使用符号链接**。取而代之：

1. **Lambda 函数代码**：保持在 `lambda-functions/` 目录
2. **SAM 模板**：使用相对路径 `../lambda-functions/xxx/` 引用代码
3. **构建输出**：SAM 会自动打包到 `.aws-sam/build/`

### 代码位置

| 类型 | 位置 | 说明 |
|------|------|------|
| Lambda 函数代码 | `lambda-functions/` | 项目根目录下，保持原位置 |
| SAM 模板 | `infra/template.yaml` | IaC 定义 |
| 共享 Layer 代码 | `lambda-functions/shared/` | 新增：公共工具代码 |
| 部署配置 | `infra/samconfig.toml` | SAM CLI 配置 |

## 使用方法

### 首次部署

```powershell
# 1. 验证模板
cd infra
sam validate

# 2. 构建
sam build

# 3. 部署（首次需要引导）
sam deploy --guided
```

### 日常部署

```powershell
# 快速部署
sam build && sam deploy
```

### 本地测试

```powershell
# 启动本地 API
sam local start-api

# 调用单个函数
sam local invoke AddVoiceEventFunction --event events/add-event.json
```

## 环境变量

SAM 模板使用以下参数：

| 参数名 | 说明 | 默认值 |
|--------|------|--------|
| `Environment` | 部署环境 | `dev` |
| `CognitoUserPoolId` | Cognito 用户池 ID | `us-east-1_Bz6JC9ko9` |

## 安全注意事项

1. **Secrets Manager**：敏感信息（如 GEMINI_API_KEY）存储在 AWS Secrets Manager
2. **DeletionPolicy**：所有数据资源设置为 `Retain`，防止意外删除
3. **IAM 最小权限**：Lambda 角色只授予必要权限

## 相关文档

- [迁移计划](../docs/IAC_MIGRATION_PLAN.md)
- [AWS SAM 文档](https://docs.aws.amazon.com/serverless-application-model/)
