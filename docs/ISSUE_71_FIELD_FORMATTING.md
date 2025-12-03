# Issue #71 事件详情字段格式化方案

> 本文档详细记录 Issue #71（事件详情格式化）的分析和实现方案。

## 问题描述

当前 EventManager 和 InteractiveTimeline 中的事件详情展示存在以下问题：
1. 直接使用 `JSON.stringify` 显示对象，用户看到的是原始 JSON
2. 字段名显示为英文技术名称（如 `fundamentalFrequency`），对用户不友好
3. 嵌套对象（如 `full_metrics`）结构复杂，难以阅读
4. 缺乏单位显示（Hz、dB、%、秒等）
5. 没有针对不同事件类型的差异化展示

## 数据统计

### 事件类型分布（共 227 条记录）

| 类型 | 数量 | 说明 |
|------|------|------|
| `self_test` | 189 | 自测事件（包含 `full_metrics` 复杂嵌套结构） |
| `feeling_log` | 24 | 感受日志 |
| `surgery` | 6 | 手术记录 |
| `hospital_test` | 6 | 医院检测 |
| `self-test` | 1 | 历史格式（需兼容） |
| `feeling-log` | 1 | 历史格式（需兼容） |

> 注意：`voice_training` 和 `self_practice` 在数据库中暂无记录，但 schema 中已定义

---

## 字段清单

### 一、事件基础字段

| 字段路径 | 中文名称 | 单位 | 类型 | 说明 |
|----------|----------|------|------|------|
| `eventId` | 事件ID | - | String | UUID 格式，不展示给用户 |
| `userId` | 用户ID | - | String | 不展示给用户 |
| `type` | 事件类型 | - | String | 需要翻译为中文 |
| `date` | 事件日期 | - | ISO String | 格式化为易读日期 |
| `status` | 审核状态 | - | String | pending/approved/rejected |
| `createdAt` | 创建时间 | - | ISO String | 格式化为易读日期时间 |
| `updatedAt` | 更新时间 | - | ISO String | 格式化为易读日期时间 |
| `attachments` | 附件 | - | Array | 私有字段，包含文件信息 |

---

### 二、附件字段 (attachments[])

| 字段路径 | 中文名称 | 说明 |
|----------|----------|------|
| `fileName` | 文件名 | 原始文件名 |
| `fileType` | 文件类型 | MIME 类型 |
| `fileUrl` | 存储路径 | S3 对象键，需转换为预签名 URL |

---

### 三、事件类型对应的 details 字段

#### 3.1 Self Test / Hospital Test 共有字段

| 字段路径 | 中文名称 | 单位 | 格式示例 | 优先级 |
|----------|----------|------|----------|--------|
| `appUsed` | 使用的应用 | - | "VFS Tracker Online Analysis" | 高 |
| `fundamentalFrequency` | 平均基频 | Hz | "203.1 Hz" | **核心** |
| `pitch.max` | 最高音 | Hz | "438.6 Hz" | **核心** |
| `pitch.min` | 最低音 | Hz | "227.6 Hz" | **核心** |
| `formants.f1` | 第一共振峰 (F1) | Hz | "622.6 Hz" | 高 |
| `formants.f2` | 第二共振峰 (F2) | Hz | "2073.0 Hz" | 高 |
| `formants.f3` | 第三共振峰 (F3) | Hz | "3205.0 Hz" | 高 |
| `jitter` | 频率抖动 (Jitter) | % | "0.64%" | 高 |
| `shimmer` | 振幅抖动 (Shimmer) | % | "3.98%" | 高 |
| `hnr` | 谐噪比 (HNR) | dB | "19.1 dB" | 高 |
| `sound` | 声音状态 | - | ["好", "喉咙中有痰"] | 中 |
| `voicing` | 发声方式 | - | ["夹了", "没夹"] | 中 |
| `customSoundDetail` | 声音状态详情 | - | 文本 | 低 |
| `customVoicingDetail` | 发声方式详情 | - | 文本 | 低 |
| `notes` | 备注 | - | 文本 | 中 |

#### 3.2 Hospital Test 特有字段

| 字段路径 | 中文名称 | 格式示例 | 优先级 |
|----------|----------|----------|--------|
| `location` | 医院/诊所 | "友谊医院" | **核心** |
| `equipmentUsed` | 使用设备 | 文本 | 中 |

---

### 四、full_metrics 完整指标（自动测试生成）

这是由 online-praat-analysis Lambda 自动生成的完整分析结果，结构非常复杂。

#### 4.1 持续元音测试 (sustained)

| 字段路径 | 中文名称 | 单位 | 格式示例 |
|----------|----------|------|----------|
| `full_metrics.sustained.f0_mean` | 持续音基频均值 | Hz | "345.6 Hz" |
| `full_metrics.sustained.f0_sd` | 持续音基频标准差 | Hz | "12.78 Hz" |
| `full_metrics.sustained.hnr_db` | 谐噪比 | dB | "19.1 dB" |
| `full_metrics.sustained.jitter_local_percent` | 局部频率抖动 | % | "0.64%" |
| `full_metrics.sustained.shimmer_local_percent` | 局部振幅抖动 | % | "3.98%" |
| `full_metrics.sustained.mpt_s` | 最长发声时间 | 秒 | "3.82 秒" |
| `full_metrics.sustained.spl_dbA_est` | 估算声压级 | dB(A) | "74.8 dB(A)" |

##### sustained.formants_sustained（持续音共振峰）

| 字段路径 | 中文名称 | 单位 |
|----------|----------|------|
| `formants_sustained.F1` | 第一共振峰 (F1) | Hz |
| `formants_sustained.F2` | 第二共振峰 (F2) | Hz |
| `formants_sustained.F3` | 第三共振峰 (F3) | Hz |
| `formants_sustained.B1` | F1 带宽 | Hz |
| `formants_sustained.B2` | F2 带宽 | Hz |
| `formants_sustained.B3` | F3 带宽 | Hz |
| `formants_sustained.F1_available` | F1 有效 | Boolean |
| `formants_sustained.F2_available` | F2 有效 | Boolean |
| `formants_sustained.is_high_pitch` | 高音 | Boolean |
| `formants_sustained.reason` | 分析状态 | String |
| `formants_sustained.best_segment_time` | 最佳片段时间 | 秒 |
| `formants_sustained.f0_mean` | 片段基频 | Hz |
| `formants_sustained.spl_dbA_est` | 片段声压级 | dB(A) |
| `formants_sustained.error_details` | 错误详情 | String |

##### sustained.formants_high（高音共振峰）

同 `formants_sustained` 结构

##### sustained.formants_low（低音共振峰）

同 `formants_sustained` 结构

##### sustained 分析失败标记

| 字段路径 | 中文名称 |
|----------|----------|
| `formant_analysis_failed` | 共振峰分析失败 |
| `formant_analysis_reason_sustained` | 持续音分析失败原因 |
| `formant_analysis_reason_high` | 高音分析失败原因 |
| `formant_analysis_reason_low` | 低音分析失败原因 |

---

#### 4.2 朗读测试 (reading)

| 字段路径 | 中文名称 | 单位 | 格式示例 |
|----------|----------|------|----------|
| `full_metrics.reading.f0_mean` | 朗读基频均值 | Hz | "205.9 Hz" |
| `full_metrics.reading.f0_sd` | 朗读基频标准差 | Hz | "49.19 Hz" |
| `full_metrics.reading.duration_s` | 朗读时长 | 秒 | "60.2 秒" |
| `full_metrics.reading.voiced_ratio` | 浊音比例 | - | "48%" (0-1 转百分比) |
| `full_metrics.reading.pause_count` | 停顿次数 | 次 | "97 次" |
| `full_metrics.reading.f0_stats.median` | 基频中位数 | Hz | "210.9 Hz" |
| `full_metrics.reading.f0_stats.p10` | 基频 P10 | Hz | "111.2 Hz" |
| `full_metrics.reading.f0_stats.p90` | 基频 P90 | Hz | "253.0 Hz" |

---

#### 4.3 自发语音测试 (spontaneous)

| 字段路径 | 中文名称 | 单位 | 格式示例 |
|----------|----------|------|----------|
| `full_metrics.spontaneous.f0_mean` | 自发语音基频均值 | Hz | "203.1 Hz" |
| `full_metrics.spontaneous.f0_sd` | 自发语音基频标准差 | Hz | "63.0 Hz" |
| `full_metrics.spontaneous.duration_s` | 自发语音时长 | 秒 | "38.9 秒" |
| `full_metrics.spontaneous.voiced_ratio` | 浊音比例 | - | "39%" |
| `full_metrics.spontaneous.pause_count` | 停顿次数 | 次 | "60 次" |
| `full_metrics.spontaneous.f0_stats.median` | 基频中位数 | Hz | "209.2 Hz" |
| `full_metrics.spontaneous.f0_stats.p10` | 基频 P10 | Hz | "103.1 Hz" |
| `full_metrics.spontaneous.f0_stats.p90` | 基频 P90 | Hz | "265.5 Hz" |

---

#### 4.4 声域图 (VRP)

| 字段路径 | 中文名称 | 单位 | 格式示例 |
|----------|----------|------|----------|
| `full_metrics.vrp.f0_min` | 最低音高 | Hz | "227.6 Hz" |
| `full_metrics.vrp.f0_max` | 最高音高 | Hz | "438.6 Hz" |
| `full_metrics.vrp.spl_min` | 最小声压 | dB | "68.3 dB" |
| `full_metrics.vrp.spl_max` | 最大声压 | dB | "82.0 dB" |
| `full_metrics.vrp.error` | VRP 错误 | - | "no_frames" |

##### vrp.bins[]（VRP 分布数据点）

| 字段路径 | 中文名称 | 单位 |
|----------|----------|------|
| `bins[].semi` | 半音 | - |
| `bins[].f0_center_hz` | 中心频率 | Hz |
| `bins[].count` | 采样数 | - |
| `bins[].spl_min` | 最小声压 | dB |
| `bins[].spl_max` | 最大声压 | dB |
| `bins[].spl_mean` | 平均声压 | dB |

> **注意**：`vrp.bins` 数组可能包含 20+ 个数据点，建议折叠显示或用图表展示

---

#### 4.5 问卷数据 (questionnaires)

| 字段路径 | 中文名称 | 格式示例 |
|----------|----------|----------|
| `full_metrics.questionnaires.RBH.R` | 粗糙度 (R) | "2" |
| `full_metrics.questionnaires.RBH.B` | 气息音 (B) | "1" |
| `full_metrics.questionnaires.RBH.H` | 嘶哑度 (H) | "2" |
| `full_metrics.questionnaires.OVHS-9 Total` | OVHS-9 总分 | "17" |
| `full_metrics.questionnaires.TVQ-G Total` | TVQ-G 总分 | "17" |
| `full_metrics.questionnaires.TVQ-G Percent` | TVQ-G 百分比 | "35%" |

---

#### 4.6 顶层共振峰数据（来自高/低音分析）

| 字段路径 | 中文名称 | 单位 |
|----------|----------|------|
| `full_metrics.formants_high.*` | 高音共振峰 | - |
| `full_metrics.formants_low.*` | 低音共振峰 | - |

结构与 `sustained.formants_high/low` 相同

---

### 五、Surgery 手术记录字段

| 字段路径 | 中文名称 | 说明 |
|----------|----------|------|
| `doctor` | 手术医生 | 枚举值 |
| `customDoctor` | 自定义医生 | 当 doctor="自定义" 时使用 |
| `location` | 手术地点 | 枚举值 |
| `customLocation` | 自定义地点 | 当 location="自定义" 时使用 |
| `notes` | 手术备注 | 文本 |

医生枚举值: 李革临、金亨泰、何双八、Kamol、田边正博、自定义
地点枚举值: 友谊医院、南京同仁医院、Yeson、Kamol、京都耳鼻咽喉科医院、自定义

---

### 六、Feeling Log 感受日志字段

| 字段路径 | 中文名称 | 说明 |
|----------|----------|------|
| `content` | 感受内容 | 主要内容（文档定义） |
| `feeling` | 感受 | 实际数据中的字段 |
| `note` | 备注 | 实际数据中的字段 |

> 注意：文档定义的是 `content`，但实际数据使用 `feeling` 和 `note`

---

### 七、Voice Training 嗓音训练字段

| 字段路径 | 中文名称 | 说明 |
|----------|----------|------|
| `trainingContent` | 训练内容 | 必填 |
| `selfPracticeContent` | 自练作业 | 可选 |
| `voiceStatus` | 嗓音状态 | 必填 |
| `voicing` | 发声方式 | 必填，String 类型 |
| `references` | 参考资料 | 可选 |
| `feelings` | 感受 | 可选 |
| `instructor` | 指导者 | 可选 |

---

### 八、Self Practice 自我练习字段

| 字段路径 | 中文名称 | 说明 |
|----------|----------|------|
| `practiceContent` | 练习内容 | 必填 |
| `hasInstructor` | 有指导者 | Boolean |
| `instructor` | 指导者姓名 | 可选 |
| `voiceStatus` | 嗓音状态 | 必填 |
| `voicing` | 发声方式 | 必填，String 类型 |
| `references` | 参考资料 | 可选 |
| `feelings` | 感受 | 可选 |

---

## 字段统计汇总

| 类别 | 字段数量 |
|------|----------|
| 事件基础字段 | 7 |
| 附件字段 | 3 |
| Self/Hospital Test 共有字段 | 15 |
| Hospital Test 特有字段 | 2 |
| full_metrics.sustained | ~25 |
| full_metrics.reading | 9 |
| full_metrics.spontaneous | 9 |
| full_metrics.vrp | 6 + bins[] |
| full_metrics.questionnaires | 6 |
| full_metrics.formants_high/low | ~26 (各 13) |
| Surgery 字段 | 5 |
| Feeling Log 字段 | 3 |
| Voice Training 字段 | 7 |
| Self Practice 字段 | 7 |
| **总计** | **约 130+ 个字段** |

---

## 实现方案

### 方案设计原则

1. **分层展示**: 核心指标优先展示，详细数据可折叠
2. **类型区分**: 不同事件类型使用不同的渲染模板
3. **单位格式化**: 所有数值带正确单位
4. **友好命名**: 所有技术字段名翻译为中文
5. **可复用**: 创建共享组件，EventManager 和 InteractiveTimeline 均可使用

### 文件结构

```
src/components/
├── events/
│   ├── EventDetailsPanel.jsx      # 主面板容器
│   ├── details/
│   │   ├── SelfTestDetails.jsx    # 自测详情（包含 full_metrics 处理）
│   │   ├── HospitalTestDetails.jsx # 医院检测详情
│   │   ├── SurgeryDetails.jsx     # 手术记录详情
│   │   ├── FeelingLogDetails.jsx  # 感受日志详情
│   │   ├── VoiceTrainingDetails.jsx # 嗓音训练详情
│   │   └── SelfPracticeDetails.jsx  # 自我练习详情
│   ├── shared/
│   │   ├── FieldRow.jsx           # 单行字段展示
│   │   ├── MetricCard.jsx         # 核心指标卡片
│   │   ├── CollapsibleSection.jsx # 可折叠区域
│   │   └── AttachmentList.jsx     # 附件列表
│   └── utils/
│       ├── fieldLabels.js         # 字段中文映射
│       ├── formatters.js          # 数值格式化函数
│       └── eventTypeConfig.js     # 事件类型配置
```

### 核心配置文件

#### fieldLabels.js - 字段中文映射

```javascript
export const FIELD_LABELS = {
  // 基础字段
  date: '事件日期',
  status: '审核状态',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  
  // 类型翻译
  type: {
    self_test: '自我测试',
    'self-test': '自我测试',
    hospital_test: '医院检测',
    surgery: 'VFS 手术',
    feeling_log: '感受日志',
    'feeling-log': '感受日志',
    voice_training: '嗓音训练',
    self_practice: '自我练习',
  },
  
  // 状态翻译
  status: {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  },
  
  // Self Test / Hospital Test
  appUsed: '使用的应用',
  fundamentalFrequency: '平均基频',
  'pitch.max': '最高音',
  'pitch.min': '最低音',
  'formants.f1': '第一共振峰 (F1)',
  'formants.f2': '第二共振峰 (F2)',
  'formants.f3': '第三共振峰 (F3)',
  jitter: '频率抖动 (Jitter)',
  shimmer: '振幅抖动 (Shimmer)',
  hnr: '谐噪比 (HNR)',
  sound: '声音状态',
  voicing: '发声方式',
  notes: '备注',
  location: '医院/诊所',
  equipmentUsed: '使用设备',
  
  // Surgery
  doctor: '手术医生',
  customDoctor: '医生（自定义）',
  customLocation: '地点（自定义）',
  
  // full_metrics
  'full_metrics.sustained.f0_mean': '持续音基频均值',
  'full_metrics.sustained.f0_sd': '持续音基频标准差',
  'full_metrics.sustained.hnr_db': '谐噪比',
  'full_metrics.sustained.jitter_local_percent': '局部频率抖动',
  'full_metrics.sustained.shimmer_local_percent': '局部振幅抖动',
  'full_metrics.sustained.mpt_s': '最长发声时间',
  'full_metrics.sustained.spl_dbA_est': '估算声压级',
  
  // ... 更多字段映射
};
```

#### formatters.js - 数值格式化

```javascript
/**
 * 格式化带单位的数值
 */
export const formatWithUnit = (value, unit, decimals = 1) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value;
  return `${num.toFixed(decimals)} ${unit}`;
};

/**
 * 格式化频率 (Hz)
 */
export const formatHz = (value) => formatWithUnit(value, 'Hz', 1);

/**
 * 格式化分贝 (dB)
 */
export const formatDb = (value) => formatWithUnit(value, 'dB', 1);

/**
 * 格式化百分比
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return value;
  // 如果值在 0-1 之间，转换为百分比
  if (num >= 0 && num <= 1) {
    return `${(num * 100).toFixed(0)}%`;
  }
  return `${num.toFixed(1)}%`;
};

/**
 * 格式化秒数
 */
export const formatSeconds = (value) => formatWithUnit(value, '秒', 1);

/**
 * 格式化日期时间
 */
export const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 格式化日期
 */
export const formatDate = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN');
};

/**
 * 字段格式化配置
 */
export const FIELD_FORMATTERS = {
  fundamentalFrequency: formatHz,
  'pitch.max': formatHz,
  'pitch.min': formatHz,
  'formants.f1': formatHz,
  'formants.f2': formatHz,
  'formants.f3': formatHz,
  jitter: formatPercent,
  shimmer: formatPercent,
  hnr: formatDb,
  
  // full_metrics
  'full_metrics.sustained.f0_mean': formatHz,
  'full_metrics.sustained.f0_sd': formatHz,
  'full_metrics.sustained.hnr_db': formatDb,
  'full_metrics.sustained.jitter_local_percent': formatPercent,
  'full_metrics.sustained.shimmer_local_percent': formatPercent,
  'full_metrics.sustained.mpt_s': formatSeconds,
  'full_metrics.sustained.spl_dbA_est': (v) => formatWithUnit(v, 'dB(A)', 1),
  
  // 时间戳
  date: formatDate,
  createdAt: formatDateTime,
  updatedAt: formatDateTime,
  
  // ... 更多格式化器
};
```

---

## 展示层级设计

### Self Test 事件展示结构

```
┌─────────────────────────────────────────┐
│ 📊 核心指标（卡片展示）                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│  │ 基频    │ │ 音域    │ │ 谐噪比   │    │
│  │ 203 Hz  │ │ 228-439 │ │ 19.1 dB │    │
│  └─────────┘ └─────────┘ └─────────┘    │
├─────────────────────────────────────────┤
│ 📋 基本信息                              │
│  • 使用应用: VFS Tracker Online Analysis │
│  • 事件日期: 2025-08-30                   │
│  • 声音状态: 好                           │
│  • 发声方式: 夹了                         │
├─────────────────────────────────────────┤
│ ▶ 共振峰数据 (点击展开)                   │
│  • F1: 622.6 Hz                         │
│  • F2: 2073.0 Hz                        │
│  • F3: 3205.0 Hz                        │
├─────────────────────────────────────────┤
│ ▶ 嗓音质量指标 (点击展开)                 │
│  • Jitter: 0.64%                        │
│  • Shimmer: 3.98%                       │
│  • HNR: 19.1 dB                         │
├─────────────────────────────────────────┤
│ ▶ 完整分析数据 (点击展开)                 │
│   ├─ 持续元音测试                        │
│   │   • 基频均值: 345.6 Hz               │
│   │   • 最长发声时间: 3.82 秒            │
│   │   • ...                             │
│   ├─ 朗读测试                            │
│   │   • 基频均值: 205.9 Hz               │
│   │   • 朗读时长: 60.2 秒                │
│   │   • ...                             │
│   ├─ 自发语音测试                        │
│   └─ 问卷结果                            │
│       • RBH: R=2, B=1, H=2              │
│       • OVHS-9: 17                       │
│       • TVQ-G: 17 (35%)                  │
├─────────────────────────────────────────┤
│ 📎 附件 (1)                              │
│  • voice_test_report.pdf [下载]          │
└─────────────────────────────────────────┘
```

### Surgery 事件展示结构

```
┌─────────────────────────────────────────┐
│ 🏥 手术信息                              │
│  ┌─────────────────────────────────┐    │
│  │ 医生: 李革临                     │    │
│  │ 地点: 友谊医院                   │    │
│  │ 日期: 2025-09-09                │    │
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│ 📝 备注                                  │
│  (无)                                    │
└─────────────────────────────────────────┘
```

---

## 实现优先级

### Phase 1: 基础框架 ✅
1. 创建 `fieldLabels.js` - 核心字段映射
2. 创建 `formatters.js` - 数值格式化
3. 创建 `FieldRow.jsx` - 基础展示组件

### Phase 2: 类型模板
1. `SurgeryDetails.jsx` - 最简单，先实现
2. `FeelingLogDetails.jsx` - 简单
3. `HospitalTestDetails.jsx` - 中等复杂度
4. `SelfTestDetails.jsx` - 最复杂，需要处理 full_metrics

### Phase 3: 共享组件
1. `MetricCard.jsx` - 核心指标卡片
2. `CollapsibleSection.jsx` - 可折叠区域
3. `AttachmentList.jsx` - 附件列表

### Phase 4: 集成
1. 创建 `EventDetailsPanel.jsx` 统一入口
2. 修改 `EventManager.jsx` 使用新组件
3. 修改 `InteractiveTimeline.jsx` 使用新组件

---

## TODO

- [ ] 创建 fieldLabels.js
- [ ] 创建 formatters.js
- [ ] 创建 FieldRow.jsx
- [ ] 创建 SurgeryDetails.jsx
- [ ] 创建 FeelingLogDetails.jsx
- [ ] 创建 HospitalTestDetails.jsx
- [ ] 创建 SelfTestDetails.jsx
- [ ] 创建 MetricCard.jsx
- [ ] 创建 CollapsibleSection.jsx
- [ ] 创建 AttachmentList.jsx
- [ ] 创建 EventDetailsPanel.jsx
- [ ] 集成到 EventManager.jsx
- [ ] 集成到 InteractiveTimeline.jsx
- [ ] 编写单元测试
- [ ] 清理临时文件

---

## 变更记录

- 2025-12-03: 初始版本，完成字段分析和方案设计
