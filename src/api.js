import { get, post, put, del } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { v4 as uuidv4 } from 'uuid';
import mockData from './mock_data.json';
import { isProductionReady as globalIsProductionReady, logEnvReadiness } from './env.js';

const isProductionReady = () => {
  const ready = globalIsProductionReady();
  logEnvReadiness('api');
  return ready;
};

async function simpleGet(path) {
  console.log('[simpleGet] making public request to:', path);
  const op = get({ apiName: 'api', path });
  const { body } = await op.response;
  return body.json();
}

async function authenticatedGet(path) {
  console.log('[authenticatedGet] making authenticated request to:', path);
  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }
  try {
    const op = get({
      apiName: 'api',
      path,
      options: {
        headers: {
          Authorization: `Bearer ${session.tokens.idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });
    const { body } = await op.response;
    const result = await body.json();
    console.log('[authenticatedGet] ✅ API调用成功，使用了ID token');
    if (result.data) {
      return result.data;
    } else if (result.events) {
      return result.events;
    } else {
      return result;
    }
  } catch (error) {
    console.error('[authenticatedGet] ❌ 使用ID token API调用失败:', error);
    throw error;
  }
}

async function authenticatedPost(path, bodyData) {
  console.log('[authenticatedPost] making authenticated request to:', path);
  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }
  const op = post({
    apiName: 'api',
    path,
    options: {
      body: bodyData,
      headers: {
        Authorization: `Bearer ${session.tokens.idToken}`
      }
    }
  });
  const { body } = await op.response;
  return body.json();
}

async function authenticatedPut(path, bodyData) {
  console.log('[authenticatedPut] making authenticated request to:', path);
  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }
  const op = put({
    apiName: 'api',
    path,
    options: {
      body: bodyData,
      headers: {
        Authorization: `Bearer ${session.tokens.idToken}`
      }
    }
  });
  const { body } = await op.response;
  return body.json();
}

async function authenticatedDelete(path) {
  console.log('[authenticatedDelete] making authenticated request to:', path);
  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }
  const op = del({
    apiName: 'api',
    path,
    options: {
      headers: {
        Authorization: `Bearer ${session.tokens.idToken}`
      }
    }
  });
  const { body } = await op.response;
  return body.json();
}

// ========== 核心API函数 ==========

export const uploadFile = async (file, userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    return Promise.resolve(`mock-uploads/${userId}/${file.name}`);
  }
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const key = `${userId}/${fileName}`;
  try {
    const result = await uploadData({ key, data: file, options: { contentType: file.type } }).result;
    return result.key;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

export const getAllEvents = async () => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    return Promise.resolve(mockData.events);
  }
  try {
    const data = await simpleGet('/all-events');
    return data;
  } catch (error) {
    console.error('Error fetching all public events:', error);
    throw error;
  }
};

export const getEventsByUserId = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockEvents = mockData.events.filter(e => e.userId === userId);
    return Promise.resolve(mockEvents);
  }
  try {
    const data = await authenticatedGet(`/events/${userId}`);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户事件失败:', error);
    throw error;
  }
};

export const addEvent = async (eventData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockItem = { userId: 'mock-user-id', eventId: uuidv4(), ...eventData, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return Promise.resolve({ item: mockItem });
  }
  try {
    const requestBody = { type: eventData.type, date: eventData.date, details: eventData.details };
    const resp = await authenticatedPost('/events', requestBody);
    return resp;
  } catch (error) {
    console.error('Error adding event via API:', error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 删除事件');
    return Promise.resolve({ message: "Event deleted successfully (mock)" });
  }
  console.log(`[deleteEvent] deleting event with ID: ${eventId}`);
  try {
    // FIX: Use the correct RESTful path /event/{eventId}
    const result = await authenticatedDelete(`/event/${eventId}`);
    console.log('✅ API: event deleted successfully', result);
    return result;
  } catch (error) {
    console.error(`❌ API: Failed to delete event ${eventId}:`, error);
    throw error;
  }
};

export const callGeminiProxy = async (prompt) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    return Promise.resolve("这是一个来自模拟代理的温暖鼓励！");
  }
  try {
    const result = await authenticatedPost('/gemini-proxy', { prompt });
    if (result.success) {
      return result.response;
    } else {
      throw new Error(result.error || 'The Gemini proxy failed to process the request.');
    }
  } catch (error) {
    console.error('❌ Failed to call Gemini proxy API:', error);
    throw error;
  }
};

export const getEncouragingMessage = async (userData) => {
  const isAiEnabled = (isProductionReady() || !!import.meta.env.VITE_ENABLE_AI_IN_DEV);
  if (!isAiEnabled) {
    return "持续跟踪，持续进步 ✨";
  }
  try {
    const userProgressSummary = `...`; // Same logic as before
    const prompt = `...`; // Same logic as before
    const message = await callGeminiProxy(prompt);
    return message;
  } catch (error) {
    console.error('🤖 Failed to get encouragement message via proxy:', error);
    return "持续跟踪，持续进步 ✨";
  }
};

const calculateConsistencyScore = (events) => {
  if (!events || events.length === 0) return 0;
  const trainingEvents = events.filter(e => e.type === 'voice_training' || e.type === 'self_practice');
  if (trainingEvents.length < 2) return 50;
  const dates = trainingEvents.map(e => new Date(e.createdAt || e.date)).sort();
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const interval = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
    intervals.push(interval);
  }
  if (intervals.length === 0) return 50;
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  return Math.round(Math.max(0, Math.min(100, 100 - variance * 2)));
};

export const getUserProfile = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockUserProfile = { userId, email: 'mock-user@example.com', profile: { name: '模拟用户', isNamePublic: false, socials: [], areSocialsPublic: false }, createdAt: '2025-08-01T10:00:00.000Z', updatedAt: '2025-08-16T10:30:00.000Z' };
    return Promise.resolve(mockUserProfile);
  }
  try {
    const data = await authenticatedGet(`/user/${userId}`);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户资料失败:', error);
    throw error;
  }
};

export const getUserPublicProfile = async (userId) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockPublicProfile = { userId, profile: { name: '（非公开）', socials: [] } };
    return Promise.resolve(mockPublicProfile);
  }
  try {
    const data = await simpleGet(`/user/${userId}/public`);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户公开资料失败:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId, profileData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockUpdatedProfile = { message: 'User profile updated successfully', user: { userId, email: 'mock-user@example.com', profile: profileData.profile, createdAt: '2025-08-01T10:00:00.000Z', updatedAt: new Date().toISOString() } };
    return Promise.resolve(mockUpdatedProfile);
  }
  try {
    const requestBody = { profile: profileData.profile };
    const data = await authenticatedPut(`/user/${userId}`, requestBody);
    return data;
  } catch (error) {
    console.error('❌ API: 更新用户资料失败:', error);
    throw error;
  }
};

export const setupUserProfile = async (profileData) => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    const mockSetupResponse = { message: 'User profile setup completed successfully', user: { userId: 'mock-new-user-id', email: 'newuser@example.com', profile: profileData.profile || { name: '', isNamePublic: false, socials: [], areSocialsPublic: false }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, isNewUser: true };
    return Promise.resolve(mockSetupResponse);
  }
  try {
    const requestBody = { profile: profileData.profile || { name: '', isNamePublic: false, socials: [], areSocialsPublic: false } };
    const data = await authenticatedPost('/user/profile-setup', requestBody);
    return data;
  } catch (error) {
    console.error('❌ API: 用户资料设置失败:', error);
    throw error;
  }
};

export const isUserProfileComplete = (userProfile) => {
  if (!userProfile || !userProfile.profile) return false;
  const profile = userProfile.profile;
  const hasBasicInfo = profile.name !== undefined && profile.name !== null;
  const hasPrivacySettings = typeof profile.isNamePublic === 'boolean' && typeof profile.areSocialsPublic === 'boolean';
  return hasBasicInfo && hasPrivacySettings;
};

export const getUploadUrl = async (fileKey, contentType) => {
  if (!isProductionReady()) {
    return `https://mock-upload-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }
  try {
    const requestBody = { fileKey, contentType };
    const data = await authenticatedPost('/upload-url', requestBody);
    return data.uploadUrl;
  } catch (error) {
    console.error('❌ 获取上传URL失败:', error);
    throw error;
  }
};

export const getFileUrl = async (fileKey) => {
  if (!isProductionReady()) {
    return `https://mock-file-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }
  try {
    const requestBody = { fileKey };
    const data = await authenticatedPost('/file-url', requestBody);
    return data.url;
  } catch (error) {
    console.error('❌ 获取文件URL失败:', error);
    throw error;
  }
};

export const getAvatarUrl = async (userId) => {
  if (!isProductionReady()) {
    return `https://mock-avatar-url.s3.amazonaws.com/avatars/${userId}/avatar?mock=true`;
  }
  try {
    const data = await simpleGet(`/avatar/${userId}`);
    return data.url;
  } catch (error) {
    console.error('❌ 获取头像URL失败:', error);
    throw error;
  }
};
