/**
 * @file Profile Setup Skip 功能测试
 * @description 测试用户跳过资料设置时 setupSkipped 字段的保存和验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupUserProfile, isUserProfileComplete } from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';
import { server } from '../../../src/test-utils/mocks/msw-server.js';

const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';

describe('Profile Setup Skip 功能测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:skip-test-user',
      email: 'skip@example.com',
      nickname: 'Skip Test User'
    });
  });

  describe('跳过设置流程', () => {
    it('应该成功保存 setupSkipped=true 标记', async () => {
      const skipPayload = {
        profile: {
          name: '',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false,
          setupSkipped: true  // 核心字段
        }
      };

      const response = await setupUserProfile(skipPayload);

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      // 验证后端保存了 setupSkipped 字段
      expect(response.user.profile.setupSkipped).toBe(true);
    });

    it('跳过后的资料应该被判定为完整', async () => {
      const userProfile = {
        userId: 'us-east-1:skip-test-user',
        profile: {
          name: '',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false,
          setupSkipped: true  // 关键：setupSkipped = true
        }
      };

      // 使用 isUserProfileComplete 函数来判断
      const isComplete = isUserProfileComplete(userProfile);
      expect(isComplete).toBe(true);
    });

    it('未设置 setupSkipped 的空资料应该被判定为不完整', async () => {
      const userProfile = {
        userId: 'us-east-1:skip-test-user',
        profile: {
          name: '',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
          // 注意：没有 setupSkipped 字段
        }
      };

      const isComplete = isUserProfileComplete(userProfile);
      expect(isComplete).toBe(false);
    });

    it('完整填写的资料应该被判定为完整（不需要 setupSkipped）', async () => {
      const userProfile = {
        userId: 'us-east-1:skip-test-user',
        profile: {
          name: 'Test User',
          bio: 'A test user',
          isNamePublic: true,
          socials: [
            { platform: 'Twitter', handle: '@testuser' }
          ],
          areSocialsPublic: true
          // 不需要 setupSkipped，name 非空 + privacy 设置完整就够了
        }
      };

      const isComplete = isUserProfileComplete(userProfile);
      expect(isComplete).toBe(true);
    });
  });

  describe('跳过后无法再次进入向导的验证', () => {
    it('setupSkipped=true 应该覆盖其他不完整条件', async () => {
      // 这是旧用户的情况：name 为空，但 setupSkipped=true
      const oldUserWithSkipFlag = {
        userId: 'c4b83408-5071-70cb-7e1f-bb1a6beafec5',  // 问题用户 ID
        profile: {
          name: '',  // 空的
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false,
          setupSkipped: true  // 新增的标记
        }
      };

      const isComplete = isUserProfileComplete(oldUserWithSkipFlag);
      expect(isComplete).toBe(true);  // 应该返回 true，不再进入向导
    });

    it('setupSkipped=false 应该被视为普通的 false', async () => {
      const userProfile = {
        userId: 'us-east-1:test-user',
        profile: {
          name: '',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false,
          setupSkipped: false  // 显式设置为 false
        }
      };

      const isComplete = isUserProfileComplete(userProfile);
      expect(isComplete).toBe(false);  // 应该返回 false，需要进入向导
    });
  });

  describe('设置完整资料', () => {
    it('应该成功保存完整资料和 setupSkipped=false', async () => {
      const completePayload = {
        profile: {
          name: 'Test User',
          bio: 'My bio',
          isNamePublic: true,
          socials: [
            { platform: 'Twitter', handle: '@testuser' },
            { platform: 'Discord', handle: 'testuser#1234' }
          ],
          areSocialsPublic: true,
          setupSkipped: false  // 明确表示不是跳过
        }
      };

      const response = await setupUserProfile(completePayload);

      expect(response).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.profile.name).toBe('Test User');
      expect(response.user.profile.socials.length).toBe(2);
      // 验证 setupSkipped 字段也被保存
      expect(response.user.profile.setupSkipped).toBe(false);
    });

    it('完整资料的判定不依赖 setupSkipped 字段', async () => {
      const userProfile = {
        userId: 'us-east-1:test-user',
        profile: {
          name: 'Test User',
          bio: 'My bio',
          isNamePublic: true,
          socials: [
            { platform: 'Twitter', handle: '@testuser' }
          ],
          areSocialsPublic: true
          // 没有 setupSkipped 字段
        }
      };

      const isComplete = isUserProfileComplete(userProfile);
      expect(isComplete).toBe(true);  // 应该返回 true，因为 name 非空且有 privacy 设置
    });
  });
});
