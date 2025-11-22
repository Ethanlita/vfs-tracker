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
| `email` | `String` | Yes | 用户电子邮箱。**必须与 Cognito 中的 `email` 保持严格同步**。当 Cognito 的 email 发生变化时，必须同步更新此字段。 |
| `profile` | `Object` | Yes | 用户个人资料 |
| `updatedAt` | `String` | Yes | 最后更新时间的ISO字符串或时间戳 |
| `userId` | `String` | Yes | 用户ID，表示数据记录所属的用户 |

**Object: `Profile` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `areSocialsPublic` | `Boolean` | Yes | 是否公开社交账户链接 |
| `bio` | `String` | No | 用户自我介绍。**预留字段，暂未实现**。 |
| `avatarKey` | `String` | No | 用户头像在 S3 中的对象键，形如 `avatars/{userId}/{timestamp}-{userId}.png`。前端通过该键生成临时访问 URL。 |
| `isNamePublic` | `Boolean` | Yes | 是否公开用户名称 |
| `name` | `String` | Yes | 用户在公共仪表板上显示的名字。用户选择不公开时展示"（非公开）"。 |
| `nickname` | `String` | Yes | 用户昵称。在 /mypage 与 Auth 组件中展示。**必须与 Cognito `nickname` 保持严格同步**。当 Cognito 的 nickname 发生变化时（通过 Cognito API 修改），必须同步更新此字段。 |
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
| `fileType` | `String` | No | 附件的 MIME 类型（如 `image/jpeg`、`application/pdf`） |
| `fileUrl` | `String` | No | **S3 对象键**（非预签名 URL）。存储格式如 `attachments/userId/eventId/filename.ext`。前端需要通过后端 API 获取临时访问 URL。 |

> ⚠️ **隐私说明**：`attachments` 字段为**私有字段**，不会出现在公共 API（如 `GET /all-events`）的响应中。只能在已鉴权的用户查询自己的事件时返回。

**Object: `Event.details`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| *(container)* | `Object` | Yes | 事件详细信息，包括测量数据和自定义字段 |

### Self Test

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `appUsed` | `String` | No | 使用的测音应用或练习应用 |
| `customSoundDetail` | `String` | No | 当 sound 字段包含"其他"选项时，用户填写的具体声音状态详情 |
| `customVoicingDetail` | `String` | No | 当 voicing 字段包含"其他"选项时，用户填写的具体发声方式详情 |
| `formants` | `Object` | No | 共振峰数据 |
| `formants.f1` | `Number` | No | 第一共振峰，单位 Hz |
| `formants.f2` | `Number` | No | 第二共振峰，单位 Hz |
| `formants.f3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics` | `Object` | No | 完整的嗓音分析指标对象，由 online-praat-analysis Lambda 函数自动生成。包含 sustained（持续元音）、reading（朗读）、spontaneous（自发语音）、vrp（声域图）等多个维度的详细测量数据。该字段包含比顶层简化指标更全面的分析结果。 |
| `full_metrics.formants_high` | `Object` | No | 高音域共振峰数据 |
| `full_metrics.formants_high.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `full_metrics.formants_high.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `full_metrics.formants_high.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `full_metrics.formants_high.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `full_metrics.formants_high.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `full_metrics.formants_high.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `full_metrics.formants_high.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `full_metrics.formants_high.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics.formants_high.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `full_metrics.formants_high.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.formants_high.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `full_metrics.formants_high.reason` | `String` | No | 分析状态或失败原因（如 LOW_PROMINENCE） |
| `full_metrics.formants_high.source_file` | `String` | No | 源音频文件名 |
| `full_metrics.formants_high.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.formants_low` | `Object` | No | 低音域共振峰数据 |
| `full_metrics.formants_low.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `full_metrics.formants_low.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `full_metrics.formants_low.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `full_metrics.formants_low.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `full_metrics.formants_low.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `full_metrics.formants_low.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `full_metrics.formants_low.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `full_metrics.formants_low.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics.formants_low.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `full_metrics.formants_low.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.formants_low.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `full_metrics.formants_low.reason` | `String` | No | 分析状态或失败原因 |
| `full_metrics.formants_low.source_file` | `String` | No | 源音频文件名 |
| `full_metrics.formants_low.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.questionnaires` | `Object` | No | 问卷调查数据 |
| `full_metrics.questionnaires.OVHS-9 Total` | `Number` | No | OVHS-9 总分 |
| `full_metrics.questionnaires.RBH` | `Object` | No | RBH 评估量表 |
| `full_metrics.questionnaires.RBH.B` | `Number` | No | 气息音(Breathiness)评分 |
| `full_metrics.questionnaires.RBH.H` | `Number` | No | 嘶哑(Hoarseness)评分 |
| `full_metrics.questionnaires.RBH.R` | `Number` | No | 粗糙(Roughness)评分 |
| `full_metrics.questionnaires.TVQ-G Percent` | `String` | No | TVQ-G 百分比 |
| `full_metrics.questionnaires.TVQ-G Total` | `Number` | No | TVQ-G 总分 |
| `full_metrics.reading` | `Object` | No | 朗读测试数据 |
| `full_metrics.reading.duration_s` | `Number` | No | 时长，单位秒 |
| `full_metrics.reading.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.reading.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `full_metrics.reading.f0_stats` | `Object` | No | 基频统计数据 |
| `full_metrics.reading.f0_stats.median` | `Number` | No | 基频中位数，单位 Hz |
| `full_metrics.reading.f0_stats.p10` | `Number` | No | 基频第10百分位数，单位 Hz |
| `full_metrics.reading.f0_stats.p90` | `Number` | No | 基频第90百分位数，单位 Hz |
| `full_metrics.reading.pause_count` | `Number` | No | 停顿次数 |
| `full_metrics.reading.voiced_ratio` | `Number` | No | 浊音比例（0-1之间） |
| `full_metrics.spontaneous` | `Object` | No | 自发语音测试数据 |
| `full_metrics.spontaneous.duration_s` | `Number` | No | 时长，单位秒 |
| `full_metrics.spontaneous.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.spontaneous.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `full_metrics.spontaneous.f0_stats` | `Object` | No | 基频统计数据 |
| `full_metrics.spontaneous.f0_stats.median` | `Number` | No | 基频中位数，单位 Hz |
| `full_metrics.spontaneous.f0_stats.p10` | `Number` | No | 基频第10百分位数，单位 Hz |
| `full_metrics.spontaneous.f0_stats.p90` | `Number` | No | 基频第90百分位数，单位 Hz |
| `full_metrics.spontaneous.pause_count` | `Number` | No | 停顿次数 |
| `full_metrics.spontaneous.voiced_ratio` | `Number` | No | 浊音比例（0-1之间） |
| `full_metrics.sustained` | `Object` | No | 持续元音测试数据 |
| `full_metrics.sustained.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.sustained.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `full_metrics.sustained.formant_analysis_failed` | `Boolean` | No | 共振峰分析是否失败 |
| `full_metrics.sustained.formant_analysis_reason_high` | `String` | No | 高音共振峰分析失败原因 |
| `full_metrics.sustained.formant_analysis_reason_low` | `String` | No | 低音共振峰分析失败原因 |
| `full_metrics.sustained.formant_analysis_reason_sustained` | `String` | No | 持续音共振峰分析失败原因 |
| `full_metrics.sustained.formants_high` | `Object` | No | 高音共振峰数据 |
| `full_metrics.sustained.formants_high.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `full_metrics.sustained.formants_high.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `full_metrics.sustained.formants_high.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics.sustained.formants_high.error_details` | `String` | No | 错误详情 |
| `full_metrics.sustained.formants_high.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.sustained.formants_high.reason` | `String` | No | 分析状态或失败原因 |
| `full_metrics.sustained.formants_high.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.sustained.formants_low` | `Object` | No | 低音共振峰数据 |
| `full_metrics.sustained.formants_low.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `full_metrics.sustained.formants_low.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `full_metrics.sustained.formants_low.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics.sustained.formants_low.error_details` | `String` | No | 错误详情 |
| `full_metrics.sustained.formants_low.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.sustained.formants_low.reason` | `String` | No | 分析状态或失败原因 |
| `full_metrics.sustained.formants_low.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.sustained.formants_sustained` | `Object` | No | 持续音共振峰数据 |
| `full_metrics.sustained.formants_sustained.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `full_metrics.sustained.formants_sustained.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `full_metrics.sustained.formants_sustained.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `full_metrics.sustained.formants_sustained.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `full_metrics.sustained.formants_sustained.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `full_metrics.sustained.formants_sustained.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `full_metrics.sustained.formants_sustained.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `full_metrics.sustained.formants_sustained.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `full_metrics.sustained.formants_sustained.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `full_metrics.sustained.formants_sustained.error_details` | `String` | No | 错误详情 |
| `full_metrics.sustained.formants_sustained.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `full_metrics.sustained.formants_sustained.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `full_metrics.sustained.formants_sustained.reason` | `String` | No | 分析状态或失败原因 |
| `full_metrics.sustained.formants_sustained.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.sustained.hnr_db` | `Number` | No | 谐噪比，单位 dB |
| `full_metrics.sustained.jitter_local_percent` | `Number` | No | 局部频率抖动，单位 % |
| `full_metrics.sustained.mpt_s` | `Number` | No | 最长发声时间，单位秒 |
| `full_metrics.sustained.shimmer_local_percent` | `Number` | No | 局部振幅抖动，单位 % |
| `full_metrics.sustained.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `full_metrics.vrp` | `Object` | No | 声域图（Voice Range Profile）数据 |
| `full_metrics.vrp.bins` | `Array<Map>` | No | 音高-音量分布数据点数组 |
| `full_metrics.vrp.bins.count` | `Number` | No | 该音高-音量区间的采样点数量 |
| `full_metrics.vrp.bins.f0_center_hz` | `Number` | No | 该区间的中心基频，单位 Hz |
| `full_metrics.vrp.bins.semi` | `Number` | No | 半音值 |
| `full_metrics.vrp.bins.spl_max` | `Number` | No | 该区间最大声压级，单位 dB |
| `full_metrics.vrp.bins.spl_mean` | `Number` | No | 该区间平均声压级，单位 dB |
| `full_metrics.vrp.bins.spl_min` | `Number` | No | 该区间最小声压级，单位 dB |
| `full_metrics.vrp.error` | `String` | No | VRP 分析错误信息（如 no_frames） |
| `full_metrics.vrp.f0_max` | `Number` | No | 最大基频，单位 Hz |
| `full_metrics.vrp.f0_min` | `Number` | No | 最小基频，单位 Hz |
| `full_metrics.vrp.spl_max` | `Number` | No | 最大声压级，单位 dB |
| `full_metrics.vrp.spl_min` | `Number` | No | 最小声压级，单位 dB |
| `fundamentalFrequency` | `Number` | No | 平均基频，单位 Hz。通常来自自发语音（spontaneous）测试的 f0_mean，代表用户日常说话的平均音高。 |
| `hnr` | `Number` | No | 谐噪比 (HNR)，单位 dB |
| `jitter` | `Number` | No | 基频抖动（Jitter），单位 % |
| `notes` | `String` | No | 用户备注 |
| `pitch` | `Object` | No | 音域范围对象，包含 max（最高音）和 min（最低音），单位 Hz，反映用户的音高范围能力 |
| `pitch.max` | `Number` | No | 最高音，单位 Hz |
| `pitch.min` | `Number` | No | 最低音，单位 Hz |
| `shimmer` | `Number` | No | 振幅抖动（Shimmer），单位 % |
| `sound` | `Array<String>` | No | 录音时的声音状态，多选数组。可选值：'好'、'喉咙中有痰'、'其他'。选择'其他'时需配合 customSoundDetail 字段使用。 |
| `voicing` | `Array<String>` | No | 发声方式，多选数组。可选值：'夹了'、'没夹'、'其他'。选择'其他'时需配合 customVoicingDetail 字段使用。**注意**：在 voice_training 和 self_practice 类型中，此字段为 `String` 类型（单选）。 |

### Hospital Test

**`Event.details` object:**

> 注：Hospital Test 类型包含所有 Self Test 的字段，以下仅列出特有字段。

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `equipmentUsed` | `String` | No | 使用的医疗设备名称 |
| `location` | `String` | Yes | 医院或诊所名称 |

### VFS Surgery

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `customDoctor` | `String` | No | 自定义医生姓名。当 doctor 字段选择"自定义"时使用。 |
| `customLocation` | `String` | No | 自定义手术地点。当 location 字段选择"自定义"时使用。 |
| `doctor` | `String` | Yes | 手术医生。枚举值：'李革临'、'金亨泰'、'何双八'、'Kamol'、'田边正博'、'自定义'。选择'自定义'时需配合 customDoctor 字段使用。 |
| `location` | `String` | Yes | 手术地点。枚举值：'友谊医院'、'南京同仁医院'、'Yeson'、'Kamol'、'京都耳鼻咽喉科医院'、'自定义'。选择'自定义'时需配合 customLocation 字段使用。 |
| `notes` | `String` | No | 手术相关备注 |

### Feeling Log

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `content` | `String` | Yes | 感受记录的文本内容 |

### General

**通用字段（可能出现在多种事件类型中）**

**`Event.details` object:**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `feelings` | `String` | No | 用户记录的感受或反思（用于 voice_training、self_practice） |
| `hasInstructor` | `Boolean` | No | 是否有指导者（用于 self_practice） |
| `instructor` | `String` | No | 指导者姓名（用于 voice_training、self_practice） |
| `practiceContent` | `String` | No | 练习内容描述（用于 self_practice） |
| `references` | `String` | No | 参考资料链接或描述（用于 voice_training、self_practice） |
| `selfPracticeContent` | `String` | No | 分配的自我练习作业（用于 voice_training） |
| `trainingContent` | `String` | No | 训练内容描述（用于 voice_training） |
| `voiceStatus` | `String` | No | 嗓音状态评估（用于 voice_training、self_practice） |

## VoiceFemTests

**Object: `TestSession`**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `calibration` | `Map` | No | 预留字段：校准信息，暂未实现 |
| `charts` | `Object` | No | 图表数据对象 |
| `createdAt` | `Number` | Yes | 创建时间的ISO字符串或时间戳 |
| `errorMessage` | `String` | No | 错误信息 |
| `forms` | `Map` | No | 预留字段：用户填写的表单内容，暂未实现 |
| `metrics` | `Object` | No | 测量结果汇总对象 |
| `reportPdf` | `String` | No | 报告的PDF文件路径或URL |
| `sessionId` | `String` | Yes | 测试会话的唯一编号，UUID格式，用于标识和追踪单次完整的嗓音测试流程 |
| `status` | `String` | Yes | 测试状态。可选值：`created`（已创建）、`processing`（处理中）、`done`（完成）、`failed`（失败） |
| `tests` | `List` | No | 预留字段：测试列表，暂未实现 |
| `updatedAt` | `Number` | No | 最后更新时间的ISO字符串或时间戳 |
| `userId` | `String` | Yes | 用户ID，表示数据记录所属的用户 |

**Object: `Charts` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `formant` | `String` | No | 共振峰图表的S3路径 |
| `formant_spl_spectrum` | `String` | No | 共振峰声压级频谱图的S3路径 |
| `timeSeries` | `String` | No | 时间序列图表的S3路径 |
| `vrp` | `String` | No | 声域图的S3路径 |

**Object: `Metrics` (nested)**

| Attribute | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `dsi` | `Number` | No | 预留字段：声音障碍指数(DSI)，暂未实现 |
| `formants_high` | `Object` | No | 高音域共振峰数据 |
| `formants_high.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `formants_high.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `formants_high.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `formants_high.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `formants_high.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `formants_high.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `formants_high.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `formants_high.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `formants_high.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `formants_high.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `formants_high.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `formants_high.reason` | `String` | No | 分析状态或失败原因 |
| `formants_high.source_file` | `String` | No | 源音频文件名 |
| `formants_high.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `formants_low` | `Object` | No | 低音域共振峰数据 |
| `formants_low.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `formants_low.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `formants_low.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `formants_low.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `formants_low.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `formants_low.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `formants_low.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `formants_low.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `formants_low.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `formants_low.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `formants_low.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `formants_low.reason` | `String` | No | 分析状态或失败原因 |
| `formants_low.source_file` | `String` | No | 源音频文件名 |
| `formants_low.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `questionnaires` | `Object` | No | 问卷调查数据 |
| `questionnaires.OVHS-9 Total` | `Number` | No | OVHS-9 总分 |
| `questionnaires.RBH` | `Object` | No | RBH 评估量表 |
| `questionnaires.RBH.B` | `Number` | No | 气息音(Breathiness)评分 |
| `questionnaires.RBH.H` | `Number` | No | 嘶哑(Hoarseness)评分 |
| `questionnaires.RBH.R` | `Number` | No | 粗糙(Roughness)评分 |
| `questionnaires.TVQ-G Percent` | `String` | No | TVQ-G 百分比 |
| `questionnaires.TVQ-G Total` | `Number` | No | TVQ-G 总分 |
| `reading` | `Object` | No | 朗读测试数据 |
| `reading.duration_s` | `Number` | No | 时长，单位秒 |
| `reading.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `reading.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `reading.f0_stats` | `Object` | No | 基频统计数据 |
| `reading.f0_stats.median` | `Number` | No | 基频中位数，单位 Hz |
| `reading.f0_stats.p10` | `Number` | No | 基频第10百分位数，单位 Hz |
| `reading.f0_stats.p90` | `Number` | No | 基频第90百分位数，单位 Hz |
| `reading.pause_count` | `Number` | No | 停顿次数 |
| `reading.voiced_ratio` | `Number` | No | 浊音比例（0-1之间） |
| `spontaneous` | `Object` | No | 自发语音测试数据 |
| `spontaneous.duration_s` | `Number` | No | 时长，单位秒 |
| `spontaneous.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `spontaneous.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `spontaneous.f0_stats` | `Object` | No | 基频统计数据 |
| `spontaneous.f0_stats.median` | `Number` | No | 基频中位数，单位 Hz |
| `spontaneous.f0_stats.p10` | `Number` | No | 基频第10百分位数，单位 Hz |
| `spontaneous.f0_stats.p90` | `Number` | No | 基频第90百分位数，单位 Hz |
| `spontaneous.pause_count` | `Number` | No | 停顿次数 |
| `spontaneous.voiced_ratio` | `Number` | No | 浊音比例（0-1之间） |
| `sustained` | `Object` | No | 持续元音测试数据 |
| `sustained.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `sustained.f0_sd` | `Number` | No | 基频标准差，单位 Hz |
| `sustained.formant_analysis_failed` | `Boolean` | No | 共振峰分析是否失败 |
| `sustained.formant_analysis_reason_high` | `String` | No | 高音共振峰分析失败原因 |
| `sustained.formant_analysis_reason_low` | `String` | No | 低音共振峰分析失败原因 |
| `sustained.formant_analysis_reason_sustained` | `String` | No | 持续音共振峰分析失败原因 |
| `sustained.formants_high` | `Object` | No | 高音共振峰数据 |
| `sustained.formants_high.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `sustained.formants_high.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `sustained.formants_high.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `sustained.formants_high.error_details` | `String` | No | 错误详情 |
| `sustained.formants_high.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `sustained.formants_high.reason` | `String` | No | 分析状态或失败原因 |
| `sustained.formants_high.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `sustained.formants_low` | `Object` | No | 低音共振峰数据 |
| `sustained.formants_low.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `sustained.formants_low.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `sustained.formants_low.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `sustained.formants_low.error_details` | `String` | No | 错误详情 |
| `sustained.formants_low.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `sustained.formants_low.reason` | `String` | No | 分析状态或失败原因 |
| `sustained.formants_low.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `sustained.formants_sustained` | `Object` | No | 持续音共振峰数据 |
| `sustained.formants_sustained.B1` | `Number` | No | 第一共振峰带宽，单位 Hz |
| `sustained.formants_sustained.B2` | `Number` | No | 第二共振峰带宽，单位 Hz |
| `sustained.formants_sustained.B3` | `Number` | No | 第三共振峰带宽，单位 Hz |
| `sustained.formants_sustained.F1` | `Number` | No | 第一共振峰，单位 Hz |
| `sustained.formants_sustained.F1_available` | `Boolean` | No | F1 数据是否可用 |
| `sustained.formants_sustained.F2` | `Number` | No | 第二共振峰，单位 Hz |
| `sustained.formants_sustained.F2_available` | `Boolean` | No | F2 数据是否可用 |
| `sustained.formants_sustained.F3` | `Number` | No | 第三共振峰，单位 Hz |
| `sustained.formants_sustained.best_segment_time` | `Number` | No | 最佳分析片段的时间点，单位秒 |
| `sustained.formants_sustained.error_details` | `String` | No | 错误详情 |
| `sustained.formants_sustained.f0_mean` | `Number` | No | 基频均值，单位 Hz |
| `sustained.formants_sustained.is_high_pitch` | `Boolean` | No | 是否为高音 |
| `sustained.formants_sustained.reason` | `String` | No | 分析状态或失败原因 |
| `sustained.formants_sustained.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `sustained.hnr_db` | `Number` | No | 谐噪比，单位 dB |
| `sustained.jitter_local_percent` | `Number` | No | 局部频率抖动，单位 % |
| `sustained.mpt_s` | `Number` | No | 最长发声时间，单位秒 |
| `sustained.shimmer_local_percent` | `Number` | No | 局部振幅抖动，单位 % |
| `sustained.spl_dbA_est` | `Number` | No | 估算声压级，单位 dB(A) |
| `vrp` | `Object` | No | 声域图（Voice Range Profile）数据 |
| `vrp.bins` | `Array<Map>` | No | 音高-音量分布数据点数组 |
| `vrp.bins.count` | `Number` | No | 该音高-音量区间的采样点数量 |
| `vrp.bins.f0_center_hz` | `Number` | No | 该区间的中心基频，单位 Hz |
| `vrp.bins.semi` | `Number` | No | 半音值 |
| `vrp.bins.spl_max` | `Number` | No | 该区间最大声压级，单位 dB |
| `vrp.bins.spl_mean` | `Number` | No | 该区间平均声压级，单位 dB |
| `vrp.bins.spl_min` | `Number` | No | 该区间最小声压级，单位 dB |
| `vrp.error` | `String` | No | VRP 分析错误信息（如 no_frames） |
| `vrp.f0_max` | `Number` | No | 最大基频，单位 Hz |
| `vrp.f0_min` | `Number` | No | 最小基频，单位 Hz |
| `vrp.spl_max` | `Number` | No | 最大声压级，单位 dB |
| `vrp.spl_min` | `Number` | No | 最小声压级，单位 dB |

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
- Total fields documented: **302**
  - users: **13** (新增bio字段)
  - events: **158**
  - tests: **131**

- Doc has, Data missing: **17** (events: 12, tests: 4, users: 1-bio字段)
- Data has, Doc missing: **0**
- Doc & Data both: **285**

> 统计口径以 `all_fields_table.csv` 为准。

---

## 变更记录

### v2.0 - 2025-10-06
- ✅ 新增 `bio` 字段标记为"预留字段，暂未实现"
- ✅ 强化 `email` 和 `nickname` 与 Cognito 的同步要求
- ✅ 明确 `Attachment.fileUrl` 为 S3 对象键（非预签名 URL）
- ✅ 补充所有 General、Hospital Test、Surgery、Feeling Log 字段的类型定义
- ✅ 补充所有 Self Test 顶层字段的详细描述
- ✅ 补充 Tests 表 `sessionId` 和 `status` 字段的详细描述
- ✅ 强调 attachments 字段的隐私性
