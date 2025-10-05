# 文档定义 vs 实际数据 字段对比报告（修正版）

## 统计摘要

- **文档中定义的字段**: 188 (系统提取)
- **文档中能找到的字段**: 57 (搜索验证)
- **数据中实际存在的字段**: 279
- **两者都有的字段**: 165 (59%)
- **只在数据存在（未文档化）**: 114 (40%)
- **只在文档定义（未使用）**: 36 (19%)

---

## 1. 文档有定义，数据也存在的字段

**共计 165 个字段**

### VoiceFemEvents (137个)

- `attachments`
- `attachments.fileName`
- `attachments.fileType`
- `attachments.fileUrl`
- `date`
- `details`
- `details.appUsed`
- `details.customSoundDetail`
- `details.customVoicingDetail`
- `details.doctor`
- `details.formants`
- `details.full_metrics`
- `details.full_metrics.formants_high`
- `details.full_metrics.formants_high.B1`
- `details.full_metrics.formants_high.B2`
- `details.full_metrics.formants_high.B3`
- `details.full_metrics.formants_high.F1`
- `details.full_metrics.formants_high.F1_available`
- `details.full_metrics.formants_high.F2`
- `details.full_metrics.formants_high.F2_available`
- `details.full_metrics.formants_high.F3`
- `details.full_metrics.formants_high.best_segment_time`
- `details.full_metrics.formants_high.f0_mean`
- `details.full_metrics.formants_high.is_high_pitch`
- `details.full_metrics.formants_high.reason`
- `details.full_metrics.formants_high.source_file`
- `details.full_metrics.formants_high.spl_dbA_est`
- `details.full_metrics.formants_low`
- `details.full_metrics.formants_low.B1`
- `details.full_metrics.formants_low.B2`
- `details.full_metrics.formants_low.B3`
- `details.full_metrics.formants_low.F1`
- `details.full_metrics.formants_low.F1_available`
- `details.full_metrics.formants_low.F2`
- `details.full_metrics.formants_low.F2_available`
- `details.full_metrics.formants_low.F3`
- `details.full_metrics.formants_low.best_segment_time`
- `details.full_metrics.formants_low.f0_mean`
- `details.full_metrics.formants_low.is_high_pitch`
- `details.full_metrics.formants_low.reason`
- `details.full_metrics.formants_low.source_file`
- `details.full_metrics.formants_low.spl_dbA_est`
- `details.full_metrics.questionnaires`
- `details.full_metrics.questionnaires.OVHS-9 Total`
- `details.full_metrics.questionnaires.RBH`
- `details.full_metrics.questionnaires.RBH.B`
- `details.full_metrics.questionnaires.RBH.H`
- `details.full_metrics.questionnaires.RBH.R`
- `details.full_metrics.questionnaires.TVQ-G Percent`
- `details.full_metrics.questionnaires.TVQ-G Total`
- `details.full_metrics.reading`
- `details.full_metrics.reading.duration_s`
- `details.full_metrics.reading.f0_mean`
- `details.full_metrics.reading.f0_sd`
- `details.full_metrics.reading.f0_stats`
- `details.full_metrics.reading.f0_stats.median`
- `details.full_metrics.reading.f0_stats.p10`
- `details.full_metrics.reading.f0_stats.p90`
- `details.full_metrics.reading.pause_count`
- `details.full_metrics.reading.voiced_ratio`
- `details.full_metrics.spontaneous`
- `details.full_metrics.spontaneous.duration_s`
- `details.full_metrics.spontaneous.f0_mean`
- `details.full_metrics.spontaneous.f0_sd`
- `details.full_metrics.spontaneous.f0_stats`
- `details.full_metrics.spontaneous.f0_stats.median`
- `details.full_metrics.spontaneous.f0_stats.p10`
- `details.full_metrics.spontaneous.f0_stats.p90`
- `details.full_metrics.spontaneous.pause_count`
- `details.full_metrics.spontaneous.voiced_ratio`
- `details.full_metrics.sustained`
- `details.full_metrics.sustained.f0_mean`
- `details.full_metrics.sustained.f0_sd`
- `details.full_metrics.sustained.formant_analysis_failed`
- `details.full_metrics.sustained.formant_analysis_reason_high`
- `details.full_metrics.sustained.formant_analysis_reason_low`
- `details.full_metrics.sustained.formant_analysis_reason_sustained`
- `details.full_metrics.sustained.formants_high`
- `details.full_metrics.sustained.formants_high.F1`
- `details.full_metrics.sustained.formants_high.F2`
- `details.full_metrics.sustained.formants_high.F3`
- `details.full_metrics.sustained.formants_high.error_details`
- `details.full_metrics.sustained.formants_high.f0_mean`
- `details.full_metrics.sustained.formants_high.reason`
- `details.full_metrics.sustained.formants_high.spl_dbA_est`
- `details.full_metrics.sustained.formants_low`
- `details.full_metrics.sustained.formants_low.F1`
- `details.full_metrics.sustained.formants_low.F2`
- `details.full_metrics.sustained.formants_low.F3`
- `details.full_metrics.sustained.formants_low.error_details`
- `details.full_metrics.sustained.formants_low.f0_mean`
- `details.full_metrics.sustained.formants_low.reason`
- `details.full_metrics.sustained.formants_low.spl_dbA_est`
- `details.full_metrics.sustained.formants_sustained`
- `details.full_metrics.sustained.formants_sustained.B1`
- `details.full_metrics.sustained.formants_sustained.B2`
- `details.full_metrics.sustained.formants_sustained.B3`
- `details.full_metrics.sustained.formants_sustained.F1`
- `details.full_metrics.sustained.formants_sustained.F1_available`
- `details.full_metrics.sustained.formants_sustained.F2`
- `details.full_metrics.sustained.formants_sustained.F2_available`
- `details.full_metrics.sustained.formants_sustained.F3`
- `details.full_metrics.sustained.formants_sustained.best_segment_time`
- `details.full_metrics.sustained.formants_sustained.error_details`
- `details.full_metrics.sustained.formants_sustained.f0_mean`
- `details.full_metrics.sustained.formants_sustained.is_high_pitch`
- `details.full_metrics.sustained.formants_sustained.reason`
- `details.full_metrics.sustained.formants_sustained.spl_dbA_est`
- `details.full_metrics.sustained.hnr_db`
- `details.full_metrics.sustained.jitter_local_percent`
- `details.full_metrics.sustained.mpt_s`
- `details.full_metrics.sustained.shimmer_local_percent`
- `details.full_metrics.sustained.spl_dbA_est`
- `details.full_metrics.vrp`
- `details.full_metrics.vrp.bins`
- `details.full_metrics.vrp.bins.count`
- `details.full_metrics.vrp.bins.f0_center_hz`
- `details.full_metrics.vrp.bins.semi`
- `details.full_metrics.vrp.bins.spl_max`
- `details.full_metrics.vrp.bins.spl_mean`
- `details.full_metrics.vrp.bins.spl_min`
- `details.full_metrics.vrp.error`
- `details.full_metrics.vrp.f0_max`
- `details.full_metrics.vrp.f0_min`
- `details.full_metrics.vrp.spl_max`
- `details.full_metrics.vrp.spl_min`
- `details.fundamentalFrequency`
- `details.hnr`
- `details.jitter`
- `details.location`
- `details.notes`
- `details.pitch`
- `details.shimmer`
- `details.sound`
- `details.voicing`
- `eventId`
- `type`

### VoiceFemUsers (9个)

- `email`
- `profile`
- `profile.areSocialsPublic`
- `profile.isNamePublic`
- `profile.name`
- `profile.nickname`
- `profile.socials`
- `profile.socials.handle`
- `profile.socials.platform`

### VoiceFemTests (19个)

- `charts`
- `charts.formant`
- `charts.formant_spl_spectrum`
- `charts.timeSeries`
- `charts.vrp`
- `createdAt`
- `errorMessage`
- `metrics`
- `metrics.questionnaires`
- `metrics.questionnaires.RBH`
- `metrics.reading`
- `metrics.spontaneous`
- `metrics.sustained`
- `metrics.vrp`
- `reportPdf`
- `sessionId`
- `status`
- `updatedAt`
- `userId`

---

## 2. 只在数据存在，文档中未定义的字段

**共计 114 个字段**

### VoiceFemEvents (5个)

- `details.formants.f1`
- `details.formants.f2`
- `details.formants.f3`
- `details.pitch.max`
- `details.pitch.min`

### VoiceFemUsers (1个)

- `profile.bio`

### VoiceFemTests (108个)

- `metrics.formants_high`
- `metrics.formants_high.B1`
- `metrics.formants_high.B2`
- `metrics.formants_high.B3`
- `metrics.formants_high.F1`
- `metrics.formants_high.F1_available`
- `metrics.formants_high.F2`
- `metrics.formants_high.F2_available`
- `metrics.formants_high.F3`
- `metrics.formants_high.best_segment_time`
- `metrics.formants_high.f0_mean`
- `metrics.formants_high.is_high_pitch`
- `metrics.formants_high.reason`
- `metrics.formants_high.source_file`
- `metrics.formants_high.spl_dbA_est`
- `metrics.formants_low`
- `metrics.formants_low.B1`
- `metrics.formants_low.B2`
- `metrics.formants_low.B3`
- `metrics.formants_low.F1`
- `metrics.formants_low.F1_available`
- `metrics.formants_low.F2`
- `metrics.formants_low.F2_available`
- `metrics.formants_low.F3`
- `metrics.formants_low.best_segment_time`
- `metrics.formants_low.f0_mean`
- `metrics.formants_low.is_high_pitch`
- `metrics.formants_low.reason`
- `metrics.formants_low.source_file`
- `metrics.formants_low.spl_dbA_est`
- `metrics.questionnaires.OVHS-9 Total`
- `metrics.questionnaires.RBH.B`
- `metrics.questionnaires.RBH.H`
- `metrics.questionnaires.RBH.R`
- `metrics.questionnaires.TVQ-G Percent`
- `metrics.questionnaires.TVQ-G Total`
- `metrics.reading.duration_s`
- `metrics.reading.f0_mean`
- `metrics.reading.f0_sd`
- `metrics.reading.f0_stats`
- `metrics.reading.f0_stats.median`
- `metrics.reading.f0_stats.p10`
- `metrics.reading.f0_stats.p90`
- `metrics.reading.pause_count`
- `metrics.reading.voiced_ratio`
- `metrics.spontaneous.duration_s`
- `metrics.spontaneous.f0_mean`
- `metrics.spontaneous.f0_sd`
- `metrics.spontaneous.f0_stats`
- `metrics.spontaneous.f0_stats.median`
- `metrics.spontaneous.f0_stats.p10`
- `metrics.spontaneous.f0_stats.p90`
- `metrics.spontaneous.pause_count`
- `metrics.spontaneous.voiced_ratio`
- `metrics.sustained.f0_mean`
- `metrics.sustained.f0_sd`
- `metrics.sustained.formant_analysis_failed`
- `metrics.sustained.formant_analysis_reason_high`
- `metrics.sustained.formant_analysis_reason_low`
- `metrics.sustained.formant_analysis_reason_sustained`
- `metrics.sustained.formants_high`
- `metrics.sustained.formants_high.F1`
- `metrics.sustained.formants_high.F2`
- `metrics.sustained.formants_high.F3`
- `metrics.sustained.formants_high.error_details`
- `metrics.sustained.formants_high.f0_mean`
- `metrics.sustained.formants_high.reason`
- `metrics.sustained.formants_high.spl_dbA_est`
- `metrics.sustained.formants_low`
- `metrics.sustained.formants_low.F1`
- `metrics.sustained.formants_low.F2`
- `metrics.sustained.formants_low.F3`
- `metrics.sustained.formants_low.error_details`
- `metrics.sustained.formants_low.f0_mean`
- `metrics.sustained.formants_low.reason`
- `metrics.sustained.formants_low.spl_dbA_est`
- `metrics.sustained.formants_sustained`
- `metrics.sustained.formants_sustained.B1`
- `metrics.sustained.formants_sustained.B2`
- `metrics.sustained.formants_sustained.B3`
- `metrics.sustained.formants_sustained.F1`
- `metrics.sustained.formants_sustained.F1_available`
- `metrics.sustained.formants_sustained.F2`
- `metrics.sustained.formants_sustained.F2_available`
- `metrics.sustained.formants_sustained.F3`
- `metrics.sustained.formants_sustained.best_segment_time`
- `metrics.sustained.formants_sustained.error_details`
- `metrics.sustained.formants_sustained.f0_mean`
- `metrics.sustained.formants_sustained.is_high_pitch`
- `metrics.sustained.formants_sustained.reason`
- `metrics.sustained.formants_sustained.spl_dbA_est`
- `metrics.sustained.hnr_db`
- `metrics.sustained.jitter_local_percent`
- `metrics.sustained.mpt_s`
- `metrics.sustained.shimmer_local_percent`
- `metrics.sustained.spl_dbA_est`
- `metrics.vrp.bins`
- `metrics.vrp.bins.count`
- `metrics.vrp.bins.f0_center_hz`
- `metrics.vrp.bins.semi`
- `metrics.vrp.bins.spl_max`
- `metrics.vrp.bins.spl_mean`
- `metrics.vrp.bins.spl_min`
- `metrics.vrp.error`
- `metrics.vrp.f0_max`
- `metrics.vrp.f0_min`
- `metrics.vrp.spl_max`
- `metrics.vrp.spl_min`

---

## 3. 只在文档定义，数据中不存在的字段

**共计 36 个字段**

### VoiceFemEvents (31个)

- `attachments.createdAt`
- `attachments.status`
- `attachments.updatedAt`
- `details.content`
- `details.customDoctor`
- `details.customLocation`
- `details.equipmentUsed`
- `details.feelings`
- `details.full_metrics.sustained.formants_high.B1`
- `details.full_metrics.sustained.formants_high.B2`
- `details.full_metrics.sustained.formants_high.B3`
- `details.full_metrics.sustained.formants_high.F1_available`
- `details.full_metrics.sustained.formants_high.F2_available`
- `details.full_metrics.sustained.formants_high.best_segment_time`
- `details.full_metrics.sustained.formants_high.is_high_pitch`
- `details.full_metrics.sustained.formants_high.source_file`
- `details.full_metrics.sustained.formants_low.B1`
- `details.full_metrics.sustained.formants_low.B2`
- `details.full_metrics.sustained.formants_low.B3`
- `details.full_metrics.sustained.formants_low.F1_available`
- `details.full_metrics.sustained.formants_low.F2_available`
- `details.full_metrics.sustained.formants_low.best_segment_time`
- `details.full_metrics.sustained.formants_low.is_high_pitch`
- `details.full_metrics.sustained.formants_low.source_file`
- `details.hasInstructor`
- `details.instructor`
- `details.practiceContent`
- `details.references`
- `details.selfPracticeContent`
- `details.trainingContent`
- `details.voiceStatus`

### VoiceFemUsers (5个)

- `calibration`
- `forms`
- `profile.handle`
- `profile.platform`
- `tests`

