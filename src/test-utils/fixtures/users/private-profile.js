/**
 * @file 用户测试数据 - 私密资料用户
 * @description 所有信息都不公开的用户
 */

export const privateProfileUser = {
  userId: 'us-east-1:private-user-004',
  email: 'private@example.com',
  profile: {
    name: '王小红',
    nickname: 'wangxiaohong',
    bio: null,
    avatarKey: null,
    isNamePublic: false,
    areSocialsPublic: false,
    socials: [
      {
        platform: 'Twitter',
        handle: '@private_user',
      },
    ],
  },
  createdAt: '2025-08-01T10:00:00.000Z',
  updatedAt: '2025-08-01T10:00:00.000Z',
};
