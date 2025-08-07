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

**Object: `Event` (Base Structure)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `userId` | `String` | Yes | The user this event belongs to. Partition Key. |
| `eventId` | `String` | Yes | Unique ID for the event (e.g., a UUID). Sort Key. |
| `type` | `String` | Yes | The type of event. Determines the structure of the `details` object. |
| `date` | `String` | Yes | ISO 8601 timestamp for when the event occurred. |
| `details` | `Object` | Yes | Contains attributes specific to the event type. |
| `createdAt`| `String` | Yes | ISO 8601 timestamp of creation. |

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
| `attachmentUrl` | `String` | No | URL to a stored file (e.g., audio recording on S3). |
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
