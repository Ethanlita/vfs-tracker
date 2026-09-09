/** @file 公共首屏和分页明细的 HTTP 契约验证。 */
import { describe, it, expect } from 'vitest';
import { getPublicDashboard, getPublicEventDetails } from '../../../src/api.js';
import { dashboardFixture } from '../../../src/test-utils/fixtures/index.js';
import { publicDashboardResponseSchema, publicEventDetailsResponseSchema } from '../../../src/api/schemas.js';

describe('公共仪表板 API', () => {
  it('首屏响应满足轻量契约且不包含文本明细', async () => {
    const result = await getPublicDashboard();
    expect(publicDashboardResponseSchema.validate(result).error).toBeUndefined();
    expect(result).toEqual(dashboardFixture().light);
    expect(JSON.stringify(result)).not.toMatch(/notes|full_metrics|attachments/);
  });
  it('明细 ID 查询经过编码，保留请求顺序且符合契约', async () => {
    const { details } = dashboardFixture();
    const result = await getPublicEventDetails('user1', [details[2].eventId, details[0].eventId]);
    expect(publicEventDetailsResponseSchema.validate(result).error).toBeUndefined();
    expect(result.map(event => event.eventId)).toEqual([details[2].eventId, details[0].eventId]);
  });
  it('超过 20 条的明细请求返回 API 错误', async () => {
    await expect(getPublicEventDetails('user1', Array.from({ length: 21 }, (_, i) => `event-${i}`))).rejects.toThrow();
  });
});
