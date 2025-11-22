/**
 * @file VFS Tracker 数据 Schema 定义
 * @description 基于 docs/data_structures_updated.md 和 docs/API_Gateway_Documentation.md
 * 使用 Joi 定义所有数据结构的验证规则，用于：
 * 1. 测试中校验 mock 数据的正确性
 * 2. 契约测试中校验真实 API 响应
 * 3. （可选）前端运行时数据校验
 */

import Joi from 'joi';

// ==================== 基础类型定义 ====================

/**
 * ISO 8601 格式的日期时间字符串
 */
export const isoDateString = Joi.string()
  .isoDate()
  .description('ISO 8601 格式的日期时间字符串');

/**
 * 用户 ID（Cognito sub）
 */
export const userId = Joi.string()
  .pattern(/^[a-z0-9-]+:[a-z0-9-]+$/i)
  .description('Cognito 用户 ID (us-east-1:xxx)');

/**
 * 事件 ID
 */
export const eventId = Joi.string()
  .min(1)
  .description('事件唯一标识符');

/**
 * 会话 ID（UUID）
 */
export const sessionId = Joi.string()
  .uuid()
  .description('测试会话 UUID');

// ==================== User Profile Schemas ====================

/**
 * 社交账号 Schema
 */
export const socialAccountSchema = Joi.object({
  platform: Joi.string()
    .required()
    .description('社交平台名称，如 Twitter, Weibo'),
  handle: Joi.string()
    .required()
    .description('用户名或 Handle'),
}).description('社交账号对象');

/**
 * 用户资料 Schema
 */
export const profileSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .description('用户显示名称'),
  nickname: Joi.string()
    .required()
    .min(1)
    .description('用户昵称，与 Cognito 同步'),
  bio: Joi.string()
    .allow('', null)
    .optional()
    .description('用户自我介绍（预留字段）'),
  avatarUrl: Joi.string()
    .uri()
    .allow('', null)
    .optional()
    .description('用户头像 URL'),
  avatarKey: Joi.string()
    .allow('', null)
    .optional()
    .description('用户头像在 S3 中的对象键，用于生成临时访问 URL'),
  isNamePublic: Joi.boolean()
    .required()
    .description('是否公开用户名称'),
  areSocialsPublic: Joi.boolean()
    .required()
    .description('是否公开社交账号'),
  socials: Joi.array()
    .items(socialAccountSchema)
    .optional()
    .description('社交账号列表'),
}).description('用户个人资料');

/**
 * 完整用户对象 Schema
 */
export const userSchema = Joi.object({
  userId: userId.required(),
  email: Joi.string()
    .email()
    .required()
    .description('用户邮箱，与 Cognito 同步'),
  profile: profileSchema.required(),
  createdAt: isoDateString.required(),
  updatedAt: isoDateString.required(),
}).description('用户对象');

// ==================== Event Schemas ====================

/**
 * 附件 Schema（私有字段）
 */
export const attachmentSchema = Joi.object({
  fileUrl: Joi.string()
    .required()
    .description('S3 对象键，格式：attachments/{userId}/{eventId}/{filename}'),
  fileType: Joi.string()
    .optional()
    .description('MIME 类型，如 application/pdf'),
  fileName: Joi.string()
    .optional()
    .description('原始文件名'),
}).description('附件对象（私有）');

/**
 * 事件类型枚举
 * 注意: 同时支持下划线和连字符格式,用于向后兼容旧数据
 * TODO: Phase 3.2数据迁移后移除连字符格式
 */
export const eventTypeEnum = Joi.string()
  .valid(
    // 规范格式 (下划线)
    'self_test',
    'hospital_test',
    'voice_training',
    'self_practice',
    'surgery',
    'feeling_log',
    // 旧格式兼容 (连字符) - 数据库中存在
    'self-test',
    'hospital-test',
    'voice-training',
    'self-practice',  // 这个两种格式相同
    'feeling-log'
  )
  .description('事件类型 (支持下划线和连字符格式)');

/**
 * 事件状态枚举
 */
export const eventStatusEnum = Joi.string()
  .valid('pending', 'approved', 'rejected')
  .description('事件状态');

// ==================== Event Details Schemas ====================

/**
 * 共振峰对象 Schema
 */
const formantsSchema = Joi.object({
  f1: Joi.number().optional().description('第一共振峰 (Hz)'),
  f2: Joi.number().optional().description('第二共振峰 (Hz)'),
  f3: Joi.number().optional().description('第三共振峰 (Hz)'),
}).optional();

/**
 * 音域对象 Schema
 */
const pitchSchema = Joi.object({
  min: Joi.number().optional().description('最低音 (Hz)'),
  max: Joi.number().optional().description('最高音 (Hz)'),
}).optional();

/**
 * full_metrics 中的共振峰详细数据 Schema
 */
const formantDetailSchema = Joi.object({
  F1: Joi.number().optional(),
  F2: Joi.number().optional(),
  F3: Joi.number().optional(),
  B1: Joi.number().optional(),
  B2: Joi.number().optional(),
  B3: Joi.number().optional(),
  F1_available: Joi.boolean().optional(),
  F2_available: Joi.boolean().optional(),
  best_segment_time: Joi.number().optional(),
  f0_mean: Joi.number().optional(),
  is_high_pitch: Joi.boolean().optional(),
  reason: Joi.string().allow('').optional(),
  source_file: Joi.string().optional(),
  spl_dbA_est: Joi.number().optional(),
  error_details: Joi.string().allow('').optional(),
}).optional();

/**
 * 语音测试统计数据 Schema
 */
const speechStatsSchema = Joi.object({
  duration_s: Joi.number().optional(),
  f0_mean: Joi.number().optional(),
  f0_sd: Joi.number().optional(),
  f0_stats: Joi.object({
    median: Joi.number().optional(),
    p10: Joi.number().optional(),
    p90: Joi.number().optional(),
  }).optional(),
  pause_count: Joi.number().optional(),
  voiced_ratio: Joi.number().min(0).max(1).optional(),
}).optional();

/**
 * Self Test 详细信息 Schema（最复杂）
 */
const selfTestDetailsSchema = Joi.object({
  // 顶层简化指标
  fundamentalFrequency: Joi.number().optional().description('平均基频 (Hz)'),
  pitch: pitchSchema,
  formants: formantsSchema,
  hnr: Joi.number().optional().description('谐噪比 (dB)'),
  jitter: Joi.number().optional().description('基频抖动 (%)'),
  shimmer: Joi.number().optional().description('振幅抖动 (%)'),
  notes: Joi.string().allow('').optional().description('用户备注'),
  appUsed: Joi.string().optional().description('使用的应用'),
  
  // 多选字段
  sound: Joi.array()
    .items(Joi.string().valid('好', '喉咙中有痰', '其他'))
    .optional()
    .description('声音状态'),
  voicing: Joi.array()
    .items(Joi.string().valid('夹了', '没夹', '其他'))
    .optional()
    .description('发声方式'),
  customSoundDetail: Joi.string().allow('').optional().description('自定义声音状态'),
  customVoicingDetail: Joi.string().allow('').optional().description('自定义发声方式'),
  
  // full_metrics - 非常复杂的嵌套结构
  full_metrics: Joi.object({
    formants_high: formantDetailSchema,
    formants_low: formantDetailSchema,
    
    // questionnaires
    questionnaires: Joi.object({
      'OVHS-9 Total': Joi.number().optional(),
      'TVQ-G Total': Joi.number().optional(),
      'TVQ-G Percent': Joi.string().optional(),
      RBH: Joi.object({
        R: Joi.number().optional(),
        B: Joi.number().optional(),
        H: Joi.number().optional(),
      }).optional(),
    }).optional(),
    
    // reading
    reading: speechStatsSchema,
    
    // spontaneous
    spontaneous: speechStatsSchema,
    
    // sustained
    sustained: Joi.object({
      f0_mean: Joi.number().optional(),
      f0_sd: Joi.number().optional(),
      hnr_db: Joi.number().optional(),
      jitter_local_percent: Joi.number().optional(),
      shimmer_local_percent: Joi.number().optional(),
      mpt_s: Joi.number().optional(),
      spl_dbA_est: Joi.number().optional(),
      formant_analysis_failed: Joi.boolean().optional(),
      formant_analysis_reason_high: Joi.string().allow('').optional(),
      formant_analysis_reason_low: Joi.string().allow('').optional(),
      formant_analysis_reason_sustained: Joi.string().allow('').optional(),
      formants_high: formantDetailSchema,
      formants_low: formantDetailSchema,
      formants_sustained: formantDetailSchema,
    }).optional(),
    
    // vrp (Voice Range Profile)
    vrp: Joi.object({
      f0_min: Joi.number().optional(),
      f0_max: Joi.number().optional(),
      spl_min: Joi.number().optional(),
      spl_max: Joi.number().optional(),
      error: Joi.string().allow('').optional(),
      bins: Joi.array().items(Joi.object({
        f0_center_hz: Joi.number().optional(),
        semi: Joi.number().optional(),
        spl_min: Joi.number().optional(),
        spl_max: Joi.number().optional(),
        spl_mean: Joi.number().optional(),
        count: Joi.number().optional(),
      })).optional(),
    }).optional(),
  }).optional().unknown(true), // 允许未知字段以向后兼容
}).unknown(true); // 允许未知字段

/**
 * Hospital Test 详细信息 Schema
 */
const hospitalTestDetailsSchema = selfTestDetailsSchema.keys({
  location: Joi.string().required().description('医院或诊所名称'),
  equipmentUsed: Joi.string().optional().description('使用的医疗设备'),
});

/**
 * Voice Training 详细信息 Schema
 */
const voiceTrainingDetailsSchema = Joi.object({
  trainingContent: Joi.string().optional().description('训练内容'),
  instructor: Joi.string().optional().description('指导者姓名'),
  voiceStatus: Joi.string().optional().description('嗓音状态'),
  selfPracticeContent: Joi.string().optional().description('自我练习作业'),
  feelings: Joi.string().optional().description('感受记录'),
  references: Joi.string().optional().description('参考资料'),
  voicing: Joi.string().optional().description('发声方式（单选）'),
}).unknown(true);

/**
 * Self Practice 详细信息 Schema
 */
const selfPracticeDetailsSchema = Joi.object({
  practiceContent: Joi.string().optional().description('练习内容'),
  hasInstructor: Joi.boolean().optional().description('是否有指导者'),
  instructor: Joi.string().optional().description('指导者姓名'),
  voiceStatus: Joi.string().optional().description('嗓音状态'),
  feelings: Joi.string().optional().description('感受记录'),
  references: Joi.string().optional().description('参考资料'),
  voicing: Joi.string().optional().description('发声方式（单选）'),
}).unknown(true);

/**
 * Surgery 详细信息 Schema
 */
const surgeryDetailsSchema = Joi.object({
  location: Joi.string()
    .valid('友谊医院', '南京同仁医院', 'Yeson', 'Kamol', '京都耳鼻咽喉科医院', '自定义')
    .required()
    .description('手术地点'),
  customLocation: Joi.string()
    .when('location', {
      is: '自定义',
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('自定义手术地点'),
  doctor: Joi.string()
    .valid('李革临', '金亨泰', '何双八', 'Kamol', '田边正博', '自定义')
    .required()
    .description('手术医生'),
  customDoctor: Joi.string()
    .when('doctor', {
      is: '自定义',
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .description('自定义医生姓名'),
  notes: Joi.string().allow('').optional().description('手术备注'),
}).unknown(true);

/**
 * Feeling Log 详细信息 Schema
 * 注意: 支持多种字段名(content, feeling, note)用于兼容不同数据格式
 * TODO: Phase 3.2 统一为content字段
 */
const feelingLogDetailsSchema = Joi.object({
  // 规范字段
  content: Joi.string().min(1).description('感受记录内容'),
  // 旧格式兼容
  feeling: Joi.string().min(1).description('心情（旧格式）'),
  note: Joi.string().allow('').description('备注（旧格式）'),
})
  .or('content', 'feeling')  // 至少需要其中一个
  .unknown(true);

// ==================== Event Base Schema ====================

/**
 * 事件基础 Schema（不含 details）
 */
const eventBaseSchema = Joi.object({
  userId: userId.required(),
  eventId: eventId.required(),
  type: eventTypeEnum.required(),
  date: isoDateString.required(),
  status: eventStatusEnum.required(),
  createdAt: isoDateString.required(),
  updatedAt: isoDateString.required(),
});

/**
 * 私有事件 Schema（包含 attachments）
 */
export const eventSchemaPrivate = eventBaseSchema.keys({
  details: Joi.alternatives().conditional('type', [
    { is: 'self_test', then: selfTestDetailsSchema },
    { is: 'hospital_test', then: hospitalTestDetailsSchema },
    { is: 'voice_training', then: voiceTrainingDetailsSchema },
    { is: 'self_practice', then: selfPracticeDetailsSchema },
    { is: 'surgery', then: surgeryDetailsSchema },
    { is: 'feeling_log', then: feelingLogDetailsSchema },
  ]).required(),
  attachments: Joi.array().items(attachmentSchema).optional(),
}).description('私有事件对象（包含 attachments）');

/**
 * 公共事件 Schema（不含 attachments、status、updatedAt，增加 userName）
 * 公共 API 返回的事件字段较少，适用于社区展示
 */
export const eventSchemaPublic = Joi.object({
  // 基础字段（公共 API 返回的）
  // 注意：userId 使用更宽松的验证，因为历史数据可能没有 region 前缀
  userId: Joi.string().required().description('用户 ID（可能是 Cognito 格式或纯 UUID）'),
  eventId: eventId.required(),
  type: eventTypeEnum.required(),
  date: isoDateString.required(),
  createdAt: isoDateString.required(),
  userName: Joi.string().required().description('公开的用户名或"（非公开）"'),
  
  // details 根据 type 动态验证
  details: Joi.alternatives().conditional('type', [
    { is: 'self_test', then: selfTestDetailsSchema },
    { is: 'hospital_test', then: hospitalTestDetailsSchema },
    { is: 'voice_training', then: voiceTrainingDetailsSchema },
    { is: 'self_practice', then: selfPracticeDetailsSchema },
    { is: 'surgery', then: surgeryDetailsSchema },
    { is: 'feeling_log', then: feelingLogDetailsSchema },
  ]).required(),
  
  // 注意：公共事件不包含 status、updatedAt、attachments
}).description('公共事件对象（用于 GET /all-events）');

// ==================== Test Session Schemas ====================

/**
 * 图表对象 Schema
 */
const chartsSchema = Joi.object({
  formant: Joi.string().optional().description('共振峰图表 S3 路径'),
  formant_spl_spectrum: Joi.string().optional().description('共振峰声压级频谱图 S3 路径'),
  timeSeries: Joi.string().optional().description('时间序列图 S3 路径'),
  vrp: Joi.string().optional().description('声域图 S3 路径'),
}).optional();

/**
 * 测试指标 Schema（复用 full_metrics 结构）
 */
const metricsSchema = Joi.object({
  dsi: Joi.number().optional().description('声音障碍指数（预留）'),
  formants_high: formantDetailSchema,
  formants_low: formantDetailSchema,
  questionnaires: Joi.object().optional().unknown(true),
  reading: speechStatsSchema,
  spontaneous: speechStatsSchema,
  sustained: Joi.object().optional().unknown(true),
  vrp: Joi.object().optional().unknown(true),
}).optional().unknown(true);

/**
 * 测试会话 Schema
 */
export const testSessionSchema = Joi.object({
  sessionId: sessionId.required(),
  userId: userId.required(),
  status: Joi.string()
    .valid('created', 'processing', 'done', 'failed')
    .required()
    .description('测试状态'),
  createdAt: Joi.alternatives()
    .try(Joi.number(), isoDateString)
    .required()
    .description('创建时间'),
  updatedAt: Joi.alternatives()
    .try(Joi.number(), isoDateString)
    .optional()
    .description('更新时间'),
  metrics: metricsSchema,
  charts: chartsSchema,
  reportPdf: Joi.string().optional().description('报告 PDF S3 路径'),
  errorMessage: Joi.string().optional().description('错误信息'),
  calibration: Joi.object().optional().unknown(true).description('校准信息（预留）'),
  forms: Joi.object().optional().unknown(true).description('表单数据（预留）'),
  tests: Joi.array().optional().description('测试列表（预留）'),
}).description('测试会话对象');

// ==================== API Response Schemas ====================

/**
 * GET /all-events 响应 Schema
 */
export const getAllEventsResponseSchema = Joi.array()
  .items(eventSchemaPublic)
  .description('GET /all-events 响应');

/**
 * GET /events/{userId} 响应 Schema
 */
export const getUserEventsResponseSchema = Joi.object({
  events: Joi.array().items(eventSchemaPrivate).required(),
  debug: Joi.object().optional().unknown(true),
}).description('GET /events/{userId} 响应');

/**
 * POST /events 请求 Schema
 */
export const addEventRequestSchema = Joi.object({
  type: eventTypeEnum.required(),
  date: isoDateString.required(),
  details: Joi.object().required(),
  attachments: Joi.array().items(attachmentSchema).optional(),
}).description('POST /events 请求体');

/**
 * POST /events 响应 Schema
 */
export const addEventResponseSchema = Joi.object({
  message: Joi.string().required(),
  eventId: eventId.required(),
}).description('POST /events 响应');

/**
 * GET /profile/{userId} 响应 Schema
 */
export const getUserProfileResponseSchema = userSchema
  .description('GET /profile/{userId} 响应');

/**
 * PUT /profile/{userId} 请求 Schema
 */
export const updateUserProfileRequestSchema = Joi.object({
  profile: profileSchema.required(),
}).description('PUT /profile/{userId} 请求体');

/**
 * PUT /profile/{userId} 响应 Schema
 */
export const updateUserProfileResponseSchema = Joi.object({
  message: Joi.string().required(),
  profile: profileSchema.required(),
}).description('PUT /profile/{userId} 响应');

// ==================== 导出所有 Schemas ====================

/**
 * 统一导出对象，方便测试使用
 */
export const schemas = {
  // 基础类型
  isoDateString,
  userId,
  eventId,
  sessionId,
  
  // 用户相关
  user: userSchema,
  profile: profileSchema,
  socialAccount: socialAccountSchema,
  
  // 事件相关
  attachment: attachmentSchema,
  eventPrivate: eventSchemaPrivate,
  eventPublic: eventSchemaPublic,
  
  // 事件详情
  selfTestDetails: selfTestDetailsSchema,
  hospitalTestDetails: hospitalTestDetailsSchema,
  voiceTrainingDetails: voiceTrainingDetailsSchema,
  selfPracticeDetails: selfPracticeDetailsSchema,
  surgeryDetails: surgeryDetailsSchema,
  feelingLogDetails: feelingLogDetailsSchema,
  
  // 测试会话
  testSession: testSessionSchema,
  
  // API 请求/响应
  getAllEventsResponse: getAllEventsResponseSchema,
  getUserEventsResponse: getUserEventsResponseSchema,
  addEventRequest: addEventRequestSchema,
  addEventResponse: addEventResponseSchema,
  getUserProfileResponse: getUserProfileResponseSchema,
  updateUserProfileRequest: updateUserProfileRequestSchema,
  updateUserProfileResponse: updateUserProfileResponseSchema,
};

/**
 * 辅助函数：校验数据并返回友好的错误信息
 */
export function validateData(schema, data, options = {}) {
  const result = schema.validate(data, {
    abortEarly: false,
    allowUnknown: true,
    ...options,
  });
  
  if (result.error) {
    const errors = result.error.details.map(detail => ({
      path: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));
    
    return {
      valid: false,
      errors,
      value: result.value,
    };
  }
  
  return {
    valid: true,
    value: result.value,
  };
}
