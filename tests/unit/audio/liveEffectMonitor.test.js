/** @file 实时试听授权、停止、参数更新和异步取消的生命周期测试。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveEffectMonitor } from '../../../src/audio/liveEffectMonitor.js';

let contexts, workers, nodes, tracks, pendingPermission;
/** 模拟音频节点之间的原生链式连接。 */
const node = () => ({ connect: vi.fn(function () { return arguments[0]; }), disconnect: vi.fn(),
  gain: { value: 0, setTargetAtTime: vi.fn() } });
beforeEach(() => {
  contexts = []; workers = []; nodes = []; tracks = [];
  pendingPermission = null;
  vi.stubGlobal('AudioContext', class {
    state = 'running'; sampleRate = 48000; currentTime = 0; destination = {};
    audioWorklet = { addModule: vi.fn().mockResolvedValue() };
    resume = vi.fn().mockResolvedValue();
    close = vi.fn(async () => { this.state = 'closed'; });
    createMediaStreamSource = vi.fn(node);
    createGain = vi.fn(node);
    createAnalyser = vi.fn(() => ({ ...node(), getFloatTimeDomainData: buffer => buffer.fill(0) }));
    constructor() { contexts.push(this); }
  });
  vi.stubGlobal('AudioWorkletNode', class {
    port = { postMessage: vi.fn(), onmessage: null };
    connect = vi.fn(function (next) { return next; });
    disconnect = vi.fn();
    constructor() { nodes.push(this); }
  });
  vi.stubGlobal('Worker', class {
    postMessage = vi.fn(); terminate = vi.fn();
    constructor() { workers.push(this); }
  });
  vi.stubGlobal('MessageChannel', class { port1 = {}; port2 = {}; });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => {
    if (pendingPermission) return pendingPermission;
    const track = { stop: vi.fn(), addEventListener: vi.fn() }; tracks.push(track);
    return Promise.resolve({ getTracks: () => [track] });
  }) } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('实时试听资源归属', () => {
  it('启动并更新小数半音，停止关闭所有本次资源，重复停止安全', async () => {
    const monitor = new LiveEffectMonitor();
    await monitor.start({ referenceF0: 200, shiftHz: 50 });
    expect(workers[0].postMessage.mock.calls[0][0]).toMatchObject({ algorithm: 'soundtouch', sampleRate: 48000,
      semitones: 12 * Math.log2(1.25) });
    monitor.setShift(60);
    expect(nodes[0].port.postMessage.mock.calls.at(-1)[0]).toEqual({ type: 'pitch', semitones: 12 * Math.log2(1.3) });
    await monitor.stop(); await monitor.stop();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(monitor.getDiagnostics().phase).toBe('idle');
  });
  it('用户取消后才到达的麦克风授权立即释放，不创建 Worker', async () => {
    let grant;
    pendingPermission = new Promise(resolve => { grant = resolve; });
    const monitor = new LiveEffectMonitor();
    const starting = monitor.start({ referenceF0: 150 });
    await Promise.resolve();
    await monitor.stop();
    const track = { stop: vi.fn() };
    grant({ getTracks: () => [track] });
    await starting;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(0);
    expect(contexts[0].state).toBe('closed');
  });
  it('权限拒绝提供可重试错误并关闭上下文', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const monitor = new LiveEffectMonitor();
    await monitor.start({ referenceF0: 150 });
    expect(monitor.getDiagnostics().error).toContain('麦克风权限未允许');
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });
  it('Worker 初始化失败会停止麦克风，不泄漏原声', async () => {
    const monitor = new LiveEffectMonitor();
    await monitor.start({ algorithm: 'rubberband', referenceF0: 150 });
    workers[0].onmessage({ data: { type: 'error', message: 'WASM failed' } });
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(monitor.getDiagnostics().error).toBe('WASM failed');
    expect(monitor.getDiagnostics().phase).toBe('idle');
  });
  it('自动校准失败后释放设备，允许用户改用手动参考值', async () => {
    vi.useFakeTimers();
    try {
      const monitor = new LiveEffectMonitor();
      const starting = monitor.start();
      await vi.advanceTimersByTimeAsync(3100);
      await starting;
      expect(monitor.getDiagnostics().error).toContain('未能校准基频');
      expect(tracks[0].stop).toHaveBeenCalledOnce();
      expect(workers).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});
