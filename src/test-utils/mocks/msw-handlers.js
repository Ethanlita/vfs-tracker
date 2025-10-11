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

// ==================== Upload API Handlers ====================

/**
 * POST /upload-url - 获取上传 URL
 * 真实 API 路径: /upload-url (不是 /get-upload-url)
 * 接收: {fileKey, contentType}
 * 返回: {uploadUrl} - 注意真实 API 返回的是 uploadUrl 字符串
 */
const getUploadUrlHandler = http.post(`${API_URL}/upload-url`, async ({ request }) => {
  console.log('[MSW] Handling POST /upload-url');
  
  try {
    const body = await request.json();
    const { fileKey, contentType } = body;
    console.log('[MSW] Upload URL request:', { fileKey, contentType });
    
    // 模拟预签名 URL（包含时间戳）
    const timestamp = Date.now();
    const mockUploadUrl = `https://mock-s3-bucket.s3.amazonaws.com/${fileKey}?X-Amz-Signature=mock&timestamp=${timestamp}&Content-Type=${encodeURIComponent(contentType)}`;
    
    // 真实 API 返回 {uploadUrl: string}
    return HttpResponse.json({
      uploadUrl: mockUploadUrl,
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
const getAvatarUrlHandler = http.get(`${API_URL}/avatar/:userId`, ({ params }) => {
  const { userId } = params;
  console.log(`[MSW] Handling GET /avatar/${userId}`);
  
  // 模拟头像 URL（可能是 CloudFront 公开 URL）
  const mockAvatarUrl = `https://mock-cdn.cloudfront.net/avatars/${userId}/avatar.jpg?timestamp=${Date.now()}`;
  
  // 真实 API 返回 {url: string}
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
  
  // User Profile APIs
  getUserProfileHandler,
  updateUserProfileHandler,
  getUserPublicProfileHandler,
  
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
  getUserProfileHandler,
  updateUserProfileHandler,
  getUserPublicProfileHandler,
  getUploadUrlHandler,
  getFileUrlHandler,
  getAvatarUrlHandler,
};
