/** @file 在 VM 中验证 Worklet 的外部消息协议、队列上限和停止行为。 */
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import source from '../../../src/audio/live-io-worklet.js?raw';

class Port {
  messages = [];
  postMessage(message) { this.messages.push(structuredClone(message)); }
  start() {}
  close() { this.closed = true; }
  deliver(data) { this.onmessage?.({ data }); }
}
/** 在没有实际设备的情况下执行原始 Worklet 代码。 */
function setup() {
  let Processor;
  vm.runInNewContext(source, { AudioWorkletProcessor: class { port = new Port(); }, sampleRate: 48000,
    Float32Array, Math, Number, registerProcessor: (_, value) => { Processor = value; } });
  const io = new Processor({ processorOptions: { semitones: 3.863 } });
  const link = new Port();
  io.port.deliver({ type: 'connect', port: link });
  link.deliver({ type: 'ready', epoch: 0, semitones: 3.863, stats: {} });
  const render = () => {
    const output = new Float32Array(128);
    const keep = io.process([[new Float32Array(128).fill(0.6)]], [[output]]);
    return { output, keep };
  };
  return { io, link, render };
}

describe('实时音频消息协议', () => {
  it('Worker 停滞时输入消息不超过 150ms，待确认消息排空后才重启', () => {
    const { io, link, render } = setup();
    for (let i = 0; i < 300; i++) expect(render().output.every(value => value === 0)).toBe(true);
    const sent = link.messages.filter(message => message.type === 'input');
    expect(sent.reduce((sum, message) => sum + message.samples.length, 0)).toBeLessThanOrEqual(7200);
    expect(link.messages.filter(message => message.type === 'pitch')).toHaveLength(0);
    for (const message of sent) link.deliver({ type: 'ack', epoch: 0, frames: message.samples.length, processingMs: 0 });
    expect(link.messages.filter(message => message.type === 'pitch')).toHaveLength(1);
    expect(io.port.messages.some(message => message.type === 'stats' && message.overloads > 0)).toBe(true);
  });
  it('接受小数半音切换，丢弃旧代次输出且不泄漏麦克风原声', () => {
    const { io, link, render } = setup();
    io.port.deliver({ type: 'pitch', semitones: 4.5 });
    expect(link.messages.at(-1)).toMatchObject({ type: 'pitch', epoch: 1, semitones: 4.5 });
    link.deliver({ type: 'ready', epoch: 1, semitones: 4.5, stats: {} });
    link.deliver({ type: 'output', epoch: 0, samples: new Float32Array(4096).fill(0.9) });
    for (let i = 0; i < 15; i++) expect(render().output.every(value => value === 0)).toBe(true);
    link.deliver({ type: 'output', epoch: 1, samples: new Float32Array(4096).fill(0.2) });
    const values = [];
    for (let i = 0; i < 25; i++) values.push(...render().output);
    expect(Math.max(...values)).toBeCloseTo(0.2);
  });
  it('停止后输出静音、关闭端口并结束渲染生命周期', () => {
    const { io, link, render } = setup();
    io.port.deliver({ type: 'stop' });
    const stopped = render();
    expect(stopped.keep).toBe(false);
    expect(stopped.output.every(value => value === 0)).toBe(true);
    expect(link.closed).toBe(true);
  });
});
