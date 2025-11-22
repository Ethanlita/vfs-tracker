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
| `avatarKey` | `String` | No | S3 object key of the uploaded avatar (e.g., `avatars/{userId}/{timestamp}-{userId}.png`). Used to request presigned download URLs. |
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

*Note: This section provides a brief overview. For complete details, see `API_Gateway_Documentation.md`.*

### GET /all-events (Public)

Returns a list of approved `Event` objects. The `attachments` field is **excluded** from all objects in the response.

### GET /events/{userId} (Private)

Returns a list of all `Event` objects for the authenticated user. The `attachments` field is **included** if present.

### POST /events

Creates a new `Event` for the authenticated user. The request body can include an `attachments` array.

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

### VoiceTests Table

This table stores the state and results of each voice test session initiated by a user.

**Table Name**: `VoiceTests`

**Partition Key**: `userOrAnonId` (String)
**Sort Key**: `sessionId` (String)

**Attributes**:

| Attribute Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `userOrAnonId` | String | User ID (if logged in) or an anonymous ID. Partition Key. | Yes |
| `sessionId` | String | Unique identifier for the test session (e.g., UUID). Sort Key. | Yes |
| `status` | String | The current status of the analysis: `pending` \| `processing` \| `done` \| `failed`. | Yes |
| `createdAt` | String | ISO 8601 timestamp of when the session was created. | Yes |
| `calibration` | Map | Object containing calibration details. | No |
| `tests` | List | A list of `Map` objects, each representing a recorded audio segment. | No |
| `metrics` | Map | A map containing the final calculated acoustic metrics after analysis. | No |
| `forms` | Map | A map containing the user-submitted questionnaire data. | No |
| `artifacts` | Map | A map containing S3 URLs for generated files (charts, PDF report). | No |

**Nested Object Structures**:

*   **`calibration` Object**:
    *   `hasExternal` (Boolean): `true` if external calibration was performed.
    *   `offsetDb` (Number, optional): The calibration offset in dB, if provided.
    *   `noiseFloorDbA` (Number, optional): Estimated background noise level in dB(A).
*   **`tests` Object (in a List)**:
    *   `step` (String): The wizard step ID where the recording was made.
    *   `s3Key` (String): The S3 object key for the raw `.wav` audio file.
    *   `durationMs` (Number): Duration of the recording in milliseconds.
*   **`metrics` Object**:
    *   `sustained` (Map): Metrics from sustained vowel test (e.g., `spl_dbA`, `f0_mean`, `jitter_local_percent`).
    *   `vrp` (Map): Metrics from voice range profile test (e.g., `f0_min`, `f0_max`, `spl_min`).
    *   `reading` (Map): Metrics from reading passage test (e.g., `duration_s`, `voiced_ratio`).
    *   `spontaneous` (Map): Metrics from spontaneous speech test.
    *   `dsi` (Number, optional): Dysphonia Severity Index score.
*   **`forms` Object**:
    *   `RBH` (Map): `{ "R": Number, "B": Number, "H": Number }`
    *   `VHI9i` (Number): Total score for the VHI-9i or equivalent questionnaire.
    *   `TVQ` (Map): `{ "total": Number, "percent": Number }` for the TVQ or equivalent.
*   **`artifacts` Object**:
    *   `timeSeries` (String): S3 URL for the time-series chart PNG.
    *   `vrp` (String): S3 URL for the VRP chart PNG.
    *   `formants` (String): S3 URL for the formants chart PNG.
    *   `reportPdf` (String): S3 URL for the final PDF report.

**Global Secondary Indexes**:

1. **SessionIdIndex**
   - Partition Key: `sessionId` (String)
   - Sort Key: `createdAt` (String)
   - Purpose: Allows for efficient querying of a session by its `sessionId` alone, which is useful for the result polling mechanism.

**Sample Item**:
```json
{
  "userOrAnonId": "us-east-1:12345678-1234-1234-1234-123456789012",
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "status": "done",
  "createdAt": "2025-09-01T10:00:00.000Z",
  "calibration": {
    "hasExternal": false
  },
  "tests": [
    { "step": "1", "s3Key": "voice-tests/us-east-1:123.../a1b2c3d4.../raw/1_1.wav", "durationMs": 5100 },
    { "step": "2", "s3Key": "voice-tests/us-east-1:123.../a1b2c3d4.../raw/2_1.wav", "durationMs": 8200 }
  ],
  "metrics": {
    "sustained": {
      "spl_dbA": 76.8,
      "f0_mean": 290,
      "f0_sd": 15.2,
      "jitter_local_percent": 1.04,
      "shimmer_local_percent": 4.52,
      "hnr_db": 20.0,
      "mpt_s": 11.8,
      "formants": {
        "F1": 550,
        "F2": 1500,
        "F3": 2500
      }
    },
    "vrp": {
      "f0_min": 90,
      "f0_max": 596,
      "spl_min": 57,
      "spl_max": 91
    }
  },
  "forms": {
    "RBH": { "R": 1, "B": 0, "H": 1 },
    "VHI9i": 18,
    "TVQ": { "total": 30, "percent": 42 }
  },
  "artifacts": {
    "timeSeries": "s3://your-bucket-name/voice-tests/us-east-1:123.../a1b2c3d4.../artifacts/timeSeries.png",
    "vrp": "s3://your-bucket-name/voice-tests/us-east-1:123.../a1b2c3d4.../artifacts/vrp.png",
    "reportPdf": "s3://your-bucket-name/voice-tests/us-east-1:123.../a1b2c3d4.../report.pdf"
  }
}
```

**Access Patterns**:
1. Get a specific test session: `GetItem` by `userOrAnonId` + `sessionId`.
2. Get all test sessions for a user: `Query` by `userOrAnonId`.
3. Get a session by its ID (e.g., for polling results): `Query` the `SessionIdIndex` by `sessionId`.

---
