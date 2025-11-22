# VFS Tracker API Documentation

**API Base URL**: `https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev`

**Version**: 1.3
**Last Updated**: October 7, 2025

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
- **Private Endpoints**: Require AWS Cognito **ID Token** (`token_use = "id"`) in the `Authorization: Bearer {id_token}` header
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
    "createdAt": "string (ISO 8601)",
    "userName": "string (公开昵称或\"（非公开）\"占位)"
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
    "createdAt": "2025-08-15T10:30:00.000Z",
    "userName": "张老师"
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
{
  "events": [
    {
      "userId": "string",
      "eventId": "string",
      "type": "self_test",
      "date": "2025-08-14T15:30:00.000Z",
      "details": { /* type-specific */ },
      "attachments": [
        { "fileUrl": "attachments/<userId>/a1.pdf", "fileType": "application/pdf", "fileName": "report.pdf" }
      ],
      "status": "pending",
      "createdAt": "2025-08-14T15:45:00.000Z",
      "updatedAt": "2025-08-14T15:45:00.000Z"
    }
  ],
  "debug": {
    "lambdaExecuted": true,
    "timestamp": "2025-08-14T15:45:01.000Z",
    "authenticatedUserId": "us-east-1:1234...",
    "eventCount": 1,
    "...": "省略若干调试字段"
  }
}
```

**Notes**:
- 返回所有状态的事件（`pending`、`approved`、`rejected`），默认按创建时间降序排序。
- `debug` 字段目前主要用于排查问题，生产环境中也会返回；后续重构可移除或受控暴露。（这不是一个必须存在的字段）

**HTTP Status Codes**:
- `200 OK`: Success
- `403 Forbidden`: Attempting to access another user's data
- `500 Internal Server Error`: Server error
  - **已知问题**: 缺失或无效 token 会触发 500（而非 401），需在后续修复认证失败的返回码。

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

**Response** (200 OK):
```json
{
  "message": "Event added successfully",
  "eventId": "event_maa123_x9ab2cdef"
}
```

> 服务端会对 `attachments` 列表做基本清洗（确保 `fileUrl` 存在，去除多余字段）后原样存储。客户端需自行获取下载 URL。

**HTTP Status Codes**:
- `200 OK`: Event created successfully
- `400 Bad Request`: Missing required fields (type, date, details)
- `500 Internal Server Error`: Server error（包含认证失败、JSON解析失败等情况）

---

### DELETE /event/{eventId}

**Description**: Deletes a specific event for the authenticated user. This follows the RESTful convention of using a singular resource name (`/event`) for operations on a specific item.

**Authentication**: Required (Cognito JWT)

**Security**: Users can only delete their own events. The Lambda function will verify that the `userId` associated with the `eventId` matches the authenticated user's ID from the JWT token.
这一API会同时级联删除当该事件在S3内的文件。

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

> 删除操作会尝试清理事件附件：Lambda 支持附件保存为 `s3://bucket/key`、`https://...` 或纯粹的 `key`；解析成功后逐一调用 S3 `DeleteObject`，失败条目会记录日志但不会阻止主流程完成。

**HTTP Status Codes**:
- `200 OK`: Event deleted successfully.
- `401 Unauthorized`: Missing or invalid JWT token（当 API Gateway 未注入 claims 时返回）。
- `404 Not Found`: Event with the given `eventId` does not exist **or** does not belong to the authenticated user.
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
    "nickname": "string (来自 Cognito，始终返回)",
    "name": "string (optional)",
    "bio": "string (optional, defaults to empty)",
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

**Notes**:
- 如果数据库中不存在该用户资料，服务会根据 token 构造一个占位资料并返回 `200 OK`（`createdAt/updatedAt` 为当前时间）。
- `nickname` 字段始终由 token 决定，客户端传入的同名字段会被忽略。

**HTTP Status Codes**:
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Attempting to access another user's data
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
    "bio": "string (optional)",
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
  "message": "Profile updated successfully",
  "user": {
    "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
    "email": "user@example.com",
    "profile": {
      "nickname": "来自 Cognito 的昵称",
      "name": "张三",
      "bio": "",
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

> 请求体中的 `profile.nickname` 字段会被忽略；系统始终使用 Cognito token 中的昵称。

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
    "bio": "string (optional, defaults to empty)",
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
      "nickname": "新用户昵称（来源于 Cognito）",
      "name": "新用户",
      "bio": "", //这个字段目前暂时没有使用，是预留
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

> 当 `profile` 缺失时会使用默认值；`nickname` 同样来自 ID token。

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
    "nickname": "（非公开）",
    "name": "string (only if isNamePublic is true, otherwise returns '（非公开）')",
    "bio": "string (用户可公开的简介，默认为空字符串)",
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
- `nickname` 始终固定为 "（非公开）"，用于提示该字段当前不对外公开
- Non-public users may return minimal information

**HTTP Status Codes**:
- `200 OK`: Success
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

---

### GET /edge-probe

**Description**: 诊断端点。返回请求在 API Gateway/CDN 边缘节点上的路由信息，用于排查域名或 CORS 配置问题。

**Authentication**: None required（公开，但仅用于调试，不返回业务数据）

**Response (200 OK)**:
```json
{
  "receivedHost": "api.vfs-tracker.app",
  "xForwardedHost": "cdn.vfs-tracker.app",
  "requestContextDomain": "2rzxc2x5l8.execute-api.us-east-1.amazonaws.com",
  "method": "GET",
  "path": "/edge-probe"
}
```

**Notes**:
- 该端点不会执行权限校验，请避免在生产环境泄露敏感 header。
- 建议仅在故障排查期间短期开放，长期策略可考虑移除或加上鉴权。

**HTTP Status Codes**:
- `200 OK`: Endpoint reachable
- `500 Internal Server Error`: Unexpected Lambda error

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

### POST /recommend-songs

**Description**: Provides song recommendations based on the user's vocal range. This endpoint securely proxies requests to the Google Gemini API with a specialized prompt for music curation.

**Authentication**: Required (Cognito JWT)

**Headers**:
```
Authorization: Bearer {jwt-token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "lowestNote": "string",  // The lowest note in the user's vocal range (e.g., "G3")
  "highestNote": "string" // The highest note in the user's vocal range (e.g., "A5")
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "recommendations": [
    {
      "songName": "Someone Like You",
      "artist": "Adele",
      "reason": "这首歌的音域与您的非常匹配，主歌部分在中音区，副歌部分则能很好地展现您的高音能力，是练习情感表达和音高控制的绝佳选择。"
    },
    {
      "songName": "Thinking Out Loud",
      "artist": "Ed Sheeran",
      "reason": "这首歌的旋律平缓，音高变化不大，非常适合在您舒适的音域内进行练习，有助于巩固稳定的发声和气息支持。"
    }
  ]
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
- `200 OK`: Success.
- `400 Bad Request`: The request body is missing `lowestNote` or `highestNote`, or is not valid JSON.
- `401 Unauthorized`: Missing or invalid JWT token.
- `500 Internal Server Error`: An unexpected server error occurred.
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
- `403 Forbidden`: Session does not belong to the authenticated user.
- `500 Internal Server Error`: Server error.

> 生成的 `putUrl` 会自动重写为 `storage.vfs-tracker.app` 或 `storage.vfs-tracker.cn` 域名，以确保使用 CDN。

---

### POST /analyze

**Description**: Submits a completed voice test session for asynchronous analysis. This triggers the backend Lambda function to process all uploaded audio files for the session.

**Authentication**: Required (Cognito JWT)

**Request Body**:
```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "calibration": { /* 可选：校准步骤用户输入 */ },
  "forms": { /* 可选：问卷或自述表单数据 */ }
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

> 当前实现不会在后台再次验证 `sessionId` 是否属于调用者；请在重构阶段补充这一安全检查。

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
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "userId": "us-east-1:1234...",
  "status": "done",
  "createdAt": 1757939726,
  "updatedAt": 1757940115,
  "metrics": {
    "sustained": { "...": "详见指标映射" },
    "spontaneous": { "...": "详见指标映射" },
    "vrp": { "f0_min": 90, "f0_max": 596, "spl_min": 57, "spl_max": 91 },
    "formants_low": { "F1": 520, "F2": 1700, "F3": 2600 },
    "questionnaires": { "...": "用户问卷得分" }
  },
  "charts": {
    "timeSeries": "https://storage.vfs-tracker.app/voice-tests/.../artifacts/timeSeries.png",
    "vrp": "https://storage.vfs-tracker.app/voice-tests/.../artifacts/vrp.png",
    "formant": "https://storage.vfs-tracker.app/voice-tests/.../artifacts/formant.png"
  },
  "reportPdf": "https://storage.vfs-tracker.app/voice-tests/.../report.pdf",
  "errorMessage": null
}
```

> `createdAt`/`updatedAt` 使用 Unix 时间戳（秒）。当状态为 `done` 时，所有 S3 URI 会转换为带 CDN 主机的预签名 URL（有效期 1 小时）。

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

**描述**: 获取文件上传的预签名URL，用于安全上传文件到S3。该端点支持用户目录下的通用上传需求；会在返回的 URL 上自动替换 CDN 主机，方便前端直接 PUT 上传。
**用于上传附件时**: 推荐 `fileKey = attachments/{userId}/{timestamp}_{originalFileName}`，其中 `userId` 必须与 ID Token 的 `sub` 一致。上传完成后，把该 key 保存到事件对象的 `attachments` 字段；`DELETE /event/{eventId}` 会根据这些 key 级联删除 S3 文件。
**用于上传嗓音测试音频时**: 请使用 Online Praat 专用的 `POST /uploads`（`handler.py` 会校验会话所有权并生成 `voice-tests/{sessionId}/raw/...` 路径）。若直接对本端点提交 `voice-tests/` 前缀，会因目录不在允许范围而返回 403。
**用于上传头像时**: 按 `avatars/{userId}/{timestamp}-{userId}{extension}` 生成唯一 key，并在上传成功后将该 key 保存到用户资料（DynamoDB）。`GET /avatar/{userId}` 需要通过查询参数 `?key=...` 显式指定该对象键，Lambda 不再执行任何自动推断或回退逻辑。
**其他上传场景**: 可以把临时草稿或个人文档放在 `uploads/{userId}/` 目录。依旧需要遵守用户 ID 校验，并利用返回的 CDN URL 直接上传；后续访问可通过 `POST /file-url` 获取下载签名。

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

> 返回的 `uploadUrl` 会自动替换为 `storage.vfs-tracker.app` 或 `storage.vfs-tracker.cn` 域名；客户端可直接使用该 URL 进行上传。

**安全规则**:
- 用户只能上传到自己的目录下
- 支持的路径格式：`avatars/{userId}/`, `attachments/{userId}/`, `uploads/{userId}/`
- 上传URL有效期15分钟

**常见使用场景**:
- **事件附件**：使用 `fileKey = attachments/{userId}/{timestamp}_{originalFileName}`。上传完成后，将该 key 写入事件的 `attachments` 字段；后续 `DELETE /event/{eventId}` 会依据该 key 清理 S3 文件。
- **嗓音测试音频**：请改用 Online Praat 专用端点 `POST /uploads`（生成 `voice-tests/{sessionId}/raw/...` 路径），本端点不接受 `voice-tests/` 前缀，直接调用会返回 403。
- **头像上传**：在调用本端点时将 `fileKey` 设为 `avatars/{userId}/{timestamp}-{userId}{extension}` 之类的唯一值并保存到用户资料；取图请调用 `GET /avatar/{userId}?key=...`。
- **其他临时或个性化上传**：可使用 `uploads/{userId}/...` 目录存放草稿、个人记录等，同样受用户 ID 校验与 CDN 主机重写影响。

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

> 预签名链接同样会重写为 `storage.vfs-tracker.app/.cn` 域名，以便前端直接访问 CDN。

**安全规则**:
- 只有文件所有者可以访问自己的文件
- `attachments/{userId}/` 路径要求路径中的 `userId` 与 token `sub` 一致
- `voice-tests/{sessionId}/` 路径会通过 VoiceFemTests 表核验 session 归属
- 访问URL有效期1小时
- 主要用于附件和私有文件访问
- 支持在查询参数或请求体中提供 `fileKey`

---

### GET /avatar/{userId}

**描述**: 获取用户头像的预签名URL（公开访问）。请求方必须在查询参数中提供完整的 `avatarKey`，形如 `avatars/{userId}/{timestamp}-{userId}.png`。

**认证**: 无需认证

**路径参数**:
- `userId`: 用户ID

**查询参数**:
- `key` (string, required): 头像文件的 S3 对象键，必须以 `avatars/{userId}/` 开头

**响应**:
```json
{
  "url": "string",      // 预签名访问URL，会根据访问域名返回CDN地址
  "expiresIn": 86400    // URL有效期（秒）
}
```

> 与其他文件端点一致，返回的预签名链接会被重写为 `storage.vfs-tracker.app` 或 `storage.vfs-tracker.cn` 主机，方便直接走 CDN。

**安全规则**:
- 任何用户都可以访问其他用户的头像，但 `key` 必须属于该用户目录
- 头像URL有效期24小时
- 如果缺少 `key` 或 key 不匹配用户目录，直接返回 400/403；不再尝试任何回退逻辑

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

### 已上线 ✅
- API Gateway `VoiceFemApi` 已部署 `/upload-url`、`/file-url`、`/avatar/{userId}`、`/edge-probe` 等端点
- Lambda 函数（getUploadUrl、getFileUrl、getAvatarUrl）与 S3/CDN 重写策略生效
- 运行环境配置了 `BUCKET_NAME`、`AWS_REGION`、`VOICE_TESTS_TABLE_NAME` 等必需变量

### 运维注意事项 🔍
- 监控 CloudWatch 日志，关注 403/500 异常峰值
- 定期复查 `ATTACHMENTS_BUCKET_NAME`、`BUCKET_NAME` 等配置是否与 IaC 同步
- 端到端测试应覆盖上传→下载→附件删除链路，以验证签名 URL 与权限策略

---

**注意**: 详细的 API Gateway 配置仍可参考 `docs/api-gateway-s3-presigned-config.md`，以便在新环境中快速复现部署。

---

## Change Log
- 1.3: Reconciled documentation with deployed API (public events `userName`, event/debug payloads, edge-probe endpoint, voice test request/response details).
- 1.2: Added Online Praat / Voice Test endpoints (/sessions, /uploads, /analyze, /results).
- 1.1: Added multi-attachment support; documented private `attachments` field visibility rules.
- 1.0: Initial version.
