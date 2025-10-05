# DynamoDB字段完整验证表格

**生成时间**: 2025-10-05 02:54:28

本表格包含data_structures.md中定义的所有字段，以及在实际数据中发现的字段。

---

## VoiceFemEvents

**字段总数**: 148
**有数据的字段**: 133 (89%)
**有写入代码的字段**: 47 (31%)
**有读取代码的字段**: 10 (6%)

| 字段名（层级） | 数据存在 | 示例ID | 示例值 | 代码写入 | 写入位置 | 代码读取 | 读取位置 |
|---|:---:|---|---|:---:|---|:---:|---|
| `attachments` | ✅ (55/75) | `6e453f06-9212-49ef-9015-36fd5d` | [{"fileUrl": "voice-tests/656501ca-8a61- | ✅ | lambda-functions/addVoiceEvent/index.mjs:95 (sanitizeAttachments处理) | ✅ | lambda-functions/getVoiceEvents/index.mjs:返回给认证用户<br>src/components/Timeline.jsx:显示附件 |
| `attachments.fileName` | ❌ | `-` | - | ✅ | lambda-functions/addVoiceEvent/index.mjs:67 (sanitizeAttachments) | ❌ | - |
| `attachments.fileType` | ❌ | `-` | - | ✅ | lambda-functions/addVoiceEvent/index.mjs:67 (sanitizeAttachments) | ❌ | - |
| `attachments.fileUrl` | ❌ | `-` | - | ✅ | lambda-functions/addVoiceEvent/index.mjs:67 (sanitizeAttachments) | ❌ | - |
| `date` | ✅ (75/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2025-08-30T18:00:21.036949Z | ✅ | lambda-functions/addVoiceEvent/index.mjs:89 (requestBody.date) | ✅ | src/components/Timeline.jsx:排序和显示<br>src/components/PublicDashboard.jsx:时间轴 |
| `details` | ✅ (75/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"formants": {"f2": "2072.972442", "f3": | ✅ | lambda-functions/addVoiceEvent/index.mjs:90 (requestBody.details) | ✅ | src/components/Timeline.jsx:渲染事件详情<br>src/components/PublicDashboard.jsx:显示数据 |
| `details.appUsed` | ✅ (70/75) | `6e453f06-9212-49ef-9015-36fd5d` | VFS Tracker Online Analysis | ✅ | lambda-functions/online-praat-analysis/handler.py:638 (固定值)<br>src/components/QuickF0Test.jsx:155 | ✅ | src/components/Timeline.jsx:显示测试工具 |
| `details.content` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (feeling_log) | ❌ | - |
| `details.customDoctor` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (surgery) | ❌ | - |
| `details.customLocation` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (surgery) | ❌ | - |
| `details.customSoundDetail` | ✅ (14/75) | `event_mg5krxyc_x4i9lnkng` | 通过快速基频测试自动记录 | ✅ | src/components/QuickF0Test.jsx:158<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.customVoicingDetail` | ✅ (14/75) | `event_mg5krxyc_x4i9lnkng` | 通过快速基频测试自动记录 | ✅ | src/components/QuickF0Test.jsx:160<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.doctor` | ✅ (3/75) | `event_mga2yfmz_lkqlwwxt6` | 李革临 | ✅ | src/components/EventForm.jsx:378 (surgery) | ✅ | src/components/Timeline.jsx:显示医生 |
| `details.equipmentUsed` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (hospital_test) | ❌ | - |
| `details.feelings` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training/self_practice) | ❌ | - |
| `details.formants` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f2": "2072.972442", "f3": "3204.985286 | ✅ | lambda-functions/online-praat-analysis/handler.py:643<br>src/components/EventForm.jsx:386 | ❌ | - |
| `details.formants.f1` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 622.576208 | ✅ | lambda-functions/online-praat-analysis/handler.py:644<br>src/components/EventForm.jsx:387 | ❌ | - |
| `details.formants.f2` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2072.972442 | ✅ | lambda-functions/online-praat-analysis/handler.py:645<br>src/components/EventForm.jsx:388 | ❌ | - |
| `details.formants.f3` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 3204.985286 | ✅ | lambda-functions/online-praat-analysis/handler.py:646<br>src/components/EventForm.jsx:389 | ❌ | - |
| `details.full_metrics` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"questionnaires": {"RBH": {"H": "2", "R | ✅ | lambda-functions/online-praat-analysis/handler.py:651 (整个metrics对象) | ✅ | src/components/Timeline.jsx:详细指标展示 |
| `details.full_metrics.formants_high` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | {"reason": "LOW_PROMINENCE", "f0_mean":  | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `details.full_metrics.formants_high.B1` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 406.55 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.B2` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 306.05 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.B3` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 111.29 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.F1` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 310.95 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.F1_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.F2` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 889.62 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.F2_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.F3` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 2050.98 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.best_segment_time` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 2.154333 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.f0_mean` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 185.29 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.is_high_pitch` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.reason` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.source_file` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | voice-tests_596c7b65-c840-4044-8a51-6801 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_high.spl_dbA_est` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 54.56665 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | {"reason": "LOW_PROMINENCE", "f0_mean":  | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `details.full_metrics.formants_low.B1` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 119.25 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.B2` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 97.68 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.B3` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 53.43 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.F1` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 858.13 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.F1_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.F2` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 1322.3 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.F2_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.F3` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 2864.81 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.best_segment_time` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 2.384667 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.f0_mean` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 358.75 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.is_high_pitch` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | True | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.reason` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.source_file` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | voice-tests_596c7b65-c840-4044-8a51-6801 | ❌ | - | ❌ | - |
| `details.full_metrics.formants_low.spl_dbA_est` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 80.352821 | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"RBH": {"H": "2", "R": "2", "B": "1"},  | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis计算所有questionnaires字段 | ❌ | - |
| `details.full_metrics.questionnaires.OVHS-9 Total` | ✅ (49/75) | `6e453f06-9212-49ef-9015-36fd5d` | 17 | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.RBH` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"H": "2", "R": "2", "B": "1"} | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.RBH.B` | ✅ (50/75) | `6e453f06-9212-49ef-9015-36fd5d` | 1 | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.RBH.H` | ✅ (50/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2 | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.RBH.R` | ✅ (50/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2 | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.TVQ-G Percent` | ✅ (49/75) | `6e453f06-9212-49ef-9015-36fd5d` | 35% | ❌ | - | ❌ | - |
| `details.full_metrics.questionnaires.TVQ-G Total` | ✅ (49/75) | `6e453f06-9212-49ef-9015-36fd5d` | 17 | ❌ | - | ❌ | - |
| `details.full_metrics.reading` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f0_mean": "205.86", "f0_stats": {"medi | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis计算所有reading字段 | ❌ | - |
| `details.full_metrics.reading.duration_s` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 60.17 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_mean` | ✅ (46/75) | `6e453f06-9212-49ef-9015-36fd5d` | 205.86 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_sd` | ✅ (46/75) | `6e453f06-9212-49ef-9015-36fd5d` | 49.19 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_stats` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"median": "210.93", "p10": "111.23", "p | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_stats.median` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 210.93 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_stats.p10` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 111.23 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.f0_stats.p90` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 253.04 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.pause_count` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 97 | ❌ | - | ❌ | - |
| `details.full_metrics.reading.voiced_ratio` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 0.48 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f0_mean": "203.1", "f0_stats": {"media | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis计算所有spontaneous字段 | ❌ | - |
| `details.full_metrics.spontaneous.duration_s` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 38.94 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_mean` | ✅ (46/75) | `6e453f06-9212-49ef-9015-36fd5d` | 203.1 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_sd` | ✅ (46/75) | `6e453f06-9212-49ef-9015-36fd5d` | 63 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_stats` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"median": "209.24", "p10": "103.06", "p | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_stats.median` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 209.24 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_stats.p10` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 103.06 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.f0_stats.p90` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 265.53 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.pause_count` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 60 | ❌ | - | ❌ | - |
| `details.full_metrics.spontaneous.voiced_ratio` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 0.39 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"mpt_s": "3.82", "f0_sd": "12.78", "shi | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis计算所有sustained字段 | ❌ | - |
| `details.full_metrics.sustained.f0_mean` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 345.6 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.f0_sd` | ✅ (26/75) | `6e453f06-9212-49ef-9015-36fd5d` | 12.78 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formant_analysis_failed` | ✅ (9/75) | `d1111149-a125-4e2f-9556-26aae3` | True | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formant_analysis_reason_high` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formant_analysis_reason_low` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formant_analysis_reason_sustained` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f0_mean": "299.871058", "F1": "589.616 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.F1` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 589.616537 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.F2` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 1509.944704 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.F3` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2346.190007 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.error_details` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Analysis failed | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.f0_mean` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 299.871058 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.reason` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_high.spl_dbA_est` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 74.830437 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f0_mean": "99.5239", "F1": "622.576208 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.F1` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 622.576208 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.F2` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 2072.972442 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.F3` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 3204.985286 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.error_details` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Analysis failed | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.f0_mean` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 99.5239 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.reason` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_low.spl_dbA_est` | ✅ (33/75) | `6e453f06-9212-49ef-9015-36fd5d` | 72.960861 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | {"reason": "LOW_PROMINENCE", "f0_mean":  | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.B1` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 295.1 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.B2` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 156.17 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.B3` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 401.15 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.F1` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 638.22 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.F1_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.F2` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 1156.48 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.F2_available` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.F3` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 2600.09 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.best_segment_time` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 3.347667 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.error_details` | ✅ (8/75) | `d1111149-a125-4e2f-9556-26aae3` | Analysis failed | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.f0_mean` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 179.49 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.is_high_pitch` | ✅ (19/75) | `bc56487c-35fa-49f8-9e76-22cf17` | False | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.reason` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.formants_sustained.spl_dbA_est` | ✅ (27/75) | `bc56487c-35fa-49f8-9e76-22cf17` | 64.486183 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.hnr_db` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 19.1 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.jitter_local_percent` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 0.64 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.mpt_s` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 3.82 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.shimmer_local_percent` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 3.98 | ❌ | - | ❌ | - |
| `details.full_metrics.sustained.spl_dbA_est` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 74.84 | ❌ | - | ❌ | - |
| `details.full_metrics.vrp` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"f0_max": "438.638387", "spl_min": "68. | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis计算所有vrp字段 | ❌ | - |
| `details.full_metrics.vrp.bins` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | [{"spl_min": "81.305534", "count": "4",  | ❌ | - | ❌ | - |
| `details.full_metrics.vrp.error` | ✅ (1/75) | `f5c64bb1-0738-478c-8b81-a5a464` | no_frames | ❌ | - | ❌ | - |
| `details.full_metrics.vrp.f0_max` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 438.638387 | ❌ | - | ❌ | - |
| `details.full_metrics.vrp.f0_min` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 227.588206 | ❌ | - | ❌ | - |
| `details.full_metrics.vrp.spl_max` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 81.980774 | ❌ | - | ❌ | - |
| `details.full_metrics.vrp.spl_min` | ✅ (52/75) | `6e453f06-9212-49ef-9015-36fd5d` | 68.339275 | ❌ | - | ❌ | - |
| `details.fundamentalFrequency` | ✅ (72/75) | `6e453f06-9212-49ef-9015-36fd5d` | 203.1 | ✅ | lambda-functions/online-praat-analysis/handler.py:639<br>src/components/QuickF0Test.jsx:156 | ✅ | src/components/Timeline.jsx:显示F0<br>src/components/PublicDashboard.jsx:统计图表 |
| `details.hasInstructor` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (self_practice) | ❌ | - |
| `details.hnr` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 19.1 | ✅ | lambda-functions/online-praat-analysis/handler.py:642<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.instructor` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training/self_practice) | ❌ | - |
| `details.jitter` | ✅ (55/75) | `6e453f06-9212-49ef-9015-36fd5d` | 0.64 | ✅ | lambda-functions/online-praat-analysis/handler.py:640<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.location` | ✅ (5/75) | `event_mga2yfmz_lkqlwwxt6` | 友谊医院 | ✅ | src/components/EventForm.jsx:378 (hospital_test) | ✅ | src/components/Timeline.jsx:显示医院名称 |
| `details.notes` | ✅ (67/75) | `6e453f06-9212-49ef-9015-36fd5d` | VFS Tracker Voice Analysis Tools 自动生成报告 | ✅ | lambda-functions/online-praat-analysis/handler.py:650 (固定值)<br>src/components/QuickF0Test.jsx:162 | ❌ | - |
| `details.pitch` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | {"max": "438.638387", "min": "227.588206 | ✅ | lambda-functions/online-praat-analysis/handler.py:647<br>src/components/EventForm.jsx:391 | ❌ | - |
| `details.pitch.max` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 438.638387 | ✅ | lambda-functions/online-praat-analysis/handler.py:648<br>src/components/EventForm.jsx:392 | ❌ | - |
| `details.pitch.min` | ✅ (53/75) | `6e453f06-9212-49ef-9015-36fd5d` | 227.588206 | ✅ | lambda-functions/online-praat-analysis/handler.py:649<br>src/components/EventForm.jsx:393 | ❌ | - |
| `details.practiceContent` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (self_practice) | ❌ | - |
| `details.references` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training/self_practice) | ❌ | - |
| `details.selfPracticeContent` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training) | ❌ | - |
| `details.shimmer` | ✅ (55/75) | `6e453f06-9212-49ef-9015-36fd5d` | 3.98 | ✅ | lambda-functions/online-praat-analysis/handler.py:641<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.sound` | ✅ (19/75) | `event_mg5krxyc_x4i9lnkng` | ["其他"] | ✅ | src/components/QuickF0Test.jsx:157 (固定[其他])<br>src/components/EventForm.jsx:378 | ❌ | - |
| `details.trainingContent` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training) | ❌ | - |
| `details.voiceStatus` | ❌ | `-` | - | ✅ | src/components/EventForm.jsx:378 (voice_training/self_practice) | ❌ | - |
| `details.voicing` | ✅ (19/75) | `event_mg5krxyc_x4i9lnkng` | ["其他"] | ✅ | src/components/QuickF0Test.jsx:159 (固定[其他])<br>src/components/EventForm.jsx:378 | ❌ | - |
| `eventId` | ✅ (75/75) | `6e453f06-9212-49ef-9015-36fd5d` | 6e453f06-9212-49ef-9015-36fd5dfe19c6 | ✅ | lambda-functions/addVoiceEvent/index.mjs:74 (generateEventId()) | ✅ | lambda-functions/getVoiceEvents/index.mjs:42 (查询键)<br>lambda-functions/autoApproveEvent/index.mjs:39 |
| `type` | ✅ (75/75) | `6e453f06-9212-49ef-9015-36fd5d` | self_test | ✅ | lambda-functions/addVoiceEvent/index.mjs:88 (requestBody.type) | ✅ | src/components/EventForm.jsx:判断事件类型<br>src/components/Timeline.jsx:渲染不同组件 |

---

## VoiceFemUsers

**字段总数**: 10
**有数据的字段**: 8 (80%)
**有写入代码的字段**: 9 (90%)
**有读取代码的字段**: 4 (40%)

| 字段名（层级） | 数据存在 | 示例ID | 示例值 | 代码写入 | 写入位置 | 代码读取 | 读取位置 |
|---|:---:|---|---|:---:|---|:---:|---|
| `email` | ✅ (11/13) | `0488a4b8-5041-70cc-2c96-f8f422` | 2586618121@qq.com | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:88 | ❌ | - |
| `profile` | ✅ (13/13) | `0488a4b8-5041-70cc-2c96-f8f422` | {"nickname": "Main包", "name": "Main包", " | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:90<br>lambda-functions/updateUserProfile/index.mjs:71 | ✅ | lambda-functions/getUserProfile/index.mjs:53<br>src/components/MyPage.jsx:显示个人资料 |
| `profile.areSocialsPublic` | ✅ (13/13) | `0488a4b8-5041-70cc-2c96-f8f422` | True | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:96<br>lambda-functions/updateUserProfile/index.mjs:71 | ❌ | - |
| `profile.bio` | ✅ (11/13) | `0488a4b8-5041-70cc-2c96-f8f422` | - | ❌ | - | ❌ | - |
| `profile.isNamePublic` | ✅ (13/13) | `0488a4b8-5041-70cc-2c96-f8f422` | True | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:94<br>lambda-functions/updateUserProfile/index.mjs:71 | ❌ | - |
| `profile.name` | ✅ (13/13) | `0488a4b8-5041-70cc-2c96-f8f422` | Main包 | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:92<br>lambda-functions/updateUserProfile/index.mjs:71 | ✅ | lambda-functions/getAllPublicEvents/index.mjs:65 (公开名称)<br>src/components/PublicDashboard.jsx:显示用户名 |
| `profile.nickname` | ✅ (11/13) | `0488a4b8-5041-70cc-2c96-f8f422` | Main包 | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:93 (从Cognito同步，只读) | ✅ | lambda-functions/getUserProfile/index.mjs:76 (注入)<br>src/components/MyPage.jsx:显示昵称 |
| `profile.socials` | ✅ (13/13) | `0488a4b8-5041-70cc-2c96-f8f422` | [{"platform": "Twitter", "handle": "@Lem | ✅ | lambda-functions/vfsTrackerUserProfileSetup/index.mjs:95<br>lambda-functions/updateUserProfile/index.mjs:71 | ✅ | src/components/PublicDashboard.jsx:显示社交账号（如果公开） |
| `profile.socials.handle` | ❌ | `-` | - | ✅ | src/components/MyPage.jsx:社交账号表单 | ❌ | - |
| `profile.socials.platform` | ❌ | `-` | - | ✅ | src/components/MyPage.jsx:社交账号表单 | ❌ | - |

---

## VoiceFemTests

**字段总数**: 121
**有数据的字段**: 121 (100%)
**有写入代码的字段**: 18 (14%)
**有读取代码的字段**: 7 (5%)

| 字段名（层级） | 数据存在 | 示例ID | 示例值 | 代码写入 | 写入位置 | 代码读取 | 读取位置 |
|---|:---:|---|---|:---:|---|:---:|---|
| `charts` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"timeSeries": "s3://vfs-tracker-objstor | ✅ | lambda-functions/online-praat-analysis/handler.py:189 (artifact_urls) | ✅ | src/components/VoiceTestWizard.jsx:显示图表 |
| `charts.formant` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | s3://vfs-tracker-objstor/voice-tests/1a3 | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis生成图表 | ❌ | - |
| `charts.formant_spl_spectrum` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | s3://vfs-tracker-objstor/voice-tests/1a3 | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis生成图表 | ❌ | - |
| `charts.timeSeries` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | s3://vfs-tracker-objstor/voice-tests/1a3 | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis生成图表 | ❌ | - |
| `charts.vrp` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | s3://vfs-tracker-objstor/voice-tests/1a3 | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis生成图表 | ❌ | - |
| `createdAt` | ✅ (449/449) | `44324238-e072-47bb-9141-3027ff` | 1759471754 | ✅ | lambda-functions/addVoiceEvent/index.mjs:92 (timestamp) | ✅ | lambda-functions/getVoiceEvents/index.mjs:排序<br>src/components/Timeline.jsx:显示创建时间 |
| `errorMessage` | ✅ (10/449) | `5c5103fc-febb-449c-b0e7-6a3cfd` | Float types are not supported. Use Decim | ✅ | lambda-functions/online-praat-analysis/handler.py:处理异常时 | ❌ | - |
| `metrics` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"questionnaires": {"RBH": {}}, "reading | ✅ | lambda-functions/online-praat-analysis/handler.py:189 (分析完成后写入所有metrics) | ✅ | src/components/VoiceTestWizard.jsx:显示分析结果 |
| `metrics.formants_high` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | {"reason": "LOW_PROMINENCE", "f0_mean":  | ❌ | - | ❌ | - |
| `metrics.formants_high.B1` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 253.19 | ❌ | - | ❌ | - |
| `metrics.formants_high.B2` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 92.25 | ❌ | - | ❌ | - |
| `metrics.formants_high.B3` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1749.29 | ❌ | - | ❌ | - |
| `metrics.formants_high.F1` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 627.34 | ❌ | - | ❌ | - |
| `metrics.formants_high.F1_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_high.F2` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1137.57 | ❌ | - | ❌ | - |
| `metrics.formants_high.F2_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_high.F3` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 2957.26 | ❌ | - | ❌ | - |
| `metrics.formants_high.best_segment_time` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 2.765333 | ❌ | - | ❌ | - |
| `metrics.formants_high.f0_mean` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 120.73 | ❌ | - | ❌ | - |
| `metrics.formants_high.is_high_pitch` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_high.reason` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `metrics.formants_high.source_file` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | voice-tests_bf3ccbba-cf8f-4012-b52d-8f06 | ❌ | - | ❌ | - |
| `metrics.formants_high.spl_dbA_est` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 67.068298 | ❌ | - | ❌ | - |
| `metrics.formants_low` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | {"reason": "LOW_PROMINENCE", "f0_mean":  | ❌ | - | ❌ | - |
| `metrics.formants_low.B1` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 404.81 | ❌ | - | ❌ | - |
| `metrics.formants_low.B2` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 115.55 | ❌ | - | ❌ | - |
| `metrics.formants_low.B3` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 408.74 | ❌ | - | ❌ | - |
| `metrics.formants_low.F1` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 507.78 | ❌ | - | ❌ | - |
| `metrics.formants_low.F1_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_low.F2` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1117.87 | ❌ | - | ❌ | - |
| `metrics.formants_low.F2_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_low.F3` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1560.96 | ❌ | - | ❌ | - |
| `metrics.formants_low.best_segment_time` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1.857333 | ❌ | - | ❌ | - |
| `metrics.formants_low.f0_mean` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 235.08 | ❌ | - | ❌ | - |
| `metrics.formants_low.is_high_pitch` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.formants_low.reason` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | LOW_PROMINENCE | ❌ | - | ❌ | - |
| `metrics.formants_low.source_file` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | voice-tests_bf3ccbba-cf8f-4012-b52d-8f06 | ❌ | - | ❌ | - |
| `metrics.formants_low.spl_dbA_est` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 70.16272 | ❌ | - | ❌ | - |
| `metrics.questionnaires` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"RBH": {}} | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `metrics.questionnaires.OVHS-9 Total` | ✅ (49/449) | `ff515cd5-49d5-4a94-a416-f046da` | 13 | ❌ | - | ❌ | - |
| `metrics.questionnaires.RBH` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {} | ❌ | - | ❌ | - |
| `metrics.questionnaires.RBH.B` | ✅ (50/449) | `ff515cd5-49d5-4a94-a416-f046da` | 1 | ❌ | - | ❌ | - |
| `metrics.questionnaires.RBH.H` | ✅ (50/449) | `ff515cd5-49d5-4a94-a416-f046da` | 2 | ❌ | - | ❌ | - |
| `metrics.questionnaires.RBH.R` | ✅ (50/449) | `ff515cd5-49d5-4a94-a416-f046da` | 1 | ❌ | - | ❌ | - |
| `metrics.questionnaires.TVQ-G Percent` | ✅ (49/449) | `ff515cd5-49d5-4a94-a416-f046da` | 33% | ❌ | - | ❌ | - |
| `metrics.questionnaires.TVQ-G Total` | ✅ (49/449) | `ff515cd5-49d5-4a94-a416-f046da` | 16 | ❌ | - | ❌ | - |
| `metrics.reading` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"f0_mean": "121.5", "f0_stats": {"media | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `metrics.reading.duration_s` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 6.48 | ❌ | - | ❌ | - |
| `metrics.reading.f0_mean` | ✅ (45/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 121.5 | ❌ | - | ❌ | - |
| `metrics.reading.f0_sd` | ✅ (45/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 17.5 | ❌ | - | ❌ | - |
| `metrics.reading.f0_stats` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"median": "125.88", "p10": "95.24", "p9 | ❌ | - | ❌ | - |
| `metrics.reading.f0_stats.median` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 125.88 | ❌ | - | ❌ | - |
| `metrics.reading.f0_stats.p10` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 95.24 | ❌ | - | ❌ | - |
| `metrics.reading.f0_stats.p90` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 138.32 | ❌ | - | ❌ | - |
| `metrics.reading.pause_count` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.reading.voiced_ratio` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0.12 | ❌ | - | ❌ | - |
| `metrics.spontaneous` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"f0_mean": "108.25", "f0_stats": {"medi | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `metrics.spontaneous.duration_s` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0.9 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_mean` | ✅ (45/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 108.25 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_sd` | ✅ (45/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 20.28 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_stats` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"median": "104.32", "p10": "84.61", "p9 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_stats.median` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 104.32 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_stats.p10` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 84.61 | ❌ | - | ❌ | - |
| `metrics.spontaneous.f0_stats.p90` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 135.86 | ❌ | - | ❌ | - |
| `metrics.spontaneous.pause_count` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.spontaneous.voiced_ratio` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0.22 | ❌ | - | ❌ | - |
| `metrics.sustained` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"mpt_s": "1.32", "f0_sd": "22.08", "shi | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `metrics.sustained.f0_mean` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 118.5 | ❌ | - | ❌ | - |
| `metrics.sustained.f0_sd` | ✅ (28/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 22.08 | ❌ | - | ❌ | - |
| `metrics.sustained.formant_analysis_failed` | ✅ (9/449) | `ff515cd5-49d5-4a94-a416-f046da` | True | ❌ | - | ❌ | - |
| `metrics.sustained.formant_analysis_reason_high` | ✅ (8/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formant_analysis_reason_low` | ✅ (8/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formant_analysis_reason_sustained` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"f0_mean": "0", "F1": "0", "F2": "0", " | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.F1` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.F2` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.F3` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.error_details` | ✅ (9/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | No stable segment of 100ms found | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.f0_mean` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.reason` | ✅ (8/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formants_high.spl_dbA_est` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"f0_mean": "0", "F1": "0", "F2": "0", " | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.F1` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.F2` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.F3` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.error_details` | ✅ (9/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | No stable segment of 100ms found | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.f0_mean` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.reason` | ✅ (8/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formants_low.spl_dbA_est` | ✅ (35/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | {"reason": "Failed to find formants even | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.B1` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 246.94 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.B2` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 171.7 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.B3` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 188.97 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.F1` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.F1_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.F2` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.F2_available` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.F3` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.best_segment_time` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | 1.242333 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.error_details` | ✅ (8/449) | `a0db45df-4908-4aaa-b9cb-036372` | Analysis failed | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.f0_mean` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.is_high_pitch` | ✅ (18/449) | `bf3ccbba-cf8f-4012-b52d-8f06ee` | False | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.reason` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | Failed to find formants even with multip | ❌ | - | ❌ | - |
| `metrics.sustained.formants_sustained.spl_dbA_est` | ✅ (26/449) | `a0db45df-4908-4aaa-b9cb-036372` | 0 | ❌ | - | ❌ | - |
| `metrics.sustained.hnr_db` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 2.43 | ❌ | - | ❌ | - |
| `metrics.sustained.jitter_local_percent` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 11.27 | ❌ | - | ❌ | - |
| `metrics.sustained.mpt_s` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 1.32 | ❌ | - | ❌ | - |
| `metrics.sustained.shimmer_local_percent` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 21.7 | ❌ | - | ❌ | - |
| `metrics.sustained.spl_dbA_est` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 74.4 | ❌ | - | ❌ | - |
| `metrics.vrp` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | {"f0_max": "141.7902", "spl_min": "65.09 | ✅ | lambda-functions/online-praat-analysis/handler.py:perform_full_analysis | ❌ | - |
| `metrics.vrp.bins` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | [{"spl_min": "66.354393", "count": "2",  | ❌ | - | ❌ | - |
| `metrics.vrp.error` | ✅ (1/449) | `fdc92885-76a0-4d41-9fa1-64f216` | no_frames | ❌ | - | ❌ | - |
| `metrics.vrp.f0_max` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 141.7902 | ❌ | - | ❌ | - |
| `metrics.vrp.f0_min` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 86.060372 | ❌ | - | ❌ | - |
| `metrics.vrp.spl_max` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 81.974333 | ❌ | - | ❌ | - |
| `metrics.vrp.spl_min` | ✅ (53/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 65.09923 | ❌ | - | ❌ | - |
| `reportPdf` | ✅ (54/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | s3://vfs-tracker-objstor/voice-tests/1a3 | ✅ | lambda-functions/online-praat-analysis/handler.py:191 (report_pdf_url) | ✅ | src/components/VoiceTestWizard.jsx:下载PDF |
| `sessionId` | ✅ (449/449) | `44324238-e072-47bb-9141-3027ff` | 44324238-e072-47bb-9141-3027ff06f595 | ✅ | lambda-functions/online-praat-analysis/handler.py:398 (创建会话) | ✅ | src/components/VoiceTestWizard.jsx:轮询状态<br>lambda-functions/online-praat-analysis/handler.py:查询会话 |
| `status` | ✅ (449/449) | `44324238-e072-47bb-9141-3027ff` | created | ✅ | lambda-functions/addVoiceEvent/index.mjs:91 (默认pending) | ✅ | src/components/VoiceTestWizard.jsx:判断分析状态 |
| `updatedAt` | ✅ (59/449) | `1a3ffd8c-c2fd-44b1-aa72-e844f8` | 1757940115 | ✅ | lambda-functions/addVoiceEvent/index.mjs:93 (timestamp)<br>lambda-functions/autoApproveEvent/index.mjs:41 (更新状态时) | ❌ | - |
| `userId` | ✅ (449/449) | `44324238-e072-47bb-9141-3027ff` | 34f8b418-1011-70a7-633b-720845138963 | ✅ | lambda-functions/addVoiceEvent/index.mjs:85 (从ID Token提取) | ✅ | lambda-functions/getVoiceEvents/index.mjs:42 (查询键)<br>lambda-functions/getAllPublicEvents/index.mjs:扫描过滤 |

---

## 总体统计

- **三个表的总字段数**: 279
- **有数据的字段**: 262 (93%)
- **有写入代码的字段**: 74 (26%)
- **有读取代码的字段**: 21 (7%)

## 说明

1. **数据存在**: ✅表示在数据库导出中至少有一条记录包含此字段
2. **示例ID**: 包含此字段的一个记录的ID（可在DynamoDB中查询验证）
3. **示例值**: 该字段在示例记录中的值（截断至40字符）
4. **代码写入/读取**: 基于代码审查确定的读写位置
5. 本表格基于实际数据扫描生成，准确反映了数据库的真实状态
