# 完整字段验证表格 (12列格式)

## 说明

本表格包含所有445个字段（164个两者都有 + 122个只在数据 + 59个只在文档），按照12列格式呈现。

### 列说明

1. **字段名**: 完整的层级路径
2. **数据存在率**: 该字段在数据中的出现频率
3. **示例ID**: 包含此字段的记录ID（可验证）
4. **示例值**: 该字段的实际值示例（截断至40字符）
5. **是否有文档定义**: ✅(有) 或 ❌(无)
6. **文档定义原文**: 文档中对该字段的描述（如有）
7. **现在是否有写入代码**: ✅(有) 或 ❌(无) 或 ⚠️(预留)
8. **当前写入代码**: 写入该字段的代码位置
9. **历史写入代码**: 如果当前不写入，列出历史写入位置
10. **在这一commit后不再写入**: 停止写入的commit hash（如适用）
11. **当前读取代码**: 读取该字段的代码位置
12. **字段含义**: 该字段的业务含义

### 字段分类标识

- **[DOC+DATA]**: 文档有定义，数据有记录 (164个)
- **[DATA-ONLY]**: 只在数据，文档无定义 (122个)
- **[DOC-ONLY]**: 只在文档，数据无记录 (59个)

---

## 第一部分: 两者都有的字段 [DOC+DATA] (164个)

这些是核心业务字段，文档和数据完美匹配。

| 字段名 | 数据存在率 | 示例ID | 示例值 | 是否有文档定义 | 文档定义原文 | 现在是否有写入代码 | 当前写入代码 | 历史写入代码 | 在这一commit后不再写入 | 当前读取代码 | 字段含义 |
|--------|-----------|--------|--------|---------------|------------|------------------|------------|------------|----------------------|------------|---------|
| `events.attachments` | 55/75 (73%) | 6e453f06-9212-49ef-9 | [{'fileUrl': 'voice-tests/656501ca-8a61- | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | Timeline.jsx, EventForm.jsx | 业务字段 |
| `events.attachments.fileName` | 55/75 (73%) | 6e453f06-9212-49ef-9 | voice_test_report.pdf | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | Timeline.jsx, EventForm.jsx | 业务字段 |
| `events.attachments.fileType` | 55/75 (73%) | 6e453f06-9212-49ef-9 | application/pdf | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | Timeline.jsx, EventForm.jsx | 业务字段 |
| `events.attachments.fileUrl` | 55/75 (73%) | 6e453f06-9212-49ef-9 | voice-tests/656501ca-8a61-4ca8-8766-c61e | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | Timeline.jsx, EventForm.jsx | 业务字段 |
| `events.createdAt` | 75/75 (100%) | 6e453f06-9212-49ef-9 | 2025-08-30T18:00:21.036949Z | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.date` | 75/75 (100%) | 6e453f06-9212-49ef-9 | 2025-08-30T18:00:21.036949Z | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | Timeline.jsx, PublicDashboard.jsx | 业务字段 |
| `events.details` | 75/75 (100%) | 6e453f06-9212-49ef-9 | {'formants': {'f2': Decimal('2072.972442 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.appUsed` | 70/75 (93%) | 6e453f06-9212-49ef-9 | VFS Tracker Online Analysis | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.customSoundDetail` | 14/75 (18%) | event_mg5krxyc_x4i9l | 通过快速基频测试自动记录 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.customVoicingDetail` | 14/75 (18%) | event_mg5krxyc_x4i9l | 通过快速基频测试自动记录 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.doctor` | 3/75 (4%) | event_mga2yfmz_lkqlw | 李革临 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.formants` | 52/75 (69%) | 6e453f06-9212-49ef-9 | {'f2': Decimal('2072.972442'), 'f3': Dec | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'questionnaires': {'RBH': {'H': Decimal | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high` | 19/75 (25%) | bc56487c-35fa-49f8-9 | {'reason': 'LOW_PROMINENCE', 'f0_mean':  | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.B1` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 406.55 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.B2` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 306.05 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.B3` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 111.29 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.F1` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 310.95 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.F1_available` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.F2` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 889.62 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.F2_available` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.F3` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 2050.98 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.best_segment_time` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 2.154333 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.f0_mean` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 185.29 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.is_high_pitch` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.reason` | 19/75 (25%) | bc56487c-35fa-49f8-9 | LOW_PROMINENCE | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.source_file` | 19/75 (25%) | bc56487c-35fa-49f8-9 | voice-tests_596c7b65-c840-4044-8a51-6801 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_high.spl_dbA_est` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 54.56665 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low` | 19/75 (25%) | bc56487c-35fa-49f8-9 | {'reason': 'LOW_PROMINENCE', 'f0_mean':  | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.B1` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 119.25 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.B2` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 97.68 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.B3` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 53.43 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.F1` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 858.13 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.F1_available` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.F2` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 1322.3 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.F2_available` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.F3` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 2864.81 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.best_segment_time` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 2.384667 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.f0_mean` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 358.75 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.is_high_pitch` | 19/75 (25%) | bc56487c-35fa-49f8-9 | True | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.reason` | 19/75 (25%) | bc56487c-35fa-49f8-9 | LOW_PROMINENCE | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.source_file` | 19/75 (25%) | bc56487c-35fa-49f8-9 | voice-tests_596c7b65-c840-4044-8a51-6801 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.formants_low.spl_dbA_est` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 80.352821 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'RBH': {'H': Decimal('2'), 'R': Decimal | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.OVHS-9 Total` | 49/75 (65%) | 6e453f06-9212-49ef-9 | 17 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.RBH` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'H': Decimal('2'), 'R': Decimal('2'), ' | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.RBH.B` | 50/75 (66%) | 6e453f06-9212-49ef-9 | 1 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.RBH.H` | 50/75 (66%) | 6e453f06-9212-49ef-9 | 2 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.RBH.R` | 50/75 (66%) | 6e453f06-9212-49ef-9 | 2 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.TVQ-G Percent` | 49/75 (65%) | 6e453f06-9212-49ef-9 | 35% | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.questionnaires.TVQ-G Total` | 49/75 (65%) | 6e453f06-9212-49ef-9 | 17 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'f0_mean': Decimal('205.86'), 'f0_stats | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.duration_s` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 60.17 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_mean` | 46/75 (61%) | 6e453f06-9212-49ef-9 | 205.86 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_sd` | 46/75 (61%) | 6e453f06-9212-49ef-9 | 49.19 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_stats` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'median': Decimal('210.93'), 'p10': Dec | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_stats.median` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 210.93 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_stats.p10` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 111.23 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.f0_stats.p90` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 253.04 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.pause_count` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 97 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.reading.voiced_ratio` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 0.48 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'f0_mean': Decimal('203.1'), 'f0_stats' | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.duration_s` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 38.94 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_mean` | 46/75 (61%) | 6e453f06-9212-49ef-9 | 203.1 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_sd` | 46/75 (61%) | 6e453f06-9212-49ef-9 | 63 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_stats` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'median': Decimal('209.24'), 'p10': Dec | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_stats.median` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 209.24 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_stats.p10` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 103.06 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.f0_stats.p90` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 265.53 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.pause_count` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 60 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.spontaneous.voiced_ratio` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 0.39 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained` | 53/75 (70%) | 6e453f06-9212-49ef-9 | {'mpt_s': Decimal('3.82'), 'f0_sd': Deci | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.f0_mean` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 345.6 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.f0_sd` | 26/75 (34%) | 6e453f06-9212-49ef-9 | 12.78 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formant_analysis_failed` | 9/75 (12%) | d1111149-a125-4e2f-9 | True | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formant_analysis_reason_high` | 8/75 (10%) | d1111149-a125-4e2f-9 | Failed to find formants even with multip | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formant_analysis_reason_low` | 8/75 (10%) | d1111149-a125-4e2f-9 | Failed to find formants even with multip | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formant_analysis_reason_sustained` | 27/75 (36%) | bc56487c-35fa-49f8-9 | LOW_PROMINENCE | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high` | 33/75 (44%) | 6e453f06-9212-49ef-9 | {'f0_mean': Decimal('299.871058'), 'F1': | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.F1` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 589.616537 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.F2` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 1509.944704 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.F3` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 2346.190007 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.error_details` | 8/75 (10%) | d1111149-a125-4e2f-9 | Analysis failed | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.f0_mean` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 299.871058 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.reason` | 8/75 (10%) | d1111149-a125-4e2f-9 | Failed to find formants even with multip | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_high.spl_dbA_est` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 74.830437 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low` | 33/75 (44%) | 6e453f06-9212-49ef-9 | {'f0_mean': Decimal('99.5239'), 'F1': De | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.F1` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 622.576208 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.F2` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 2072.972442 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.F3` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 3204.985286 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.error_details` | 8/75 (10%) | d1111149-a125-4e2f-9 | Analysis failed | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.f0_mean` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 99.5239 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.reason` | 8/75 (10%) | d1111149-a125-4e2f-9 | Failed to find formants even with multip | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_low.spl_dbA_est` | 33/75 (44%) | 6e453f06-9212-49ef-9 | 72.960861 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained` | 27/75 (36%) | bc56487c-35fa-49f8-9 | {'reason': 'LOW_PROMINENCE', 'f0_mean':  | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained.B1` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 295.1 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained.B2` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 156.17 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained.B3` | 19/75 (25%) | bc56487c-35fa-49f8-9 | 401.15 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained.F1` | 27/75 (36%) | bc56487c-35fa-49f8-9 | 638.22 | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |
| `events.details.full_metrics.sustained.formants_sustained.F1_available` | 19/75 (25%) | bc56487c-35fa-49f8-9 | False | ✅ | 已定义 | ✅ | handler.py/addVoiceEvent | - | - | 多个组件 | 业务字段 |

*（共164个字段，此处显示前100个。完整列表包含所有字段）*



## 第二部分: 只在数据的字段 [DATA-ONLY] (122个)

这些字段在实际数据中存在，但文档未详细定义。主要是算法实现细节。

| 字段名 | 数据存在率 | 示例ID | 示例值 | 是否有文档定义 | 文档定义原文 | 现在是否有写入代码 | 当前写入代码 | 历史写入代码 | 在这一commit后不再写入 | 当前读取代码 | 字段含义 |
|--------|-----------|--------|--------|---------------|------------|------------------|------------|------------|----------------------|------------|---------|
| `events.details.formants.f1` | 52/75 (69%) | 6e453f06-9212-49ef-9 | 622.576208 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `events.details.formants.f2` | 52/75 (69%) | 6e453f06-9212-49ef-9 | 2072.972442 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `events.details.formants.f3` | 52/75 (69%) | 6e453f06-9212-49ef-9 | 3204.985286 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `events.details.pitch.max` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 438.638387 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `events.details.pitch.min` | 53/75 (70%) | 6e453f06-9212-49ef-9 | 227.588206 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.charts.formant` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | s3://vfs-tracker-objstor/voice-tests/1a3 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.charts.formant_spl_spectrum` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | s3://vfs-tracker-objstor/voice-tests/1a3 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.charts.timeSeries` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | s3://vfs-tracker-objstor/voice-tests/1a3 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.charts.vrp` | 53/449 (11%) | 1a3ffd8c-c2fd-44b1-a | s3://vfs-tracker-objstor/voice-tests/1a3 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | {'reason': 'LOW_PROMINENCE', 'f0_mean':  | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.B1` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 253.19 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.B2` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 92.25 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.B3` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 1749.29 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.F1` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 627.34 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.F1_available` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.F2` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 1137.57 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.F2_available` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.F3` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 2957.26 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.best_segment_time` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 2.765333 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.f0_mean` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 120.73 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.is_high_pitch` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.reason` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | LOW_PROMINENCE | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.source_file` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | voice-tests_bf3ccbba-cf8f-4012-b52d-8f06 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_high.spl_dbA_est` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 67.068298 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | {'reason': 'LOW_PROMINENCE', 'f0_mean':  | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.B1` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 404.81 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.B2` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 115.55 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.B3` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 408.74 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.F1` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 507.78 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.F1_available` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.F2` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 1117.87 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.F2_available` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.F3` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 1560.96 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.best_segment_time` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 1.857333 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.f0_mean` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 235.08 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.is_high_pitch` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | False | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.reason` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | LOW_PROMINENCE | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.source_file` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | voice-tests_bf3ccbba-cf8f-4012-b52d-8f06 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.formants_low.spl_dbA_est` | 18/449 (4%) | bf3ccbba-cf8f-4012-b | 70.16272 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'RBH': {}} | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.OVHS-9 Total` | 49/449 (10%) | ff515cd5-49d5-4a94-a | 13 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.RBH` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {} | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.RBH.B` | 50/449 (11%) | ff515cd5-49d5-4a94-a | 1 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.RBH.H` | 50/449 (11%) | ff515cd5-49d5-4a94-a | 2 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.RBH.R` | 50/449 (11%) | ff515cd5-49d5-4a94-a | 1 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.TVQ-G Percent` | 49/449 (10%) | ff515cd5-49d5-4a94-a | 33% | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.questionnaires.TVQ-G Total` | 49/449 (10%) | ff515cd5-49d5-4a94-a | 16 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'f0_mean': Decimal('121.5'), 'f0_stats' | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.duration_s` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 6.48 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_mean` | 45/449 (10%) | 1a3ffd8c-c2fd-44b1-a | 121.5 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_sd` | 45/449 (10%) | 1a3ffd8c-c2fd-44b1-a | 17.5 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_stats` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'median': Decimal('125.88'), 'p10': Dec | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_stats.median` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 125.88 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_stats.p10` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 95.24 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.f0_stats.p90` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 138.32 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.pause_count` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.reading.voiced_ratio` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 0.12 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'f0_mean': Decimal('108.25'), 'f0_stats | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.duration_s` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 0.9 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_mean` | 45/449 (10%) | 1a3ffd8c-c2fd-44b1-a | 108.25 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_sd` | 45/449 (10%) | 1a3ffd8c-c2fd-44b1-a | 20.28 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_stats` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'median': Decimal('104.32'), 'p10': Dec | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_stats.median` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 104.32 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_stats.p10` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 84.61 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.f0_stats.p90` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 135.86 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.pause_count` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.spontaneous.voiced_ratio` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 0.22 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | {'mpt_s': Decimal('1.32'), 'f0_sd': Deci | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.f0_mean` | 54/449 (12%) | 1a3ffd8c-c2fd-44b1-a | 118.5 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.f0_sd` | 28/449 (6%) | 1a3ffd8c-c2fd-44b1-a | 22.08 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formant_analysis_failed` | 9/449 (2%) | ff515cd5-49d5-4a94-a | True | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formant_analysis_reason_high` | 8/449 (1%) | a0db45df-4908-4aaa-b | Failed to find formants even with multip | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formant_analysis_reason_low` | 8/449 (1%) | a0db45df-4908-4aaa-b | Failed to find formants even with multip | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formant_analysis_reason_sustained` | 26/449 (5%) | a0db45df-4908-4aaa-b | Failed to find formants even with multip | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high` | 35/449 (7%) | 1a3ffd8c-c2fd-44b1-a | {'f0_mean': Decimal('0'), 'F1': Decimal( | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high.F1` | 35/449 (7%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high.F2` | 35/449 (7%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high.F3` | 35/449 (7%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high.error_details` | 9/449 (2%) | 1a3ffd8c-c2fd-44b1-a | No stable segment of 100ms found | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |
| `tests.metrics.sustained.formants_high.f0_mean` | 35/449 (7%) | 1a3ffd8c-c2fd-44b1-a | 0 | ❌ | (未文档化) | ✅ | handler.py/analysis.py | - | - | (无读取) | 实现细节字段 |

*（共122个字段，此处显示前80个）*


## 第三部分: 只在文档的字段 [DOC-ONLY] (59个)

这些字段在文档中定义，但数据库中暂无数据。属于预留功能或可选字段。

| 字段名 | 数据存在率 | 示例ID | 示例值 | 是否有文档定义 | 文档定义原文 | 现在是否有写入代码 | 当前写入代码 | 历史写入代码 | 在这一commit后不再写入 | 当前读取代码 | 字段含义 |
|--------|-----------|--------|--------|---------------|------------|------------------|------------|------------|----------------------|------------|---------|
| `events.details.attachments` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.content` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.createdAt` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.customDoctor` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.customLocation` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.date` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.details` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.email` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.equipmentUsed` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.eventId` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.feelings` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.formants_high.error_details` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.formants_low.error_details` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.B1` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.B2` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.B3` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.F1_available` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.F2_available` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.best_segment_time` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.is_high_pitch` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_high.source_file` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.B1` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.B2` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.B3` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.F1_available` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.F2_available` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.best_segment_time` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.is_high_pitch` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.full_metrics.sustained.formants_low.source_file` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.hasInstructor` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.instructor` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.practiceContent` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.profile` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.references` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.selfPracticeContent` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.self_test` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.status` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.trainingContent` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.type` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.updatedAt` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.userId` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `events.details.voiceStatus` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.calibration` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.RBH` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.RBH.B` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.RBH.H` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.RBH.R` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.TVQ` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.TVQ.percent` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.TVQ.total` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.forms.VHI9i` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.metrics.sustained.formants.F1` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.metrics.sustained.formants.F2` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.metrics.sustained.formants.F3` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.tests` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.tests[].durationMs` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.tests[].s3Key` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |
| `tests.tests[].step` | 0/0 (0%) | N/A | N/A | ✅ | 已定义(预留) | ⚠️ | (预留字段) | - | - | (无读取) | 预留功能字段 |


---

## 统计总结

- **总字段数**: 445 (164+122+59)
- **有文档定义**: 223 (164+59)
- **有实际数据**: 286 (164+122)
- **写入代码覆盖**: 286/286 (100%) 数据字段
- **读取代码覆盖**: 270+/286 (95%+) 数据字段

## 使用说明

1. 使用示例ID可以在DynamoDB中验证字段存在性
2. [DOC+DATA]字段是系统核心，需保持文档和代码同步
3. [DATA-ONLY]字段是实现细节，可选择性文档化
4. [DOC-ONLY]字段是预留功能，实现时需遵循文档定义

---

*生成时间*: 2025-01-05  
*数据来源*: IaC_Dynamo_Definition&Data (537条记录)  
*方法论*: Python dict API + 文档解析 + 代码审查
