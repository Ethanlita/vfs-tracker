/**
 * @file [CN] api.js 提供了与后端服务进行通信的所有函数。它封装了 AWS Amplify 的 API 调用，处理真实的 API 请求。
 */
import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ApiError, AuthenticationError, ServiceError, UploadError } from './utils/apiError.js';
import { withAutoTimeout, isTimeoutError } from './utils/timeout.js';

/**
 * [CN] 用于缓存用户个人资料的本地存储键。
 * @type {string}
 */
export const PROFILE_CACHE_KEY = 'lastGoodUserProfile:v1';

/**
 * [CN] 发送一个公共的 GET 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {ApiError} 如果请求失败或超时，则抛出 ApiError。
 */
async function simpleGet(path) {
  console.debug('[simpleGet] making public request to:', path);
  try {
    const op = get({ apiName: 'api', path });
    // 使用自动超时配置
    return await withAutoTimeout(op, { method: 'GET', path });
  } catch (error) {
    console.error(`[simpleGet] 请求失败: ${path}`, error);
    // 如果是超时错误,直接抛出 (已经是 ApiError)
    if (isTimeoutError(error)) {
      throw error;
    }
    // 其他错误转换为 ApiError
    throw ApiError.from(error, {
      requestMethod: 'GET',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

/**
 * [CN] 发送一个经过身份验证的 GET 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @returns {Promise<any>} 一个解析为 API 响应数据的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证，则抛出 AuthenticationError。
 * @throws {ApiError} 如果请求失败或超时，则抛出 ApiError。
 */
async function authenticatedGet(path) {
  console.debug('[authenticatedGet] making authenticated request to:', path);
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken;
  if (!idToken) {
    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'GET',
      requestPath: path
    });
  }
  try {
    const op = get({
      apiName: 'api',
      path,
      options: {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });
    // 使用自动超时配置
    const result = await withAutoTimeout(op, { method: 'GET', path });
    console.log('✅ API调用成功，使用了ID token');
    if (result.data) {
      return result.data;
    } else if (result.events) {
      return result.events;
    }
    return result;
  } catch (error) {
    console.error('❌ 使用ID token API调用失败:', error);
    // 如果是超时错误,直接抛出
    if (isTimeoutError(error)) {
      throw error;
    }
    throw ApiError.from(error, {
      requestMethod: 'GET',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

/**
 * [CN] 发送一个经过身份验证的 POST 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @param {object} bodyData - 要在请求正文中发送的数据。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证。
 * @throws {ApiError} 如果请求失败或超时。
 */
async function authenticatedPost(path, bodyData) {
  console.log('[authenticatedPost] making authenticated request to:', path);
  const session = await fetchAuthSession();
  const idTokenRaw = session.tokens?.idToken;
  const idToken = typeof idTokenRaw === 'string' ? idTokenRaw : idTokenRaw?.toString?.();
  if (!idToken) {
    console.error('[authenticatedPost] No ID token in session.tokens');
    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'POST',
      requestPath: path
    });
  }
  console.debug('[authenticatedPost] ID Token preview (first 20 chars):', idToken.slice(0, 20));
  try {
    const op = post({
      apiName: 'api',
      path,
      options: {
        body: bodyData,
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });
    // 使用自动超时配置
    return await withAutoTimeout(op, { method: 'POST', path });
  } catch (error) {
    console.error(`[authenticatedPost] 请求失败: ${path}`, error);
    // 如果是超时错误,直接抛出
    if (isTimeoutError(error)) {
      throw error;
    }
    throw ApiError.from(error, {
      requestMethod: 'POST',
      requestPath: path,
      details: { body: bodyData },
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

/**
 * [CN] 发送一个经过身份验证的 PUT 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @param {object} bodyData - 要在请求正文中发送的数据。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证。
 * @throws {ApiError} 如果请求失败或超时。
 */
async function authenticatedPut(path, bodyData) {
  console.log('[authenticatedPut] making authenticated request to:', path);
  const session = await fetchAuthSession();
  const idTokenRaw = session.tokens?.idToken;
  const idToken = typeof idTokenRaw === 'string' ? idTokenRaw : idTokenRaw?.toString?.();
  if (!idToken) {
    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'PUT',
      requestPath: path
    });
  }
  try {
    const op = put({
      apiName: 'api',
      path,
      options: {
        body: bodyData,
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });
    // 使用自动超时配置
    return await withAutoTimeout(op, { method: 'PUT', path });
  } catch (error) {
    console.error(`[authenticatedPut] 请求失败: ${path}`, error);
    // 如果是超时错误,直接抛出
    if (isTimeoutError(error)) {
      throw error;
    }
    throw ApiError.from(error, {
      requestMethod: 'PUT',
      requestPath: path,
      details: { body: bodyData },
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

/**
 * [CN] 发送一个经过身份验证的 DELETE 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证。
 * @throws {ApiError} 如果请求失败或超时。
 */
async function authenticatedDelete(path) {
  console.log('[authenticatedDelete] making authenticated request to:', path);
  const session = await fetchAuthSession();
  const idTokenRaw = session.tokens?.idToken;
  const idToken = typeof idTokenRaw === 'string' ? idTokenRaw : idTokenRaw?.toString?.();
  if (!idToken) {
    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'DELETE',
      requestPath: path
    });
  }
  try {
    const op = del({
      apiName: 'api',
      path,
      options: {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });
    // 使用自动超时配置
    return await withAutoTimeout(op, { method: 'DELETE', path });
  } catch (error) {
    console.error(`[authenticatedDelete] 请求失败: ${path}`, error);
    // 如果是超时错误,直接抛出
    if (isTimeoutError(error)) {
      throw error;
    }
    throw ApiError.from(error, {
      requestMethod: 'DELETE',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

// ========== 核心API函数 ==========

/**
 * [CN] 添加一个新事件。
 * @param {object} eventData - 事件数据。
 * @returns {Promise<object>} 一个解析为 API 响应的 Promise，其中包含已创建的事件项目。
 */
export const addEvent = async (eventData) => {
  const requestBody = { type: eventData.type, date: eventData.date, details: eventData.details };
  if (Array.isArray(eventData.attachments) && eventData.attachments.length) {
    requestBody.attachments = eventData.attachments;
  }
  return authenticatedPost('/events', requestBody);
};

/**
 * [CN] 获取所有事件的列表。
 * @returns {Promise<Array<object>>} 一个解析为事件对象数组的 Promise。
 */
export const getAllEvents = async () => {
  return simpleGet('/all-events');
};

/**
 * [CN] 根据用户 ID 获取事件。
 * @param {string} userId - 用户的唯一标识符。
 * @returns {Promise<Array<object>>} 一个解析为该用户事件对象数组的 Promise。
 */
export const getEventsByUserId = async (userId) => {
  return authenticatedGet(`/events/${userId}`);
};

/**
 * [CN] 根据事件 ID 删除一个事件。
 * @param {string} eventId - 要删除事件的唯一标识符。
 * @returns {Promise<object>} 一个解析为确认消息的 Promise。
 */
export const deleteEvent = async (eventId) => {
  console.log(`[deleteEvent] deleting event with ID: ${eventId}`);
  return authenticatedDelete(`/event/${eventId}`);
};

/**
 * [CN] 调用 Gemini代理 以获取基于提示的响应。
 * @param {string} prompt - 发送到 AI 代理的提示。
 * @returns {Promise<string>} 一个解析为 AI 生成的响应字符串的 Promise。
 * @throws {ServiceError} 如果代理服务调用失败。
 */
export const callGeminiProxy = async (prompt) => {
  const result = await authenticatedPost('/gemini-proxy', { prompt });
  if (result.success) {
    return result.response;
  }
  throw new ServiceError(result.error || 'The Gemini proxy failed to process the request.', {
    requestMethod: 'POST',
    requestPath: '/gemini-proxy',
    statusCode: result.statusCode ?? result.status,
    details: { success: result.success },
    serviceName: 'Gemini Proxy'
  });
};

/**
 * [CN] 根据用户的事件数据生成一条鼓励性消息。如果 AI 未启用或调用失败，则返回默认消息。
 * @param {object} userData - 包含用户事件数据的对象。
 * @returns {Promise<string>} 一个解析为鼓励性消息字符串的 Promise。
 */
export const getEncouragingMessage = async (userData) => {
  // AI 功能默认启用，除非显式禁用
  const isAiEnabled = import.meta.env.VITE_ENABLE_AI !== 'false';
  if (!isAiEnabled) return "持续跟踪，持续进步 ✨";

  try {
    if (!userData || !userData.events || userData.events.length === 0) {
      return "开始记录你的声音数据，让我为你加油吧！";
    }
    const eventsSummary = userData.events.map(e => {
      const date = new Date(e.date || e.createdAt).toLocaleDateString('zh-CN');
      const details = e.details ? JSON.stringify(e.details) : '无';
      return `- 日期: ${date}, 事件类型: ${e.type}, 详情: ${details}`;
    }).join('\n');
    const prompt = `
这是用户最近的嗓音事件记录：
${eventsSummary}

请基于这些数据，结合你的知识库，给用户一句鼓励和分析的话。
`;
    return await callGeminiProxy(prompt);
  } catch (error) {
    console.error("获取AI消息失败:", error);
    return "持续跟踪，持续进步 ✨"; // Fallback message
  }
};

/**
 * [CN] 根据用户的音域推荐歌曲。
 * @param {object} range - 包含用户音域的对象。
 * @returns {Promise<Array<object>>} 一个解析为歌曲推荐对象数组的 Promise。
 * @throws {ServiceError} 如果歌曲推荐服务调用失败。
 */
export const getSongRecommendations = async ({ lowestNote, highestNote }) => {
  const result = await authenticatedPost('/recommend-songs', { lowestNote, highestNote });
  if (result.success) {
    return result.recommendations;
  }
  throw new ServiceError(result.error || 'The song recommendation service failed.', {
    requestMethod: 'POST',
    requestPath: '/recommend-songs',
    statusCode: result.statusCode ?? result.status,
    details: { success: result.success },
    serviceName: 'Song Recommendation'
  });
};

/**
 * [CN] 获取用户的完整个人资料。
 * @param {string} userId - 用户的唯一标识符。
 * @returns {Promise<object>} 一个解析为用户个人资料对象的 Promise。
 */
export const getUserProfile = async (userId) => {
  return authenticatedGet(`/user/${userId}`);
};

/**
 * [CN] 获取用户的公开个人资料。
 * @param {string} userId - 用户的唯一标识符。
 * @returns {Promise<object>} 一个解析为用户公开个人资料对象的 Promise。
 */
export const getUserPublicProfile = async (userId) => {
  return simpleGet(`/user/${userId}/public`);
};

/**
 * [CN] 更新用户的个人资料。
 * @param {string} userId - 用户的唯一标识符。
 * @param {object} profileData - 包含要更新的个人资料数据的对象。
 * @returns {Promise<object>} 一个解析为包含更新后用户信息的 API 响应的 Promise。
 */
export const updateUserProfile = async (userId, profileData) => {
  const requestBody = { profile: profileData.profile };
  return authenticatedPut(`/user/${userId}`, requestBody);
};

/**
 * [CN] 为新用户设置个人资料。
 * @param {object} profileData - 包含新用户个人资料数据的对象。
 * @returns {Promise<object>} 一个解析为包含新用户信息和 `isNewUser` 标志的 API 响应的 Promise。
 */
export const setupUserProfile = async (profileData) => {
  const requestBody = { profile: profileData.profile || { name: '', isNamePublic: false, socials: [], areSocialsPublic: false } };
  return authenticatedPost('/user/profile-setup', requestBody);
};

/**
 * [CN] 创建一个新的嗓音测试会话。
 * @param {string} [userId] - （可选）用户的唯一标识符。
 * @returns {Promise<{sessionId: string}>} 一个解析为包含新会话 ID 对象的 Promise。
 */
export const createVoiceTestSession = async (userId) => {
  const path = '/sessions';
  const bodyData = userId ? { userId } : {};
  return authenticatedPost(path, bodyData);
};

/**
 * [CN] 获取用于上传嗓音测试文件的预签名 URL。
 * @param {string} sessionId - 测试会话的 ID。
 * @param {string} step - 测试的步骤。
 * @param {string} fileName - 要上传的文件名。
 * @param {string} contentType - 文件的 MIME 类型。
 * @returns {Promise<{putUrl: string, objectKey: string}>} 一个解析为包含 `putUrl` 和 `objectKey` 对象的 Promise。
 */
export const getVoiceTestUploadUrl = async (sessionId, step, fileName, contentType) => {
  const path = '/uploads';
  const bodyData = { sessionId, step, fileName, contentType };
  return authenticatedPost(path, bodyData);
};

/**
 * [CN] 将嗓音测试文件上传到 S3。
 * @param {string} putUrl - 从 `getVoiceTestUploadUrl` 获取的预签名上传 URL。
 * @param {File} file - 要上传的文件对象。
 * @returns {Promise<Response>} 一个解析为 fetch 响应的 Promise。
 * @throws {UploadError} 如果上传失败。
 */
export const uploadVoiceTestFileToS3 = async (putUrl, file) => {
  try {
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/wav' },
      body: file
    });
    if (!response.ok) {
      throw await UploadError.fromResponse(response, {
        requestMethod: 'PUT',
        requestPath: putUrl,
        uploadUrl: putUrl,
      });
    }
    return response;
  } catch (error) {
    throw error instanceof ApiError
      ? error
      : UploadError.from(error, {
        requestMethod: 'PUT',
        requestPath: putUrl,
        uploadUrl: putUrl,
        statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
      });
  }
};

/**
 * [CN] 请求对嗓音测试会话进行分析。
 * @param {string} sessionId - 测试会话的 ID。
 * @param {object} calibration - 用户提供的校准数据。
 * @param {object} forms - 用户填写的问卷数据。
 * @returns {Promise<{status: string, sessionId: string}>} 一个解析为包含分析状态和会话 ID 对象的 Promise。
 */
export const requestVoiceTestAnalyze = async (sessionId, calibration, forms) => {
  const path = '/analyze';
  const bodyData = { sessionId, calibration, forms };
  return authenticatedPost(path, bodyData);
};

/**
 * [CN] 获取嗓音测试的结果。
 * @param {string} sessionId - 测试会话的 ID。
 * @returns {Promise<object>} 一个解析为测试结果对象的 Promise。
 */
export const getVoiceTestResults = async (sessionId) => {
  const path = `/results/${sessionId}`;
  return authenticatedGet(path);
};

/**
 * [CN] 获取一个通用的 S3 上传预签名 URL。
 * @param {string} fileKey - 文件在 S3 存储桶中的唯一键。
 * @param {string} contentType - 文件的 MIME 类型。
 * @returns {Promise<string>} 一个解析为上传 URL 字符串的 Promise。
 */
export const getUploadUrl = async (fileKey, contentType) => {
  const requestBody = { fileKey, contentType };
  const data = await authenticatedPost('/upload-url', requestBody);
  return data.uploadUrl;
};

/**
 * [CN] 获取一个通用的 S3 文件访问预签名 URL。
 * @param {string} fileKey - 文件在 S3 存储桶中的唯一键。
 * @returns {Promise<string>} 一个解析为文件 URL 字符串的 Promise。
 */
export const getFileUrl = async (fileKey) => {
  const requestBody = { fileKey };
  const data = await authenticatedPost('/file-url', requestBody);
  return data.url;
};

/**
 * [CN] 获取用户的头像 URL。
 * @param {string} userId - 用户的唯一标识符。
 * @returns {Promise<string>} 一个解析为头像 URL 字符串的 Promise。
 */
export const getAvatarUrl = async (userId) => {
  const data = await simpleGet(`/avatar/${userId}`);
  return data.url;
};

/**
 * [CN] 检查用户的个人资料是否填写完整。
 * @param {object | null | undefined} userProfile - 用户的个人资料对象。
 * @returns {boolean} 如果个人资料完整，则返回 true；否则返回 false。
 */
export const isUserProfileComplete = (userProfile) => {
  if (!userProfile || !userProfile.profile) return false;
  const { name, isNamePublic, areSocialsPublic } = userProfile.profile;
  const hasNonEmptyName = typeof name === 'string' && name.trim().length > 0;
  const hasPrivacySettings = typeof isNamePublic === 'boolean' && typeof areSocialsPublic === 'boolean';
  return hasNonEmptyName && hasPrivacySettings;
};