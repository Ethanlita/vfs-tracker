import { describe, expect, it, vi } from 'vitest';
import {
  assertCompressedResponse,
  extractEntryScript,
  verifyCompression,
} from '../../../scripts/verify-esa-compression.mjs';

describe('ESA 主站压缩发布验证', () => {
  it('从首页提取相对或绝对入口脚本', () => {
    expect(extractEntryScript('<script type="module" src="/assets/index-abc.js"></script>').href)
      .toBe('https://vfs-tracker.cn/assets/index-abc.js');
    expect(extractEntryScript('<script src="https://cdn.example.com/assets/app.js"></script>').href)
      .toBe('https://cdn.example.com/assets/app.js');
  });

  it('拒绝没有压缩或缺少 Vary 的响应', () => {
    expect(() => assertCompressedResponse(new Response('x', {
      headers: { vary: 'Accept-Encoding' },
    }))).toThrow(/not compressed/);
    expect(() => assertCompressedResponse(new Response('x', {
      headers: { 'content-encoding': 'gzip' },
    }))).toThrow(/does not vary/);
  });

  it('验证压缩与 identity 两个真实 GET 变体', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(
        '<script type="module" src="/assets/index-test.js"></script>',
      ))
      .mockResolvedValueOnce(new Response('compressed-body', {
        headers: {
          'content-encoding': 'br',
          vary: 'Origin, Accept-Encoding',
        },
      }))
      .mockResolvedValueOnce(new Response('identity-body'));

    const result = await verifyCompression({ fetchImpl, cacheKey: 'unit' });

    expect(result).toMatchObject({ encoding: 'br', compressedBytes: 15, identityBytes: 13 });
    expect(fetchImpl).toHaveBeenNthCalledWith(2,
      new URL('https://vfs-tracker.cn/assets/index-test.js?compression-check=unit'),
      expect.objectContaining({ headers: expect.objectContaining({ 'accept-encoding': 'gzip, br, zstd' }) }));
    expect(fetchImpl).toHaveBeenNthCalledWith(3,
      new URL('https://vfs-tracker.cn/assets/index-test.js?compression-check=unit'),
      expect.objectContaining({ headers: expect.objectContaining({ 'accept-encoding': 'identity' }) }));
  });
});
