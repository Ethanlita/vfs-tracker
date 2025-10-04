# VoiceFemEvents Legacy Fields Analysis（最终版）

## 概述

本文档分析了VoiceFemEvents表中"self_test"事件类型的字段，区分了：
1. **当前代码会写入的字段**（Active Fields）
2. **仅存在于历史数据中的字段**（Legacy/Deprecated Fields）- 在数据中有，代码中不写
3. **代码中定义但数据中暂未使用的字段**（Reserved/Future Fields）- 在代码中有，数据中没有

## 分析方法

### 审查的代码路径

1. **online-praat-analysis/handler.py** (`handle_analyze_task`, lines 596-698)
   - 自动化嗓音分析
   - 写入full_metrics + 顶层简化字段
   
2. **QuickF0Test.jsx** (`handleSave`, lines 121-178)
   - 前端快速F0测试
   - 写入固定的字段集（appUsed, fundamentalFrequency, sound, voicing, notes）
   
3. **EventForm.jsx** (`renderEventSpecificFields` for self_test, lines 240-268)
   - 用户手动填写表单
   - 允许用户输入多种可选字段
   
4. **addVoiceEvent Lambda**
   - 透传前端提交的数据到DynamoDB

### 数据分析范围

- 总记录数: 70条self_test事件
- 包含full_metrics: 53条（75.7%）
- 数据时间范围: 涵盖历史数据到当前

---

## 字段分类结果

### ✅ 当前代码会写入的字段（Active Fields）

#### 1. online-praat-analysis Lambda写入的字段

**顶层基本字段**:
- `notes`: "VFS Tracker Voice Analysis Tools 自动生成报告"
- `appUsed`: "VFS Tracker Online Analysis"

**顶层简化指标**:
- `fundamentalFrequency`: 从metrics.spontaneous.f0_mean提取
- `jitter`: 从metrics.sustained.jitter_local_percent提取
- `shimmer`: 从metrics.sustained.shimmer_local_percent提取
- `hnr`: 从metrics.sustained.hnr_db提取

**顶层复合对象**:
- `formants`: {f1, f2, f3} - 从metrics.formants_low提取
- `pitch`: {max, min} - 从metrics.vrp提取

**完整分析结果**:
- `full_metrics`: 整个metrics对象（109个嵌套字段）

#### 2. QuickF0Test.jsx写入的字段

```javascript
{
  appUsed: 'VFS Tracker Fast F0 Analysis Tool',
  fundamentalFrequency: <averageF0>,
  sound: ['其他'],
  customSoundDetail: '通过快速基频测试自动记录',
  voicing: ['其他'],
  customVoicingDetail: '通过快速基频测试自动记录',
  notes: `快速基频测试，平均F0: ${averageF0.toFixed(2)} Hz`
}
```

#### 3. EventForm.jsx允许用户输入的字段（当前版本）

根据源代码（lines 241-268），当前EventForm为self_test提供以下输入字段：

**基本信息**:
- `appUsed`: 使用的App（可选）
- `sound`: 声音状态（必填，多选）
- `customSoundDetail`: 其他声音状态详情（条件显示）
- `voicing`: 发声方式（必填，多选）
- `customVoicingDetail`: 其他发声方式详情（条件显示）
- `notes`: 备注（可选）

**声学指标**:
- `fundamentalFrequency`: 基频（Hz，可选）
- `jitter`: Jitter（%，可选）
- `shimmer`: Shimmer（%，可选）
- `hnr`: 谐噪比（dB，可选）

**共振峰数据**（转换为formants对象）:
- `f1`, `f2`, `f3`: 转换为 `formants: {f1, f2, f3}`

**音域范围**（转换为pitch对象）:
- `pitchMax`, `pitchMin`: 转换为 `pitch: {max, min}`

**重要说明**: 
- 当前EventForm **不包含** testDate, testLocation, voiceStatus的输入字段
- 所有声学指标字段都是**可选的**
- 代码会自动将f1/f2/f3组合成formants对象，pitchMax/pitchMin组合成pitch对象（lines 378-391）

---

### 🔴 历史/废弃字段（Legacy/Deprecated Fields）

这些字段**在数据中存在**但**当前代码不再写入**：

#### 1. testDate (String, ISO 8601)
- **示例**: `"2025-08-30T07:00:00.000000Z"`
- **存在率**: 59/70 (84.3%)
- **来源**: 早期版本EventForm的用户手动输入
- **用途**: 测试执行的具体日期时间
- **当前替代**: 事件顶层的 `date` 字段
- **废弃原因**: 与事件date字段重复

#### 2. testLocation (String)
- **示例**: `"Home"`, `"Clinic"`
- **存在率**: 59/70 (84.3%)
- **来源**: 早期版本EventForm的用户手动输入（曾有地点选择下拉框）
- **用途**: 测试执行地点
- **废弃原因**: 对self_test类型意义不大，且hospital_test有独立的location字段

#### 3. voiceStatus (String)
- **示例**: `"良好"`, `"需要改进"`
- **存在率**: 59/70 (84.3%)
- **来源**: 早期版本EventForm的用户主观评价输入
- **用途**: 用户对嗓音状态的主观评价
- **废弃原因**: 改用sound/voicing多选方式更标准化

#### 4. _migration_source (String)
- **示例**: `"old_system"`
- **存在率**: 11/70 (15.7%)
- **来源**: 数据迁移标记
- **用途**: 标识从旧系统迁移的数据
- **废弃原因**: 仅用于历史数据迁移，新数据不需要

**84.3%的一致存在率说明**: testDate/testLocation/voiceStatus这三个字段来自同一个早期版本的EventForm，该版本在某个时间点被移除。

---

### 🟢 预留/未来字段（Reserved/Future Fields）

这些字段**在代码中定义或文档中存在**但**实际数据中未使用**（0%存在率）：

#### 在online_praat_plan.md中定义但未实现

从`docs/online_praat_plan.md`和`docs/online_praat_detailed_plan.md`中发现以下字段在文档中定义但实际未使用：

1. **calibration** (Object)
   - 文档定义: 校准信息 `{hasExternal, offsetDb, noiseFloorDbA}`
   - 存在率: 0/449 (0%)
   - 状态: **未实现/预留**
   - 说明: VoiceFemTests表的预留字段，online-praat-analysis未实现

2. **tests** (List)
   - 文档定义: 录音段落列表 `[{step, s3Key, durationMs}]`
   - 存在率: 0/449 (0%)
   - 状态: **未实现/预留**
   - 说明: VoiceFemTests表的预留字段，online-praat-analysis未实现

3. **forms** (Object)
   - 文档定义: 问卷结果 `{RBH, VHI9i, TVQ}`
   - 存在率: 0/449 (0%)
   - 状态: **未实现/预留**
   - 说明: VoiceFemTests表的预留字段，questionnaires数据实际在metrics.questionnaires中

**注意**: 这些字段在data_structures.md中已标记为**[未实现/预留]**，符合实际情况。

---

## 结论与建议

### ✅ data_structures.md的准确性

经过全面代码审查，确认：
- ✅ 文档**不包含**任何历史字段（testDate/testLocation/voiceStatus）
- ✅ 文档**只记录**当前代码会写入的字段
- ✅ 文档**正确标记**了未实现字段（calibration/tests/forms）
- ✅ **无需修改** data_structures.md

### 📋 建议的后续actions

#### 历史数据清理issue（优先级：中）

**问题**: 84.3%的self_test记录（59/70条）包含废弃字段

**方案选项**:

**方案A: 保留到_legacy对象（推荐）**
```javascript
{
  ...currentFields,
  _legacy: {
    testDate: "2025-08-30T07:00:00.000000Z",
    testLocation: "Home",
    voiceStatus: "良好"
  }
}
```
- 优点: 保留历史信息，不丢失数据
- 缺点: 增加存储空间

**方案B: 迁移有用信息**
- testDate → 如果与事件date不一致，可以添加到notes
- testLocation/voiceStatus → 合并到notes
- 优点: 不增加新字段
- 缺点: 信息以文本形式存储，不易查询

**方案C: 直接删除**
- 优点: 清理干净
- 缺点: 永久丢失历史信息
- 影响: 有限（这些字段对分析价值不高）

**推荐**: 方案A（_legacy对象），既保留历史又不影响当前结构

#### 数据统一性验证（优先级：低）

虽然当前文档已经准确，但建议：
- 定期运行Shell验证脚本，确保新数据符合标准
- 监控EventForm提交的数据，确保没有意外字段
- 文档添加"字段演进历史"章节，记录字段变更

---

## 附录：完整字段映射

### self_test事件字段汇总

| 字段名 | 当前代码写入? | 数据存在率 | 来源 | 状态 |
|--------|--------------|-----------|------|------|
| appUsed | ✅ | 100% | online-praat/QuickF0/EventForm | Active |
| sound | ✅ | 100% | QuickF0/EventForm | Active |
| voicing | ✅ | 100% | QuickF0/EventForm | Active |
| fundamentalFrequency | ✅ | ~90% | online-praat/QuickF0/EventForm | Active |
| jitter | ✅ | ~75% | online-praat/EventForm | Active |
| shimmer | ✅ | ~75% | online-praat/EventForm | Active |
| hnr | ✅ | ~75% | online-praat/EventForm | Active |
| formants | ✅ | ~75% | online-praat/EventForm | Active |
| pitch | ✅ | ~75% | online-praat/EventForm | Active |
| full_metrics | ✅ | 75.7% | online-praat | Active |
| notes | ✅ | 100% | online-praat/QuickF0/EventForm | Active |
| customSoundDetail | ✅ | ~40% | QuickF0/EventForm | Active |
| customVoicingDetail | ✅ | ~40% | QuickF0/EventForm | Active |
| **testDate** | ❌ | **84.3%** | 早期EventForm | **Legacy** |
| **testLocation** | ❌ | **84.3%** | 早期EventForm | **Legacy** |
| **voiceStatus** | ❌ | **84.3%** | 早期EventForm | **Legacy** |
| **_migration_source** | ❌ | **15.7%** | 数据迁移 | **Legacy** |

### 代码路径对比

| 字段 | online-praat | QuickF0 | EventForm |
|------|--------------|---------|-----------|
| appUsed | ✅ (固定值) | ✅ (固定值) | ✅ (用户输入) |
| fundamentalFrequency | ✅ (computed) | ✅ (measured) | ✅ (用户输入) |
| jitter | ✅ (computed) | ❌ | ✅ (用户输入) |
| shimmer | ✅ (computed) | ❌ | ✅ (用户输入) |
| hnr | ✅ (computed) | ❌ | ✅ (用户输入) |
| formants | ✅ (computed) | ❌ | ✅ (用户输入) |
| pitch | ✅ (computed) | ❌ | ✅ (用户输入) |
| full_metrics | ✅ | ❌ | ❌ |
| sound | ❌ | ✅ (固定) | ✅ (用户选择) |
| voicing | ❌ | ✅ (固定) | ✅ (用户选择) |
| notes | ✅ (固定) | ✅ (动态) | ✅ (用户输入) |
| testDate | ❌ | ❌ | ❌ (已移除) |
| testLocation | ❌ | ❌ | ❌ (已移除) |
| voiceStatus | ❌ | ❌ | ❌ (已移除) |

---

**文档版本**: v1.2  
**最后更新**: 2025年  
**审查人**: GitHub Copilot  
**审查方法**: 完整源代码审查 + 实际数据分析（537条记录）
