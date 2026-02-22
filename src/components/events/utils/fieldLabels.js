/**
 * 事件字段中文标签映射
 * 用于将 DynamoDB 中的英文字段名转换为用户友好的中文显示
 */

/**
 * 事件类型中文名称映射
 */
export const EVENT_TYPE_LABELS = {
  self_test: '自我测试',
  'self-test': '自我测试',
  hospital_test: '医院检测',
  surgery: 'VFS 手术',
  feeling_log: '感受日志',
  'feeling-log': '感受日志',
  voice_training: '嗓音训练',
  self_practice: '自我练习',
};

/**
 * 事件状态中文名称映射
 */
export const STATUS_LABELS = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

/**
 * 基础字段中文标签
 */
export const BASE_FIELD_LABELS = {
  date: '事件日期',
  status: '审核状态',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  type: '事件类型',
  notes: '备注',
  attachments: '附件',
};

/**
 * Self Test / Hospital Test 共有字段标签
 */
export const VOICE_TEST_LABELS = {
  // 基本信息
  appUsed: '使用的应用',
  location: '医院/诊所',
  equipmentUsed: '使用设备',
  
  // 核心指标
  fundamentalFrequency: '平均基频',
  'pitch.max': '最高音',
  'pitch.min': '最低音',
  
  // 共振峰
  'formants.f1': '第一共振峰 (F1)',
  'formants.f2': '第二共振峰 (F2)',
  'formants.f3': '第三共振峰 (F3)',
  
  // 嗓音质量
  jitter: '频率抖动 (Jitter)',
  shimmer: '振幅抖动 (Shimmer)',
  hnr: '谐噪比 (HNR)',
  
  // 状态选项
  sound: '声音状态',
  voicing: '发声方式',
  customSoundDetail: '声音状态详情',
  customVoicingDetail: '发声方式详情',
};

/**
 * Surgery 手术记录字段标签
 */
export const SURGERY_LABELS = {
  doctor: '手术医生',
  customDoctor: '医生（自定义）',
  location: '手术地点',
  customLocation: '地点（自定义）',
  notes: '手术备注',
};

/**
 * Feeling Log 感受日志字段标签
 */
export const FEELING_LOG_LABELS = {
  content: '感受内容',
  feeling: '感受',
  note: '备注',
};

/**
 * Voice Training 嗓音训练字段标签
 */
export const VOICE_TRAINING_LABELS = {
  trainingContent: '训练内容',
  selfPracticeContent: '自练作业',
  voiceStatus: '嗓音状态',
  voicing: '发声方式',
  references: '参考资料',
  feelings: '感受',
  instructor: '指导者',
};

/**
 * Self Practice 自我练习字段标签
 */
export const SELF_PRACTICE_LABELS = {
  practiceContent: '练习内容',
  hasInstructor: '有指导者',
  instructor: '指导者姓名',
  voiceStatus: '嗓音状态',
  voicing: '发声方式',
  references: '参考资料',
  feelings: '感受',
};

/**
 * full_metrics 完整分析指标标签
 */
export const FULL_METRICS_LABELS = {
  // 持续元音 (sustained)
  'sustained.f0_mean': '持续音基频均值',
  'sustained.f0_sd': '持续音基频标准差',
  'sustained.hnr_db': '谐噪比',
  'sustained.jitter_local_percent': '局部频率抖动',
  'sustained.shimmer_local_percent': '局部振幅抖动',
  'sustained.mpt_s': '最长发声时间',
  'sustained.spl_dbA_est': '估算声压级',
  
  // 朗读测试 (reading)
  'reading.f0_mean': '朗读基频均值',
  'reading.f0_sd': '朗读基频标准差',
  'reading.duration_s': '朗读时长',
  'reading.voiced_ratio': '浊音比例',
  'reading.pause_count': '停顿次数',
  'reading.f0_stats.median': '基频中位数',
  'reading.f0_stats.p10': '基频 P10',
  'reading.f0_stats.p90': '基频 P90',
  
  // 自发语音 (spontaneous)
  'spontaneous.f0_mean': '自发语音基频均值',
  'spontaneous.f0_sd': '自发语音基频标准差',
  'spontaneous.duration_s': '自发语音时长',
  'spontaneous.voiced_ratio': '浊音比例',
  'spontaneous.pause_count': '停顿次数',
  'spontaneous.f0_stats.median': '基频中位数',
  'spontaneous.f0_stats.p10': '基频 P10',
  'spontaneous.f0_stats.p90': '基频 P90',
  
  // 声域图 (VRP)
  'vrp.f0_min': '最低音高',
  'vrp.f0_max': '最高音高',
  'vrp.spl_min': '最小声压',
  'vrp.spl_max': '最大声压',
  
  // 问卷 (questionnaires)
  'questionnaires.RBH.R': '粗糙度 (R)',
  'questionnaires.RBH.B': '气息音 (B)',
  'questionnaires.RBH.H': '嘶哑度 (H)',
  'questionnaires.OVHS-9 Total': 'OVHS-9 总分',
  'questionnaires.TVQ-G Total': 'TVQ-G 总分',
  'questionnaires.TVQ-G Percent': 'TVQ-G 百分比',
};

/**
 * 共振峰相关字段标签
 */
export const FORMANT_LABELS = {
  F1: '第一共振峰 (F1)',
  F2: '第二共振峰 (F2)',
  F3: '第三共振峰 (F3)',
  B1: 'F1 带宽',
  B2: 'F2 带宽',
  B3: 'F3 带宽',
  F1_available: 'F1 有效',
  F2_available: 'F2 有效',
  f0_mean: '基频均值',
  spl_dbA_est: '声压级',
  is_high_pitch: '高音',
  reason: '分析状态',
  best_segment_time: '最佳片段时间',
  error_details: '错误详情',
};

/**
 * 分析区域中文名称
 */
export const ANALYSIS_SECTION_LABELS = {
  sustained: '持续元音测试',
  reading: '朗读测试',
  spontaneous: '自发语音测试',
  vrp: '声域图 (VRP)',
  questionnaires: '问卷结果',
  formants_sustained: '持续音共振峰',
  formants_high: '高音共振峰',
  formants_low: '低音共振峰',
};

/**
 * 获取字段的中文标签
 * @param {string} fieldPath - 字段路径，如 'fundamentalFrequency' 或 'full_metrics.sustained.f0_mean'
 * @returns {string} 中文标签，如果找不到则返回原字段名
 */
export const getFieldLabel = (fieldPath) => {
  // 尝试从各个标签映射中查找
  const allLabels = {
    ...BASE_FIELD_LABELS,
    ...VOICE_TEST_LABELS,
    ...SURGERY_LABELS,
    ...FEELING_LOG_LABELS,
    ...VOICE_TRAINING_LABELS,
    ...SELF_PRACTICE_LABELS,
  };
  
  if (allLabels[fieldPath]) {
    return allLabels[fieldPath];
  }
  
  // 处理 full_metrics 路径
  if (fieldPath.startsWith('full_metrics.')) {
    const subPath = fieldPath.replace('full_metrics.', '');
    if (FULL_METRICS_LABELS[subPath]) {
      return FULL_METRICS_LABELS[subPath];
    }
  }
  
  // 处理共振峰字段
  if (FORMANT_LABELS[fieldPath]) {
    return FORMANT_LABELS[fieldPath];
  }
  
  // 返回原字段名（转换驼峰为空格分隔）
  return fieldPath
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/**
 * 获取事件类型的中文名称
 * @param {string} type - 事件类型
 * @returns {string} 中文名称
 */
export const getEventTypeLabel = (type) => {
  return EVENT_TYPE_LABELS[type] || type;
};

/**
 * 获取状态的中文名称
 * @param {string} status - 状态值
 * @returns {string} 中文名称
 */
export const getStatusLabel = (status) => {
  return STATUS_LABELS[status] || status;
};
