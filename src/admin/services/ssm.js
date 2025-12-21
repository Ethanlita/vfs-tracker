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
    const value = parseInt(param.Value, 10);
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

  return config;
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
  const updates = [];

  if (config.adviceWindowHours !== undefined) {
    updates.push(updateRateLimitParam(client, SSM_PATHS.ADVICE_WINDOW_HOURS, config.adviceWindowHours));
  }
  if (config.adviceMaxRequests !== undefined) {
    updates.push(updateRateLimitParam(client, SSM_PATHS.ADVICE_MAX_REQUESTS, config.adviceMaxRequests));
  }
  if (config.songWindowHours !== undefined) {
    updates.push(updateRateLimitParam(client, SSM_PATHS.SONG_WINDOW_HOURS, config.songWindowHours));
  }
  if (config.songMaxRequests !== undefined) {
    updates.push(updateRateLimitParam(client, SSM_PATHS.SONG_MAX_REQUESTS, config.songMaxRequests));
  }

  await Promise.all(updates);
}
