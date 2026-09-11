/** @file 公开文档加载、离线缺失与联网恢复的行为测试。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readDocumentation } from '../../../src/utils/documentation';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('readDocumentation', () => {
  it('读取正文和JSON目录', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('# 文档')).mockResolvedValueOnce(new Response('[]')));
    expect(await readDocumentation('/posts/test.md')).toBe('# 文档');
    expect(await readDocumentation('/posts.json', 'json')).toEqual([]);
  });
  it('离线缓存命中仍返回内容', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('# 缓存正文')));
    expect(await readDocumentation('/posts/test.md')).toBe('# 缓存正文');
  });
  it('离线缺失提供中文提示，联网重试正常读取', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const cause = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(cause).mockResolvedValueOnce(new Response('# 已恢复')));
    await expect(readDocumentation('/posts/test.md')).rejects.toMatchObject({
      message: '当前离线，所需文档尚未缓存。请联网后点击重试。',
      errorCode: 'DOCUMENT_NOT_AVAILABLE_OFFLINE', requestMethod: 'GET', requestPath: '/posts/test.md', cause
    });
    online.mockReturnValue(true);
    expect(await readDocumentation('/posts/test.md')).toBe('# 已恢复');
  });
  it('在线HTTP错误保留状态及请求上下文', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })));
    await expect(readDocumentation('/posts/test.md')).rejects.toMatchObject({ statusCode: 404, requestMethod: 'GET', requestPath: '/posts/test.md' });
  });
  it('在线网络错误保留原始原因', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const cause = new TypeError('network');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause));
    await expect(readDocumentation('/posts.json', 'json')).rejects.toBe(cause);
  });
});
