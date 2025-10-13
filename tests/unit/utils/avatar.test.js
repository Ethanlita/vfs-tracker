/**
 * 单元测试: src/utils/avatar.js
 * 
 * 测试头像生成和用户信息提取工具函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAvatarFromName,
  generateAvatar,
  getUserAvatarUrl,
  getUserDisplayName
} from '../../../src/utils/avatar.js';
import * as api from '../../../src/api.js';

describe('avatar.js 单元测试', () => {

  // Mock console 方法避免测试输出混乱
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // generateAvatarFromName 函数测试
  // ============================================
  
  describe('generateAvatarFromName', () => {
    it('空名称应该返回默认紫色头像', () => {
      const url = generateAvatarFromName('', 40);
      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=?');
      expect(url).toContain('size=40');
      expect(url).toContain('background=E9D5FF');
      expect(url).toContain('color=3730A3');
    });

    it('null 或 undefined 应该返回默认头像', () => {
      const url1 = generateAvatarFromName(null, 40);
      const url2 = generateAvatarFromName(undefined, 40);
      
      expect(url1).toContain('name=?');
      expect(url2).toContain('name=?');
    });

    it('应该生成包含首字母的头像URL', () => {
      const url = generateAvatarFromName('Alice', 40);
      
      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=A'); // 首字母大写
      expect(url).toContain('size=40');
      expect(url).toContain('format=png');
    });

    it('应该将首字母转为大写', () => {
      const url = generateAvatarFromName('bob', 40);
      expect(url).toContain('name=B');
    });

    it('应该支持中文名称', () => {
      const url = generateAvatarFromName('张三', 40);
      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=%E5%BC%A0'); // "张" 的 URL 编码
    });

    it('应该去除名称前后空格', () => {
      const url = generateAvatarFromName('  Charlie  ', 40);
      expect(url).toContain('name=C');
    });

    it('应该根据字符生成不同颜色', () => {
      // 不同首字母应该生成不同的背景色和文字色
      const urlA = generateAvatarFromName('Alice');
      const urlB = generateAvatarFromName('Bob');
      const urlZ = generateAvatarFromName('Zoe');
      
      // URL应该包含color和background参数
      expect(urlA).toMatch(/background=[A-F0-9]{6}/);
      expect(urlB).toMatch(/background=[A-F0-9]{6}/);
      expect(urlZ).toMatch(/background=[A-F0-9]{6}/);
      
      expect(urlA).toMatch(/color=[A-F0-9]{6}/);
      expect(urlB).toMatch(/color=[A-F0-9]{6}/);
      expect(urlZ).toMatch(/color=[A-F0-9]{6}/);
    });

    it('相同首字母应该生成相同颜色', () => {
      const url1 = generateAvatarFromName('Alice');
      const url2 = generateAvatarFromName('Amy');
      const url3 = generateAvatarFromName('Andrew');
      
      // 提取 background 参数
      const bg1 = url1.match(/background=([A-F0-9]{6})/)[1];
      const bg2 = url2.match(/background=([A-F0-9]{6})/)[1];
      const bg3 = url3.match(/background=([A-F0-9]{6})/)[1];
      
      expect(bg1).toBe(bg2);
      expect(bg2).toBe(bg3);
    });

    it('应该支持自定义尺寸', () => {
      const url80 = generateAvatarFromName('Alice', 80);
      const url120 = generateAvatarFromName('Alice', 120);
      
      expect(url80).toContain('size=80');
      expect(url120).toContain('size=120');
    });

    it('默认尺寸应该是40', () => {
      const url = generateAvatarFromName('Alice');
      expect(url).toContain('size=40');
    });
  });

  // ============================================
  // generateAvatar 函数测试 (generateAvatarFromName的别名)
  // ============================================
  
  describe('generateAvatar', () => {
    it('应该是 generateAvatarFromName 的别名', () => {
      const url1 = generateAvatar('Alice', 40);
      const url2 = generateAvatarFromName('Alice', 40);
      
      expect(url1).toBe(url2);
    });

    it('应该支持相同的参数', () => {
      const url = generateAvatar('Bob', 80);
      expect(url).toContain('name=B');
      expect(url).toContain('size=80');
    });

    it('空名称应该返回默认头像', () => {
      const url = generateAvatar('', 40);
      expect(url).toContain('name=?');
    });
  });

  // ============================================
  // getUserAvatarUrl 函数测试
  // ============================================
  
  describe('getUserAvatarUrl', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getAvatarUrl');
    });

    it('有 avatarKey 且 API 成功时应该返回上传的头像', async () => {
      api.getAvatarUrl.mockResolvedValue('https://s3.signed-url.com/avatar.jpg');

      const user = {
        userId: 'user-123',
        attributes: {
          sub: 'user-123',
          avatarKey: 's3-avatar-key',
          nickname: 'Alice'
        }
      };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toBe('https://s3.signed-url.com/avatar.jpg');
      expect(api.getAvatarUrl).toHaveBeenCalledWith('user-123');
    });

    it('有 avatarKey 但没有 userId 时应该使用 sub', async () => {
      api.getAvatarUrl.mockResolvedValue('https://s3.signed-url.com/avatar.jpg');

      const user = {
        attributes: {
          sub: 'sub-456',
          avatarKey: 's3-avatar-key',
          nickname: 'Bob'
        }
      };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toBe('https://s3.signed-url.com/avatar.jpg');
      expect(api.getAvatarUrl).toHaveBeenCalledWith('sub-456');
    });

    it('API 失败时应该回退到生成的头像', async () => {
      api.getAvatarUrl.mockRejectedValue(new Error('S3 Error'));

      const user = {
        userId: 'user-123',
        attributes: {
          avatarKey: 's3-avatar-key',
          nickname: 'Charlie'
        }
      };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=C'); // Charlie 的首字母
      expect(console.error).toHaveBeenCalledWith('获取头像URL失败:', expect.any(Error));
    });

    it('API 返回 null 时应该回退到生成的头像', async () => {
      api.getAvatarUrl.mockResolvedValue(null);

      const user = {
        userId: 'user-123',
        attributes: {
          avatarKey: 's3-avatar-key',
          nickname: 'Diana'
        }
      };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=D');
    });

    it('没有 avatarKey 时应该直接生成头像', async () => {
      const user = {
        userId: 'user-123',
        attributes: {
          nickname: 'Eve'
        }
      };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=E');
      expect(api.getAvatarUrl).not.toHaveBeenCalled();
    });

    it('应该按优先级选择用户名 (nickname > name > preferred_username > username > email)', async () => {
      // 测试 nickname 优先
      const user1 = {
        attributes: {
          nickname: 'NickName',
          name: 'RealName',
          email: 'test@example.com'
        }
      };
      const url1 = await getUserAvatarUrl(user1);
      expect(url1).toContain('name=N'); // NickName 的首字母

      // 测试 name 第二优先
      const user2 = {
        attributes: {
          name: 'RealName',
          preferred_username: 'PreferredName',
          email: 'test@example.com'
        }
      };
      const url2 = await getUserAvatarUrl(user2);
      expect(url2).toContain('name=R'); // RealName 的首字母

      // 测试 preferred_username 第三优先
      const user3 = {
        attributes: {
          preferred_username: 'PreferredName',
          email: 'test@example.com'
        }
      };
      const url3 = await getUserAvatarUrl(user3);
      expect(url3).toContain('name=P'); // PreferredName 的首字母

      // 测试 username 第四优先
      const user4 = {
        username: 'Username',
        attributes: {
          email: 'test@example.com'
        }
      };
      const url4 = await getUserAvatarUrl(user4);
      expect(url4).toContain('name=U'); // Username 的首字母

      // 测试 email 最后优先
      const user5 = {
        attributes: {
          email: 'emailuser@example.com'
        }
      };
      const url5 = await getUserAvatarUrl(user5);
      expect(url5).toContain('name=E'); // emailuser 的首字母
    });

    it('完全没有用户信息时应该返回默认头像', async () => {
      const user = { attributes: {} };

      const url = await getUserAvatarUrl(user, 40);

      expect(url).toContain('ui-avatars.com');
      expect(url).toContain('name=?'); // 默认头像
    });

    it('应该正确传递自定义尺寸', async () => {
      const user = {
        attributes: {
          nickname: 'Alice'
        }
      };

      const url = await getUserAvatarUrl(user, 80);
      expect(url).toContain('size=80');
    });
  });

  // ============================================
  // getUserDisplayName 函数测试
  // ============================================
  
  describe('getUserDisplayName', () => {
    it('应该返回 nickname (第一优先级)', () => {
      const user = {
        attributes: {
          nickname: 'NickName',
          name: 'RealName',
          preferred_username: 'PreferredName',
          email: 'test@example.com'
        },
        username: 'Username'
      };

      expect(getUserDisplayName(user)).toBe('NickName');
    });

    it('没有 nickname 时应该返回 name (第二优先级)', () => {
      const user = {
        attributes: {
          name: 'RealName',
          preferred_username: 'PreferredName',
          email: 'test@example.com'
        },
        username: 'Username'
      };

      expect(getUserDisplayName(user)).toBe('RealName');
    });

    it('没有 nickname 和 name 时应该返回 preferred_username (第三优先级)', () => {
      const user = {
        attributes: {
          preferred_username: 'PreferredName',
          email: 'test@example.com'
        },
        username: 'Username'
      };

      expect(getUserDisplayName(user)).toBe('PreferredName');
    });

    it('没有 nickname、name、preferred_username 时应该返回 username (第四优先级)', () => {
      const user = {
        attributes: {
          email: 'test@example.com'
        },
        username: 'Username'
      };

      expect(getUserDisplayName(user)).toBe('Username');
    });

    it('只有 email 时应该返回 email 用户名部分 (第五优先级)', () => {
      const user = {
        attributes: {
          email: 'emailuser@example.com'
        }
      };

      expect(getUserDisplayName(user)).toBe('emailuser');
    });

    it('完全没有用户信息时应该返回"未知用户"', () => {
      const user1 = { attributes: {} };
      const user2 = {};
      const user3 = null;

      expect(getUserDisplayName(user1)).toBe('未知用户');
      expect(getUserDisplayName(user2)).toBe('未知用户');
      expect(getUserDisplayName(user3)).toBe('未知用户');
    });

    it('应该输出调试日志', () => {
      const user = {
        attributes: {
          nickname: 'TestUser'
        }
      };

      getUserDisplayName(user);

      // 验证 console.log 被调用
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('getUserDisplayName'),
        expect.any(Object)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('最终显示名称'),
        'TestUser'
      );
    });
  });
});
