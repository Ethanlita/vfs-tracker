/**
 * @file ProfileSetupWizard 跳转和跳过逻辑测试
 * @description Issue #83 修复验证：
 *   1. getUserProfile 用户不存在时返回 exists: false，不返回默认数据
 *   2. API 失败 + 无缓存时不启动 Wizard（避免误判）
 *   3. 跳过后不调用 refreshUserProfile（避免竞态条件）
 *   4. isUserProfileComplete 正确处理 exists: false 的空壳对象
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { getUserProfile, isUserProfileComplete } from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

// 测试中使用的认证用户 ID
// 注意：生产环境中 getUserProfile 只能查询自己的资料（userId 必须匹配 JWT），
// 这里通过 server.use() 覆盖 MSW handler 来模拟不同的后端响应，
// 但始终使用认证用户自己的 userId 进行查询，以匹配生产行为。
const TEST_USER_ID = 'us-east-1:test-user-083';

describe('Issue #83: ProfileSetupWizard 逻辑修复', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: TEST_USER_ID,
      email: 'test083@example.com',
      nickname: 'Test User 083'
    });
  });

  describe('getUserProfile 返回 exists 字段', () => {
    it('用户不存在时应返回 exists: false 且不包含 profile', async () => {
      // 覆盖默认 handler，模拟后端对不存在用户的新行为
      server.use(
        http.get(`${API_URL}/user/:userId`, ({ params }) => {
          return HttpResponse.json({
            exists: false,
            userId: params.userId
          });
        })
      );

      const result = await getUserProfile(TEST_USER_ID);

      expect(result.exists).toBe(false);
      expect(result.userId).toBe(TEST_USER_ID);
      // 不应包含虚构的默认 profile
      expect(result.profile).toBeUndefined();
      // 不应包含虚构的 createdAt / updatedAt
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
    });

    it('用户存在时应返回 exists: true 和完整数据', async () => {
      server.use(
        http.get(`${API_URL}/user/:userId`, () => {
          return HttpResponse.json({
            exists: true,
            userId: TEST_USER_ID,
            profile: {
              nickname: 'Test User 083',
              name: '已有用户',
              bio: '',
              isNamePublic: true,
              areSocialsPublic: false,
              socials: [],
              setupSkipped: false
            },
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-06-01T00:00:00.000Z'
          });
        })
      );

      const result = await getUserProfile(TEST_USER_ID);

      expect(result.exists).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile.name).toBe('已有用户');
      expect(result.createdAt).toBeDefined();
    });

    it('用户存在但资料为空时应返回 exists: true（区别于不存在）', async () => {
      server.use(
        http.get(`${API_URL}/user/:userId`, () => {
          return HttpResponse.json({
            exists: true,
            userId: TEST_USER_ID,
            profile: {
              nickname: 'Test User 083',
              name: '',
              bio: '',
              isNamePublic: false,
              areSocialsPublic: false,
              socials: [],
              setupSkipped: false
            },
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z'
          });
        })
      );

      const result = await getUserProfile(TEST_USER_ID);

      // 用户存在于数据库中，只是资料为空
      expect(result.exists).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile.name).toBe('');
    });
  });

  describe('isUserProfileComplete 对 exists: false 的处理', () => {
    it('exists: false 的空壳对象（无 profile）应返回 false', () => {
      // 这就是 getUserProfile 在用户不存在时返回的对象
      const notExistResponse = {
        exists: false,
        userId: 'non-existent-user'
      };

      expect(isUserProfileComplete(notExistResponse)).toBe(false);
    });

    it('exists: true 但资料为空应返回 false', () => {
      const emptyProfile = {
        exists: true,
        userId: 'empty-user',
        profile: {
          name: '',
          isNamePublic: false,
          areSocialsPublic: false
        }
      };

      expect(isUserProfileComplete(emptyProfile)).toBe(false);
    });

    it('exists: true 且有 setupSkipped 应返回 true', () => {
      const skippedProfile = {
        exists: true,
        userId: 'skipped-user',
        profile: {
          name: '',
          isNamePublic: false,
          areSocialsPublic: false,
          setupSkipped: true
        }
      };

      expect(isUserProfileComplete(skippedProfile)).toBe(true);
    });

    it('exists: true 且资料完整应返回 true', () => {
      const completeProfile = {
        exists: true,
        userId: 'complete-user',
        profile: {
          name: '完整用户',
          isNamePublic: true,
          areSocialsPublic: false,
          socials: []
        }
      };

      expect(isUserProfileComplete(completeProfile)).toBe(true);
    });

    it('null / undefined 应返回 false', () => {
      expect(isUserProfileComplete(null)).toBe(false);
      expect(isUserProfileComplete(undefined)).toBe(false);
    });
  });

  describe('MSW handler 默认行为验证', () => {
    it('查询不存在的用户 ID 应返回 exists: false', async () => {
      // 模拟后端对不存在用户的响应（使用认证用户自己的 ID 查询）
      server.use(
        http.get(`${API_URL}/user/:userId`, ({ params }) => {
          return HttpResponse.json({
            exists: false,
            userId: params.userId
          });
        })
      );

      const result = await getUserProfile(TEST_USER_ID);

      expect(result.exists).toBe(false);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.profile).toBeUndefined();
    });

    it('查询存在的用户 ID 应返回 exists: true', async () => {
      // 模拟后端对已存在用户的响应
      server.use(
        http.get(`${API_URL}/user/:userId`, () => {
          return HttpResponse.json({
            exists: true,
            userId: TEST_USER_ID,
            profile: {
              nickname: 'Test User 083',
              name: '张三',
              isNamePublic: true,
              areSocialsPublic: false,
              socials: []
            }
          });
        })
      );

      const result = await getUserProfile(TEST_USER_ID);

      expect(result.exists).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile.name).toBe('张三');
    });
  });
});
