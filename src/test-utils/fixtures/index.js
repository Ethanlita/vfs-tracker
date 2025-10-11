/**
 * @file 测试数据 Fixtures - 总导出
 */

// 用户数据
export * from './users/index.js';

// 事件数据
export * from './events/index.js';

// API 响应数据（简化版，基于已有数据）
export const mockApiResponses = {
  getAllEvents: null, // 将在 handlers 中使用 mockPublicEvents
  getUserEvents: null, // 将在 handlers 中动态生成
  addEvent: {
    message: 'Event added successfully',
    eventId: 'event_mock_new_001',
  },
  getUserProfile: null, // 将在 handlers 中使用 mockUsers
  updateUserProfile: {
    message: 'Profile updated successfully',
  },
};
