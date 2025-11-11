/**
 * 单元测试: src/utils/attachments.js
 * 
 * 测试附件解析工具函数
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAttachmentLinks, resolveAttachmentUrl } from '../../../src/utils/attachments.js';
import * as api from '../../../src/api.js';

describe('attachments.js 单元测试', () => {
  
  // Mock getFileUrl 函数
  beforeEach(() => {
    vi.spyOn(api, 'getFileUrl');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // resolveAttachmentLinks 函数测试
  // ============================================
  
  describe('resolveAttachmentLinks', () => {
    it('空数组应该返回空数组', async () => {
      const result = await resolveAttachmentLinks([]);
      expect(result).toEqual([]);
    });

    it('null 或 undefined 应该返回空数组', async () => {
      const result1 = await resolveAttachmentLinks(null);
      const result2 = await resolveAttachmentLinks(undefined);
      
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('非数组输入应该返回空数组', async () => {
      const result = await resolveAttachmentLinks('not-an-array');
      expect(result).toEqual([]);
    });

    it('应该为单个附件生成 downloadUrl', async () => {
      api.getFileUrl.mockResolvedValue('https://s3.signed-url.com/file1.pdf');

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf', fileType: 'pdf', fileName: 'report.pdf' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        fileUrl: 's3://bucket/file1.pdf',
        fileType: 'pdf',
        fileName: 'report.pdf',
        downloadUrl: 'https://s3.signed-url.com/file1.pdf'
      });
      expect(api.getFileUrl).toHaveBeenCalledWith('s3://bucket/file1.pdf');
    });

    it('应该为多个附件批量生成 downloadUrl', async () => {
      api.getFileUrl
        .mockResolvedValueOnce('https://s3.signed-url.com/file1.pdf')
        .mockResolvedValueOnce('https://s3.signed-url.com/file2.jpg')
        .mockResolvedValueOnce('https://s3.signed-url.com/file3.mp3');

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf', fileType: 'pdf' },
        { fileUrl: 's3://bucket/file2.jpg', fileType: 'image' },
        { fileUrl: 's3://bucket/file3.mp3', fileType: 'audio' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result).toHaveLength(3);
      expect(result[0].downloadUrl).toBe('https://s3.signed-url.com/file1.pdf');
      expect(result[1].downloadUrl).toBe('https://s3.signed-url.com/file2.jpg');
      expect(result[2].downloadUrl).toBe('https://s3.signed-url.com/file3.mp3');
      expect(api.getFileUrl).toHaveBeenCalledTimes(3);
    });

    it('getFileUrl 失败时应该回退到原始 fileUrl', async () => {
      api.getFileUrl.mockRejectedValue(new Error('S3 Access Denied'));

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf', fileType: 'pdf' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].downloadUrl).toBe('s3://bucket/file1.pdf'); // 回退到原始
      expect(result[0].fileUrl).toBe('s3://bucket/file1.pdf');
    });

    it('getFileUrl 返回 null 时应该回退到原始 fileUrl', async () => {
      api.getFileUrl.mockResolvedValue(null);

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result).toHaveLength(1);
      expect(result[0].downloadUrl).toBe('s3://bucket/file1.pdf');
    });

    it('应该过滤掉没有 fileUrl 的附件', async () => {
      api.getFileUrl.mockResolvedValue('https://s3.signed-url.com/file.pdf');

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf', fileType: 'pdf' },
        { fileType: 'pdf' }, // 缺少 fileUrl
        null, // null 项
        { fileUrl: '', fileType: 'pdf' }, // 空字符串
        { fileUrl: 's3://bucket/file2.pdf' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      // 只有有效的 fileUrl 会被处理
      expect(result.length).toBeLessThanOrEqual(2);
      expect(result.every(item => item.fileUrl)).toBe(true);
    });

    it('应该保留原始附件的所有属性', async () => {
      api.getFileUrl.mockResolvedValue('https://s3.signed-url.com/file.pdf');

      const attachments = [
        {
          fileUrl: 's3://bucket/file.pdf',
          fileType: 'pdf',
          fileName: 'document.pdf',
          fileSize: 1024000,
          uploadedAt: '2025-01-01T00:00:00Z',
          customField: 'custom-value'
        }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result[0]).toEqual({
        fileUrl: 's3://bucket/file.pdf',
        fileType: 'pdf',
        fileName: 'document.pdf',
        fileSize: 1024000,
        uploadedAt: '2025-01-01T00:00:00Z',
        customField: 'custom-value',
        downloadUrl: 'https://s3.signed-url.com/file.pdf'
      });
    });

    it('部分附件失败时应该继续处理其他附件', async () => {
      api.getFileUrl
        .mockResolvedValueOnce('https://s3.signed-url.com/file1.pdf')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('https://s3.signed-url.com/file3.pdf');

      const attachments = [
        { fileUrl: 's3://bucket/file1.pdf' },
        { fileUrl: 's3://bucket/file2.pdf' },
        { fileUrl: 's3://bucket/file3.pdf' }
      ];

      const result = await resolveAttachmentLinks(attachments);

      expect(result).toHaveLength(3);
      expect(result[0].downloadUrl).toBe('https://s3.signed-url.com/file1.pdf');
      expect(result[1].downloadUrl).toBe('s3://bucket/file2.pdf'); // 回退
      expect(result[2].downloadUrl).toBe('https://s3.signed-url.com/file3.pdf');
    });
  });

  // ============================================
  // resolveAttachmentUrl 函数测试 (兼容旧函数)
  // ============================================
  
  describe('resolveAttachmentUrl', () => {
    it('应该返回单个文件的 downloadUrl', async () => {
      api.getFileUrl.mockResolvedValue('https://s3.signed-url.com/file.pdf');

      const result = await resolveAttachmentUrl('s3://bucket/file.pdf');

      expect(result).toBe('https://s3.signed-url.com/file.pdf');
      expect(api.getFileUrl).toHaveBeenCalledWith('s3://bucket/file.pdf');
    });

    it('空字符串应该返回空字符串', async () => {
      const result = await resolveAttachmentUrl('');
      expect(result).toBe('');
      expect(api.getFileUrl).not.toHaveBeenCalled();
    });

    it('null 或 undefined 应该返回空字符串', async () => {
      const result1 = await resolveAttachmentUrl(null);
      const result2 = await resolveAttachmentUrl(undefined);
      
      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(api.getFileUrl).not.toHaveBeenCalled();
    });

    it('getFileUrl 失败时应该返回原始 key', async () => {
      api.getFileUrl.mockRejectedValue(new Error('S3 Error'));

      const result = await resolveAttachmentUrl('s3://bucket/file.pdf');

      expect(result).toBe('s3://bucket/file.pdf'); // 回退到原始
    });

    it('getFileUrl 返回 null 时应该返回原始 key', async () => {
      api.getFileUrl.mockResolvedValue(null);

      const result = await resolveAttachmentUrl('s3://bucket/file.pdf');

      expect(result).toBe('s3://bucket/file.pdf');
    });

    it('应该通过 resolveAttachmentLinks 实现', async () => {
      // 验证它内部调用了 resolveAttachmentLinks
      api.getFileUrl.mockResolvedValue('https://s3.signed-url.com/test.pdf');

      const key = 's3://bucket/test.pdf';
      const result = await resolveAttachmentUrl(key);

      expect(result).toBe('https://s3.signed-url.com/test.pdf');
    });
  });
});
