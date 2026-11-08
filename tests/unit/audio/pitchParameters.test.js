/** @file 统一变调参数及校准检测的行为测试。 */
import { describe, expect, it } from 'vitest';
import { estimateReferencePitch, getPitchParameters } from '../../../src/audio/pitchParameters.js';

describe('统一音高参数', () => {
  it('同一 Hz 增量按实际参考基频换算，并保留小数半音', () => {
    const parameters = getPitchParameters(200, 50);
    expect(parameters.ratio).toBe(1.25);
    expect(parameters.semitones).toBeCloseTo(3.863137, 5);
    expect(getPitchParameters(150, 50).ratio).toBeCloseTo(4 / 3, 12);
    expect(getPitchParameters(150, 0).semitones).toBe(0);
  });
  it.each([[0, 50], [79, 50], [501, 50], [NaN, 50], [150, -1], [150, 101], [150, Infinity]])('拒绝无效参考基频或增量 %s/%s', (reference, shift) => {
    expect(() => getPitchParameters(reference, shift)).toThrow(RangeError);
  });
});

describe('实时参考基频校准', () => {
  it.each([100, 150, 220, 350])('检测 %s Hz 的带谐波人声模型', frequency => {
    const rate = 48000;
    const signal = Float32Array.from({ length: 4096 }, (_, i) => {
      const phase = 2 * Math.PI * frequency * i / rate;
      return 0.2 * Math.sin(phase) + 0.12 * Math.sin(phase * 2) + 0.05 * Math.sin(phase * 3);
    });
    expect(estimateReferencePitch(signal, rate)).toBeCloseTo(frequency, 0);
  });
  it('静音和没有周期的信号不会被当作可用参考值', () => {
    expect(estimateReferencePitch(new Float32Array(4096), 48000)).toBeNull();
    let seed = 37;
    const noise = Float32Array.from({ length: 4096 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return 0.1 * (seed / 0xffffffff - 0.5);
    });
    expect(estimateReferencePitch(noise, 48000)).toBeNull();
  });
});
