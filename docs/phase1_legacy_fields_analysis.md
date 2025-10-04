# VoiceFemEvents Legacy Fields Analysis

## 概述

本文档分析了VoiceFemEvents表中"self_test"事件类型的字段，区分了**当前代码会写入的字段**与**仅存在于历史数据中的字段**。

## 分析方法

1. 审查了所有可能创建`self_test`事件的代码路径：
   - **online-praat-analysis/handler.py**: `handle_analyze_task`函数（第596-698行） - 自动化嗓音分析
   - **QuickF0Test.jsx**: 前端快速基频测试工具 - 简化的F0测量
   - **EventForm.jsx**: 前端手动事件录入表单 - 用户手动填写
   - **addVoiceEvent Lambda**: 接收前端提交的事件数据并写入DynamoDB
2. 对比实际数据（70条self_test记录，其中53条包含full_metrics）与各代码路径的写入逻辑

---

## 字段分类

### ✅ 当前代码会写入的字段

以下字段在`handle_analyze_task`函数中被明确写入（第643-671行）：

#### 1. 顶层基本字段
- `notes`: 固定值 "VFS Tracker Voice Analysis Tools 自动生成报告"
- `appUsed`: 固定值 "VFS Tracker Online Analysis"

#### 2. 顶层简化指标（来自不同分析模块）
- `fundamentalFrequency`: 来自 `metrics.spontaneous.f0_mean`（自发语音）
- `jitter`: 来自 `metrics.sustained.jitter_local_percent`（持续元音）
- `shimmer`: 来自 `metrics.sustained.shimmer_local_percent`（持续元音）
- `hnr`: 来自 `metrics.sustained.hnr_db`（持续元音）

#### 3. 顶层复合对象
- `formants`: 包含 `f1`, `f2`, `f3`（来自 `metrics.formants_low`）
- `pitch`: 包含 `max`, `min`（来自 `metrics.vrp`）

#### 4. 完整分析结果
- **`full_metrics`**: 整个 `metrics` 对象（第671行）

---

### 🔴 仅存在于历史数据的字段（当前代码不再写入）

以下字段在实际数据中存在，但当前代码中**没有找到写入逻辑**：

#### 测试报告的顶层元数据字段（来源：历史版本的EventForm手动录入）
1. **`testDate`** (String, ISO 8601)
   - 示例: `"2025-08-30T07:00:00.000000Z"`
   - 存在率: 59/70 (84.3%)
   - **来源**: 早期版本的EventForm.jsx允许用户手动输入测试日期
   - **用途**: 测试执行的具体日期时间
   - **当前替代**: 事件的 `date` 字段记录测试日期
   - **当前代码**: EventForm.jsx、QuickF0Test.jsx和online-praat-analysis都**不再**写入此字段

2. **`testLocation`** (String)
   - 示例: `"Home"`, `"Clinic"`
   - 存在率: 59/70 (84.3%)
   - **来源**: 早期版本的EventForm.jsx允许用户选择测试地点
   - **用途**: 测试执行地点
   - **当前替代**: 无直接替代，信息丢失
   - **当前代码**: EventForm.jsx、QuickF0Test.jsx和online-praat-analysis都**不再**写入此字段

3. **`voiceStatus`** (String)
   - 示例: `"stable"`, `"improving"`, `"concerning"`
   - 存在率: 59/70 (84.3%)
   - **来源**: 早期版本的EventForm.jsx允许用户输入主观状态评价
   - **用途**: 用户对自己嗓音状态的主观评价
   - **当前替代**: 无直接替代，主观评价信息丢失
   - **当前代码**: EventForm.jsx、QuickF0Test.jsx和online-praat-analysis都**不再**写入此字段

#### 特殊情况：软件迁移标识
4. **`_migration_source`** (String)
   - 示例: `"onlineAudioDataSource"`
   - 存在率: 11/70 (15.7%)
   - **用途**: 标识数据从旧系统迁移而来
   - **当前替代**: 不需要替代，这是迁移标记

---

## 代码证据

### 创建self_test事件的三个代码路径

#### 路径1: online-praat-analysis Lambda (自动化分析)
```python
# handler.py:643-683
event_details = {
    'notes': 'VFS Tracker Voice Analysis Tools 自动生成报告',
    'appUsed': 'VFS Tracker Online Analysis',
    'fundamentalFrequency': spontaneous_metrics.get('f0_mean'),
    'jitter': sustained_metrics.get('jitter_local_percent'),
    'shimmer': sustained_metrics.get('shimmer_local_percent'),
    'hnr': sustained_metrics.get('hnr_db'),
    'formants': {...},  # f1, f2, f3
    'pitch': {...},     # min, max
    'full_metrics': metrics  # 完整的109个嵌套字段
}
# ❌ 不写入: testDate, testLocation, voiceStatus
```

#### 路径2: QuickF0Test.jsx (快速F0测试)
```javascript
// QuickF0Test.jsx:130-142
const eventData = {
  type: 'self_test',
  date: new Date().toISOString(),
  details: {
    appUsed: 'VFS Tracker Fast F0 Analysis Tool',
    fundamentalFrequency: averageF0,
    sound: ['其他'],
    customSoundDetail: '通过快速基频测试自动记录',
    voicing: ['其他'],
    customVoicingDetail: '通过快速基频测试自动记录',
    notes: `快速基频测试，平均F0: ${averageF0.toFixed(2)} Hz`,
  },
};
// ❌ 不写入: testDate, testLocation, voiceStatus
```

#### 路径3: EventForm.jsx (手动录入)
```javascript
// EventForm.jsx - self_test case
// 当前代码只收集以下字段：
// - appUsed, sound[], voicing[]
// - fundamentalFrequency, jitter, shimmer, hnr
// - formants: {f1, f2, f3}
// ❌ 不写入: testDate, testLocation, voiceStatus
```

#### 数据写入层：addVoiceEvent Lambda
```javascript
// addVoiceEvent/index.mjs:160-169
const item = {
    userId,
    eventId,
    type: requestBody.type,        // 从前端接收
    date: requestBody.date,         // 从前端接收
    details: requestBody.details,   // 从前端接收（完整details对象）
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
};
// Lambda只是透传前端的details，不添加额外字段
```

**关键发现**: 
- 所有三个当前代码路径都**没有**写入 `testDate`, `testLocation`, `voiceStatus`
- 这些字段只存在于84.3%的历史记录中，来源是早期版本的EventForm
- 可能是早期EventForm.jsx包含这些输入字段，后来被移除了

---

## 数据统计

| 字段名 | 存在率 | 是否当前写入 | 说明 |
|--------|--------|-------------|------|
| `notes` | 70/70 (100%) | ✅ 是 | 固定文本 |
| `appUsed` | 70/70 (100%) | ✅ 是 | 固定文本 |
| `fundamentalFrequency` | 70/70 (100%) | ✅ 是 | 来自spontaneous |
| `jitter` | 70/70 (100%) | ✅ 是 | 来自sustained |
| `shimmer` | 70/70 (100%) | ✅ 是 | 来自sustained |
| `hnr` | 70/70 (100%) | ✅ 是 | 来自sustained |
| `formants` | 70/70 (100%) | ✅ 是 | 来自formants_low |
| `pitch` | 67/70 (95.7%) | ✅ 是 | 来自vrp（有时失败） |
| `full_metrics` | 53/70 (75.7%) | ✅ 是 | 完整分析结果 |
| **`testDate`** | 59/70 (84.3%) | ❌ 否 | **历史字段** |
| **`testLocation`** | 59/70 (84.3%) | ❌ 否 | **历史字段** |
| **`voiceStatus`** | 59/70 (84.3%) | ❌ 否 | **历史字段** |
| **`_migration_source`** | 11/70 (15.7%) | ❌ 否 | **迁移标记** |

---

## 建议

### 1. 文档更新策略

**当前data_structures.md应包含**:
- ✅ 所有当前代码会写入的字段（已完成）
- ✅ `full_metrics`及其所有109个嵌套字段（已完成）

**不应包含**:
- ❌ `testDate`, `testLocation`, `voiceStatus`（历史字段，当前代码不写入）
- ❌ `_migration_source`（内部迁移标记）

### 2. 历史数据处理

创建新issue：**"self_test历史数据字段清理"**

**目标**: 处理84.3%记录中的3个历史字段

**方案A - 数据保留**（推荐）:
```python
# 保留在details对象中，但标记为deprecated
if 'testDate' in event_details:
    event_details['_legacy'] = {
        'testDate': event_details.pop('testDate'),
        'testLocation': event_details.pop('testLocation'),
        'voiceStatus': event_details.pop('voiceStatus')
    }
```

**方案B - 数据迁移**:
- `testDate` → 可忽略（与事件date重复）
- `testLocation` → 可忽略（大部分是"Home"）
- `voiceStatus` → 考虑迁移到`details.notes`字段

**方案C - 简单清理**:
- 直接删除这3个字段（数据量小，影响有限）

### 3. 前端兼容性

**如果选择方案A或C**，需要更新前端代码：
- 检查`Timeline.jsx`, `EventForm.jsx`等组件
- 确保不依赖`testDate`, `testLocation`, `voiceStatus`字段
- 如果有显示逻辑，改为使用事件顶层的`date`字段

---

## 结论

### 关键发现
1. **self_test事件有三个创建路径**：
   - online-praat-analysis Lambda（自动化分析，53/70记录，包含full_metrics）
   - QuickF0Test.jsx（快速F0测试，前端工具）
   - EventForm.jsx（手动录入，用户填写表单）
2. **84.3%的self_test记录**包含3个当前代码不再写入的历史字段（`testDate`, `testLocation`, `voiceStatus`）
3. 这些历史字段来自**早期版本的EventForm.jsx**，允许用户手动输入测试日期、地点和状态评价
4. **当前代码已标准化**，所有三个路径都不再写入这些历史字段

### 行动项
- [x] 识别历史字段（本文档）
- [ ] 创建后续issue：历史数据清理
- [ ] 更新data_structures.md：**移除**历史字段定义
- [ ] 验证前端不依赖历史字段
- [ ] 执行数据清理（如果需要）

### 文档准确性确认
✅✅✅ **重要发现：当前`data_structures.md`已经是完全准确的！**

经过检查，`data_structures.md`中的self_test部分：
- ✅ **不包含**`testDate`, `testLocation`, `voiceStatus`等历史字段
- ✅ **正确记录**了当前代码写入的所有字段
- ✅ **完整文档化**了`full_metrics`及其所有109个嵌套字段

**结论**：文档已经正确地排除了历史字段，仅记录当前活跃的字段定义。**无需对data_structures.md进行修改**。
