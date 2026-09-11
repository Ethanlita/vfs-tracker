/** @file TD-PSOLA 能量匹配的量纲与弱声回归测试。 */
import { describe, expect, it } from 'vitest';
import { matchTdPsolaEnergy } from '../../../src/utils/tdPsolaEnergy.js';

/** 生成指定振幅的稳定正弦采样。 */
const sine = (amplitude, length = 640) => Float32Array.from(
  { length },
  (_, index) => amplitude * Math.sin((2 * Math.PI * index) / 80)
);

describe('matchTdPsolaEnergy', () => {
  it.each([0.02, 0.08, 0.2])('振幅 %s 的等能量输入不会因帧长度被放大', amplitude => {
    const signal = sine(amplitude);
    const output = Float32Array.from(signal);

    const result = matchTdPsolaEnergy(output, signal);

    expect(result.inputSamples).toBe(signal.length);
    expect(result.outputSamples).toBe(signal.length);
    expect(result.inputMeanSquare).toBeCloseTo(result.outputMeanSquare, 8);
    expect(result.scale).toBe(1);
    expect(Math.max(...output.map(Math.abs))).toBeLessThanOrEqual(amplitude + 1e-6);
  });

  it('输出确有能量损失时只恢复到带余量的目标', () => {
    const input = sine(0.2);
    const output = Float32Array.from(input, sample => sample * 0.5);

    const result = matchTdPsolaEnergy(output, input);

    expect(result.scale).toBeCloseTo(1.8, 5);
    expect(Math.sqrt(output.reduce((sum, sample) => sum + sample * sample, 0) / output.length))
      .toBeCloseTo(Math.sqrt(result.inputMeanSquare) * 0.9, 5);
  });

  it('静音和无有效输出区域不会产生非有限采样', () => {
    const output = new Float32Array(128);
    const result = matchTdPsolaEnergy(output, new Float32Array(128));

    expect(result.scale).toBe(1);
    expect(result.outputSamples).toBe(128);
    expect([...output].every(Number.isFinite)).toBe(true);
  });

  it('稀疏输出的整体能量补偿受峰值余量限制', () => {
    const input = sine(0.08);
    const output = new Float32Array(input.length);
    // 单个瞬态让所需能量增益超过安全峰值，验证最终采用峰值上限。
    output[20] = 0.08;

    const result = matchTdPsolaEnergy(output, input);

    expect(result.scale).toBeCloseTo(0.95 / result.outputPeak, 5);
    expect(Math.max(...output.map(Math.abs))).toBeLessThanOrEqual(0.950001);
  });
});
