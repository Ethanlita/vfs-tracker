import { parseEventDate } from './utils/calendarDate.js';
/**
 * @file [CN] api.js 提供了与后端服务进行通信的所有函数。它封装了 AWS Amplify 的 API 调用，处理真实的 API 请求。
 */
import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ApiError, AuthenticationError, ServiceError, UploadError } from './utils/apiError.js';
import { withAutoTimeout, isTimeoutError } from './utils/timeout.js';
import { assertProfileSetupRequest } from './utils/profileSetupProtocol.js';

/**
 * [CN] 发送一个公共的 GET 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {ApiError} 如果请求失败或超时，则抛出 ApiError。
 */
async function simpleGet(path) {

  try {
    const op = get({ apiName: 'api', path });
    // 使用自动超时配置
    return await withAutoTimeout(op, { method: 'GET', path });
  } catch (error) {

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
 * @param {{signal?: AbortSignal, returnEnvelope?: boolean}} [options] - 取消信号及是否保留响应包装对象。
 * @returns {Promise<any>} 一个解析为 API 响应数据的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证，则抛出 AuthenticationError。
 * @throws {ApiError} 如果请求失败或超时，则抛出 ApiError。
 */
async function authenticatedGet(path, { signal, returnEnvelope = false } = {}) {

  const session = await fetchAuthSession();
  signal?.throwIfAborted();
  const idToken = session.tokens?.idToken;
  if (!idToken) {
    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'GET',
      requestPath: path
    });
  }
  let cancelRequest;
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
    // 某些 Amplify 适配器不暴露 cancel；中止能力缺失时仍须保留原始请求错误。
    cancelRequest = typeof op.cancel === 'function' ? () => op.cancel() : undefined;
    if (cancelRequest) signal?.addEventListener('abort', cancelRequest, { once: true });
    // 使用自动超时配置
    const result = await withAutoTimeout(op, { method: 'GET', path });

    if (returnEnvelope) return result;
    if (result.data) {
      return result.data;
    } else if (result.events) {
      return result.events;
    }
    return result;
  } catch (error) {

    // 如果是超时错误,直接抛出
    if (isTimeoutError(error)) {
      cancelRequest?.();
      throw error;
    }
    throw ApiError.from(error, {
      requestMethod: 'GET',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  } finally {
    if (cancelRequest) signal?.removeEventListener('abort', cancelRequest);
  }
}

/**
 * [CN] 发送一个经过身份验证的 POST 请求 (带超时控制)。
 * @param {string} path - 请求的 API 路径。
 * @param {object} bodyData - 要在请求正文中发送的数据。
 * @param {string} [expectedUserId] - 若指定，发送前核对凭证所属账号。
 * @returns {Promise<any>} 一个解析为 API 响应 JSON 的 Promise。
 * @throws {AuthenticationError} 如果用户未通过身份验证。
 * @throws {ApiError} 如果请求失败或超时。
 */
async function authenticatedPost(path, bodyData, expectedUserId) {

  const session = await fetchAuthSession();
  const idTokenRaw = session.tokens?.idToken;
  const idToken = typeof idTokenRaw === 'string' ? idTokenRaw : idTokenRaw?.toString?.();
  if (!idToken) {

    throw new AuthenticationError('未检测到身份凭证，请登录后重试。', {
      requestMethod: 'POST',
      requestPath: path
    });
  }
  if (expectedUserId) {
    // 使用即将发送的同一份凭证核对归属，避免等待会话读取期间切换账号造成串号。
    let subject = idTokenRaw?.payload?.sub;
    if (!subject) {
      try {
        const encoded = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        subject = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))).sub;
      } catch {
        // 无法确认账号时拒绝发送，不猜测当前登录身份。
      }
    }
    if (subject !== expectedUserId) {
      throw new AuthenticationError('登录账号已变化，请切回保存记录时的账号后重试。', {
        requestMethod: 'POST', requestPath: path
      });
    }
  }
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
 * @param {{expectedUserId?: string, clientRequestId?: string}} [options] - 记录归属检查及稳定的幂等标识。
 * @returns {Promise<object>} 一个解析为 API 响应的 Promise，其中包含已创建的事件项目。
 */
export const addEvent = async (eventData, { expectedUserId, clientRequestId } = {}) => {
  const requestBody = { type: eventData.type, date: eventData.date, details: eventData.details };
  // 离线重试共用已持久化的标识，不能在每次请求时重新生成。
  if (clientRequestId !== undefined) requestBody.clientRequestId = clientRequestId;
  if (Array.isArray(eventData.attachments) && eventData.attachments.length) {
    requestBody.attachments = eventData.attachments;
  }
  return authenticatedPost('/events', requestBody, expectedUserId);
};

/**
 * [CN] 获取所有事件的列表。
 * @returns {Promise<Array<object>>} 一个解析为事件对象数组的 Promise。
 */
export const getAllEvents = async () => {
  return simpleGet('/all-events');
};

/**
 * 获取公共首屏的轻量事件投影，不加载文本明细和分析原始结果。
 * @returns {Promise<object[]>} 统计及曲线所需的全部公开事件。
 */
export const getPublicDashboard = () => simpleGet('/public/dashboard');

/**
 * 读取当前启用的朗读稿件库。
 * @returns {Promise<Array<{passageId: string, title: string, author: string, content: string}>>}
 */
export const getReadingPassages = () => simpleGet('/reading-passages');

/**
 * 按首屏日期顺序分页读取用户明细，服务端重新检查公开状态。
 * @param {string} userId 用户 ID。
 * @param {string[]} eventIds 本页最多 20 个事件 ID。
 * @returns {Promise<object[]>} 当前仍公开的事件明细。
 */
export const getPublicEventDetails = (userId, eventIds) =>
  simpleGet(`/public/users/${encodeURIComponent(userId)}/events?ids=${encodeURIComponent(JSON.stringify(eventIds))}`);

/**
 * [CN] 根据用户 ID 获取事件。
 * @param {string} userId - 用户的唯一标识符。
 * @returns {Promise<Array<object>>} 一个解析为该用户完整事件数组的 Promise。
 * @throws {ServiceError} 后端没有确认已读取全部分页时拒绝把部分记录用于统计。
 */
export const getEventsByUserId = async (userId) => {
  const path = `/events/${userId}`;
  const response = await authenticatedGet(path, { returnEnvelope: true });
  if (!response || response.complete !== true || !Array.isArray(response.events)) {
    throw new ServiceError('事件历史响应不完整，请稍后重试。', {
      requestMethod: 'GET',
      requestPath: path,
      serviceName: 'Voice Events',
      details: { complete: response?.complete === true },
    });
  }
  return response.events;
};

/**
 * [CN] 根据事件 ID 删除一个事件。
 * @param {string} eventId - 要删除事件的唯一标识符。
 * @returns {Promise<object>} 一个解析为确认消息的 Promise。
 */
export const deleteEvent = async (eventId) => {

  return authenticatedDelete(`/event/${eventId}`);
};

/**
 * [CN] 调用 Gemini代理 以获取基于提示的响应。
 * @param {string} prompt - 发送到 AI 代理的提示。
 * @returns {Promise<{response: string, rateLimited?: boolean}>} 一个解析为包含 AI 生成的响应字符串和可选限速标志的对象的 Promise。
 * @throws {ServiceError} 如果代理服务调用失败。
 */
export const callGeminiProxy = async (prompt) => {
  const result = await authenticatedPost('/gemini-proxy', { prompt });
  if (result.success) {
    // 如果被限速，返回限速信息
    if (result.rateLimited) {
      return { response: result.response, rateLimited: true };
    }
    return { response: result.response, rateLimited: false };
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
/**
 * 计算用户训练一致性分数
 * @param {Array} events - 用户事件列表
 * @returns {number} 0-100的一致性分数
 */
const calculateConsistencyScore = (events) => {
  if (!events || events.length === 0) return 0;

  const trainingEvents = events.filter(e => e.type === 'training');
  if (trainingEvents.length < 2) return 50;

  // 计算训练频率的一致性
  const dates = trainingEvents.map(e => parseEventDate(e.createdAt || e.date)).sort((a, b) => a - b);
  const intervals = [];

  for (let i = 1; i < dates.length; i++) {
    const interval = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24); // 天数
    intervals.push(interval);
  }

  if (intervals.length === 0) return 50;

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

  // 一致性分数：方差越小，分数越高
  const consistencyScore = Math.max(0, Math.min(100, 100 - variance * 2));

  return Math.round(consistencyScore);
};

/**
 * [CN] 根据用户的事件数据生成一条鼓励性消息。如果 AI 未启用或调用失败，则返回默认消息。
 * @param {object} userData - 包含用户事件数据的对象。
 * @param {object} [options] - 额外选项。
 * @param {boolean} [options.throwOnError=false] - 发生错误时是否抛出异常，而不是返回默认文案。
 * @returns {Promise<string>} 一个解析为鼓励性消息字符串的 Promise。
 */
export const getEncouragingMessage = async (userData, options = {}) => {
  const { throwOnError = false } = options;
  // AI 功能默认启用，除非显式禁用
  const isAiEnabled = import.meta.env.VITE_ENABLE_AI !== 'false';
  if (!isAiEnabled) return "持续跟踪，持续进步 ✨";

  try {
    if (!userData || !userData.events || userData.events.length === 0) {
      return "开始记录你的声音数据，让我为你加油吧！";
    }



    // 构建丰富的数据摘要
    // 注意：传入的 userData.events 已经在调用方按时间排序并限制为最近30条
    const totalEvents = userData.events.length;
    const recentTrainingCount = userData.events.filter(e =>
      e.type === 'training' &&
      parseEventDate(e.createdAt || e.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    const consistencyScore = calculateConsistencyScore(userData.events);

    const eventsSummary = userData.events.map(e => {
      const date = parseEventDate(e.date || e.createdAt).toLocaleDateString('zh-CN');
      const details = e.details ? JSON.stringify(e.details) : '无';
      return `- 日期: ${date}, 事件类型: ${e.type}, 详情: ${details}`;
    }).join('\n');

    const userProgressSummary = `
用户声音训练进度摘要：
- 总事件数: ${totalEvents}
- 近7天训练次数: ${recentTrainingCount}
- 训练一致性分数: ${consistencyScore}/100
${userData.voiceParameters ? `- 最新声音参数: 基频 ${userData.voiceParameters.fundamental}Hz, 抖动 ${userData.voiceParameters.jitter}%, 微颤 ${userData.voiceParameters.shimmer}%` : ''}

最近详细记录 (Top 30):
${eventsSummary}
`;

    const prompt = `
这是用户的声音训练数据摘要和最近记录：
${userProgressSummary}

请基于这些数据，结合你的知识库，给用户一句鼓励和分析的话。
请注意：
1. 你的回复应该包含对用户当前状态的简要分析（例如：一致性分数高说明坚持得很好）。
2. 如果用户有进步（如近期训练频繁），请明确指出。
3. 给出具体的建议或鼓励。
4. 语气要温暖、专业且富有同理心。
5. 回复长度适中，不要太短，也不要过于冗长（建议不超过600字）。
6. 一致性分数对用户是不可见的，不要提到这个名词。
`;
    const result = await callGeminiProxy(prompt);
    return result.response;  // 返回响应内容（无论是否限速，后端都会返回有意义的消息）
  } catch (error) {

    if (throwOnError) {
      throw error;
    }
    return "持续跟踪，持续进步 ✨"; // Fallback message
  }
};

/**
 * [CN] 根据用户的音域推荐歌曲。
 * @param {object} range - 包含用户音域的对象。
 * @returns {Promise<{recommendations: Array<object>, rateLimited?: boolean, message?: string}>} 一个解析为包含歌曲推荐、限速标志和可选消息的对象的 Promise。
 * @throws {ServiceError} 如果歌曲推荐服务调用失败。
 */
export const getSongRecommendations = async ({ lowestNote, highestNote }) => {
  const result = await authenticatedPost('/recommend-songs', { lowestNote, highestNote });
  if (result.success) {
    // 如果被限速，返回上次的推荐结果和限速信息
    if (result.rateLimited) {
      return {
        recommendations: result.recommendations || [],
        rateLimited: true,
        message: result.message
      };
    }
    return {
      recommendations: result.recommendations,
      rateLimited: false
    };
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
  // 显式补丁字段确保旧后端拒绝新协议，不能把部分资料误当成完整替换。
  const requestBody = { profilePatch: profileData.profile };
  return authenticatedPut(`/user/${userId}`, requestBody);
};

/**
 * [CN] 为新用户设置个人资料。
 * @param {object} profileData - 包含新用户个人资料数据的对象。
 * @param {{exists:boolean,updatedAt:string|null}} baseVersion - 用户填写或保存草稿时看到的服务端版本。
 * @returns {Promise<object>} 一个解析为包含新用户信息和 `isNewUser` 标志的 API 响应的 Promise。
 * @throws {TypeError} 请求不符合资料设置协议时在发送前拒绝。
 */
export const setupUserProfile = async (profileData, baseVersion) => {
  const requestBody = { profile: profileData.profile, baseVersion };
  // 离线恢复后的首次请求不能依赖额外代码块；使用与草稿读写共享的轻量协议校验。
  assertProfileSetupRequest(requestBody);
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
 * @param {{signal?: AbortSignal}} [options] - 查询取消信号，离线或卸载时使用。
 * @returns {Promise<object>} 一个解析为测试结果对象的 Promise。
 */
export const getVoiceTestResults = async (sessionId, options) => {
  const path = `/results/${sessionId}`;
  return authenticatedGet(path, options);
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
 * [CN] 获取指定头像文件的预签名 URL。
 * @param {string} userId - 用户的唯一标识符。
 * @param {string} avatarKey - 头像文件在 S3 中的对象键。
 * @returns {Promise<string>} 一个解析为头像 URL 字符串的 Promise。
 */
export const getAvatarUrl = async (userId, avatarKey) => {
  if (!avatarKey) {
    throw new Error('avatarKey is required when requesting getAvatarUrl');
  }
  const path = `/avatar/${userId}?key=${encodeURIComponent(avatarKey)}`;
  const data = await simpleGet(path);
  return data.url;
};

/**
 * [CN] 检查用户的个人资料是否填写完整。
 * 用户资料被视为"完整"的条件之一：
 * 1. 用户有非空的名称，并且设置了隐私选项
 * 2. 用户明确跳过了资料设置（setupSkipped: true）
 * @param {object | null | undefined} userProfile - 用户的个人资料对象。
 * @returns {boolean} 如果个人资料完整或用户已跳过设置，则返回 true；否则返回 false。
 */
export const isUserProfileComplete = (userProfile) => {
  if (!userProfile || !userProfile.profile) return false;
  const { name, isNamePublic, areSocialsPublic, setupSkipped } = userProfile.profile;

  // 如果用户明确选择跳过设置，视为"完整"（不再弹出向导）
  if (setupSkipped === true) {
    return true;
  }

  const hasNonEmptyName = typeof name === 'string' && name.trim().length > 0;
  const hasPrivacySettings = typeof isNamePublic === 'boolean' && typeof areSocialsPublic === 'boolean';
  return hasNonEmptyName && hasPrivacySettings;
};
