/**
 * @file User Profile Setup API 集成测试
 * @description 测试用户资料设置相关 API 和工具函数
 * 
 * 当前 API 接口:
 * - setupUserProfile(profileData) - 为新用户设置资料
 * - isUserProfileComplete(userProfile) - 检查资料完整性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupUserProfile, isUserProfileComplete } from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { ApiError } from '../../../src/utils/apiError.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

describe('User Profile Setup API 集成测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:new-user-001',
      email: 'newuser@example.com',
      nickname: 'New User'
    });
  });

  describe('setupUserProfile', () => {
    it('应该成功设置新用户资料', async () => {
      const profileData = {
        profile: {
          name: '测试用户',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('isNewUser');
    });

    it('返回的 user 对象应该包含完整信息', async () => {
      const profileData = {
        profile: {
          name: 'Alice',
          isNamePublic: true,
          socials: [
            { platform: 'twitter', handle: '@alice' }
          ],
          areSocialsPublic: true
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result.user).toBeDefined();
      expect(result.user).toHaveProperty('userId');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('profile');
      expect(result.user).toHaveProperty('createdAt');
      expect(result.user).toHaveProperty('updatedAt');
    });

    it('isNewUser 标志应该是 boolean 类型', async () => {
      const profileData = {
        profile: {
          name: 'Bob',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
        }
      };

      const result = await setupUserProfile(profileData);

      expect(typeof result.isNewUser).toBe('boolean');
    });

    it('应该正确保存用户的隐私设置', async () => {
      const profileData = {
        profile: {
          name: 'Charlie',
          isNamePublic: false,
          socials: [
            { platform: 'github', handle: 'charlie' }
          ],
          areSocialsPublic: false
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result.user.profile.isNamePublic).toBe(false);
      expect(result.user.profile.areSocialsPublic).toBe(false);
    });

    it('应该能处理没有社交账号的情况', async () => {
      const profileData = {
        profile: {
          name: 'Diana',
          isNamePublic: true,
          socials: [],
          areSocialsPublic: false
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result.user.profile.socials).toEqual([]);
    });

    it('应该能处理多个社交账号', async () => {
      const profileData = {
        profile: {
          name: 'Eve',
          isNamePublic: true,
          socials: [
            { platform: 'twitter', handle: '@eve' },
            { platform: 'github', handle: 'eve-dev' },
            { platform: 'linkedin', handle: 'eve-professional' }
          ],
          areSocialsPublic: true
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result.user.profile.socials.length).toBe(3);
    });

    it('不传 profile 时应该使用默认值', async () => {
      const profileData = {};

      const result = await setupUserProfile(profileData);

      expect(result.user.profile).toBeDefined();
      expect(result.user.profile.name).toBe('');
      expect(result.user.profile.isNamePublic).toBe(false);
      expect(result.user.profile.socials).toEqual([]);
      expect(result.user.profile.areSocialsPublic).toBe(false);
    });

    it('message 应该包含成功提示', async () => {
      const profileData = {
        profile: {
          name: 'Frank',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
        }
      };

      const result = await setupUserProfile(profileData);

      expect(result.message).toMatch(/success|completed/i);
    });
  });

  describe('isUserProfileComplete', () => {
    it('完整的用户资料应该返回 true', () => {
      const completeProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        profile: {
          name: 'Complete User',
          isNamePublic: true,
          socials: [],
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(completeProfile)).toBe(true);
    });

    it('缺少 name 应该返回 false', () => {
      const incompleteProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        profile: {
          name: '',
          isNamePublic: true,
          socials: [],
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(incompleteProfile)).toBe(false);
    });

    it('name 只有空格应该返回 false', () => {
      const incompleteProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        profile: {
          name: '   ',
          isNamePublic: true,
          socials: [],
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(incompleteProfile)).toBe(false);
    });

    it('缺少 isNamePublic 应该返回 false', () => {
      const incompleteProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        profile: {
          name: 'User',
          socials: [],
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(incompleteProfile)).toBe(false);
    });

    it('缺少 areSocialsPublic 应该返回 false', () => {
      const incompleteProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        profile: {
          name: 'User',
          isNamePublic: true,
          socials: []
        }
      };

      expect(isUserProfileComplete(incompleteProfile)).toBe(false);
    });

    it('null userProfile 应该返回 false', () => {
      expect(isUserProfileComplete(null)).toBe(false);
    });

    it('undefined userProfile 应该返回 false', () => {
      expect(isUserProfileComplete(undefined)).toBe(false);
    });

    it('缺少 profile 字段应该返回 false', () => {
      const incompleteProfile = {
        userId: 'user-123',
        email: 'user@example.com'
      };

      expect(isUserProfileComplete(incompleteProfile)).toBe(false);
    });

    it('空对象应该返回 false', () => {
      expect(isUserProfileComplete({})).toBe(false);
    });

    it('有效 name 和隐私设置就足够了', () => {
      const minimalCompleteProfile = {
        profile: {
          name: 'Min User',
          isNamePublic: false,
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(minimalCompleteProfile)).toBe(true);
    });

    it('isNamePublic 和 areSocialsPublic 必须是 boolean', () => {
      const invalidProfile1 = {
        profile: {
          name: 'User',
          isNamePublic: 'true', // 字符串而非 boolean
          areSocialsPublic: false
        }
      };

      const invalidProfile2 = {
        profile: {
          name: 'User',
          isNamePublic: true,
          areSocialsPublic: 1 // 数字而非 boolean
        }
      };

      expect(isUserProfileComplete(invalidProfile1)).toBe(false);
      expect(isUserProfileComplete(invalidProfile2)).toBe(false);
    });

    it('socials 字段不影响完整性判断', () => {
      const profileWithSocials = {
        profile: {
          name: 'Social User',
          isNamePublic: true,
          socials: [
            { platform: 'twitter', handle: '@user' }
          ],
          areSocialsPublic: true
        }
      };

      const profileWithoutSocials = {
        profile: {
          name: 'No Social User',
          isNamePublic: true,
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(profileWithSocials)).toBe(true);
      expect(isUserProfileComplete(profileWithoutSocials)).toBe(true);
    });
  });

  describe('错误状态码处理 (P1.2.4 - Phase 3.3 Code Review)', () => {
    const testProfileData = {
      profile: {
        name: '测试用户',
        isNamePublic: false,
        socials: [],
        areSocialsPublic: false
      }
    };

    describe('setupUserProfile 错误状态码', () => {
      it('应该处理 401 未授权错误', async () => {
        server.use(
          http.post(`${API_URL}/user/profile-setup`, () => {
            return HttpResponse.json(
              { error: 'Unauthorized', message: 'Token 已过期' },
              { status: 401 }
            );
          })
        );

        try {
          await setupUserProfile(testProfileData);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(401);
        }
      });

      it('应该处理 400 数据验证错误', async () => {
        server.use(
          http.post(`${API_URL}/user/profile-setup`, () => {
            return HttpResponse.json(
              { error: 'Bad Request', message: '资料数据格式错误' },
              { status: 400 }
            );
          })
        );

        try {
          await setupUserProfile(testProfileData);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(400);
        }
      });

      it('应该处理 409 用户已存在错误', async () => {
        server.use(
          http.post(`${API_URL}/user/profile-setup`, () => {
            return HttpResponse.json(
              { error: 'Conflict', message: '用户资料已设置' },
              { status: 409 }
            );
          })
        );

        try {
          await setupUserProfile(testProfileData);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(409);
        }
      });

      it('应该处理 500 服务器错误', async () => {
        server.use(
          http.post(`${API_URL}/user/profile-setup`, () => {
            return HttpResponse.json(
              { error: 'Internal Server Error', message: '资料设置失败' },
              { status: 500 }
            );
          })
        );

        try {
          await setupUserProfile(testProfileData);
          expect.fail('Should have thrown ApiError');
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError);
          expect(error.statusCode).toBe(500);
        }
      });
    });
  });
});
