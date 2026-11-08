/** @file RubberBand 兼容入口的显式参考基频与无额外上下文行为。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
const { process } = vi.hoisted(() => ({ process: vi.fn() }));
vi.mock('../../../src/audio/processRecordedEffect.js', () => ({ processRecordedEffect: process }));
import { processWithRubberBand } from '../../../src/utils/rubberbandProcessor.js';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('RubberBand 统一参考基频', () => {
  it('使用调用方的 200 Hz 参考值，不再隐含 150 Hz', async () => {
    const channels = [Float32Array.of(0.2, -0.2)];
    process.mockResolvedValue(channels);
    vi.stubGlobal('AudioBuffer', class {
      constructor(options) { Object.assign(this, options); }
      copyToChannel = vi.fn();
    });
    const input = { sampleRate: 48000 };
    const output = await processWithRubberBand(input, 50, undefined, 200);
    expect(process.mock.calls[0][2].ratio).toBe(1.25);
    expect(output.length).toBe(2);
    expect(output.copyToChannel).toHaveBeenCalledWith(channels[0], 0);
  });
  it('缺少参考基频会显式报错，避免不同算法使用不同默认值', async () => {
    await expect(processWithRubberBand({}, 50)).rejects.toThrow('参考基频');
    expect(process).not.toHaveBeenCalled();
  });
});
