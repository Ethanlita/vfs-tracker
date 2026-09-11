/**
 * @file Lambda 结构化日志工具
 * @description 输出单行 JSON，按 LOG_LEVEL 过滤，并主动移除可能包含用户内容或凭据的字段。
 */
import { createHash } from 'node:crypto';

const LEVELS = Object.freeze({ DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 });
const SENSITIVE_KEY = /authorization|cookie|token|secret|password|api.?key|body|prompt|response|payload|content|email|uri|url|file|attachment/i;

/**
 * 判断字段是否可能携带用户内容或凭据。
 * 以 Count、Length 或 Size 结尾的数值字段仅描述聚合规模，可以安全用于运行监控。
 */
function isSensitiveKey(key, value) {
  if (!SENSITIVE_KEY.test(key)) return false;
  return !(typeof value === 'number' && /(?:count|length|size)$/i.test(key));
}

/** 将内部标识转换为不可逆短指纹，便于关联日志而不记录原值。 */
export function fingerprintIdentifier(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * 清理日志元数据，只保留有限深度的标量、数组和普通对象。
 * 敏感键无论处于哪一层都替换为固定标记，防止调用方误传原始请求或模型内容。
 */
export function sanitizeLogMetadata(value, depth = 0) {
  if (depth > 3) return '[TRUNCATED]';
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.slice(0, 256).replace(/[\r\n\t]/g, ' ');
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeLogMetadata(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => [
    key,
    isSensitiveKey(key, item) ? '[REDACTED]' : sanitizeLogMetadata(item, depth + 1),
  ]));
}

/** 只提取可安全聚合的错误分类，不记录 message、stack 或第三方响应正文。 */
export function describeError(error) {
  if (!error || typeof error !== 'object') return { errorName: 'UnknownError' };
  return sanitizeLogMetadata({
    errorName: error.name || error.constructor?.name || 'Error',
    errorCode: error.code,
    errorStatus: error.status || error.statusCode,
    retryable: error.retryable,
  });
}

/**
 * 创建 Lambda 调用使用的结构化日志器。
 * @param {object} options 日志上下文。
 * @param {string} options.service Lambda 服务名。
 * @param {string} [options.requestId] AWS 请求 ID。
 * @param {string} [options.level] 最低日志级别，默认读取 LOG_LEVEL，再回退到 INFO。
 * @param {() => string} [options.now] 测试可注入的 ISO 时间函数。
 * @returns {{debug: Function, info: Function, warn: Function, error: Function}} 分级日志方法。
 */
export function createStructuredLogger({
  service,
  requestId,
  level = process.env.LOG_LEVEL || 'INFO',
  now = () => new Date().toISOString(),
}) {
  const configuredLevel = LEVELS[String(level).toUpperCase()] ?? LEVELS.INFO;

  const write = (logLevel, eventName, metadata = {}) => {
    if (LEVELS[logLevel] < configuredLevel) return;
    const entry = {
      timestamp: now(),
      level: logLevel,
      service,
      event: eventName,
      ...(requestId ? { requestId } : {}),
      ...sanitizeLogMetadata(metadata),
    };
    const serialized = JSON.stringify(entry);
    if (logLevel === 'ERROR') console.error(serialized);
    else if (logLevel === 'WARN') console.warn(serialized);
    else console.log(serialized);
  };

  return {
    debug: (eventName, metadata) => write('DEBUG', eventName, metadata),
    info: (eventName, metadata) => write('INFO', eventName, metadata),
    warn: (eventName, metadata) => write('WARN', eventName, metadata),
    error: (eventName, metadata) => write('ERROR', eventName, metadata),
  };
}
