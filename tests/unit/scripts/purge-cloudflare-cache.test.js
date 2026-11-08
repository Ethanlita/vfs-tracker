/** @file Cloudflare 缓存刷新脚本测试。 */
import { describe, expect, it, vi } from 'vitest';
import { purgeCloudflareCache } from '../../../scripts/purge-cloudflare-cache.mjs';

/** 构造一个 fetch 响应替身。 */
const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('Cloudflare 缓存刷新脚本', () => {
  it('以 Bearer Token 请求清空整个 Zone 的缓存', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, result: { id: 'zone-1' } }));

    await purgeCloudflareCache({ zoneId: 'zone-1', token: 'secret-token', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true }),
    });
  });

  it('Cloudflare 返回失败时抛错，且错误信息不包含 Token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, {
      success: false,
      errors: [{ code: 10000, message: 'Authentication error' }],
    }));

    const error = await purgeCloudflareCache({ zoneId: 'zone-1', token: 'secret-token', fetchImpl }).catch(e => e);
    expect(error.message).toContain('HTTP 403');
    expect(error.message).toContain('Authentication error');
    expect(error.message).not.toContain('secret-token');
  });

  it('HTTP 成功但 success 为 false 时同样视为失败', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { success: false, errors: [] }));
    await expect(purgeCloudflareCache({ zoneId: 'zone-1', token: 't', fetchImpl })).rejects.toThrow('Cloudflare 缓存刷新失败');
  });

  it('缺少 Zone ID 或 Token 时不发请求并直接失败', async () => {
    const fetchImpl = vi.fn();
    await expect(purgeCloudflareCache({ zoneId: '', token: 't', fetchImpl })).rejects.toThrow('CLOUDFLARE_ZONE_ID');
    await expect(purgeCloudflareCache({ zoneId: 'z', token: undefined, fetchImpl })).rejects.toThrow('CLOUDFLARE_API_TOKEN');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
