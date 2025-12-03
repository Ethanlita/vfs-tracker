/**
 * 事件字段数值格式化工具
 * 用于将原始数值转换为带单位的用户友好显示格式
 */

/**
 * 格式化带单位的数值
 * @param {number|string} value - 数值
 * @param {string} unit - 单位
 * @param {number} decimals - 小数位数，默认 1
 * @returns {string} 格式化后的字符串
 */
export const formatWithUnit = (value, unit, decimals = 1) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return `${num.toFixed(decimals)} ${unit}`;
};

/**
 * 格式化频率 (Hz)
 * @param {number|string} value - 频率值
 * @returns {string} 格式化后的字符串，如 "203.1 Hz"
 */
export const formatHz = (value) => formatWithUnit(value, 'Hz', 1);

/**
 * 格式化分贝 (dB)
 * @param {number|string} value - 分贝值
 * @returns {string} 格式化后的字符串，如 "19.1 dB"
 */
export const formatDb = (value) => formatWithUnit(value, 'dB', 1);

/**
 * 格式化声压级 dB(A)
 * @param {number|string} value - 声压级值
 * @returns {string} 格式化后的字符串，如 "74.8 dB(A)"
 */
export const formatDbA = (value) => formatWithUnit(value, 'dB(A)', 1);

/**
 * 格式化百分比
 * @param {number|string} value - 百分比值（可能是 0-1 的小数或已经是百分比）
 * @returns {string} 格式化后的字符串，如 "48%"
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  
  // 如果已经是百分比字符串（如 "35%"），直接返回
  if (typeof value === 'string' && value.includes('%')) {
    return value;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  
  // 如果值在 0-1 之间，认为是小数形式的百分比，需要乘以 100
  if (num >= 0 && num <= 1) {
    return `${(num * 100).toFixed(0)}%`;
  }
  
  // 否则认为已经是百分比形式
  return `${num.toFixed(1)}%`;
};

/**
 * 格式化秒数
 * @param {number|string} value - 秒数
 * @returns {string} 格式化后的字符串，如 "3.82 秒"
 */
export const formatSeconds = (value) => formatWithUnit(value, '秒', 2);

/**
 * 格式化次数
 * @param {number|string} value - 次数
 * @returns {string} 格式化后的字符串，如 "97 次"
 */
export const formatCount = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return String(value);
  return `${num} 次`;
};

/**
 * 格式化日期时间
 * @param {string} isoString - ISO 8601 格式的时间字符串
 * @returns {string} 格式化后的字符串，如 "2025/08/30 18:00"
 */
export const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

/**
 * 格式化日期
 * @param {string} isoString - ISO 8601 格式的时间字符串
 * @returns {string} 格式化后的字符串，如 "2025/08/30"
 */
export const formatDate = (isoString) => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return isoString;
  }
};

/**
 * 格式化布尔值
 * @param {boolean} value - 布尔值
 * @returns {string} "是" 或 "否"
 */
export const formatBoolean = (value) => {
  if (value === null || value === undefined) return '-';
  return value ? '是' : '否';
};

/**
 * 格式化数组为逗号分隔的字符串
 * @param {Array} arr - 数组
 * @returns {string} 逗号分隔的字符串
 */
export const formatArray = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return '-';
  return arr.join('、');
};

/**
 * 格式化音域范围
 * @param {Object} pitch - 包含 max 和 min 的对象
 * @returns {string} 格式化后的字符串，如 "227.6 - 438.6 Hz"
 */
export const formatPitchRange = (pitch) => {
  if (!pitch || (pitch.min === undefined && pitch.max === undefined)) return '-';
  const min = pitch.min !== undefined ? parseFloat(pitch.min).toFixed(1) : '?';
  const max = pitch.max !== undefined ? parseFloat(pitch.max).toFixed(1) : '?';
  return `${min} - ${max} Hz`;
};

/**
 * 格式化共振峰数据
 * @param {Object} formants - 包含 f1, f2, f3 的对象
 * @returns {string} 格式化后的字符串
 */
export const formatFormants = (formants) => {
  if (!formants) return '-';
  const parts = [];
  if (formants.f1 !== undefined) parts.push(`F1: ${formatHz(formants.f1)}`);
  if (formants.f2 !== undefined) parts.push(`F2: ${formatHz(formants.f2)}`);
  if (formants.f3 !== undefined) parts.push(`F3: ${formatHz(formants.f3)}`);
  return parts.length > 0 ? parts.join(' | ') : '-';
};

/**
 * 格式化 RBH 评估
 * @param {Object} rbh - 包含 R, B, H 的对象
 * @returns {string} 格式化后的字符串，如 "R=2, B=1, H=2"
 */
export const formatRBH = (rbh) => {
  if (!rbh) return '-';
  const parts = [];
  if (rbh.R !== undefined) parts.push(`R=${rbh.R}`);
  if (rbh.B !== undefined) parts.push(`B=${rbh.B}`);
  if (rbh.H !== undefined) parts.push(`H=${rbh.H}`);
  return parts.length > 0 ? parts.join(', ') : '-';
};

/**
 * 自动格式化字段值
 * 根据字段路径自动选择合适的格式化函数
 * @param {string} fieldPath - 字段路径
 * @param {*} value - 字段值
 * @returns {string} 格式化后的字符串
 */
export const autoFormat = (fieldPath, value) => {
  // 空值处理
  if (value === null || value === undefined || value === '') return '-';
  
  // 根据字段路径确定格式化方式
  const path = fieldPath.toLowerCase();
  
  // 频率相关字段
  if (
    path.includes('frequency') ||
    path.includes('f0') ||
    path.includes('f1') ||
    path.includes('f2') ||
    path.includes('f3') ||
    path === 'pitch.max' ||
    path === 'pitch.min' ||
    path.includes('_hz')
  ) {
    return formatHz(value);
  }
  
  // 声压级相关字段
  if (path.includes('spl_dba')) {
    return formatDbA(value);
  }
  
  // 分贝相关字段
  if (path.includes('hnr') || path.includes('_db')) {
    return formatDb(value);
  }
  
  // 百分比相关字段
  if (
    path.includes('jitter') ||
    path.includes('shimmer') ||
    path.includes('percent') ||
    path === 'ratio' ||
    path.endsWith('_ratio') ||
    path.endsWith('.ratio')
  ) {
    return formatPercent(value);
  }
  
  // 时长相关字段
  if (path.includes('duration') || path.includes('mpt_s') || path.includes('_s')) {
    return formatSeconds(value);
  }
  
  // 次数相关字段
  if (path.includes('count')) {
    return formatCount(value);
  }
  
  // 时间戳字段
  if (path.includes('createdat') || path.includes('updatedat')) {
    return formatDateTime(value);
  }
  
  // 日期字段
  if (path === 'date') {
    return formatDate(value);
  }
  
  // 布尔值
  if (typeof value === 'boolean') {
    return formatBoolean(value);
  }
  
  // 数组
  if (Array.isArray(value)) {
    return formatArray(value);
  }
  
  // 对象 - 特殊处理
  if (typeof value === 'object') {
    // pitch 对象
    if (value.max !== undefined || value.min !== undefined) {
      return formatPitchRange(value);
    }
    // formants 对象
    if (value.f1 !== undefined || value.f2 !== undefined) {
      return formatFormants(value);
    }
    // RBH 对象
    if (value.R !== undefined || value.B !== undefined) {
      return formatRBH(value);
    }
    // 其他对象返回 JSON
    return JSON.stringify(value);
  }
  
  // 默认返回原值
  return String(value);
};

/**
 * 安全地获取嵌套对象的值
 * @param {Object} obj - 对象
 * @param {string} path - 路径，如 'full_metrics.sustained.f0_mean'
 * @param {*} defaultValue - 默认值
 * @returns {*} 字段值或默认值
 */
export const getNestedValue = (obj, path, defaultValue = undefined) => {
  if (!obj || !path) return defaultValue;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
};
