/** @file 医院报告上传提示、用户文档与实现能力的一致性测试。 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** 读取仓库根目录中的文本文件。 */
const readRepositoryFile = relativePath => readFile(path.join(process.cwd(), relativePath), 'utf8');

describe('医院报告处理披露', () => {
  it('上传提示不再承诺无人访问，并说明关键决策信息', async () => {
    const source = await readRepositoryFile('src/components/EventForm.jsx');
    expect(source).not.toMatch(/不会有人看到|没有人工介入/);
    expect(source).toMatch(/Google Gemini API/);
    expect(source).toMatch(/授权管理员或运维人员/);
    expect(source).toMatch(/不会出现在公开页面/);
    expect(source).toMatch(/48 小时后自动删除/);
  });

  it.each(['posts/数据保护指南.md', 'posts/使用协议.md'])('%s 同步第三方、管理员、公开和删除说明', async path => {
    const content = await readRepositoryFile(path);
    expect(content).toMatch(/Google Gemini API/);
    expect(content).toMatch(/授权管理员或运维人员/);
    expect(content).toMatch(/公开页面/);
    expect(content).toMatch(/删除事件/);
    expect(content).not.toMatch(/不会有人看到|没有人工介入处理数据/);
  });

  it('管理员详情保留受权限控制的附件签名路径', async () => {
    const source = await readRepositoryFile('src/admin/components/EventDetailModal.jsx');
    expect(source).toMatch(/getPresignedUrl\(s3Client, s3Key\)/);
  });
});
