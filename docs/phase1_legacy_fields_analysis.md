# VoiceFemEvents Legacy Fields Analysis

## 概述

本文档分析了VoiceFemEvents表中"self_test"事件类型的字段，区分了**当前代码会写入的字段**与**仅存在于历史数据中的字段**。

## 分析方法

1. 审查了`online-praat-analysis/handler.py`中的`handle_analyze_task`函数（第596-698行）
2. 该函数是唯一创建`self_test`类型事件的代码
3. 对比实际数据（53/70条记录包含full_metrics）与代码逻辑

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

#### 测试报告的顶层元数据字段
1. **`testDate`** (String, ISO 8601)
   - 示例: `"2025-08-30T07:00:00.000000Z"`
   - 存在率: 59/70 (84.3%)
   - **用途**: 测试执行的具体日期时间
   - **当前替代**: 事件的 `date` 字段记录测试日期

2. **`testLocation`** (String)
   - 示例: `"Home"`, `"Clinic"`
   - 存在率: 59/70 (84.3%)
   - **用途**: 测试执行地点
   - **当前替代**: 无直接替代，信息丢失

3. **`voiceStatus`** (String)
   - 示例: `"stable"`, `"improving"`, `"concerning"`
   - 存在率: 59/70 (84.3%)
   - **用途**: 用户对自己嗓音状态的主观评价
   - **当前替代**: 无直接替代，主观评价信息丢失

#### 特殊情况：软件迁移标识
4. **`_migration_source`** (String)
   - 示例: `"onlineAudioDataSource"`
   - 存在率: 11/70 (15.7%)
   - **用途**: 标识数据从旧系统迁移而来
   - **当前替代**: 不需要替代，这是迁移标记

---

## 代码证据

### 当前写入代码（handler.py:643-683）

```python
event_details = {
    'notes': 'VFS Tracker Voice Analysis Tools 自动生成报告',
    'appUsed': 'VFS Tracker Online Analysis',

    # 顶层简化指标
    'fundamentalFrequency': spontaneous_metrics.get('f0_mean'),
    'jitter': sustained_metrics.get('jitter_local_percent'),
    'shimmer': sustained_metrics.get('shimmer_local_percent'),
    'hnr': sustained_metrics.get('hnr_db'),
}

# 顶层 formants 对象
formants_low = metrics.get('formants_low', {})
if formants_low:
    event_details['formants'] = {
        'f1': formants_low.get('F1'),
        'f2': formants_low.get('F2'),
        'f3': formants_low.get('F3'),
    }

# 顶层 pitch 对象
if vrp_metrics and 'error' not in vrp_metrics:
    event_details['pitch'] = {
        'max': vrp_metrics.get('f0_max'),
        'min': vrp_metrics.get('f0_min'),
    }

# 完整的 full_metrics 对象
event_details['full_metrics'] = metrics
```

**关键发现**: 
- 代码中**没有**写入 `testDate`, `testLocation`, `voiceStatus` 的逻辑
- 这些字段只在旧版本代码中存在（可能是早期手动输入或其他接口）

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
1. **84.3%的self_test记录**包含3个当前代码不再写入的历史字段
2. 这些字段似乎来自早期版本或手动录入
3. **当前代码已标准化**，只写入明确定义的字段结构

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
