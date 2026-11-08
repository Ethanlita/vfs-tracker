/** @file 一次性离线 Worker 的取消、完成及失败行为。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processRecordedEffect } from '../../../src/audio/processRecordedEffect.js';

let workers;
const input = Float32Array.of(0.1, 0.2, 0.3);
const buffer = { numberOfChannels: 1, sampleRate: 48000, getChannelData: () => input };
beforeEach(() => {
  workers = [];
  vi.stubGlobal('Worker', class {
    postMessage = vi.fn(); terminate = vi.fn();
    constructor() { workers.push(this); }
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('离线音频 Worker', () => {
  it('传递副本和精确比例，返回处理声道并终止 Worker', async () => {
    const processing = processRecordedEffect(buffer, 'soundtouch', { ratio: 1.25, semitones: 3.863 });
    const message = workers[0].postMessage.mock.calls[0][0];
    expect(message.channels[0]).not.toBe(input);
    expect(message.ratio).toBe(1.25);
    const output = [Float32Array.of(0.2, 0.1, 0)];
    workers[0].onmessage({ data: { type: 'result', channels: output } });
    expect(await processing).toBe(output);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('取消后立即终止，不接受迟到结果', async () => {
    const abort = new AbortController();
    const processing = processRecordedEffect(buffer, 'rubberband', {}, { signal: abort.signal });
    const rejected = expect(processing).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort();
    workers[0].onmessage({ data: { type: 'result', channels: [] } });
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it('处理异常返回具体错误并释放资源', async () => {
    const processing = processRecordedEffect(buffer, 'soundtouch', {});
    const rejected = expect(processing).rejects.toThrow('bad pcm');
    workers[0].onmessage({ data: { type: 'error', message: 'bad pcm' } });
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
});
