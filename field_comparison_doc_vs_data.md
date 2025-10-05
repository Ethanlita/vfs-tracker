# 文档定义字段 vs 实际数据字段对比分析

## 执行摘要

本文档提供data_structures.md中定义的字段与实际DynamoDB数据中存在字段的完整对比分析。

### 关键统计

- **文档定义**: 223 字段
- **数据存在**: 286 字段
- **两者都有**: 164 字段
  - 73% 的文档字段有实际数据
  - 57% 的数据字段有文档定义
- **只在文档**: 59 字段 (26%)
- **只在数据**: 122 字段 (42%)

## 三类字段详细列表

### 类型1: 两者都有 (164个字段)

这些是核心业务字段，既有文档定义又在实际数据中使用：

1. `events.attachments`
2. `events.attachments.fileName`
3. `events.attachments.fileType`
4. `events.attachments.fileUrl`
5. `events.createdAt`
6. `events.date`
7. `events.details`
8. `events.details.appUsed`
9. `events.details.customSoundDetail`
10. `events.details.customVoicingDetail`
11. `events.details.doctor`
12. `events.details.formants`
13. `events.details.full_metrics`
14. `events.details.full_metrics.formants_high`
15. `events.details.full_metrics.formants_high.B1`
16. `events.details.full_metrics.formants_high.B2`
17. `events.details.full_metrics.formants_high.B3`
18. `events.details.full_metrics.formants_high.F1`
19. `events.details.full_metrics.formants_high.F1_available`
20. `events.details.full_metrics.formants_high.F2`
21. `events.details.full_metrics.formants_high.F2_available`
22. `events.details.full_metrics.formants_high.F3`
23. `events.details.full_metrics.formants_high.best_segment_time`
24. `events.details.full_metrics.formants_high.f0_mean`
25. `events.details.full_metrics.formants_high.is_high_pitch`
26. `events.details.full_metrics.formants_high.reason`
27. `events.details.full_metrics.formants_high.source_file`
28. `events.details.full_metrics.formants_high.spl_dbA_est`
29. `events.details.full_metrics.formants_low`
30. `events.details.full_metrics.formants_low.B1`
31. `events.details.full_metrics.formants_low.B2`
32. `events.details.full_metrics.formants_low.B3`
33. `events.details.full_metrics.formants_low.F1`
34. `events.details.full_metrics.formants_low.F1_available`
35. `events.details.full_metrics.formants_low.F2`
36. `events.details.full_metrics.formants_low.F2_available`
37. `events.details.full_metrics.formants_low.F3`
38. `events.details.full_metrics.formants_low.best_segment_time`
39. `events.details.full_metrics.formants_low.f0_mean`
40. `events.details.full_metrics.formants_low.is_high_pitch`
41. `events.details.full_metrics.formants_low.reason`
42. `events.details.full_metrics.formants_low.source_file`
43. `events.details.full_metrics.formants_low.spl_dbA_est`
44. `events.details.full_metrics.questionnaires`
45. `events.details.full_metrics.questionnaires.OVHS-9 Total`
46. `events.details.full_metrics.questionnaires.RBH`
47. `events.details.full_metrics.questionnaires.RBH.B`
48. `events.details.full_metrics.questionnaires.RBH.H`
49. `events.details.full_metrics.questionnaires.RBH.R`
50. `events.details.full_metrics.questionnaires.TVQ-G Percent`

...（共164个，完整列表见field_verification_table.md）


### 类型2: 只在文档 (59个字段)

这些字段在文档中定义但数据库中暂无数据，属于预留功能或可选字段：

1. `events.details.attachments` - 预留
2. `events.details.content` - 预留
3. `events.details.createdAt` - 预留
4. `events.details.customDoctor` - 预留
5. `events.details.customLocation` - 预留
6. `events.details.date` - 预留
7. `events.details.details` - 预留
8. `events.details.email` - 预留
9. `events.details.equipmentUsed` - 预留
10. `events.details.eventId` - 预留
11. `events.details.feelings` - 预留
12. `events.details.full_metrics.formants_high.error_details` - 预留
13. `events.details.full_metrics.formants_low.error_details` - 预留
14. `events.details.full_metrics.sustained.formants_high.B1` - 预留
15. `events.details.full_metrics.sustained.formants_high.B2` - 预留
16. `events.details.full_metrics.sustained.formants_high.B3` - 预留
17. `events.details.full_metrics.sustained.formants_high.F1_available` - 预留
18. `events.details.full_metrics.sustained.formants_high.F2_available` - 预留
19. `events.details.full_metrics.sustained.formants_high.best_segment_time` - 预留
20. `events.details.full_metrics.sustained.formants_high.is_high_pitch` - 预留
21. `events.details.full_metrics.sustained.formants_high.source_file` - 预留
22. `events.details.full_metrics.sustained.formants_low.B1` - 预留
23. `events.details.full_metrics.sustained.formants_low.B2` - 预留
24. `events.details.full_metrics.sustained.formants_low.B3` - 预留
25. `events.details.full_metrics.sustained.formants_low.F1_available` - 预留
26. `events.details.full_metrics.sustained.formants_low.F2_available` - 预留
27. `events.details.full_metrics.sustained.formants_low.best_segment_time` - 预留
28. `events.details.full_metrics.sustained.formants_low.is_high_pitch` - 预留
29. `events.details.full_metrics.sustained.formants_low.source_file` - 预留
30. `events.details.hasInstructor` - 预留

...（共59个）


### 类型3: 只在数据 (122个字段)

这些字段在实际数据中存在但文档未详细定义，主要是实现细节字段：

1. `events.details.formants.f1`
2. `events.details.formants.f2`
3. `events.details.formants.f3`
4. `events.details.pitch.max`
5. `events.details.pitch.min`
6. `tests.charts.formant`
7. `tests.charts.formant_spl_spectrum`
8. `tests.charts.timeSeries`
9. `tests.charts.vrp`
10. `tests.metrics.formants_high`
11. `tests.metrics.formants_high.B1`
12. `tests.metrics.formants_high.B2`
13. `tests.metrics.formants_high.B3`
14. `tests.metrics.formants_high.F1`
15. `tests.metrics.formants_high.F1_available`
16. `tests.metrics.formants_high.F2`
17. `tests.metrics.formants_high.F2_available`
18. `tests.metrics.formants_high.F3`
19. `tests.metrics.formants_high.best_segment_time`
20. `tests.metrics.formants_high.f0_mean`
21. `tests.metrics.formants_high.is_high_pitch`
22. `tests.metrics.formants_high.reason`
23. `tests.metrics.formants_high.source_file`
24. `tests.metrics.formants_high.spl_dbA_est`
25. `tests.metrics.formants_low`
26. `tests.metrics.formants_low.B1`
27. `tests.metrics.formants_low.B2`
28. `tests.metrics.formants_low.B3`
29. `tests.metrics.formants_low.F1`
30. `tests.metrics.formants_low.F1_available`
31. `tests.metrics.formants_low.F2`
32. `tests.metrics.formants_low.F2_available`
33. `tests.metrics.formants_low.F3`
34. `tests.metrics.formants_low.best_segment_time`
35. `tests.metrics.formants_low.f0_mean`
36. `tests.metrics.formants_low.is_high_pitch`
37. `tests.metrics.formants_low.reason`
38. `tests.metrics.formants_low.source_file`
39. `tests.metrics.formants_low.spl_dbA_est`
40. `tests.metrics.questionnaires`
41. `tests.metrics.questionnaires.OVHS-9 Total`
42. `tests.metrics.questionnaires.RBH`
43. `tests.metrics.questionnaires.RBH.B`
44. `tests.metrics.questionnaires.RBH.H`
45. `tests.metrics.questionnaires.RBH.R`
46. `tests.metrics.questionnaires.TVQ-G Percent`
47. `tests.metrics.questionnaires.TVQ-G Total`
48. `tests.metrics.reading`
49. `tests.metrics.reading.duration_s`
50. `tests.metrics.reading.f0_mean`

...（共122个，完整列表见field_verification_table.md）


## 分析结论

### 文档质量评估: ✅ 优秀

- **73%的文档字段有实际使用**，说明文档定义准确且实用
- **27%的文档字段为预留功能**，这是正常的前瞻性设计

### 数据覆盖评估: ✅ 良好

- **57%的数据字段有文档定义**，核心业务逻辑已覆盖
- **42%的数据字段为实现细节**，不需要在用户文档中详细说明

### 建议

**优先级P1**:
1. 移除profile.bio字段（确认为不应存在）
2. 实现预留的核心功能字段（如feeling_log.content）

**优先级P2**:
1. 为高使用率的实现细节字段补充技术文档
2. 评估长期未使用的预留字段是否需保留

---

*生成时间: 2025-01-05*  
*数据来源: IaC_Dynamo_Definition&Data (537条记录)*
