import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../../infra/cloudflare-trans-router/worker.js';

describe('vfs-tracker-trans-router', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-storage hosts', async () => {
    const request = new Request('https://vfs-tracker.app/example.txt');

    const response = await worker.fetch(request, { S3_HOST: 'bucket.s3.us-east-1.amazonaws.com' });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not found');
  });

  it('handles CORS preflight locally', async () => {
    const request = new Request('https://storage.vfs-tracker.app/file.txt', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://vfs-tracker.cn',
        'access-control-request-headers': 'content-type,x-test',
      },
    });

    const response = await worker.fetch(request, { S3_HOST: 'bucket.s3.us-east-1.amazonaws.com' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://vfs-tracker.cn');
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type,x-test');
    expect(response.headers.get('access-control-max-age')).toBe('86400');
  });

  it('proxies storage requests to S3 and strips edge headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
      })
    );

    const request = new Request('https://storage.vfs-tracker.app/path/report.pdf?token=123', {
      method: 'GET',
      headers: {
        origin: 'https://vfs-tracker.cn',
        host: 'storage.vfs-tracker.app',
        'cf-ray': 'test-ray',
        'cf-connecting-ip': '127.0.0.1',
        'x-forwarded-host': 'storage.vfs-tracker.app',
        'x-custom-header': 'keep-me',
      },
    });

    const response = await worker.fetch(request, { S3_HOST: 'bucket.s3.us-east-1.amazonaws.com' });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const upstreamRequest = fetchMock.mock.calls[0][0];
    expect(upstreamRequest).toBeInstanceOf(Request);
    expect(upstreamRequest.url).toBe('https://bucket.s3.us-east-1.amazonaws.com/path/report.pdf?token=123');
    expect(upstreamRequest.headers.get('host')).toBeNull();
    expect(upstreamRequest.headers.get('cf-ray')).toBeNull();
    expect(upstreamRequest.headers.get('cf-connecting-ip')).toBeNull();
    expect(upstreamRequest.headers.get('x-forwarded-host')).toBeNull();
    expect(upstreamRequest.headers.get('x-custom-header')).toBe('keep-me');

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://vfs-tracker.cn');
    expect(response.headers.get('x-vfs-worker')).toBe('storage-proxy');
    expect(response.headers.get('vary')).toContain('origin');
    await expect(response.text()).resolves.toBe('ok');
  });
});
