# API Gateway 配置文档 - S3预签名URL端点

## 概述
为了实现S3安全访问，需要在API Gateway中配置以下端点来支持预签名URL功能。这些端点提供头像公开访问和文件私有访问的安全机制。

## 端点配置

### 1. 获取上传预签名URL
- **路径**: `POST /upload-url`
- **认证**: 需要JWT认证
- **Lambda函数**: `getUploadUrl`
- **描述**: 生成文件上传的预签名URL，仅允许用户上传到自己的目录

### 2. 获取文件访问预签名URL
- **路径**: `POST /file-url`
- **认证**: 需要JWT认证
- **Lambda函数**: `getFileUrl`
- **描述**: 生成文件访问的预签名URL，仅允许文件所有者访问

### 3. 获取头像预签名URL
- **路径**: `GET /avatar/{userId}`
- **认证**: 无需认证（公开访问）
- **Lambda函数**: `getAvatarUrl`
- **描述**: 生成头像访问的预签名URL，允许所有用户访问任何人的头像

## 安全策略

### 权限控制
1. **头像访问**: 公开访问，任何用户都可以查看其他用户的头像
2. **附件访问**: 私有访问，只有文件所有者才能访问自己的附件
3. **文件上传**: 用户只能上传到自己的目录下

### 文件路径规范
```
avatars/{userId}/         # 头像文件
attachments/{userId}/     # 附件文件
uploads/{userId}/         # 通用上传文件
```

### Token验证
- 上传和私有文件访问需要在Authorization header中提供JWT token
- Lambda函数会验证token并提取用户ID进行权限检查

## 请求/响应格式

### 获取上传URL
**请求**:
```json
{
  "fileKey": "attachments/user123/1629123456789_document.pdf",
  "contentType": "application/pdf"
}
```

**响应**:
```json
{
  "uploadUrl": "https://bucket.s3.region.amazonaws.com/...",
  "fileKey": "attachments/user123/1629123456789_document.pdf",
  "expiresIn": 900
}
```

### 获取文件访问URL
**请求**:
```json
{
  "fileKey": "attachments/user123/1629123456789_document.pdf"
}
```

**响应**:
```json
{
  "url": "https://bucket.s3.region.amazonaws.com/...",
  "expiresIn": 3600
}
```

### 获取头像URL
**响应**:
```json
{
  "url": "https://bucket.s3.region.amazonaws.com/...",
  "expiresIn": 86400
}
```

## 环境变量配置

Lambda函数需要以下环境变量：
- `BUCKET_NAME`: S3存储桶名称
- `AWS_REGION`: AWS区域

## CORS配置

API Gateway需要配置CORS支持：
```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
}
```

## 部署清单

### Lambda函数部署
1. ✅ `getUploadUrl` - 生成上传预签名URL
2. ✅ `getFileUrl` - 生成文件访问预签名URL  
3. ✅ `getAvatarUrl` - 生成头像访问预签名URL

### API Gateway端点配置
1. ⏳ `POST /upload-url` -> `getUploadUrl`
2. ⏳ `POST /file-url` -> `getFileUrl`
3. ⏳ `GET /avatar/{userId}` -> `getAvatarUrl`

### 前端集成
1. ✅ SecureFileUpload组件已完成
2. ✅ API模块已添加预签名URL函数
3. ✅ EventForm组件已集成SecureFileUpload
4. ✅ AvatarUpload组件已集成SecureFileUpload

## 测试步骤

1. 部署Lambda函数到AWS
2. 在API Gateway中配置端点
3. 设置环境变量
4. 测试各个端点的功能
5. 验证权限控制是否正确工作
