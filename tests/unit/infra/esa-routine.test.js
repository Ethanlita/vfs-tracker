import { afterEach, describe, expect, it, vi } from 'vitest';
import routine from '../../../infra/esa-routine/cn-spa-fallback.js';

/**
 * 加载 ESA Routine 模块，并注入 fetch mock。
 * @param {ReturnType<typeof vi.fn>} fetchMock - 注入的 fetch mock。
 * @returns {(request: Request) => Promise<Response>} Routine 请求处理函数。
 */
const loadRoutine = (fetchMock) => {
  vi.stubGlobal('fetch', fetchMock);
  return (request) => routine.fetch(request);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ESA cn-spa-fallback routine', () => {
  it('passes static assets through to origin', async () => {
    const originResponse = new Response('asset', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(originResponse);
    const handle = loadRoutine(fetchMock);

    const response = await handle(new Request('https://vfs-tracker.cn/assets/app.js'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].url).toBe('https://origin-probe.vfs-tracker.cn/assets/app.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    await expect(response.text()).resolves.toBe('asset');
  });

  it('returns index.html for known SPA routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );
    const handle = loadRoutine(fetchMock);

    const response = await handle(new Request('https://vfs-tracker.cn/scale-practice'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].url).toBe('https://origin-probe.vfs-tracker.cn/');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-esa-spa-route')).toBe('true');
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    await expect(response.text()).resolves.toBe('<html></html>');
  });

  it('falls back to index.html when unknown routes return 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response('<html></html>', { status: 200 }));
    const handle = loadRoutine(fetchMock);

    const response = await handle(new Request('https://vfs-tracker.cn/deep-link'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0].url).toBe('https://origin-probe.vfs-tracker.cn/deep-link');
    expect(fetchMock.mock.calls[1][0].url).toBe('https://origin-probe.vfs-tracker.cn/');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-esa-spa-fallback')).toBe('true');
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
  });
});
