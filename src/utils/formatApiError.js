import {
  ensureAppError,
  ApiError,
  AuthenticationError,
  ServiceError,
  UploadError,
  PermissionError,
  ValidationError,
  StorageError
} from './apiError.js';

const defaultLabels = {
  summaryFallback: '请求过程中出现问题',
  statusCode: '状态码',
  requestMethod: '请求方法',
  requestPath: '请求地址',
  requestId: '请求 ID',
  responseBody: '响应内容',
  errorCode: '错误代码',
  details: '详细信息',
  notSent: '请求状态',
  serviceName: '服务',
  meta: '附加信息',
  // New labels for new error types
  objectKey: 'S3 Object Key',
  permissionName: '所需权限',
  storageOperation: '存储操作',
  storageKey: '存储键',
  fieldErrors: '字段错误'
};

function toDisplayValue(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeDetailItems(details, labels, fallbackLabel = labels.details) {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details
      .map((item, index) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return { label: `${fallbackLabel}`, value: item };
        }
        if (typeof item === 'object') {
          const label = item.label ?? `${fallbackLabel}`;
          const value = item.value ?? toDisplayValue(item);
          return value ? { label, value } : null;
        }
        return { label: `${fallbackLabel}[${index}]`, value: String(item) };
      })
      .filter(Boolean);
  }

  if (typeof details === 'object') {
    return Object.entries(details)
      .map(([key, value]) => ({ label: key, value: toDisplayValue(value) }))
      .filter(item => item.value !== undefined);
  }

  const value = toDisplayValue(details);
  return value ? [{ label: fallbackLabel, value }] : [];
}

export function formatApiError(error, options = {}) {
  if (!error) return null;
  const labels = { ...defaultLabels, ...(options.labels || {}) };
  const appError = ensureAppError(error, options.context);

  const summary = appError.message || labels.summaryFallback;
  const detailItems = [];

  if (appError.errorCode) {
    detailItems.push({ label: labels.errorCode, value: appError.errorCode });
  }

  if (appError instanceof ApiError) {
    if (appError.statusCode !== undefined && appError.statusCode !== null) {
      detailItems.push({ label: labels.statusCode, value: appError.statusCode });
    }
  } else if (appError instanceof AuthenticationError) {
    detailItems.push({ label: labels.notSent, value: '请求未发送（鉴权失败）' });
  } else if (appError.statusCode !== undefined && appError.statusCode !== null) {
    detailItems.push({ label: labels.statusCode, value: appError.statusCode });
  }

  if (appError instanceof ServiceError && appError.serviceName) {
    detailItems.push({ label: labels.serviceName, value: appError.serviceName });
  }

  // Handle new error types
  if (appError instanceof UploadError && appError.objectKey) {
    detailItems.push({ label: labels.objectKey, value: appError.objectKey });
  }

  if (appError instanceof PermissionError && appError.permissionName) {
    detailItems.push({ label: labels.permissionName, value: appError.permissionName });
  }

  if (appError instanceof StorageError) {
    if (appError.operation) detailItems.push({ label: labels.storageOperation, value: appError.operation });
    if (appError.key) detailItems.push({ label: labels.storageKey, value: appError.key });
  }

  if (appError instanceof ValidationError && appError.fieldErrors) {
    const fieldsSummary = appError.fieldErrors
      .map(e => `${e.field}: ${e.message}`)
      .join('; ');
    detailItems.push({ label: labels.fieldErrors, value: fieldsSummary });
  }

  if (appError.requestMethod) {
    const method = typeof appError.requestMethod === 'string'
      ? appError.requestMethod.toUpperCase()
      : appError.requestMethod;
    detailItems.push({ label: labels.requestMethod, value: method });
  }
  if (appError.requestPath) {
    detailItems.push({ label: labels.requestPath, value: appError.requestPath });
  }
  if (appError.requestId) {
    detailItems.push({ label: labels.requestId, value: appError.requestId });
  }
  if (options.includeResponseBody && appError.responseBody) {
    const responseValue = toDisplayValue(appError.responseBody);
    if (responseValue) {
      detailItems.push({ label: labels.responseBody, value: responseValue });
    }
  }

  const detailFromError = normalizeDetailItems(appError.details, labels);
  detailItems.push(...detailFromError);

  const metaDetailItems = normalizeDetailItems(appError.meta, labels, labels.meta);
  detailItems.push(...metaDetailItems);

  const extraDetailItems = normalizeDetailItems(options.additionalDetails, labels);
  detailItems.push(...extraDetailItems);

  const detailText = detailItems.map(item => `${item.label}：${item.value}`).join(' · ');

  return {
    summary,
    detailItems,
    detailText,
    error: appError
  };
}

export default formatApiError;
