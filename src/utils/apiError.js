const FALLBACK_MESSAGE = '请求失败，请稍后重试';
const GENERIC_MESSAGE = '发生未知错误';

const headerNames = ['x-amzn-requestid', 'x-amz-request-id', 'x-request-id'];

function readHeaderValue(headers, keys) {
  if (!headers) return undefined;
  try {
    for (const key of keys) {
      const value = typeof headers.get === 'function'
        ? headers.get(key)
        : headers[key] ?? headers[key?.toLowerCase?.()];
      if (value) {
        return value;
      }
    }
  } catch {
    // ignore header access errors
  }
  return undefined;
}

function mergeDetails(current, incoming) {
  if (incoming === undefined) return current;
  if (current === undefined) return incoming;

  if (Array.isArray(current) && Array.isArray(incoming)) {
    return [...current, ...incoming];
  }

  if (typeof current === 'object' && current !== null && typeof incoming === 'object' && incoming !== null) {
    return { ...current, ...incoming };
  }

  return incoming;
}

function mergeMeta(current, incoming) {
  if (incoming === undefined) return current;
  if (current === undefined) return incoming;
  if (typeof current === 'object' && current !== null && typeof incoming === 'object' && incoming !== null) {
    return { ...current, ...incoming };
  }
  return incoming;
}

function extractStatusCode(input, context) {
  if (context?.statusCode !== undefined) return context.statusCode;
  if (!input || typeof input !== 'object') return undefined;

  return (
    input.$metadata?.httpStatusCode ??
    input.output?.statusCode ??
    input.response?.status ??
    input.statusCode ??
    input.status ??
    input.responseStatus
  );
}

export class AppError extends Error {
  constructor(message = GENERIC_MESSAGE, context = {}) {
    super(message || GENERIC_MESSAGE);
    this.name = 'AppError';
    const {
      statusCode,
      requestMethod,
      requestPath,
      requestId,
      responseBody,
      details,
      cause,
      originalError,
      errorCode,
      meta
    } = context;

    if (statusCode !== undefined) this.statusCode = statusCode;
    if (requestMethod !== undefined) this.requestMethod = requestMethod;
    if (requestPath !== undefined) this.requestPath = requestPath;
    if (requestId !== undefined) this.requestId = requestId;
    if (responseBody !== undefined) this.responseBody = responseBody;
    if (errorCode !== undefined) this.errorCode = errorCode;
    if (details !== undefined) this.details = details;
    if (meta !== undefined) this.meta = meta;
    if (cause !== undefined && this.cause === undefined) this.cause = cause;
    if (originalError !== undefined) this.originalError = originalError;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
    if (!this.originalError && context.cause instanceof Error) {
      this.originalError = context.cause;
    }
  }

  applyContext(context = {}) {
    if (!context) return this;
    const {
      message,
      statusCode,
      requestMethod,
      requestPath,
      requestId,
      responseBody,
      details,
      cause,
      originalError,
      errorCode,
      meta
    } = context;

    if (message) this.message = message;
    if (statusCode !== undefined) this.statusCode = statusCode;
    if (requestMethod !== undefined) this.requestMethod = requestMethod;
    if (requestPath !== undefined) this.requestPath = requestPath;
    if (requestId !== undefined) this.requestId = requestId;
    if (responseBody !== undefined) this.responseBody = responseBody;
    if (errorCode !== undefined) this.errorCode = errorCode;
    if (details !== undefined) {
      this.details = mergeDetails(this.details, details);
    }
    if (meta !== undefined) {
      this.meta = mergeMeta(this.meta, meta);
    }
    if (cause !== undefined && this.cause === undefined) this.cause = cause;
    if (originalError !== undefined && this.originalError === undefined) this.originalError = originalError;
    return this;
  }

  static from(input, context = {}) {
    if (input instanceof AppError) {
      return input.applyContext(context);
    }

    let originalError = null;
    if (input instanceof Error) {
      originalError = input;
    } else if (context.originalError instanceof Error) {
      originalError = context.originalError;
    } else if (input && typeof input === 'object' && input.message) {
      originalError = new Error(String(input.message));
    } else if (input !== undefined) {
      originalError = new Error(typeof input === 'string' ? input : JSON.stringify(input));
    }

    const messageFromInput =
      context.message ??
      (input instanceof Error
        ? input.message
        : typeof input === 'string'
          ? input
          : input?.message);

    const appError = new AppError(messageFromInput || GENERIC_MESSAGE, {
      statusCode: extractStatusCode(input, context),
      requestMethod: context.requestMethod ?? input?.request?.method ?? input?.method,
      requestPath: context.requestPath ?? input?.request?.url ?? input?.url ?? context.url,
      requestId: context.requestId,
      responseBody: context.responseBody ?? input?.responseBody ?? input?.body ?? input?.data,
      details: mergeDetails(context.details, input?.details),
      errorCode: context.errorCode ?? input?.errorCode,
      meta: mergeMeta(context.meta, input?.meta),
      originalError: originalError ?? undefined
    });

    return appError;
  }
}

export class ApiError extends AppError {
  constructor(message = FALLBACK_MESSAGE, context = {}) {
    super(message || FALLBACK_MESSAGE, context);
    this.name = 'ApiError';
  }

  applyContext(context = {}) {
    super.applyContext(context);
    return this;
  }

  static from(input, context = {}) {
    if (input instanceof ApiError) {
      return input.applyContext(context);
    }

    const metadata = input?.$metadata ?? {};
    const response = input?.response;
    const headers = response?.headers || input?.headers;

    const derivedStatus = extractStatusCode(input, context);
    const derivedMethod = context.requestMethod ?? input?.request?.method ?? input?.config?.method ?? response?.method ?? context.method;
    const derivedPath = context.requestPath ?? input?.request?.url ?? input?.config?.url ?? response?.url ?? input?.url ?? context.url;
    const derivedRequestId = context.requestId ?? metadata.requestId ?? input?.requestId ?? readHeaderValue(headers, headerNames);

    const message = context.message || input?.message || FALLBACK_MESSAGE;

    const apiError = new ApiError(message, {
      statusCode: derivedStatus,
      requestMethod: derivedMethod,
      requestPath: derivedPath,
      requestId: derivedRequestId,
      responseBody: context.responseBody ?? input?.responseBody ?? input?.body ?? input?.data,
      details: mergeDetails(context.details, input?.details),
      errorCode: context.errorCode ?? input?.errorCode,
      originalError: input instanceof Error ? input : context.originalError
    });

    if (metadata.attempts) {
      apiError.attempts = metadata.attempts;
    }

    return apiError;
  }

  static async fromResponse(response, context = {}) {
    const Ctor = this; // Allow subclasses to instantiate themselves via this method
    if (!response) {
      return new Ctor(context.message || FALLBACK_MESSAGE, context);
    }

    let responseBody;
    try {
      if (response.clone) {
        const cloned = response.clone();
        const contentType = cloned.headers?.get?.('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseBody = await cloned.json();
        } else {
          responseBody = await cloned.text();
        }
      }
  } catch (_) {
      responseBody = undefined;
    }

    const finalContext = {
      ...context,
      statusCode: response.status,
      requestMethod: context.requestMethod ?? response.request?.method ?? context.method,
      requestPath: context.requestPath ?? response.url ?? context.url,
      requestId: context.requestId ?? readHeaderValue(response.headers, headerNames),
      responseBody,
      originalError: context.originalError instanceof Error ? context.originalError : undefined,
    };

    return new Ctor(context.message || `请求失败，状态码 ${response.status}`, finalContext);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = '未登录：请求未发送，请先完成登录后重试。', context = {}) {
    super(message, {
      ...context,
      statusCode: undefined,
      errorCode: context.errorCode ?? 'AUTH_MISSING_ID_TOKEN',
      details: mergeDetails(context.details, { 提示: '由于缺少身份凭证，请求未发送到服务器。' })
    });
    this.name = 'AuthenticationError';
  }
}

export class ClientError extends AppError {
  constructor(message = GENERIC_MESSAGE, context = {}) {
    super(message, context);
    this.name = 'ClientError';
  }
}

export class ServiceError extends AppError {
  constructor(message = GENERIC_MESSAGE, context = {}) {
    super(message, context);
    this.name = 'ServiceError';
    if (context.serviceName !== undefined) this.serviceName = context.serviceName;
  }

  applyContext(context = {}) {
    super.applyContext(context);
    if (context?.serviceName !== undefined) {
      this.serviceName = context.serviceName;
    }
    return this;
  }
}

// --- Client-Side Specific Errors ---

export class ValidationError extends ClientError {
  constructor(message = '提交的数据无效，请检查后重试。', context = {}) {
    super(message, context);
    this.name = 'ValidationError';
    if (context.fieldErrors) {
      this.fieldErrors = context.fieldErrors; // e.g., [{field: 'email', message: '格式不正确'}]
    }
  }
}

export class PermissionError extends ClientError {
  constructor(message = '操作所需的权限被拒绝。', context = {}) {
    super(message, context);
    this.name = 'PermissionError';
    if (context.permissionName) {
      this.permissionName = context.permissionName; // e.g., 'microphone'
    }
  }
}

export class StorageError extends ClientError {
  constructor(message = '本地存储操作失败。', context = {}) {
    super(message, context);
    this.name = 'StorageError';
    if (context.operation) this.operation = context.operation; // 'get', 'set', 'remove'
    if (context.key) this.key = context.key;
    if (context.quotaExceeded) this.quotaExceeded = context.quotaExceeded; // boolean
  }
}

// --- API/Network Specific Errors ---

export class UploadError extends ApiError {
  constructor(message = '文件上传失败。', context = {}) {
    super(message, context);
    this.name = 'UploadError';
    if (context.objectKey) this.objectKey = context.objectKey;
    if (context.uploadUrl) this.uploadUrl = context.uploadUrl;
  }
}


export function ensureAppError(error, context) {
  return error instanceof AppError ? error.applyContext(context) : AppError.from(error, context);
}

export function ensureApiError(error, context) {
  if (error instanceof ApiError) {
    return error.applyContext(context);
  }
  if (error instanceof AppError) {
    return error.applyContext(context);
  }
  return ApiError.from(error, context);
}

export function normalizeFetchError(response, context = {}) {
  if (!response) {
    return new ApiError(context.message || FALLBACK_MESSAGE, context);
  }
  return ApiError.from(response, {
    ...context,
    statusCode: response.status,
    requestMethod: context.requestMethod ?? response.request?.method ?? context.method,
    requestPath: context.requestPath ?? response.url ?? context.url
  });
}

