/**
 * @file SSM Parameter Store 操作服务
 * 封装管理员页面所需的 SSM 操作
 */

import { 
  GetParametersCommand,
  PutParameterCommand
} from '@aws-sdk/client-ssm';

/**
 * SSM 参数路径常量
 */
export const SSM_PATHS = {
  // 速率限制参数
  RATE_LIMIT_PREFIX: '/vfs-tracker/rate-limit',
  ADVICE_WINDOW_HOURS: '/vfs-tracker/rate-limit/advice-window-hours',
  ADVICE_MAX_REQUESTS: '/vfs-tracker/rate-limit/advice-max-requests',
  SONG_WINDOW_HOURS: '/vfs-tracker/rate-limit/song-window-hours',
  SONG_MAX_REQUESTS: '/vfs-tracker/rate-limit/song-max-requests',
};

/** 四项限速配置的唯一前端字段规则，页面输入与 SSM 写入共用。 */
export const RATE_LIMIT_FIELDS = {
  adviceWindowHours: { path: SSM_PATHS.ADVICE_WINDOW_HOURS, label: 'AI 建议时间窗口', min: 1, max: 168 },
  adviceMaxRequests: { path: SSM_PATHS.ADVICE_MAX_REQUESTS, label: 'AI 建议最大请求次数', min: 1, max: 100 },
  songWindowHours: { path: SSM_PATHS.SONG_WINDOW_HOURS, label: '歌曲推荐时间窗口', min: 1, max: 168 },
  songMaxRequests: { path: SSM_PATHS.SONG_MAX_REQUESTS, label: '歌曲推荐最大请求次数', min: 1, max: 100 },
};

/**
 * 校验限速配置，不把空值、小数或越界值转换成另一数字。
 * @param {object} config - 待校验配置
 * @returns {Record<string, string>} 按字段返回的中文错误
 */
export function validateRateLimitConfig(config, { partial = false } = {}) {
  const errors = {};
  for (const [key, rule] of Object.entries(RATE_LIMIT_FIELDS)) {
    const raw = config?.[key];
    if (partial && raw === undefined) continue;
    if (raw === '' || raw === null || raw === undefined) {
      errors[key] = `请填写${rule.label}`;
      continue;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      errors[key] = `${rule.label}必须是整数`;
    } else if (value < rule.min || value > rule.max) {
      errors[key] = `${rule.label}必须在 ${rule.min} 到 ${rule.max} 之间`;
    }
  }
  return errors;
}

/** 返回经过校验的数值配置，非法配置直接拒绝读取或写入。 */
export function normalizeRateLimitConfig(config, options) {
  const errors = validateRateLimitConfig(config, options);
  if (Object.keys(errors).length) {
    const error = new Error(Object.values(errors).join('；'));
    error.name = 'RateLimitConfigError';
    error.fieldErrors = errors;
    throw error;
  }
  return Object.fromEntries(Object.keys(RATE_LIMIT_FIELDS)
    .filter(key => config?.[key] !== undefined)
    .map(key => [key, Number(config[key])]));
}

/**
 * 获取速率限制配置
 * @param {SSMClient} client - SSM 客户端
 * @returns {Promise<{adviceWindowHours: number, adviceMaxRequests: number, songWindowHours: number, songMaxRequests: number}>}
 */
export async function getRateLimitConfig(client) {
  const command = new GetParametersCommand({
    Names: [
      SSM_PATHS.ADVICE_WINDOW_HOURS,
      SSM_PATHS.ADVICE_MAX_REQUESTS,
      SSM_PATHS.SONG_WINDOW_HOURS,
      SSM_PATHS.SONG_MAX_REQUESTS,
    ],
  });

  const response = await client.send(command);

  // 默认配置
  const config = {
    adviceWindowHours: 24,
    adviceMaxRequests: 10,
    songWindowHours: 24,
    songMaxRequests: 10,
  };

  // 解析参数值
  for (const param of response.Parameters || []) {
    const value = Number(param.Value);
    if (param.Name === SSM_PATHS.ADVICE_WINDOW_HOURS) {
      config.adviceWindowHours = value;
    } else if (param.Name === SSM_PATHS.ADVICE_MAX_REQUESTS) {
      config.adviceMaxRequests = value;
    } else if (param.Name === SSM_PATHS.SONG_WINDOW_HOURS) {
      config.songWindowHours = value;
    } else if (param.Name === SSM_PATHS.SONG_MAX_REQUESTS) {
      config.songMaxRequests = value;
    }
  }

  return normalizeRateLimitConfig(config);
}

/**
 * 更新单个速率限制参数
 * @param {SSMClient} client - SSM 客户端
 * @param {string} paramName - 参数名称
 * @param {number} value - 参数值
 * @returns {Promise<void>}
 */
export async function updateRateLimitParam(client, paramName, value) {
  const command = new PutParameterCommand({
    Name: paramName,
    Value: String(value),
    Type: 'String',
    Overwrite: true,
  });

  await client.send(command);
}

/**
 * 批量更新速率限制配置
 * @param {SSMClient} client - SSM 客户端
 * @param {object} config - 配置对象
 * @returns {Promise<void>}
 */
export async function updateRateLimitConfig(client, config) {
  const validConfig = normalizeRateLimitConfig(config, { partial: true });
  const entries = Object.entries(validConfig);
  const settled = await Promise.allSettled(entries.map(([key, value]) =>
    updateRateLimitParam(client, RATE_LIMIT_FIELDS[key].path, value)
  ));
  const results = Object.fromEntries(entries.map(([key, value], index) => [key, {
    value,
    status: settled[index].status,
    reason: settled[index].status === 'rejected' ? settled[index].reason : undefined,
  }]));
  const failedFields = Object.keys(results).filter(key => results[key].status === 'rejected');
  if (failedFields.length) {
    const error = new Error(`部分配置保存失败：${failedFields.map(key => RATE_LIMIT_FIELDS[key].label).join('、')}`);
    error.name = 'RateLimitUpdateError';
    error.results = results;
    throw error;
  }
  return { results };
}
