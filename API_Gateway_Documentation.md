# VFS Tracker API Documentation

**API Base URL**: `https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev`

**Version**: 1.2
**Last Updated**: August 19, 2025

---

## Overview

VFS Tracker API provides endpoints for managing voice feminization training events and user data. The API supports both public access for community dashboard and authenticated access for personal event management.

> 新增说明: 事件对象支持多附件字段 `attachments` (Array<Attachment>)，该字段为 **私有**，只在需要鉴权的用户事件接口 (`GET /events/{userId}`) 与创建事件接口 (`POST /events`) 的响应/请求中出现。公共接口 (`GET /all-events`) 将自动移除该字段。

### Attachment Object (Private)
```json
{
  "fileUrl": "attachments/<userId>/<generatedKey>.pdf",   // 存储key，不是直链
  "fileType": "application/pdf",                         // MIME，可选
  "fileName": "hospital_report_front.pdf"                // 原始文件名，可选
}
```

## Authentication

- **Public Endpoints**: No authentication required
- **Private Endpoints**: Require AWS Cognito JWT token in Authorization header
- **User Pool**: `us-east-1_Bz6JC9ko9`
- **Client ID**: `fb5fjoh3k5djvmbl9qq3pdl4q`

## CORS Configuration

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Amz-Date, X-Api-Key`

---

## Endpoints

### GET /all-events

**Description**: Retrieves all approved events for the public community dashboard.

**Authentication**: None required

**Parameters**: None

**Response Format**:
```json
[
  {
    "userId": "string",
    "eventId": "string (UUID)",
    "type": "voice_training | self_test | hospital_test | self_practice | surgery | feeling_log",
    "date": "string (ISO 8601)",
    "details": { /* type-specific */ },
    "createdAt": "string (ISO 8601)"
    // NOTE: attachments 字段已被后台剥离，不会出现在公共响应中
  }
]
```

**Example Response**:
```json
[
  {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "voice_training",
    "date": "2025-08-15T10:00:00.000Z",
    "details": {
      "trainingContent": "发音练习和气息控制",
      "voiceStatus": "良好",
      "instructor": "张老师"
    },
    "createdAt": "2025-08-15T10:30:00.000Z"
  }
]
```
> Public endpoint does NOT expose attachments for privacy.

---

### GET /events/{userId}

**Description**: Retrieves all events (any status) for the authenticated user, including private `attachments` array when present.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only access their own events. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Response Format**:
```json
[
  {
    "userId": "string",
    "eventId": "string",
    "type": "self_test",
    "date": "2025-08-14T15:30:00.000Z",
    "details": { /* type-specific */ },
    "attachments": [
       { "fileUrl": "attachments/<userId>/a1.jpg", "fileType": "image/jpeg", "fileName": "front.jpg" },
       { "fileUrl": "attachments/<userId>/a2.jpg", "fileType": "image/jpeg", "fileName": "back.jpg" }
    ],
    "status": "pending",
    "createdAt": "2025-08-14T15:45:00.000Z",
    "updatedAt": "2025-08-14T15:45:00.000Z"
  }
]
```

**Note**: Returns ALL events for the user (pending, approved, rejected), sorted by date descending.

**HTTP Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to access another user's data
- `500 Internal Server Error`: Server error

---

### POST /events

**Description**: Creates a new event for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "type": "voice_training | self_test | hospital_test | self_practice | surgery | feeling_log",
  "date": "string (ISO 8601)",
  "details": {
    // Event-specific details based on type
  }
}
```

**Server-Generated Fields**: The following fields are automatically generated:
- `userId`: Extracted from JWT token
- `eventId`: Generated UUID v4
- `status`: Set to "pending"
- `createdAt`: Current timestamp
- `updatedAt`: Current timestamp

**Response** (201 Created):
```json
{
  "message": "Event added successfully",
  "eventId": "event_maa123_x9ab2cdef"
}
```

> The server persists the attachments array as-is (after basic validation). Clients must resolve actual download URLs separately.

**HTTP Status Codes**:
- `201 Created`: Event created successfully
- `400 Bad Request`: Missing required fields (type, date, details)
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Server error

---

### DELETE /event/{eventId}

**Description**: Deletes a specific event for the authenticated user. This follows the RESTful convention of using a singular resource name (`/event`) for operations on a specific item.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only delete their own events. The Lambda function will verify that the `userId` associated with the `eventId` matches the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
```

**Parameters**:
- `eventId` (path): The unique ID of the event to be deleted.

**Response (200 OK)**:
```json
{
  "message": "Event deleted successfully"
}
```

**HTTP Status Codes**:
- `200 OK`: Event deleted successfully.
- `401 Unauthorized`: Missing or invalid JWT token.
- `403 Forbidden`: Attempting to delete another user's event (handled by Lambda logic, may result in 404).
- `404 Not Found`: Event with the given `eventId` does not exist for the authenticated user.
- `500 Internal Server Error`: Server error.

---

### GET /user/{userId}

**Description**: Retrieves user profile information for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only access their own profile. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Response Format**:
```json
{
  "userId": "string",
  "email": "string",
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional, defaults to false)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional, defaults to false)"
  },
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601, optional)"
}
```

**HTTP Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to access another user's data
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Server error

---

### PUT /user/{userId}

**Description**: Updates user profile information for the authenticated user.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only update their own profile. The userId in the path must match the authenticated user's ID from the JWT token.

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Parameters**:
- `userId` (path): Cognito user sub ID (must match authenticated user)

**Request Body**:
```json
{
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional)"
  }
}
```

**Server-Generated Fields**: The following fields are automatically updated:
- `updatedAt`: Current timestamp

**Response** (200 OK):
```json
{
  "message": "User profile updated successfully",
  "user": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "email": "user@example.com",
    "profile": {
      "name": "张三",
      "isNamePublic": true,
      "socials": [
        {
          "platform": "Twitter",
          "handle": "@username"
        }
      ],
      "areSocialsPublic": false
    },
    "createdAt": "2025-08-15T10:00:00.000Z",
    "updatedAt": "2025-08-16T10:30:00.000Z"
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Profile updated successfully
- `400 Bad Request`: Invalid request format or data
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to update another user's profile
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Server error

---

### POST /user/profile-setup

**Description**: Creates or completes user profile setup for new users. This endpoint is designed for the onboarding flow where new users need to complete their profile information.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "profile": {
    "name": "string (optional)",
    "isNamePublic": "boolean (optional, defaults to false)",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ],
    "areSocialsPublic": "boolean (optional, defaults to false)"
  }
}
```

**Server-Generated Fields**: The following fields are automatically generated/updated:
- `userId`: Extracted from JWT token
- `email`: Extracted from JWT token (if not already exists)
- `createdAt`: Current timestamp (for new users)
- `updatedAt`: Current timestamp

**Response** (201 Created for new users, 200 OK for existing users):
```json
{
  "message": "User profile setup completed successfully",
  "user": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "email": "newuser@example.com",
    "profile": {
      "name": "新用户",
      "isNamePublic": false,
      "socials": [],
      "areSocialsPublic": false
    },
    "createdAt": "2025-08-16T10:30:00.000Z",
    "updatedAt": "2025-08-16T10:30:00.000Z"
  },
  "isNewUser": true
}
```

**HTTP Status Codes**:
- `201 Created`: New user profile created successfully
- `200 OK`: Existing user profile updated successfully
- `400 Bad Request`: Invalid request format or data
- `401 Unauthorized`: Missing or invalid JWT token
- `500 Internal Server Error`: Server error

---

### GET /user/{userId}/public

**Description**: Retrieves public profile information for any user. Only returns information that the user has marked as public.

**Authentication**: None required

**Parameters**:
- `userId` (path): User ID to retrieve public information for

**Response Format**:
```json
{
  "userId": "string",
  "profile": {
    "name": "string (only if isNamePublic is true, otherwise returns '（非公开）')",
    "socials": [
      {
        "platform": "string",
        "handle": "string"
      }
    ]
  }
}
```

**Note**: 
- If `isNamePublic` is false, the `name` field will return "（非公开）"
- If `areSocialsPublic` is false, the `socials` array will be empty
- Non-public users may return minimal information

**HTTP Status Codes**:
- `200 OK`: Success
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

## AI & Services Endpoints

### POST /gemini-proxy

**Description**: Securely proxies requests to the Google Gemini API to avoid exposing the API key on the client-side. This endpoint takes a user's prompt, forwards it to the Gemini API, and returns the generated text.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "prompt": "string"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "response": "This is a sample response text generated by Gemini."
}
```

**Error Response (e.g., 502 Bad Gateway)**:
```json
{
  "success": false,
  "error": "Failed to call Gemini API."
}
```

**HTTP Status Codes**:
- `200 OK`: Success
- `400 Bad Request`: The request body is missing the `prompt` field or is not valid JSON.
- `401 Unauthorized`: Missing or invalid JWT token.
- `500 Internal Server Error`: An unexpected server error occurred (e.g., Lambda misconfiguration).
- `502 Bad Gateway`: The proxy failed to get a valid response from the Gemini API.

---

## Online Praat / Voice Test Endpoints

This set of endpoints manages the multi-step voice analysis test feature.

### POST /sessions

**Description**: Initiates a new voice test session and returns a unique session ID. This is the first step for a user starting a new voice test.

**Authentication**: Required (Cognito JWT)

**Request Body**: (Empty)

**Response (201 Created)**:
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

**HTTP Status Codes**:
- `201 Created`: Session created successfully.
- `401 Unauthorized`: Missing or invalid JWT token.
- `500 Internal Server Error`: Server error.

---

### POST /uploads

**Description**: Gets a pre-signed S3 URL for uploading a single audio file corresponding to a specific step in the voice test wizard.

**Authentication**: Required (Cognito JWT)

**Request Body**:
```json
{
  "sessionId": "string",
  "step": "string (e.g., \"calibration\", \"mpt\")",
  "fileName": "string",
  "contentType": "audio/wav"
}
```

**Response (200 OK)**:
```json
{
  "putUrl": "https://your-bucket.s3.amazonaws.com/voice-tests/.../1_1.wav?AWSAccessKeyId=...&Signature=...&Expires=...",
  "objectKey": "voice-tests/us-east-1:123.../a1b2c3d4.../raw/1_1.wav"
}
```

**HTTP Status Codes**:
- `200 OK`: Success.
- `400 Bad Request`: Missing required fields.
- `401 Unauthorized`: Missing or invalid JWT token.
- `500 Internal Server Error`: Server error.

---

### POST /analyze

**Description**: Submits a completed voice test session for asynchronous analysis. This triggers the backend Lambda function to process all uploaded audio files for the session.

**Authentication**: Required (Cognito JWT)

**Request Body**:
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

**Response (202 Accepted)**:
```json
{
  "status": "queued",
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
```

**HTTP Status Codes**:
- `202 Accepted`: The analysis request has been successfully queued.
- `400 Bad Request`: Invalid request format or data.
- `401 Unauthorized`: Missing or invalid JWT token.
- `500 Internal Server Error`: Server error.

---

### GET /results/{sessionId}

**Description**: Polls for and retrieves the results of a voice test analysis. The client should call this endpoint periodically after a session has been submitted for analysis.

**Authentication**: Required (Cognito JWT)

**Parameters**:
- `sessionId` (path): The unique ID of the voice test session.

**Response Format (while processing)**:
```json
{
  "status": "processing"
}
```

**Response Format (when complete)**:
```json
{
  "status": "done",
  "metrics": {
    "sustained": {
      "spl_dbA": 76.8,
      "f0_mean": 290,
      "f0_sd": 15.2,
      "jitter_local_percent": 1.04,
      "shimmer_local_percent": 4.52,
      "hnr_db": 20.0,
      "mpt_s": 11.8,
      "formants": { "F1": 550, "F2": 1500, "F3": 2500 }
    },
    "vrp": {
      "f0_min": 90,
      "f0_max": 596,
      "spl_min": 57,
      "spl_max": 91
    }
  },
  "charts": {
    "timeSeries": "s3://your-bucket/voice-tests/.../artifacts/timeSeries.png",
    "vrp": "s3://your-bucket/voice-tests/.../artifacts/vrp.png"
  },
  "reportPdf": "s3://your-bucket/voice-tests/.../report.pdf"
}
```

**Response Format (if failed)**:
```json
{
  "status": "failed",
  "error": "Analysis pipeline failed for session..."
}
```

**HTTP Status Codes**:
- `200 OK`: Success (status is `processing`, `done`, or `failed`).
- `401 Unauthorized`: Missing or invalid JWT token.
- `404 Not Found`: Session with the given ID not found.
- `500 Internal Server Error`: Server error.

---

## 文件管理端点 (S3预签名URL)

### POST /upload-url

**描述**: 获取文件上传的预签名URL，用于安全上传文件到S3

**认证**: 需要JWT token

**请求体**:
```json
{
  "fileKey": "string",     // S3文件key，格式：{type}/{userId}/{timestamp}_{filename}
  "contentType": "string"  // 文件MIME类型，如 "image/jpeg", "application/pdf"
}
```

**响应**:
```json
{
  "uploadUrl": "string",   // 预签名上传URL
  "fileKey": "string",     // 确认的文件key
  "expiresIn": 900         // URL有效期（秒）
}
```

**安全规则**:
- 用户只能上传到自己的目录下
- 支持的路径格式：`avatars/{userId}/`, `attachments/{userId}/`, `uploads/{userId}/`
- 上传URL有效期15分钟

---

### POST /file-url

**描述**: 获取私有文件访问的预签名URL（仅限文件所有者）

**认证**: 需要JWT token

**请求体**:
```json
{
  "fileKey": "string"  // 要访问的S3文件key
}
```

**响应**:
```json
{
  "url": "string",      // 预签名访问URL
  "expiresIn": 3600     // URL有效期（秒）
}
```

**安全规则**:
- 只有文件所有者可以访问自己的文件
- 访问URL有效期1小时
- 主要用于附件和私有文件访问

---

### GET /avatar/{userId}

**描述**: 获取用户头像的预签名URL（公开访问）

**认证**: 无需认证

**路径参数**:
- `userId`: 用户ID

**响应**:
```json
{
  "url": "string",      // 预签名访问URL
  "expiresIn": 86400    // URL有效期（秒）
}
```

**安全规则**:
- 任何用户都可以访问其他用户的头像
- 头像URL有效期24小时
- 如果头像不存在，返回默认头像

---

## 文件上传安全架构

### 概述
VFS Tracker已迁移到安全的S3预签名URL架构，不再使用公开S3访问。这确保了：
1. **头像公开访问**: 允许所有用户查看头像
2. **附件私有访问**: 仅文件所有者可以访问自己的附件
3. **安全上传**: 用户只能上传到自己的目录

### 文件路径规范
```
avatars/{userId}/           # 用户头像
attachments/{userId}/       # 嗓音事件附件
uploads/{userId}/           # 通用上传文件
```

### 前端集成
- 使用`SecureFileUpload`组件进行文件上传
- 自动处理预签名URL获取和文件上传流程
- 支持头像、附件等不同文件类型

### 错误处理
所有文件管理端点返回标准错误格式：
```json
{
  "error": "string",        // 错误描述
  "details": "string"       // 详细错误信息（可选）
}
```

常见错误代码：
- `400`: 请求参数错误
- `401`: 认证失败或缺少token
- `403`: 权限不足，无法访问指定文件
- `500`: 服务器内部错误

---

## 部署状态

### 已完成 ✅
- Lambda函数实现（getUploadUrl, getFileUrl, getAvatarUrl）
- 前端SecureFileUpload组件
- API模块预签名URL函数
- 安全架构设计

### 待完成 ⏳
- API Gateway端点配置
- Lambda函数部署到AWS
- 环境变量配置
- 端到端测试

---

**注意**: 这些端点目前处于开发阶段，实际部署需要先完成API Gateway配置。详细配置说明请参考 `docs/api-gateway-s3-presigned-config.md`.

---

## Change Log
- 1.2: Added Online Praat / Voice Test endpoints (/sessions, /uploads, /analyze, /results).
- 1.1: Added multi-attachment support; documented private `attachments` field visibility rules.
- 1.0: Initial version.
