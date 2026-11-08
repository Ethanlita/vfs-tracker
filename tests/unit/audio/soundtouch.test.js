/** @file SoundTouch 的频率、时长、小数半音与持续流状态回归。 */
import { describe, expect, it } from 'vitest';
import { pitchShift } from '../../../src/audio/soundtouch/dsp.mjs';
import { StreamingPitchShifter } from '../../../src/audio/soundtouch/streaming-dsp.mjs';

/** 生成用于独立测量频率的确定性正弦信号。 */
const tone = (rate, seconds = 2) => Float32Array.from({ length: rate * seconds }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 220 * i / rate));
const join = parts => {
  const output = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) { output.set(part, position); position += part.length; }
  return output;
};
/** 用稳态过零点测量输出频率，不读取引擎内部参数作断言。 */
function measureFrequency(samples, rate) {
  const crossings = [];
  for (let i = Math.floor(rate * 0.3) + 1; i < samples.length - rate * 0.3; i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]));
  }
  return rate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]);
}

describe('SoundTouch 整段处理', () => {
  it.each([44100, 48000])('%s Hz 下准确支持非整数半音且保持时长', rate => {
    const input = tone(rate);
    const semitones = 12 * Math.log2(1.25);
    const output = pitchShift([input], rate, semitones).channels[0];
    expect(output).toHaveLength(input.length);
    expect(Math.abs(measureFrequency(output, rate) - 275)).toBeLessThan(2);
    expect(output.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true);
  });
  it('原调返回独立副本，不更改输入', () => {
    const input = Float32Array.of(0.2, -0.3, 0.4);
    const output = pitchShift([input], 48000, 0).channels[0];
    expect(output).toEqual(input);
    expect(output).not.toBe(input);
  });
});

describe('SoundTouch 持续流式处理', () => {
  it.each([44100, 48000])('%s Hz 下不同输入分块生成相同连续音频', rate => {
    const input = tone(rate);
    const semitones = 12 * Math.log2(4 / 3);
    const render = chunk => {
      const engine = new StreamingPitchShifter(rate, semitones);
      const parts = [];
      for (let offset = 0; offset < input.length; offset += chunk) parts.push(engine.push(input.subarray(offset, offset + chunk)));
      expect(engine.push(new Float32Array())).toHaveLength(0);
      return join(parts);
    };
    const output = render(512);
    expect(output).toEqual(render(997));
    expect(Math.abs(measureFrequency(output, rate) - 220 * 4 / 3)).toBeLessThan(2);
    // 稳态中不存在逐块补零导致的周期性静音。
    for (let start = rate / 2; start + 960 < output.length; start += 960) {
      let energy = 0;
      for (let i = start; i < start + 960; i++) energy += output[i] ** 2;
      expect(Math.sqrt(energy / 960)).toBeGreaterThan(0.1);
    }
  });
  it('修改变调后丢弃上一段状态，原调可立即输出', () => {
    const engine = new StreamingPitchShifter(48000, 4.98);
    engine.push(tone(48000, 1));
    engine.setPitch(0);
    const input = Float32Array.of(0.3, -0.4, 0.1);
    expect(engine.push(input)).toEqual(input);
  });
});
