# VFS Tracker Data Structures (Updated)

> 本文档根据 **AWS 导出数据** 与 **IaC**（优先）以及现有代码回溯校准；当与旧文档不一致时，以数据/代码为准。

## Tables
1. [VoiceFemUsers](#voicefemusers)
2. [VoiceFemEvents](#voicefemevents)
3. [VoiceFemTests](#voicefemtests)

## VoiceFemUsers

**Object: `User`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `createdAt` | `String` | Yes | 创建时间的ISO字符串或时间戳 |
| `email` | `String` | Yes | 用户电子邮箱。与 Cognito 中的 `email` 保持一致，变更后需同步。 |
| `profile` | `Object` | Yes | 用户个人资料 |
| `updatedAt` | `String` | Yes | 最后更新时间的ISO字符串或时间戳 |
| `userId` | `String` | Yes | 用户ID，表示数据记录所属的用户 |

**Object: `Profile` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `areSocialsPublic` | `Boolean` | Yes | 是否公开社交账户链接 |
| `isNamePublic` | `Boolean` | Yes | 是否公开用户名称 |
| `name` | `String` | Yes | 用户在公共仪表板上显示的名字。用户选择不公开时展示“（非公开）”。 |
| `nickname` | `String` | Yes | 用户昵称。在 /mypage 与 Auth 组件中展示；与 Cognito `nickname` 保持一致，Cognito 修改后需同步。 |
| `socials` | `Array<SocialAccount>` | No | 用户社交信息列表 |
| `socials.handle` | `String` | No | 社交账号的用户名或Handle |
| `socials.platform` | `String` | No | 社交账号的平台，如Twitter |

## VoiceFemEvents

**Object: `Event` (Base Structure)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `attachments` | `Array<Attachment>` | No | 附件数组，包含与事件相关的文件 |
| `createdAt` | `String` | Yes | 创建时间的ISO字符串或时间戳 |
| `date` | `String` | Yes | 事件发生的日期 |
| `details` | `Object` | Yes | 事件详细信息，包括测量数据和自定义字段 |
| `eventId` | `String` | Yes | 事件ID，唯一标识事件 |
| `status` | `String` | Yes | 事件状态，例如 pending、approved |
| `type` | `String` | Yes | 事件类型（如 self_test、surgery 等） |
| `updatedAt` | `String` | Yes | 最后更新时间的ISO字符串或时间戳 |
| `userId` | `String` | Yes | 用户ID，表示数据记录所属的用户 |

**Object: `Attachment` (Reusable, PRIVATE)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fileName` | `String` | No | 附件的原始文件名 |
| `fileType` | `String` | No | 附件的 MIME 类型 |
| `fileUrl` | `String` | No | 附件的存储地址URL |

**Object: `Event.details`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| *(container)* | `Object` | Yes | 事件详细信息，包括测量数据和自定义字段 |

### Self Test

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `appUsed` | `String` | No | 使用的测音应用或练习应用 |
| `customSoundDetail` | `String` | No |  |
| `customVoicingDetail` | `String` | No |  |
| `formants` | `Object` | No | 共振峰数据 |
| `formants.f1` | `Number` | No |  |
| `formants.f2` | `Number` | No |  |
| `formants.f3` | `Number` | No |  |
| `full_metrics` | `Object` | No |  |
| `full_metrics.formants_high` | `Object` | No | 共振峰数据 |
| `full_metrics.formants_high.B1` | `Number` | No |  |
| `full_metrics.formants_high.B2` | `Number` | No |  |
| `full_metrics.formants_high.B3` | `Number` | No |  |
| `full_metrics.formants_high.F1` | `Number` | No |  |
| `full_metrics.formants_high.F1_available` | `Boolean` | No |  |
| `full_metrics.formants_high.F2` | `Number` | No |  |
| `full_metrics.formants_high.F2_available` | `Boolean` | No |  |
| `full_metrics.formants_high.F3` | `Number` | No |  |
| `full_metrics.formants_high.best_segment_time` | `Number` | No |  |
| `full_metrics.formants_high.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.formants_high.is_high_pitch` | `Boolean` | No | 音高 |
| `full_metrics.formants_high.reason` | `String` | No |  |
| `full_metrics.formants_high.source_file` | `String` | No |  |
| `full_metrics.formants_high.spl_dbA_est` | `Number` | No |  |
| `full_metrics.formants_low` | `Object` | No | 共振峰数据 |
| `full_metrics.formants_low.B1` | `Number` | No |  |
| `full_metrics.formants_low.B2` | `Number` | No |  |
| `full_metrics.formants_low.B3` | `Number` | No |  |
| `full_metrics.formants_low.F1` | `Number` | No |  |
| `full_metrics.formants_low.F1_available` | `Boolean` | No |  |
| `full_metrics.formants_low.F2` | `Number` | No |  |
| `full_metrics.formants_low.F2_available` | `Boolean` | No |  |
| `full_metrics.formants_low.F3` | `Number` | No |  |
| `full_metrics.formants_low.best_segment_time` | `Number` | No |  |
| `full_metrics.formants_low.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.formants_low.is_high_pitch` | `Boolean` | No | 音高 |
| `full_metrics.formants_low.reason` | `String` | No |  |
| `full_metrics.formants_low.source_file` | `String` | No |  |
| `full_metrics.formants_low.spl_dbA_est` | `Number` | No |  |
| `full_metrics.questionnaires` | `Object` | No |  |
| `full_metrics.questionnaires.OVHS-9 Total` | `Number` | No |  |
| `full_metrics.questionnaires.RBH` | `Object` | No |  |
| `full_metrics.questionnaires.RBH.B` | `Number` | No |  |
| `full_metrics.questionnaires.RBH.H` | `Number` | No |  |
| `full_metrics.questionnaires.RBH.R` | `Number` | No |  |
| `full_metrics.questionnaires.TVQ-G Percent` | `String` | No |  |
| `full_metrics.questionnaires.TVQ-G Total` | `Number` | No |  |
| `full_metrics.reading` | `Object` | No |  |
| `full_metrics.reading.duration_s` | `Number` | No |  |
| `full_metrics.reading.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.reading.f0_sd` | `Number` | No |  |
| `full_metrics.reading.f0_stats` | `Object` | No |  |
| `full_metrics.reading.f0_stats.median` | `Number` | No |  |
| `full_metrics.reading.f0_stats.p10` | `Number` | No |  |
| `full_metrics.reading.f0_stats.p90` | `Number` | No |  |
| `full_metrics.reading.pause_count` | `Number` | No |  |
| `full_metrics.reading.voiced_ratio` | `Number` | No |  |
| `full_metrics.spontaneous` | `Object` | No |  |
| `full_metrics.spontaneous.duration_s` | `Number` | No |  |
| `full_metrics.spontaneous.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.spontaneous.f0_sd` | `Number` | No |  |
| `full_metrics.spontaneous.f0_stats` | `Object` | No |  |
| `full_metrics.spontaneous.f0_stats.median` | `Number` | No |  |
| `full_metrics.spontaneous.f0_stats.p10` | `Number` | No |  |
| `full_metrics.spontaneous.f0_stats.p90` | `Number` | No |  |
| `full_metrics.spontaneous.pause_count` | `Number` | No |  |
| `full_metrics.spontaneous.voiced_ratio` | `Number` | No |  |
| `full_metrics.sustained` | `Object` | No |  |
| `full_metrics.sustained.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.sustained.f0_sd` | `Number` | No |  |
| `full_metrics.sustained.formant_analysis_failed` | `Boolean` | No | 共振峰数据 |
| `full_metrics.sustained.formant_analysis_reason_high` | `String` | No | 共振峰数据 |
| `full_metrics.sustained.formant_analysis_reason_low` | `String` | No | 共振峰数据 |
| `full_metrics.sustained.formant_analysis_reason_sustained` | `String` | No | 共振峰数据 |
| `full_metrics.sustained.formants_high` | `Object` | No | 共振峰数据 |
| `full_metrics.sustained.formants_high.F1` | `Number` | No |  |
| `full_metrics.sustained.formants_high.F2` | `Number` | No |  |
| `full_metrics.sustained.formants_high.F3` | `Number` | No |  |
| `full_metrics.sustained.formants_high.error_details` | `String` | No |  |
| `full_metrics.sustained.formants_high.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.sustained.formants_high.reason` | `String` | No |  |
| `full_metrics.sustained.formants_high.spl_dbA_est` | `Number` | No |  |
| `full_metrics.sustained.formants_low` | `Object` | No | 共振峰数据 |
| `full_metrics.sustained.formants_low.F1` | `Number` | No |  |
| `full_metrics.sustained.formants_low.F2` | `Number` | No |  |
| `full_metrics.sustained.formants_low.F3` | `Number` | No |  |
| `full_metrics.sustained.formants_low.error_details` | `String` | No |  |
| `full_metrics.sustained.formants_low.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.sustained.formants_low.reason` | `String` | No |  |
| `full_metrics.sustained.formants_low.spl_dbA_est` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained` | `Object` | No | 共振峰数据 |
| `full_metrics.sustained.formants_sustained.B1` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.B2` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.B3` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.F1` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.F1_available` | `Boolean` | No |  |
| `full_metrics.sustained.formants_sustained.F2` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.F2_available` | `Boolean` | No |  |
| `full_metrics.sustained.formants_sustained.F3` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.best_segment_time` | `Number` | No |  |
| `full_metrics.sustained.formants_sustained.error_details` | `String` | No |  |
| `full_metrics.sustained.formants_sustained.f0_mean` | `Number` | No | 基频均值 |
| `full_metrics.sustained.formants_sustained.is_high_pitch` | `Boolean` | No | 音高 |
| `full_metrics.sustained.formants_sustained.reason` | `String` | No |  |
| `full_metrics.sustained.formants_sustained.spl_dbA_est` | `Number` | No |  |
| `full_metrics.sustained.hnr_db` | `Number` | No |  |
| `full_metrics.sustained.jitter_local_percent` | `Number` | No |  |
| `full_metrics.sustained.mpt_s` | `Number` | No |  |
| `full_metrics.sustained.shimmer_local_percent` | `Number` | No |  |
| `full_metrics.sustained.spl_dbA_est` | `Number` | No |  |
| `full_metrics.vrp` | `Object` | No |  |
| `full_metrics.vrp.bins` | `Array<Map>` | No |  |
| `full_metrics.vrp.bins.count` | `Number` | No |  |
| `full_metrics.vrp.bins.f0_center_hz` | `Number` | No |  |
| `full_metrics.vrp.bins.semi` | `Number` | No |  |
| `full_metrics.vrp.bins.spl_max` | `Number` | No |  |
| `full_metrics.vrp.bins.spl_mean` | `Number` | No |  |
| `full_metrics.vrp.bins.spl_min` | `Number` | No |  |
| `full_metrics.vrp.error` | `String` | No |  |
| `full_metrics.vrp.f0_max` | `Number` | No | 基频最大值 |
| `full_metrics.vrp.f0_min` | `Number` | No | 基频最小值 |
| `full_metrics.vrp.spl_max` | `Number` | No |  |
| `full_metrics.vrp.spl_min` | `Number` | No |  |
| `fundamentalFrequency` | `Number` | No |  |
| `hnr` | `Number` | No | 谐噪比 (HNR) |
| `jitter` | `Number` | No | 基频抖动 (jitter) |
| `notes` | `String` | No | 用户备注 |
| `pitch` | `Object` | No | 音高 |
| `pitch.max` | `Number` | No |  |
| `pitch.min` | `Number` | No |  |
| `shimmer` | `Number` | No | 振幅抖动 (shimmer) |
| `sound` | `Array` | No | 录音类型，如aa或ee |
| `voicing` | `Array` | No | 发声类型，如日常语音或练习语音 |

### Hospital Test

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `equipmentUsed` | `` | No | 使用的设备 |

### VFS Surgery

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `customDoctor` | `` | No | 自定义医生信息 |
| `customLocation` | `` | No | 自定义地点信息 |
| `doctor` | `String` | No | 医生姓名或机构 |
| `location` | `String` | No | 事件发生地点 |

### Feeling Log

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `content` | `` | No |  |

### General

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `feelings` | `` | No | 用户记录的感受或参考信息 |
| `hasInstructor` | `` | No |  |
| `instructor` | `` | No | 指导者姓名 |
| `practiceContent` | `` | No | 练习或训练内容 |
| `references` | `` | No | 用户记录的感受或参考信息 |
| `selfPracticeContent` | `` | No | 练习或训练内容 |
| `trainingContent` | `` | No | 练习或训练内容 |
| `voiceStatus` | `` | No | 用户记录的感受或参考信息 |

## VoiceFemTests

**Object: `TestSession`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `calibration` | `` | No | 预留字段：校准信息，暂未实现 |
| `charts` | `Object` | No | 图表数据对象 |
| `createdAt` | `Number` | Yes | 创建时间的ISO字符串或时间戳 |
| `errorMessage` | `String` | No | 错误信息 |
| `forms` | `` | No | 预留字段：用户填写的表单内容，暂未实现 |
| `metrics` | `Object` | No | 测量结果汇总对象 |
| `reportPdf` | `String` | No | 报告的PDF文件路径或URL |
| `sessionId` | `String` | Yes | 测试会话的唯一编号 |
| `status` | `String` | Yes | 事件状态，例如 pending、approved |
| `tests` | `` | No | 预留字段：测试列表，暂未实现 |
| `updatedAt` | `Number` | No | 最后更新时间的ISO字符串或时间戳 |
| `userId` | `String` | Yes | 用户ID，表示数据记录所属的用户 |

**Object: `Charts` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `formant` | `String` | No | 共振峰数据 |
| `formant_spl_spectrum` | `String` | No | 共振峰数据 |
| `timeSeries` | `String` | No |  |
| `vrp` | `String` | No |  |

**Object: `Metrics` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `dsi` | `` | No | 预留字段：声音障碍指数(DSI)，暂未实现 |
| `formants_high` | `Object` | No | 共振峰数据 |
| `formants_high.B1` | `Number` | No |  |
| `formants_high.B2` | `Number` | No |  |
| `formants_high.B3` | `Number` | No |  |
| `formants_high.F1` | `Number` | No |  |
| `formants_high.F1_available` | `Boolean` | No |  |
| `formants_high.F2` | `Number` | No |  |
| `formants_high.F2_available` | `Boolean` | No |  |
| `formants_high.F3` | `Number` | No |  |
| `formants_high.best_segment_time` | `Number` | No |  |
| `formants_high.f0_mean` | `Number` | No | 基频均值 |
| `formants_high.is_high_pitch` | `Boolean` | No | 音高 |
| `formants_high.reason` | `String` | No |  |
| `formants_high.source_file` | `String` | No |  |
| `formants_high.spl_dbA_est` | `Number` | No |  |
| `formants_low` | `Object` | No | 共振峰数据 |
| `formants_low.B1` | `Number` | No |  |
| `formants_low.B2` | `Number` | No |  |
| `formants_low.B3` | `Number` | No |  |
| `formants_low.F1` | `Number` | No |  |
| `formants_low.F1_available` | `Boolean` | No |  |
| `formants_low.F2` | `Number` | No |  |
| `formants_low.F2_available` | `Boolean` | No |  |
| `formants_low.F3` | `Number` | No |  |
| `formants_low.best_segment_time` | `Number` | No |  |
| `formants_low.f0_mean` | `Number` | No | 基频均值 |
| `formants_low.is_high_pitch` | `Boolean` | No | 音高 |
| `formants_low.reason` | `String` | No |  |
| `formants_low.source_file` | `String` | No |  |
| `formants_low.spl_dbA_est` | `Number` | No |  |
| `questionnaires` | `Object` | No |  |
| `questionnaires.OVHS-9 Total` | `Number` | No |  |
| `questionnaires.RBH` | `Object` | No |  |
| `questionnaires.RBH.B` | `Number` | No |  |
| `questionnaires.RBH.H` | `Number` | No |  |
| `questionnaires.RBH.R` | `Number` | No |  |
| `questionnaires.TVQ-G Percent` | `String` | No |  |
| `questionnaires.TVQ-G Total` | `Number` | No |  |
| `reading` | `Object` | No |  |
| `reading.duration_s` | `Number` | No |  |
| `reading.f0_mean` | `Number` | No | 基频均值 |
| `reading.f0_sd` | `Number` | No |  |
| `reading.f0_stats` | `Object` | No |  |
| `reading.f0_stats.median` | `Number` | No |  |
| `reading.f0_stats.p10` | `Number` | No |  |
| `reading.f0_stats.p90` | `Number` | No |  |
| `reading.pause_count` | `Number` | No |  |
| `reading.voiced_ratio` | `Number` | No |  |
| `spontaneous` | `Object` | No |  |
| `spontaneous.duration_s` | `Number` | No |  |
| `spontaneous.f0_mean` | `Number` | No | 基频均值 |
| `spontaneous.f0_sd` | `Number` | No |  |
| `spontaneous.f0_stats` | `Object` | No |  |
| `spontaneous.f0_stats.median` | `Number` | No |  |
| `spontaneous.f0_stats.p10` | `Number` | No |  |
| `spontaneous.f0_stats.p90` | `Number` | No |  |
| `spontaneous.pause_count` | `Number` | No |  |
| `spontaneous.voiced_ratio` | `Number` | No |  |
| `sustained` | `Object` | No |  |
| `sustained.f0_mean` | `Number` | No | 基频均值 |
| `sustained.f0_sd` | `Number` | No |  |
| `sustained.formant_analysis_failed` | `Boolean` | No | 共振峰数据 |
| `sustained.formant_analysis_reason_high` | `String` | No | 共振峰数据 |
| `sustained.formant_analysis_reason_low` | `String` | No | 共振峰数据 |
| `sustained.formant_analysis_reason_sustained` | `String` | No | 共振峰数据 |
| `sustained.formants_high` | `Object` | No | 共振峰数据 |
| `sustained.formants_high.F1` | `Number` | No |  |
| `sustained.formants_high.F2` | `Number` | No |  |
| `sustained.formants_high.F3` | `Number` | No |  |
| `sustained.formants_high.error_details` | `String` | No |  |
| `sustained.formants_high.f0_mean` | `Number` | No | 基频均值 |
| `sustained.formants_high.reason` | `String` | No |  |
| `sustained.formants_high.spl_dbA_est` | `Number` | No |  |
| `sustained.formants_low` | `Object` | No | 共振峰数据 |
| `sustained.formants_low.F1` | `Number` | No |  |
| `sustained.formants_low.F2` | `Number` | No |  |
| `sustained.formants_low.F3` | `Number` | No |  |
| `sustained.formants_low.error_details` | `String` | No |  |
| `sustained.formants_low.f0_mean` | `Number` | No | 基频均值 |
| `sustained.formants_low.reason` | `String` | No |  |
| `sustained.formants_low.spl_dbA_est` | `Number` | No |  |
| `sustained.formants_sustained` | `Object` | No | 共振峰数据 |
| `sustained.formants_sustained.B1` | `Number` | No |  |
| `sustained.formants_sustained.B2` | `Number` | No |  |
| `sustained.formants_sustained.B3` | `Number` | No |  |
| `sustained.formants_sustained.F1` | `Number` | No |  |
| `sustained.formants_sustained.F1_available` | `Boolean` | No |  |
| `sustained.formants_sustained.F2` | `Number` | No |  |
| `sustained.formants_sustained.F2_available` | `Boolean` | No |  |
| `sustained.formants_sustained.F3` | `Number` | No |  |
| `sustained.formants_sustained.best_segment_time` | `Number` | No |  |
| `sustained.formants_sustained.error_details` | `String` | No |  |
| `sustained.formants_sustained.f0_mean` | `Number` | No | 基频均值 |
| `sustained.formants_sustained.is_high_pitch` | `Boolean` | No | 音高 |
| `sustained.formants_sustained.reason` | `String` | No |  |
| `sustained.formants_sustained.spl_dbA_est` | `Number` | No |  |
| `sustained.hnr_db` | `Number` | No |  |
| `sustained.jitter_local_percent` | `Number` | No |  |
| `sustained.mpt_s` | `Number` | No |  |
| `sustained.shimmer_local_percent` | `Number` | No |  |
| `sustained.spl_dbA_est` | `Number` | No |  |
| `vrp` | `Object` | No |  |
| `vrp.bins` | `Array<Map>` | No |  |
| `vrp.bins.count` | `Number` | No |  |
| `vrp.bins.f0_center_hz` | `Number` | No |  |
| `vrp.bins.semi` | `Number` | No |  |
| `vrp.bins.spl_max` | `Number` | No |  |
| `vrp.bins.spl_mean` | `Number` | No |  |
| `vrp.bins.spl_min` | `Number` | No |  |
| `vrp.error` | `String` | No |  |
| `vrp.f0_max` | `Number` | No | 基频最大值 |
| `vrp.f0_min` | `Number` | No | 基频最小值 |
| `vrp.spl_max` | `Number` | No |  |
| `vrp.spl_min` | `Number` | No |  |

---

## DynamoDB Table Definitions (from AWS export)

**VoiceFemUsers**

- Partition Key: `userId` (String)
- Billing Mode: Pay-per-request

**VoiceFemEvents**

- Partition Key: `userId` (String)
- Sort Key: `eventId` (String)
- Stream: Enabled (NEW_IMAGE)

**VoiceFemTests**

- Partition Key: `sessionId` (String)
- Billing Mode: Pay-per-request

---

## Field Coverage Summary
- Total fields documented: **301**
  - users: **12**
  - events: **158**
  - tests: **131**

- Doc has, Data missing: **16** (events: 12, tests: 4)
- Data has, Doc missing: **1** (users: 1)
- Doc & Data both: **285**

> 统计口径以 `all_fields_table_updated.csv` 为准。