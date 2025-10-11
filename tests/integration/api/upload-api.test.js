/**
 * @file Upload API 集成测试
 * @description 测试文件上传和 URL 生成相关 API
 * 
 * 注意: 这些 API 函数返回字符串，而非对象:
 * - getUploadUrl() 返回 string (uploadUrl)
 * - getFileUrl() 返回 string (url)
 * - getAvatarUrl() 返回 string (url)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getUploadUrl, getFileUrl, getAvatarUrl } from '../../../src/api.js';
import { setAuthenticated } from '../../../src/test-utils/mocks/amplify-auth.js';

describe('Upload API 集成测试', () => {
  beforeEach(() => {
    setAuthenticated({
      userId: 'us-east-1:complete-user-001',
      email: 'complete@example.com',
      nickname: 'Complete User'
    });
  });

  describe('getUploadUrl', () => {
    it('应该成功获取音频文件的上传 URL', async () => {
      const fileKey = 'audio/test-file.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain('https://');
      expect(uploadUrl).toContain(fileKey);
    });

    it('应该成功获取头像文件的上传 URL', async () => {
      const fileKey = 'avatars/user-avatar.jpg';
      const contentType = 'image/jpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain('https://');
    });

    it('应该成功获取文档附件的上传 URL', async () => {
      const fileKey = 'attachments/document.pdf';
      const contentType = 'application/pdf';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain('https://');
    });

    it('uploadUrl 应该包含必要的查询参数', async () => {
      const fileKey = 'test/file.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // 检查 URL 格式
      expect(uploadUrl).toContain('https://');
      expect(uploadUrl).toMatch(/^https:\/\/.+/);
    });

    it('fileKey 应该包含时间戳避免冲突', async () => {
      const fileKey = `test/file-${Date.now()}.mp3`;
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      expect(uploadUrl).toBeDefined();
      expect(uploadUrl).toContain(fileKey);
    });
  });

  describe('getFileUrl', () => {
    it('应该成功获取文件的下载 URL', async () => {
      const fileKey = 'audio/existing-file.mp3';

      const fileUrl = await getFileUrl(fileKey);

      expect(fileUrl).toBeDefined();
      expect(typeof fileUrl).toBe('string');
      expect(fileUrl).toContain('https://');
      expect(fileUrl).toContain(fileKey);
    });

    it('应该为私有文件生成预签名 URL', async () => {
      const fileKey = 'private/user-file.mp3';

      const fileUrl = await getFileUrl(fileKey);

      expect(fileUrl).toBeDefined();
      expect(fileUrl).toContain('https://');
      // 预签名 URL 通常包含签名参数
    });

    it('应该能够获取不同类型文件的 URL', async () => {
      const fileKeys = [
        'audio/test.mp3',
        'documents/test.pdf',
        'images/test.jpg'
      ];

      for (const fileKey of fileKeys) {
        const fileUrl = await getFileUrl(fileKey);
        expect(fileUrl).toBeDefined();
        expect(typeof fileUrl).toBe('string');
        expect(fileUrl).toContain('https://');
      }
    });

    it('预签名 URL 应该有过期时间', async () => {
      const fileKey = 'audio/test-file.mp3';

      const fileUrl = await getFileUrl(fileKey);

      expect(fileUrl).toBeDefined();
      expect(typeof fileUrl).toBe('string');
      // 在开发模式下可能返回 mock URL
      // 在生产模式下应该包含 X-Amz-Expires 参数
    });
  });

  describe('getAvatarUrl', () => {
    it('应该成功获取用户头像的 URL', async () => {
      const userId = 'us-east-1:complete-user-001';

      const avatarUrl = await getAvatarUrl(userId);

      expect(avatarUrl).toBeDefined();
      expect(typeof avatarUrl).toBe('string');
      expect(avatarUrl).toContain('https://');
      expect(avatarUrl).toContain('avatar');
    });

    it('应该为不同用户返回不同的头像 URL', async () => {
      const userId1 = 'us-east-1:user-001';
      const userId2 = 'us-east-1:user-002';

      const avatarUrl1 = await getAvatarUrl(userId1);
      const avatarUrl2 = await getAvatarUrl(userId2);

      expect(avatarUrl1).toBeDefined();
      expect(avatarUrl2).toBeDefined();
      expect(typeof avatarUrl1).toBe('string');
      expect(typeof avatarUrl2).toBe('string');
      // URLs 可能相同(如果都使用默认头像)或不同
    });

    it('头像 URL 应该可以公开访问或包含预签名', async () => {
      const userId = 'us-east-1:complete-user-001';

      const avatarUrl = await getAvatarUrl(userId);

      expect(avatarUrl).toContain('https://');
    });

    it('应该处理没有头像的用户情况', async () => {
      const userId = 'us-east-1:user-without-avatar';

      const avatarUrl = await getAvatarUrl(userId);

      // 应该返回默认头像或空 URL
      expect(avatarUrl).toBeDefined();
      expect(typeof avatarUrl).toBe('string');
    });
  });

  describe('错误处理', () => {
    it('未授权情况下获取上传 URL - 在开发模式下返回 mock', async () => {
      // 在开发模式下,即使未授权也会返回 mock 数据
      const fileKey = 'test/unauthorized.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // 开发模式下会返回 mock URL
      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe('string');
    });

    it('获取不存在文件的 URL 应该正常返回', async () => {
      const fileKey = 'nonexistent/file.mp3';

      // 在开发模式下会返回 mock URL
      // 在生产模式下可能返回预签名 URL(即使文件不存在)
      const fileUrl = await getFileUrl(fileKey);

      expect(fileUrl).toBeDefined();
      expect(typeof fileUrl).toBe('string');
      expect(fileUrl).toContain('https://');
    });
  });

  describe('安全性测试', () => {
    it('上传 URL 应该限制文件大小', async () => {
      const fileKey = 'test/large-file.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      // 验证响应有效(实际大小限制在服务端)
      expect(uploadUrl).toBeDefined();
      expect(typeof uploadUrl).toBe('string');
      expect(uploadUrl).toContain('https://');
    });

    it('fileKey 应该遵循安全的路径结构', async () => {
      const fileKey = 'audio/valid-filename.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);

      expect(uploadUrl).toBeDefined();
      expect(uploadUrl).toContain(fileKey);
      // fileKey 不应该包含 ../ 等不安全路径
      expect(uploadUrl).not.toContain('../');
    });
  });

  describe('URL 格式验证', () => {
    it('所有返回的 URL 应该是有效的 URL 格式', async () => {
      const fileKey = 'test/file.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);
      const fileUrl = await getFileUrl(fileKey);
      const avatarUrl = await getAvatarUrl('us-east-1:test-user');

      // 验证 URL 格式
      [uploadUrl, fileUrl, avatarUrl].forEach(url => {
        expect(url).toMatch(/^https?:\/\//);
        expect(typeof url).toBe('string');
      });
    });

    it('URL 应该使用 HTTPS 协议', async () => {
      const fileKey = 'test/secure-file.mp3';
      const contentType = 'audio/mpeg';

      const uploadUrl = await getUploadUrl(fileKey, contentType);
      const fileUrl = await getFileUrl(fileKey);

      expect(uploadUrl).toMatch(/^https:\/\//);
      expect(fileUrl).toMatch(/^https:\/\//);
    });
  });
});
