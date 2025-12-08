/**
 * @file MSW Request Handlers
 * @description 定义所有 API 端点的 mock handlers
 */

import { http, HttpResponse } from 'msw';
import { 
  mockPublicEvents, 
  mockPrivateEvents,
  mockUsers,
  mockApiResponses,
} from '../fixtures/index.js';
import { getFullApiEndpoint } from '../../env.js';

// API Base URL - 使用统一的 env.js 配置
// 这样可以自动处理 VITE_API_ENDPOINT + VITE_API_STAGE 的组合
const API_URL = getFullApiEndpoint();

console.log(`[MSW] API URL: ${API_URL}`);

// ==================== Event API Handlers ====================

/**
 * GET /all-events - 获取所有公共事件
 */
const getAllEventsHandler = http.get(`${API_URL}/all-events`, () => {
  console.log('[MSW] Handling GET /all-events');
  return HttpResponse.json(mockPublicEvents);
});

/**
 * GET /events/:userId - 获取用户的所有事件
 * 真实 API 返回格式: {events: [...], debug: {...}}
 * 契约测试验证: tests/contract/api-contract.test.js
 */
const getUserEventsHandler = http.get(`${API_URL}/events/:userId`, ({ params }) => {
  const { userId } = params;
  console.log(`[MSW] Handling GET /events/${userId}`);
  
  // 过滤出该用户的事件
  const userEvents = mockPrivateEvents.filter(event => event.userId === userId);
  
  // 返回 {events: [...]} 格式 (匹配真实 API)
  return HttpResponse.json({
    events: userEvents,
    debug: {
      lambdaExecuted: true,
      timestamp: new Date().toISOString(),
      success: true,
      eventCount: userEvents.length
    }
  });
});

/**
 * POST /events - 创建新事件
 * 真实 API 返回格式: {message: "Event added successfully", eventId: "event_..."}
 * 契约测试验证: tests/contract/api-contract.test.js:273
 */
const addEventHandler = http.post(`${API_URL}/events`, async ({ request }) => {
  console.log('[MSW] Handling POST /events');
  
  try {
    const body = await request.json();
    console.log('[MSW] Event data:', body);
    
    // 创建事件ID
    const eventId = `event_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    const newEvent = {
      eventId,
      userId: 'us-east-1:complete-user-001',
      type: body.type,
      date: body.date,
      details: body.details,
      attachments: body.attachments || [],
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // 添加到 mock 数据中
    mockPrivateEvents.push(newEvent);
    
    // 返回 {message, eventId} 格式 (匹配真实 API)
    return HttpResponse.json({
      message: 'Event added successfully',
      eventId: eventId
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * DELETE /event/:eventId - 删除事件
 */
const deleteEventHandler = http.delete(`${API_URL}/event/:eventId`, ({ params }) => {
  const { eventId } = params;
  console.log(`[MSW] Handling DELETE /event/${eventId}`);
  
  return HttpResponse.json({
    message: 'Event deleted successfully',
    eventId,
  });
});

// ==================== AI Services API Handlers ====================

/**
 * POST /gemini-proxy - 调用 Gemini AI 代理
 * 接收: {prompt}
 * 返回: {success: true, response: string} 或 {success: false, error: string}
 */
const callGeminiProxyHandler = http.post(`${API_URL}/gemini-proxy`, async ({ request }) => {
  console.log('[MSW] Handling POST /gemini-proxy');
  
  try {
    const body = await request.json();
    const { prompt } = body;
    console.log('[MSW] Gemini prompt:', prompt);
    
    // 模拟 AI 响应
    const mockResponse = '这是一个来自模拟 Gemini AI 的鼓励性消息！继续保持良好的声音健康习惯。✨';
    
    return HttpResponse.json({
      success: true,
      response: mockResponse,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * POST /recommend-songs - 获取歌曲推荐
 * 接收: {lowestNote, highestNote}
 * 返回: {success: true, recommendations: [...]} 或 {success: false, error: string}
 */
const getSongRecommendationsHandler = http.post(`${API_URL}/recommend-songs`, async ({ request }) => {
  console.log('[MSW] Handling POST /recommend-songs');
  
  try {
    const body = await request.json();
    const { lowestNote, highestNote } = body;
    console.log('[MSW] Song recommendation request:', { lowestNote, highestNote });
    
    // 模拟歌曲推荐
    const mockRecommendations = [
      {
        songName: '月亮代表我的心',
        artist: '邓丽君',
        reason: '这首歌的音域非常适合您当前的声音范围，旋律优美舒缓。'
      },
      {
        songName: '晴天',
        artist: '周杰伦',
        reason: '歌曲音域适中，适合日常练习和演唱。'
      }
    ];
    
    return HttpResponse.json({
      success: true,
      recommendations: mockRecommendations,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

// ==================== User Profile API Handlers ====================

/**
 * GET /user/:userId - 获取用户资料
 * 真实 API 返回格式: {userId, profile: {nickname, name, bio, ...}}
 * 契约测试验证: tests/contract/api-contract.test.js:205
 */
const getUserProfileHandler = http.get(`${API_URL}/user/:userId`, ({ params }) => {
  const { userId } = params;
  console.log(`[MSW] Handling GET /user/${userId}`);
  
  // 返回嵌套结构（匹配真实 API）
  const user = mockUsers.find(u => u.userId === userId) || mockUsers[0];
  return HttpResponse.json({
    userId: user.userId,
    profile: user.profile
  });
});

/**
 * PUT /user/:userId - 更新用户资料
 * 真实 API 路径: /user/:userId (不是 /profile/:userId)
 * 返回格式: {message: ..., user: {...}}
 */
const updateUserProfileHandler = http.put(`${API_URL}/user/:userId`, async ({ request, params }) => {
  const { userId } = params;
  console.log(`[MSW] Handling PUT /user/${userId}`);
  
  try {
    const body = await request.json();
    console.log('[MSW] Profile update data:', body);
    
    // 找到用户并更新
    const user = mockUsers.find(u => u.userId === userId) || mockUsers[0];
    const updatedUser = {
      ...user,
      profile: { ...user.profile, ...body.profile },
      updatedAt: new Date().toISOString(),
    };
    
    // 返回 {message, user} 格式（匹配真实 API）
    return HttpResponse.json({
      message: 'User profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * GET /user/:userId/public - 获取用户公开资料
 * 真实 API 路径: /user/:userId/public (不是 /public-profile/:userId)
 * 返回公开资料（根据隐私设置过滤）
 * 如果用户不存在，返回 404
 */
const getUserPublicProfileHandler = http.get(`${API_URL}/user/:userId/public`, ({ params }) => {
  const { userId } = params;
  console.log(`[MSW] Handling GET /user/${userId}/public`);
  
  // 检查用户是否存在
  const user = mockUsers.find(u => u.userId === userId);
  if (!user) {
    return HttpResponse.json(
      { message: 'User not found' },
      { status: 404 }
    );
  }
  
  // 返回公开资料（根据隐私设置过滤）- 匹配 Lambda 返回格式
  return HttpResponse.json({
    userId: user.userId,
    profile: {
      nickname: '（非公开）', // 公开资料中不显示真实 nickname
      name: user.profile.isNamePublic ? (user.profile.name || '（未设置）') : '（非公开）',
      bio: user.profile.bio || '',
      socials: user.profile.areSocialsPublic ? (user.profile.socials || []) : [],
    }
  });
});

/**
 * POST /user/profile-setup - 新用户资料设置
 * 接收: {profile: {name, isNamePublic, socials, areSocialsPublic, setupSkipped?}}
 * 返回: {message, user, isNewUser}
 */
const setupUserProfileHandler = http.post(`${API_URL}/user/profile-setup`, async ({ request }) => {
  console.log('[MSW] Handling POST /user/profile-setup');
  
  try {
    const body = await request.json();
    const profile = body.profile || {
      name: '',
      isNamePublic: false,
      socials: [],
      areSocialsPublic: false
    };
    
    console.log('[MSW] Profile setup data:', profile);
    
    // 构建新用户的 profile，保留 setupSkipped 字段
    const userProfile = {
      nickname: 'Test User',  // 从 Cognito 获取
      name: profile.name || '',
      bio: profile.bio || '',
      isNamePublic: profile.isNamePublic !== undefined ? profile.isNamePublic : false,
      socials: profile.socials || [],
      areSocialsPublic: profile.areSocialsPublic !== undefined ? profile.areSocialsPublic : false
    };
    
    // 保存 setupSkipped 字段，避免用户重复进入向导
    if (profile.setupSkipped !== undefined) {
      userProfile.setupSkipped = profile.setupSkipped;
    }
    
    // 创建新用户
    const newUser = {
      userId: `us-east-1:new-user-${Date.now()}`,
      email: 'newuser@example.com',
      profile: userProfile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return HttpResponse.json({
      message: 'User profile setup completed successfully',
      user: newUser,
      isNewUser: true,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

// ==================== Voice Test API Handlers ====================

/**
 * POST /sessions - 创建嗓音测试会话
 * 接收: {userId?}
 * 返回: {sessionId}
 */
const createVoiceTestSessionHandler = http.post(`${API_URL}/sessions`, async ({ request }) => {
  console.log('[MSW] Handling POST /sessions');
  
  try {
    const body = await request.json().catch(() => ({}));
    const { userId } = body;
    console.log('[MSW] Create session for userId:', userId);
    
    // 生成 UUID v4 格式的 sessionId
    const sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    return HttpResponse.json({ sessionId });
  } catch (error) {
    console.error('[MSW] Error in create session:', error);
    return HttpResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
});

/**
 * POST /uploads - 获取嗓音测试上传 URL
 * 接收: {sessionId, step, fileName, contentType}
 * 返回: {putUrl, objectKey}
 */
const getVoiceTestUploadUrlHandler = http.post(`${API_URL}/uploads`, async ({ request }) => {
  console.log('[MSW] Handling POST /uploads');
  
  try {
    const body = await request.json();
    const { sessionId, step, fileName, contentType } = body;
    console.log('[MSW] Upload URL request:', { sessionId, step, fileName, contentType });
    
    // 构造对象键
    const objectKey = `voice-tests/mock-user/${sessionId}/raw/${step}/${fileName}`;
    
    // 生成预签名 URL
    const timestamp = Date.now();
    const putUrl = `https://mock-s3-bucket.s3.amazonaws.com/${objectKey}?X-Amz-Signature=mock&timestamp=${timestamp}&Content-Type=${encodeURIComponent(contentType)}`;
    
    return HttpResponse.json({
      putUrl,
      objectKey,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * POST /analyze - 请求嗓音测试分析
 * 接收: {sessionId, calibration, forms}
 * 返回: {status, sessionId}
 */
const requestVoiceTestAnalyzeHandler = http.post(`${API_URL}/analyze`, async ({ request }) => {
  console.log('[MSW] Handling POST /analyze');
  
  try {
    const body = await request.json();
    const { sessionId, calibration, forms } = body;
    console.log('[MSW] Analyze request:', { sessionId, calibration, forms });
    
    // 模拟排队状态
    return HttpResponse.json({
      status: 'queued',
      sessionId,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * GET /results/:sessionId - 获取嗓音测试结果
 * 返回: {status, results?, ...}
 */
let resultCallCount = 0; // 模拟轮询计数器

const getVoiceTestResultsHandler = http.get(`${API_URL}/results/:sessionId`, ({ params }) => {
  const { sessionId } = params;
  console.log(`[MSW] Handling GET /results/${sessionId}`);
  
  resultCallCount++;
  
  // 前两次返回 processing，之后返回 done
  if (resultCallCount <= 2) {
    return HttpResponse.json({
      status: 'processing',
      sessionId,
      progress: resultCallCount * 50,
    });
  } else {
    // 重置计数器（用于下一个会话）
    resultCallCount = 0;
    
    return HttpResponse.json({
      status: 'done',
      sessionId,
      results: {
        pitch: {
          average: 220.5,
          range: { min: 180, max: 300 }
        },
        jitter: 0.45,
        shimmer: 2.1,
        quality: 'good',
      },
    });
  }
});

// ==================== Upload API Handlers ====================

/**
 * POST /upload-url - 获取上传 URL
 * 真实 API 路径: /upload-url (不是 /get-upload-url)
 * 接收: {fileKey, contentType}
 * 返回: {uploadUrl} - 注意真实 API 返回的是 uploadUrl 字符串
 */
const getUploadUrlHandler = http.post(`${API_URL}/upload-url`, async ({ request }) => {
  console.log('[MSW] Handling POST /upload-url');
  
  // CRITICAL: 使用 request.clone() 读取请求体,不会消费原始请求
  // 这样 Amplify mock 仍然可以读取 body
  let fileKey = 'test/file.mp3'; // 默认值
  let contentType = 'audio/mpeg'; // 默认值
  
  try {
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    if (body.fileKey) fileKey = body.fileKey;
    if (body.contentType) contentType = body.contentType;
  } catch (error) {
    console.warn('[MSW] Could not read request body, using defaults');
  }
  
  // 模拟预签名 URL（包含时间戳和真实的fileKey）
  const timestamp = Date.now();
  const encodedContentType = encodeURIComponent(contentType);
  const mockUploadUrl = `https://mock-s3-bucket.s3.amazonaws.com/${fileKey}?X-Amz-Signature=mock&timestamp=${timestamp}&Content-Type=${encodedContentType}`;
  
  const responseData = { uploadUrl: mockUploadUrl };
  console.log('[MSW] Returning response:', responseData);
  
  // 真实 API 返回 {uploadUrl: string}
  return HttpResponse.json(responseData);
});

/**
 * POST /file-url - 获取文件访问 URL
 * 真实 API 路径: /file-url (不是 /get-file-url)
 * 接收: {fileKey}
 * 返回: {url} - 注意真实 API 返回的字段名是 url
 */
const getFileUrlHandler = http.post(`${API_URL}/file-url`, async ({ request }) => {
  console.log('[MSW] Handling POST /file-url');
  
  try {
    const body = await request.json();
    const { fileKey } = body;
    console.log('[MSW] File URL request:', { fileKey });
    
    // 模拟预签名 URL（包含时间戳和过期时间）
    const timestamp = Date.now();
    const expiresIn = 3600; // 1 hour
    const mockFileUrl = `https://mock-s3-bucket.s3.amazonaws.com/${fileKey}?X-Amz-Signature=mock&timestamp=${timestamp}&Expires=${timestamp + expiresIn * 1000}`;
    
    // 真实 API 返回 {url: string}
    return HttpResponse.json({
      url: mockFileUrl,
    });
  } catch (error) {
    console.error('[MSW] Error parsing request body:', error);
    return HttpResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
});

/**
 * GET /avatar/:userId - 获取用户头像 URL
 * 真实 API 路径: /avatar/:userId (不是 POST /get-avatar-url)
 * 这是一个 GET 请求，不是 POST
 * 返回: {url} - 头像的公开或预签名 URL
 */
const getAvatarUrlHandler = http.get(`${API_URL}/avatar/:userId`, ({ request, params }) => {
  const { userId } = params;
  const url = new URL(request.url);
  const avatarKey = url.searchParams.get('key');

  console.log(`[MSW] Handling GET /avatar/${userId}`, { avatarKey });

  if (!avatarKey) {
    return HttpResponse.json({ error: 'avatarKey is required' }, { status: 400 });
  }

  const mockAvatarUrl = `https://mock-cdn.cloudfront.net/${avatarKey}?timestamp=${Date.now()}`;

  return HttpResponse.json({
    url: mockAvatarUrl,
  });
});

// ==================== 导出所有 Handlers ====================

export const handlers = [
  // Event APIs
  getAllEventsHandler,
  getUserEventsHandler,
  addEventHandler,
  deleteEventHandler,
  
  // AI Services APIs
  callGeminiProxyHandler,
  getSongRecommendationsHandler,
  
  // User Profile APIs
  getUserProfileHandler,
  updateUserProfileHandler,
  getUserPublicProfileHandler,
  setupUserProfileHandler,
  
  // Voice Test APIs
  createVoiceTestSessionHandler,
  getVoiceTestUploadUrlHandler,
  requestVoiceTestAnalyzeHandler,
  getVoiceTestResultsHandler,
  
  // Upload APIs
  getUploadUrlHandler,
  getFileUrlHandler,
  getAvatarUrlHandler,
];

// 导出单独的 handler 以便在测试中覆盖
export {
  getAllEventsHandler,
  getUserEventsHandler,
  addEventHandler,
  deleteEventHandler,
  callGeminiProxyHandler,
  getSongRecommendationsHandler,
  getUserProfileHandler,
  updateUserProfileHandler,
  getUserPublicProfileHandler,
  setupUserProfileHandler,
  createVoiceTestSessionHandler,
  getVoiceTestUploadUrlHandler,
  requestVoiceTestAnalyzeHandler,
  getVoiceTestResultsHandler,
  getUploadUrlHandler,
  getFileUrlHandler,
  getAvatarUrlHandler,
};
