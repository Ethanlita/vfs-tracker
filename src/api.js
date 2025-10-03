import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { v4 as uuidv4 } from 'uuid';
import mockData from './mock_data.json';
import { isProductionReady as globalIsProductionReady, logEnvReadiness } from './env.js';
import { ApiError, AuthenticationError, ServiceError, UploadError } from './utils/apiError.js';

export const PROFILE_CACHE_KEY = 'lastGoodUserProfile:v1';

const isProductionReady = () => {
  const ready = globalIsProductionReady();
  logEnvReadiness('api');
  return ready;
};

async function simpleGet(path) {
  console.log('[simpleGet] making public request to:', path);
  try {
    const op = get({ apiName: 'api', path });
    const { body } = await op.response;
    return body.json();
  } catch (error) {
    console.error(`[simpleGet] 请求失败: ${path}`, error);
    throw ApiError.from(error, {
      requestMethod: 'GET',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

async function authenticatedGet(path) {
  console.log('[authenticatedGet] making authenticated request to:', path);
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
    const { body } = await op.response;
    const result = await body.json();
    console.log('✅ API调用成功，使用了ID token');
    if (result.data) {
      return result.data;
    } else if (result.events) {
      return result.events;
    }
    return result;
  } catch (error) {
    console.error('❌ 使用ID token API调用失败:', error);
    throw ApiError.from(error, {
      requestMethod: 'GET',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

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
  console.debug('[authenticatedPost] ID Token preview (first 20 chars):', idToken.slice(0,20));
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
    const { body } = await op.response;
    return body.json();
  } catch (error) {
    console.error(`[authenticatedPost] 请求失败: ${path}`, error);
    throw ApiError.from(error, {
      requestMethod: 'POST',
      requestPath: path,
      details: { body: bodyData },
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

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
    const { body } = await op.response;
    return body.json();
  } catch (error) {
    console.error(`[authenticatedPut] 请求失败: ${path}`, error);
    throw ApiError.from(error, {
      requestMethod: 'PUT',
      requestPath: path,
      details: { body: bodyData },
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

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
    const { body } = await op.response;
    return body.json();
  } catch (error) {
    console.error(`[authenticatedDelete] 请求失败: ${path}`, error);
    throw ApiError.from(error, {
      requestMethod: 'DELETE',
      requestPath: path,
      statusCode: error?.$metadata?.httpStatusCode ?? error?.statusCode ?? error?.status
    });
  }
}

// ========== 核心API函数 ==========

export const addEvent = async (eventData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockItem = { userId: 'mock-user-id', eventId: uuidv4(), ...eventData, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return Promise.resolve({ item: mockItem });
  }
  const requestBody = { type: eventData.type, date: eventData.date, details: eventData.details };
  if (Array.isArray(eventData.attachments) && eventData.attachments.length) {
    requestBody.attachments = eventData.attachments;
  }
  return authenticatedPost('/events', requestBody);
};

export const getAllEvents = async () => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    // eslint-disable-next-line no-unused-vars
    return Promise.resolve(mockData.events.map(({ attachments: _attachments, ...rest }) => rest));
  }
  return simpleGet('/all-events');
};

export const getEventsByUserId = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    return Promise.resolve(mockData.events.filter(e => e.userId === userId));
  }
  return await authenticatedGet(`/events/${userId}`);
};

export const deleteEvent = async (eventId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 删除事件');
    return Promise.resolve({ message: "Event deleted successfully (mock)" });
  }
  console.log(`[deleteEvent] deleting event with ID: ${eventId}`);
  // FIX: Use the correct RESTful path /event/{eventId}
  return authenticatedDelete(`/event/${eventId}`);
};

export const callGeminiProxy = async (prompt) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    return Promise.resolve("这是一个来自模拟代理的温暖鼓励！");
  }
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

export const getEncouragingMessage = async (userData) => {
  const isAiEnabled = (isProductionReady() || !!import.meta.env.VITE_ENABLE_AI_IN_DEV);
  if (!isAiEnabled) return "持续跟踪，持续进步 ✨";

  try {
    // If there's no data, return a generic starter message.
    if (!userData || !userData.events || userData.events.length === 0) {
      return "开始记录你的声音数据，让我为你加油吧！";
    }

    // Construct a detailed prompt from userData.
    // The backend lambda already has the full knowledge base.
    // The prompt here should just be the user's specific data, formatted clearly.
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

    console.log("Constructed prompt for Gemini:", prompt);
    return await callGeminiProxy(prompt);
  } catch (error) {
    console.error("获取AI消息失败:", error);
    return "持续跟踪，持续进步 ✨"; // Fallback message
  }
};

export const getSongRecommendations = async ({ lowestNote, highestNote }) => {
  const isAiEnabled = (isProductionReady() || !!import.meta.env.VITE_ENABLE_AI_IN_DEV);
  if (!isAiEnabled) {
    console.log('🔧 开发/未就绪：mock 歌曲推荐');
    return Promise.resolve([
      { songName: "Mock Song 1", artist: "Mock Artist A", reason: "这是一个模拟的推荐理由。" },
      { songName: "Mock Song 2", artist: "Mock Artist B", reason: "这首歌的音域非常适合您。" },
    ]);
  }

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

export const getUserProfile = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockUserProfile = { userId, email: 'mock-user@example.com', profile: { name: '模拟用户', isNamePublic: false, socials: [], areSocialsPublic: false }, createdAt: '2025-08-01T10:00:00.000Z', updatedAt: '2025-08-16T10:30:00.000Z' };
    return Promise.resolve(mockUserProfile);
  }
  return authenticatedGet(`/user/${userId}`);
};

export const getUserPublicProfile = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockPublicProfile = { userId, profile: { name: '（非公开）', socials: [] } };
    return Promise.resolve(mockPublicProfile);
  }
  return simpleGet(`/user/${userId}/public`);
};

export const updateUserProfile = async (userId, profileData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockUpdatedProfile = { message: 'User profile updated successfully', user: { userId, email: 'mock-user@example.com', profile: profileData.profile, createdAt: '2025-08-01T10:00:00.000Z', updatedAt: new Date().toISOString() } };
    return Promise.resolve(mockUpdatedProfile);
  }
  const requestBody = { profile: profileData.profile };
  return authenticatedPut(`/user/${userId}`, requestBody);
};

export const setupUserProfile = async (profileData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockSetupResponse = { message: 'User profile setup completed successfully', user: { userId: 'mock-new-user-id', email: 'newuser@example.com', profile: profileData.profile || { name: '', isNamePublic: false, socials: [], areSocialsPublic: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, isNewUser: true };
    return Promise.resolve(mockSetupResponse);
  }
  const requestBody = { profile: profileData.profile || { name: '', isNamePublic: false, socials: [], areSocialsPublic: false } };
  return authenticatedPost('/user/profile-setup', requestBody);
};

// New API functions for Voice Test
export const createVoiceTestSession = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('[mock] createVoiceTestSession: Returning mock session ID');
    return Promise.resolve({ sessionId: uuidv4() });
  }
  const path = '/sessions';
  const bodyData = userId ? { userId } : {};
  return authenticatedPost(path, bodyData);
};

export const getVoiceTestUploadUrl = async (sessionId, step, fileName, contentType) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('[mock] getVoiceTestUploadUrl: Returning mock upload URL');
    const mockObjectKey = `voice-tests/mock-user/${sessionId}/raw/${step}/${fileName}`;
    return Promise.resolve({
      putUrl: `https://mock-s3-bucket.s3.amazonaws.com/${mockObjectKey}?mock=true`,
      objectKey: mockObjectKey
    });
  }
  const path = '/uploads';
  const bodyData = { sessionId, step, fileName, contentType };
  return authenticatedPost(path, bodyData);
};

export const uploadVoiceTestFileToS3 = async (putUrl, file) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('[mock] uploadVoiceTestFileToS3: Simulating successful upload');
    return Promise.resolve();
  }
  try {
    const response = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'audio/wav' // Ensure this matches the expected content type
      },
      body: file
    });
    if (!response.ok) {
      // Use the new UploadError and fromResponse method
      throw await UploadError.fromResponse(response, {
        requestMethod: 'PUT',
        requestPath: putUrl,
        uploadUrl: putUrl,
      });
    }
    console.log('✅ S3: Voice test file uploaded successfully');
    return response;
  } catch (error) {
    console.error('❌ S3: Failed to upload voice test file:', error);
    // Ensure any failure from this function is wrapped as an UploadError
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

let mockGetResultsCallCount = 0;
const MOCK_POLLING_THRESHOLD = 2; // Return processing for 2 calls, then done

export const requestVoiceTestAnalyze = async (sessionId, calibration, forms) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('[mock] requestVoiceTestAnalyze: Returning mock queued status');
    return Promise.resolve({ status: 'queued', sessionId });
  }
  const path = '/analyze';
  const bodyData = { sessionId, calibration, forms };
  return authenticatedPost(path, bodyData);
};

export const getVoiceTestResults = async (sessionId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    mockGetResultsCallCount++;
    if (mockGetResultsCallCount <= MOCK_POLLING_THRESHOLD) {
      console.log(`[mock] getVoiceTestResults: Returning mock processing status (call ${mockGetResultsCallCount})`);
      return Promise.resolve(mockData.voiceTestResults.processing);
    } else {
      console.log('[mock] getVoiceTestResults: Returning mock done status');
      // Reset counter for next session or test run
      mockGetResultsCallCount = 0;
      return Promise.resolve(mockData.voiceTestResults.done);
    }
  }
  const path = `/results/${sessionId}`;
  return authenticatedGet(path);
};

export const getUploadUrl = async (fileKey, contentType) => {
  if (!isProductionReady()) {
    return `https://mock-upload-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }
  const requestBody = { fileKey, contentType };
  const data = await authenticatedPost('/upload-url', requestBody);
  return data.uploadUrl;
};

export const getFileUrl = async (fileKey) => {
  if (!isProductionReady()) {
    return `https://mock-file-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }
  const requestBody = { fileKey };
  const data = await authenticatedPost('/file-url', requestBody);
  return data.url;
};

export const getAvatarUrl = async (userId) => {
  if (!isProductionReady()) {
    return `https://mock-avatar-url.s3.amazonaws.com/avatars/${userId}/avatar?mock=true`;
  }
  const data = await simpleGet(`/avatar/${userId}`);
  return data.url;
};

export const isUserProfileComplete = (userProfile) => {
  if (!userProfile || !userProfile.profile) return false;
  const { name, isNamePublic, areSocialsPublic } = userProfile.profile;
  const hasNonEmptyName = typeof name === 'string' && name.trim().length > 0;
  const hasPrivacySettings = typeof isNamePublic === 'boolean' && typeof areSocialsPublic === 'boolean';
  return hasNonEmptyName && hasPrivacySettings;
};
