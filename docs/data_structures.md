# VFS Tracker Data Structures

This document outlines the data structures used for storing user information and events in the VFS Tracker application backend, likely in a DynamoDB table.

## Table of Contents
1.  [User Information](#user-information)
2.  [Event Data](#event-data)
    - [Self Test](#self-test)
    - [Hospital Test](#hospital-test)
    - [Voice Training](#voice-training)
    - [Self Practice](#self-practice)
    - [VFS Surgery](#vfs-surgery)
    - [Feeling Log](#feeling-log)
3.  [API Request/Response Formats](#api-requestresponse-formats)
4.  [DynamoDB Table Definitions](#dynamodb-table-definitions)

---

## User Information

Stores the profile and preferences for each user. The `email` is used as the primary identifier, retrieved from Cognito upon login.

**Object: `User`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | `String` | Yes | The unique user identifier (e.g., from Cognito `sub`). Partition Key. |
| `email` | `String` | Yes | User's email address. Used for queries. |
| `profile` | `Object` | No | Contains the user's personal and public-facing information. |
| `createdAt`| `String` | Yes | ISO 8601 timestamp of creation. |

**Object: `Profile` (nested within `User`)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `String` | No | The user's name. |
| `isNamePublic` | `Boolean` | No | If `true`, the name is shown on the public dashboard. Defaults to `false`. |
| `socials` | `Array<SocialAccount>` | No | A list of the user's social media accounts. |
| `areSocialsPublic`| `Boolean` | No | If `true`, social accounts are shown on the public dashboard. Defaults to `false`.|

**Object: `SocialAccount` (nested within `Profile`)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `platform` | `String` | Yes | Name of the social media platform (e.g., "Twitter", "Discord"). |
| `handle` | `String` | Yes | The user's handle or username on the platform. |

---

## Event Data

Events are actions or logs recorded by the user. All events share a common structure, with a `type` field and a `details` object that contains type-specific attributes.

**Object: `Attachment` (Reusable, PRIVATE)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fileUrl` | `String` | Yes | INTERNAL storage key (NOT a presigned URL). A temporary download URL must be resolved via backend/Storage when needed. |
| `fileType` | `String` | No | MIME type reported by client upload (e.g. `image/png`, `application/pdf`). |
| `fileName` | `String` | No | Original file name as provided by client. |

> 隐私说明 / Privacy Notice: `attachments` 字段为 **私有字段**，不会出现在公共 API (`GET /all-events`) 的响应中。只能在已鉴权的用户私有事件查询中返回。

**Object: `Event` (Base Structure)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | `String` | Yes | The user this event belongs to. Partition Key. |
| `eventId` | `String` | Yes | Unique ID for the event (e.g., a UUID). Sort Key. |
| `type` | `String` | Yes | The type of event. Determines the structure of the `details` object. |
| `date` | `String` | Yes | ISO 8601 timestamp for when the event occurred. |
| `details` | `Object` | Yes | Contains attributes specific to the event type. |
| `attachments` | `Array<Attachment>` | No | PRIVATE. Arbitrary number of uploaded files (images / documents). Not returned in public endpoints. |
| `status` | `String` | Yes | Event approval status. Values: "pending", "approved", "rejected". Only "approved" events appear on public dashboard. |
| `createdAt`| `String` | Yes | ISO 8601 timestamp of creation. |
| `updatedAt`| `String` | No | ISO 8601 timestamp of last modification. |

### Self Test

A record of a voice test performed by the user on their own.

**`Event.type` = `"self_test"`**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `appUsed` | `String` | No | The app used for the test (e.g., "Voice Tools", "Praat"). |
| `sound` | `Array<String>` | Yes | Vocal sound quality. Options: "好", "喉咙中有痰", "其他". |
| `customSoundDetail` | `String` | No | Details if "其他" is chosen for `sound`. |
| `voicing` | `Array<String>` | Yes | Phonation style. Options: "夹了", "没夹", "其他". |
| `customVoicingDetail`| `String` | No | Details if "其他" is chosen for `voicing`. |
| `fundamentalFrequency`| `Number` | No | Average pitch in Hz. |
| `formants` | `Object` | No | Vocal tract resonances. `{ "f1": Number, "f2": Number, ... }` |
| `pitch` | `Object` | No | Pitch range. `{ "max": Number, "min": Number }` |
| `jitter` | `Number` | No | Frequency variation. |
| `shimmer` | `Number` | No | Amplitude variation. |
| `hnr` | `Number` | No | Harmonics-to-Noise Ratio. |
| `notes` | `String` | No | General notes or observations. |

### Hospital Test

A record of a voice test performed in a clinical setting.

**`Event.type` = `"hospital_test"`**

**`Event.details` object:** (Same as `self_test`, but with location and equipment)

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `location` | `String` | Yes | Name of the hospital or clinic. |
| `equipmentUsed` | `String` | No | The equipment used for the test. |
| *(...all other attributes from `self_test` except `appUsed`)* | | | |

### Voice Training

A log of a formal voice training session.

**`Event.type` = `"voice_training"`**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `trainingContent` | `String` | Yes | Description of the training exercises. |
| `selfPracticeContent`| `String` | No | Assigned exercises for self-practice. |
| `voiceStatus` | `String` | Yes | User's assessment of their voice status. |
| `references` | `String` | No | Link to or description of reference materials. |
| `voicing` | `String` | Yes | Phonation style used during training. |
| `feelings` | `String` | No | User's feelings or reflections on the session. |
| `instructor` | `String` | No | Name of the voice coach or instructor. |

### Self Practice

A log of the user's own practice sessions.

**`Event.type` = `"self_practice"`**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `practiceContent` | `String` | Yes | Description of the practice exercises. |
| `hasInstructor` | `Boolean` | Yes | Whether the practice was guided. |
| `instructor` | `String` | No | Name of the instructor, if `hasInstructor` is `true`. |
| `references` | `String` | No | Link to or description of reference materials. |
| `voiceStatus` | `String` | Yes | User's assessment of their voice status. |
| `voicing` | `String` | Yes | Phonation style used. |
| `feelings` | `String` | No | User's feelings or reflections on the practice. |


### VFS Surgery

A record of a voice feminization surgery.

**`Event.type` = `"surgery"`**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `doctor` | `String` | Yes | Enum: "李革临", "金亨泰", "何双八", "Kamol", "田边正博", "自定义". |
| `customDoctor` | `String` | No | Name of the doctor if "自定义" is chosen. |
| `location` | `String` | Yes | Enum: "友谊医院", "南京同仁医院", "Yeson", "Kamol", "京都耳鼻咽喉科医院", "自定义". |
| `customLocation`| `String` | No | Name of the location if "自定义" is chosen. |
| `notes` | `String` | No | General notes about the surgery. |

### Feeling Log

A simple journal entry for the user to record their feelings.

**`Event.type` = `"feeling_log"`**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `content` | `String` | Yes | The text content of the journal entry. |

---

## API Request/Response Formats

### GET /all-events (Public)
返回的事件对象 **不包含** `attachments` 字段。

**Request**:
```http
GET /all-events
Content-Type: application/json
```

**Response** (200 OK):
```json
[
  {
    "userId": "cognito-user-sub-id",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "voice_training",
    "date": "2025-08-15T10:00:00.000Z",
    "details": {
      "trainingContent": "发音练习和气息控制",
      "voiceStatus": "良好",
      "instructor": "张老师",
      "feelings": "今天的训练效果很好"
    },
    "createdAt": "2025-08-15T10:30:00.000Z"
  },
  {
    "userId": "another-user-id",
    "eventId": "660f9511-f3ac-52e5-b827-557766551111",
    "type": "self_test",
    "date": "2025-08-14T15:30:00.000Z",
    "details": {
      "appUsed": "Voice Tools",
      "fundamentalFrequency": 180.5,
      "sound": ["好"],
      "voicing": ["没夹"],
      "jitter": 0.02,
      "shimmer": 0.03,
      "hnr": 15.2
    },
    "createdAt": "2025-08-14T15:45:00.000Z"
  }
]
```

**Error Response** (500):
```json
{
  "message": "Error fetching all events",
  "error": "详细错误信息"
}
```

### GET /events/{userId} (Private)
返回的事件对象包含其 `attachments` 数组（若存在）。

**Description**: Retrieves all events for a specific authenticated user.

**Request**:
```http
GET /events/{userId}
Authorization: Bearer {cognito-jwt-token}
Content-Type: application/json
```

**Response**: Similar to `/all-events` but includes events with all status values.

### POST /events
允许在顶层提交可选 `attachments` 数组。

**Description**: Creates a new event for the authenticated user.

**Request**:
```http
POST /events
Authorization: Bearer {cognito-jwt-token}
Content-Type: application/json

{
  "type": "voice_training",
  "date": "2025-08-15T10:00:00.000Z",
  "details": {
    "trainingContent": "发音练习",
    "voiceStatus": "良好",
    "instructor": "张老师"
  }
}
```

**Response** (200):
```json
{
  "item": {
    "userId": "cognito-user-sub-id",
    "eventId": "generated-uuid",
    "type": "voice_training",
    "date": "2025-08-15T10:00:00.000Z",
    "details": {
      "trainingContent": "发音练习",
      "voiceStatus": "良好",
      "instructor": "张老师"
    },
    "status": "pending",
    "createdAt": "2025-08-15T10:30:00.000Z",
    "updatedAt": "2025-08-15T10:30:00.000Z"
  }
}
```

---

## DynamoDB Table Definitions

### VoiceFemEvents Table

**Table Name**: `VoiceFemEvents`

**Partition Key**: `userId` (String)
**Sort Key**: `eventId` (String)

**Attributes**:

| Attribute Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `userId` | String | Cognito user sub ID (Partition Key) | Yes |
| `eventId` | String | UUID v4 identifier (Sort Key) | Yes |
| `type` | String | Event type enum | Yes |
| `date` | String | ISO 8601 event occurrence timestamp | Yes |
| `details` | Map | Event-specific details object | Yes |
| `attachments` | List | PRIVATE,存储Attachment对象数组 | No |
| `status` | String | Approval status: "pending" \| "approved" \| "rejected" | Yes |
| `createdAt` | String | ISO 8601 creation timestamp | Yes |
| `updatedAt` | String | ISO 8601 last modification timestamp | No |

**Global Secondary Indexes**:

1. **StatusDateIndex**
   - Partition Key: `status` (String)
   - Sort Key: `date` (String)
   - Purpose: Efficiently query approved events by date for public dashboard

**Sample Item (with attachments)**:
```json
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
  "attachments": [
    { "fileUrl": "attachments/us-east-1:123/.../report_front.jpg", "fileType": "image/jpeg", "fileName": "report_front.jpg" },
    { "fileUrl": "attachments/us-east-1:123/.../report_back.jpg",  "fileType": "image/jpeg", "fileName": "report_back.jpg" }
  ],
  "status": "approved",
  "createdAt": "2025-08-15T10:30:00.000Z",
  "updatedAt": "2025-08-15T11:00:00.000Z"
}
```

**Access Patterns**:
1. Get all events for a user: Query by `userId`
2. Get specific event: Get item by `userId` + `eventId`
3. Get all approved events: Query `StatusDateIndex` by `status = "approved"`
4. Get approved events in date range: Query `StatusDateIndex` by `status` + date range

---

### VoiceFemUsers Table

**Table Name**: `VoiceFemUsers`

**Partition Key**: `userId` (String)

**Attributes**:

| Attribute Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `userId` | String | Cognito user sub ID (Partition Key) | Yes |
| `email` | String | User's email address from Cognito | Yes |
| `profile` | Map | User's profile information object | No |
| `createdAt` | String | ISO 8601 creation timestamp | Yes |
| `updatedAt` | String | ISO 8601 last modification timestamp | No |

**Profile Object Structure** (nested within `profile` attribute):
- `name` (String, optional): User's display name
- `isNamePublic` (Boolean, optional): Whether name is shown on public dashboard
- `socials` (List, optional): Array of social media accounts
- `areSocialsPublic` (Boolean, optional): Whether social accounts are shown publicly

**Social Account Object Structure** (within `profile.socials`):
- `platform` (String, required): Social media platform name
- `handle` (String, required): Username/handle on that platform

**Sample Item**:
```json
{
  "userId": "us-east-1:12345678-1234-1234-1234-123456789012",
  "email": "user@example.com",
  "profile": {
    "name": "张三",
    "isNamePublic": true,
    "socials": [
      {
        "platform": "Twitter",
        "handle": "@username"
      },
      {
        "platform": "Discord", 
        "handle": "username#1234"
      }
    ],
    "areSocialsPublic": false
  },
  "createdAt": "2025-08-16T10:00:00.000Z",
  "updatedAt": "2025-08-16T10:30:00.000Z"
}
```

**Access Patterns**:
1. Get user profile: Get item by `userId`
2. Check if user exists: Get item by `userId` (returns empty if not found)
3. Update user profile: Update item by `userId`

---
