/**
 * @file 用户测试数据 - 公开资料用户
 * @description 所有信息都公开的用户
 */

export const publicProfileUser = {
  userId: 'us-east-1:public-user-003',
  email: 'public@example.com',
  profile: {
    name: '李明',
    nickname: 'liming',
    bio: '分享我的嗓音训练经验',
    avatarKey: 'avatars/us-east-1:public-user-003/latest.png',
    isNamePublic: true,
    areSocialsPublic: true,
    socials: [
      {
        platform: 'Twitter',
        handle: '@liming_voice',
      },
    ],
  },
  createdAt: '2025-05-10T09:00:00.000Z',
  updatedAt: '2025-09-15T11:30:00.000Z',
};
