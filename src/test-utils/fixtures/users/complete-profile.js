/**
 * @file 用户测试数据 - 完整资料
 * @description 包含所有字段的完整用户资料
 */

export const completeProfileUser = {
  userId: 'us-east-1:complete-user-001',
  email: 'complete@example.com',
  profile: {
    name: '张三',
    nickname: 'zhangsan',
    bio: '我是一名嗓音训练爱好者，正在探索声音女性化的旅程。',
    avatarUrl: 'https://mock-cdn.cloudfront.net/avatars/us-east-1:complete-user-001/avatar.jpg',
    avatarKey: 'avatars/us-east-1:complete-user-001/latest.png',
    isNamePublic: true,
    areSocialsPublic: true,
    socials: [
      {
        platform: 'Twitter',
        handle: '@zhangsan_voice',
      },
      {
        platform: 'Weibo',
        handle: '张三的嗓音日记',
      },
      {
        platform: 'Bilibili',
        handle: 'zhangsan_voice',
      },
    ],
  },
  createdAt: '2024-01-15T08:30:00.000Z',
  updatedAt: '2025-10-01T10:20:00.000Z',
};
