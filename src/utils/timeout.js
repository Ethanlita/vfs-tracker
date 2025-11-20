/**
 * @file 网络请求超时处理工具
 * @description 提供与 IaC 配置一致的超时管理和错误处理
 */

import { ApiError } from './apiError.js';

/**
 * 超时配置 (基于 IaC Lambda 函数超时设置)
 * 参考: data_of_dynamodb/VFS-Tracker-IaC-template-1759594356761.yaml
 * 
 * Lambda 超时时间:
 * - 标准 API 操作: 3秒
 * - 复杂查询操作: 29秒
 * - 文件处理操作: 300秒 (5分钟)
 * 
 * 前端超时配置:
 * - API Gateway 最大超时: 30秒
 * - 前端默认超时: Lambda超时 + 5秒缓冲 (考虑网络延迟)
 * - 最小超时: 5秒 (避免过早超时)
 * - 最大超时: 310秒 (文件处理 + 缓冲)
 */

/**
 * API 端点超时配置映射
 * @type {Object<string, number>}
 * 
 * 配置规则:
 * - 快速操作 (GET/POST/PUT 单条数据): 8秒 (Lambda 3s + 5s缓冲)
 * - 复杂查询 (批量数据/计算密集): 34秒 (Lambda 29s + 5s缓冲)
 * - 文件操作 (上传/下载/处理): 305秒 (Lambda 300s + 5s缓冲)
 */
export const TIMEOUT_CONFIG = {
  // 用户相关 API (快速操作)
  '/user': 8000,                    // getUserProfile, updateUserProfile
  '/user/public': 8000,              // getUserPublicProfile

  // 事件相关 API
  '/events': 8000,                   // addEvent (POST), getUserEvents (GET)
  '/event': 8000,                    // deleteEvent
  '/all-events': 34000,              // getAllEvents (复杂查询,需遍历大量数据)

  // 文件相关 API (文件处理操作)
  '/upload-url': 305000,             // getUploadUrl (生成预签名URL + S3操作)
  '/file-url': 305000,               // getFileUrl (S3访问URL生成)
  '/avatar': 8000,                   // getAvatarUrl (简单的URL返回)

  // 外部服务 API (复杂操作)
  '/song-recommendations': 34000,    // 调用外部推荐服务
  '/gemini-proxy': 34000,            // AI 服务代理

  // 默认超时
  'default': 8000
};

/**
 * 根据 API 路径获取超时时间
 * 
 * @param {string} path - API 请求路径
 * @returns {number} 超时时间(毫秒)
 * 
 * @example
 * getTimeout('/user/123') // 8000
 * getTimeout('/all-events') // 34000
 * getTimeout('/upload-url') // 305000
 */
export function getTimeout(path) {
  // 移除查询参数和尾部斜杠
  const cleanPath = path.split('?')[0].replace(/\/$/, '');

  // 精确匹配
  if (TIMEOUT_CONFIG[cleanPath]) {
    return TIMEOUT_CONFIG[cleanPath];
  }

  // 前缀匹配 (例如 /user/123 匹配 /user)
  for (const [pattern, timeout] of Object.entries(TIMEOUT_CONFIG)) {
    if (pattern !== 'default' && cleanPath.startsWith(pattern)) {
      return timeout;
    }
  }

  // 返回默认超时
  return TIMEOUT_CONFIG.default;
}

/**
 * 为 Promise 添加超时控制
 * 
 * @template T
 * @param {Promise<T>} promise - 要包装的 Promise
 * @param {number} timeoutMs - 超时时间(毫秒)
 * @param {Object} context - 请求上下文信息
 * @param {string} context.method - HTTP 方法
 * @param {string} context.path - API 路径
 * @returns {Promise<T>} 带超时控制的 Promise
 * @throws {ApiError} 超时时抛出 ApiError (code: 'TIMEOUT')
 * 
 * @example
 * const result = await withTimeout(
 *   fetch('/api/data'),
 *   5000,
 *   { method: 'GET', path: '/api/data' }
 * );
 */
export function withTimeout(promise, timeoutMs, context = {}) {
  return new Promise((resolve, reject) => {
    // 创建超时定时器
    const timeoutId = setTimeout(() => {
      const error = new ApiError(
        `请求超时: ${context.method || 'REQUEST'} ${context.path || 'unknown'} ` +
        `(${timeoutMs}ms)`,
        {
          errorCode: 'TIMEOUT',
          statusCode: 408, // Request Timeout
          requestMethod: context.method,
          requestPath: context.path,
          details: {
            message: '服务器响应时间过长，请检查网络连接或稍后重试',
            configuredTimeout: `${timeoutMs}ms`,
            suggestion: timeoutMs >= 30000
              ? '大型操作可能需要更多时间，请耐心等待'
              : '请检查网络连接状态'
          }
        }
      );
      // 同时设置 code 和 timeout 属性以兼容测试
      error.code = 'TIMEOUT';
      error.timeout = timeoutMs;
      reject(error);
    }, timeoutMs);

    // 执行原始 Promise
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * 为 Amplify API 操作添加超时控制
 * 
 * @param {Object} operation - Amplify API 操作对象 (get/post/put/del 的返回值)
 * @param {number} timeoutMs - 超时时间(毫秒)
 * @param {Object} context - 请求上下文
 * @returns {Promise<any>} 带超时的 API 响应
 * 
 * @example
 * const op = get({ apiName: 'api', path: '/user/123' });
 * const result = await withAmplifyTimeout(op, 8000, { 
 *   method: 'GET', 
 *   path: '/user/123' 
 * });
 */
export async function withAmplifyTimeout(operation, timeoutMs, context = {}) {
  const responsePromise = operation.response
    .then(({ body }) => {
      console.log('[withAmplifyTimeout] Got body, calling body.json()');
      return body.json();
    })
    .then(data => {
      console.log('[withAmplifyTimeout] Parsed JSON data:', data);
      return data;
    })
    .catch(error => {
      console.error('[withAmplifyTimeout] Error:', error);
      // 如果 response promise 被 reject,直接重新抛出
      // 这样错误会被 withTimeout 或外层 catch 捕获
      throw error;
    });
  return withTimeout(responsePromise, timeoutMs, context);
}

/**
 * 使用自动超时配置包装 Amplify API 操作
 * 
 * @param {Object} operation - Amplify API 操作对象
 * @param {Object} context - 请求上下文
 * @param {string} context.method - HTTP 方法
 * @param {string} context.path - API 路径
 * @returns {Promise<any>} 带自动超时的 API 响应
 * 
 * @example
 * const op = get({ apiName: 'api', path: '/user/123' });
 * const result = await withAutoTimeout(op, { 
 *   method: 'GET', 
 *   path: '/user/123' 
 * });
 */
export async function withAutoTimeout(operation, context = {}) {
  const timeout = getTimeout(context.path || '');
  // console.debug(`[Timeout] ${context.method} ${context.path}: ${timeout}ms`);
  return withAmplifyTimeout(operation, timeout, context);
}

/**
 * 检查错误是否为超时错误
 * 
 * @param {Error} error - 要检查的错误对象
 * @returns {boolean} 如果是超时错误返回 true
 * 
 * @example
 * try {
 *   await apiCall();
 * } catch (error) {
 *   if (isTimeoutError(error)) {
 *     console.log('请求超时，请重试');
 *   }
 * }
 */
export function isTimeoutError(error) {
  if (!error) return false;
  return error.code === 'TIMEOUT' ||
    error.errorCode === 'TIMEOUT' ||
    error.name === 'TimeoutError' ||
    (typeof error.message === 'string' && error.message.includes('超时')) ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'));
}

/**
 * 创建一个可取消的超时 Promise (用于实现请求取消)
 * 
 * @param {number} timeoutMs - 超时时间(毫秒)
 * @returns {{promise: Promise<void>, cancel: Function}} 超时 Promise 和取消函数
 * 
 * @example
 * const { promise: timeout, cancel } = createCancellableTimeout(5000);
 * try {
 *   await Promise.race([fetchData(), timeout]);
 * } catch (error) {
 *   // 超时处理
 * } finally {
 *   cancel(); // 清理定时器
 * }
 */
export function createCancellableTimeout(timeoutMs) {
  let timeoutId;
  let cancelFn;

  const promise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new ApiError('Operation timeout', {
        code: 'TIMEOUT',
        timeout: timeoutMs
      }));
    }, timeoutMs);
  });

  cancelFn = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { promise, cancel: cancelFn };
}
