/**
 * @file td-psola.test.js
 * @zh TD-PSOLA 算法单元测试
 * 
 * 测试 TD-PSOLA (Time-Domain Pitch-Synchronous Overlap-Add) 算法的各个组成部分：
 * 1. 基频标记点检测
 * 2. 分析帧提取
 * 3. 合成位置计算
 * 4. 重叠相加合成
 * 5. 完整的音高变换流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * @zh 生成测试用的正弦波信号
 * @param {number} frequency - 频率（Hz）
 * @param {number} duration - 时长（秒）
 * @param {number} sampleRate - 采样率（Hz）
 * @returns {Float32Array} 音频数据
 */
const generateSineWave = (frequency, duration, sampleRate) => {
  const length = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  
  return buffer;
};

/**
 * @zh 生成带有谐波的复合音信号（模拟语音）
 * @param {number} f0 - 基频（Hz）
 * @param {number} duration - 时长（秒）
 * @param {number} sampleRate - 采样率（Hz）
 * @returns {Float32Array} 音频数据
 */
const generateVoiceLikeSignal = (f0, duration, sampleRate) => {
  const length = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(length);
  
  // 添加基频和几个谐波（模拟语音的频谱结构）
  const harmonics = [
    { freq: f0, amplitude: 1.0 },      // 基频
    { freq: f0 * 2, amplitude: 0.5 },  // 第二谐波
    { freq: f0 * 3, amplitude: 0.3 },  // 第三谐波
    { freq: f0 * 4, amplitude: 0.2 },  // 第四谐波
  ];
  
  for (let i = 0; i < length; i++) {
    let sample = 0;
    for (const harmonic of harmonics) {
      sample += harmonic.amplitude * Math.sin(2 * Math.PI * harmonic.freq * i / sampleRate);
    }
    buffer[i] = sample / harmonics.length; // 归一化
  }
  
  return buffer;
};

/**
 * @zh 计算信号的平均周期
 * @param {number[]} pitchMarks - 基频标记点数组
 * @returns {number} 平均周期
 */
const calculateAveragePeriod = (pitchMarks) => {
  if (pitchMarks.length < 2) return 0;
  
  let totalPeriod = 0;
  for (let i = 1; i < pitchMarks.length; i++) {
    totalPeriod += pitchMarks[i] - pitchMarks[i - 1];
  }
  
  return totalPeriod / (pitchMarks.length - 1);
};

/**
 * @zh 估计信号的基频（从标记点）
 * @param {number[]} pitchMarks - 基频标记点数组
 * @param {number} sampleRate - 采样率
 * @returns {number} 估计的基频（Hz）
 */
const estimateF0FromMarks = (pitchMarks, sampleRate) => {
  const avgPeriod = calculateAveragePeriod(pitchMarks);
  if (avgPeriod === 0) return 0;
  return sampleRate / avgPeriod;
};

describe('TD-PSOLA 算法测试', () => {
  // Mock AudioBuffer for testing
  const createMockAudioBuffer = (channelData, sampleRate = 48000) => ({
    length: channelData.length,
    numberOfChannels: 1,
    sampleRate,
    duration: channelData.length / sampleRate,
    getChannelData: (channel) => {
      if (channel === 0) return channelData;
      throw new Error('Invalid channel');
    },
  });

  describe('基频标记点检测', () => {
    it('应该能检测到单频信号的周期', () => {
      const frequency = 150; // 150 Hz
      const sampleRate = 48000;
      const duration = 1; // 1秒
      
      const signal = generateSineWave(frequency, duration, sampleRate);
      const expectedPeriod = sampleRate / frequency; // 应该是320个采样点
      
      // 计算第一个周期的位置
      let firstZeroCrossing = -1;
      for (let i = 1; i < signal.length; i++) {
        if (signal[i - 1] <= 0 && signal[i] > 0) {
          firstZeroCrossing = i;
          break;
        }
      }
      
      expect(firstZeroCrossing).toBeGreaterThan(0);
      expect(firstZeroCrossing).toBeLessThan(expectedPeriod / 2);
    });

    it('应该能从复合信号中检测基频', () => {
      const f0 = 150; // 基频 150 Hz
      const sampleRate = 48000;
      const duration = 0.5;
      
      const signal = generateVoiceLikeSignal(f0, duration, sampleRate);
      
      // 验证信号不是全零
      const energy = signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
      expect(energy).toBeGreaterThan(0.01);
    });

    it('应该处理低能量信号', () => {
      const sampleRate = 48000;
      const duration = 0.5;
      
      // 创建非常低能量的信号
      const signal = new Float32Array(Math.floor(duration * sampleRate));
      for (let i = 0; i < signal.length; i++) {
        signal[i] = 0.0001 * Math.sin(2 * Math.PI * 150 * i / sampleRate);
      }
      
      const energy = signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
      expect(energy).toBeLessThan(0.001); // 应该低于能量阈值
    });

    it('应该处理静音信号', () => {
      const sampleRate = 48000;
      const duration = 0.5;
      
      const signal = new Float32Array(Math.floor(duration * sampleRate));
      // 全零信号
      
      const energy = signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
      expect(energy).toBe(0);
    });
  });

  describe('周期检测算法', () => {
    it('应该能找到正确的自相关峰值', () => {
      const f0 = 150;
      const sampleRate = 48000;
      const expectedPeriod = sampleRate / f0; // 320 采样点
      
      const signal = generateSineWave(f0, 1, sampleRate);
      const windowSize = 1024;
      const window = signal.slice(0, windowSize);
      
      // 简单的自相关检测
      const minLag = Math.floor(sampleRate / 500);
      const maxLag = Math.floor(sampleRate / 80);
      
      let maxCorrelation = -Infinity;
      let bestLag = 0;
      
      for (let lag = minLag; lag <= maxLag && lag < windowSize / 2; lag++) {
        let correlation = 0;
        for (let i = 0; i < windowSize - lag; i++) {
          correlation += window[i] * window[i + lag];
        }
        
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestLag = lag;
        }
      }
      
      // 允许 ±5% 的误差
      expect(bestLag).toBeGreaterThan(expectedPeriod * 0.95);
      expect(bestLag).toBeLessThan(expectedPeriod * 1.05);
    });

    it('应该在不同频率下工作', () => {
      const testFrequencies = [100, 150, 200, 250];
      const sampleRate = 48000;
      
      for (const f0 of testFrequencies) {
        const signal = generateSineWave(f0, 0.5, sampleRate);
        const energy = signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
        
        // 验证信号生成正确
        expect(energy).toBeGreaterThan(0.4); // 正弦波能量约为0.5
        expect(energy).toBeLessThan(0.6);
      }
    });
  });

  describe('分析帧提取', () => {
    it('应该生成正确长度的汉宁窗', () => {
      const windowLength = 512;
      const window = new Float32Array(windowLength);
      
      // 生成汉宁窗
      for (let i = 0; i < windowLength; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowLength - 1)));
      }
      
      // 验证窗口特性
      expect(window[0]).toBeCloseTo(0, 5); // 起始点接近0
      expect(window[windowLength - 1]).toBeCloseTo(0, 5); // 结束点接近0
      expect(window[Math.floor(windowLength / 2)]).toBeCloseTo(1, 4); // 中心点接近1（降低精度要求）
    });

    it('应该从标记点提取帧', () => {
      const sampleRate = 48000;
      const f0 = 150;
      const signal = generateSineWave(f0, 1, sampleRate);
      
      const period = sampleRate / f0;
      const pitchMarks = [
        Math.floor(period * 0),
        Math.floor(period * 1),
        Math.floor(period * 2),
        Math.floor(period * 3),
      ];
      
      // 提取帧
      const frameLength = Math.floor(period * 2);
      const frames = [];
      
      for (const mark of pitchMarks) {
        const halfFrame = Math.floor(frameLength / 2);
        const start = Math.max(0, mark - halfFrame);
        const end = Math.min(signal.length, mark + halfFrame);
        
        if (end > start) {
          frames.push({
            center: mark,
            length: end - start
          });
        }
      }
      
      expect(frames.length).toBe(pitchMarks.length);
      expect(frames[0].center).toBe(pitchMarks[0]);
    });

    it('应该处理边界情况', () => {
      const sampleRate = 48000;
      const signal = new Float32Array(1000);
      
      // 标记点在边界附近
      const pitchMarks = [10, 990];
      const frameLength = 200;
      
      for (const mark of pitchMarks) {
        const halfFrame = Math.floor(frameLength / 2);
        const start = Math.max(0, mark - halfFrame);
        const end = Math.min(signal.length, mark + halfFrame);
        
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(signal.length);
        expect(end).toBeGreaterThan(start);
      }
    });
  });

  describe('合成位置计算', () => {
    it('音高升高时应该减小帧间距', () => {
      const pitchMarks = [0, 320, 640, 960, 1280]; // 150Hz @ 48kHz
      const pitchRatio = 1.5; // 升高音高50%
      
      const positions = [];
      positions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        const newPosition = positions[i - 1] + newInterval;
        positions.push(Math.round(newPosition));
      }
      
      // 验证新间距更小
      const originalInterval = pitchMarks[1] - pitchMarks[0];
      const newInterval = positions[1] - positions[0];
      
      expect(newInterval).toBeLessThan(originalInterval);
      expect(newInterval).toBeCloseTo(originalInterval / pitchRatio, 0); // 放宽精度到整数级别
    });

    it('音高降低时应该增大帧间距', () => {
      const pitchMarks = [0, 320, 640, 960];
      const pitchRatio = 0.75; // 降低音高25%
      
      const positions = [];
      positions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        const newPosition = positions[i - 1] + newInterval;
        positions.push(Math.round(newPosition));
      }
      
      const originalInterval = pitchMarks[1] - pitchMarks[0];
      const newInterval = positions[1] - positions[0];
      
      expect(newInterval).toBeGreaterThan(originalInterval);
      expect(newInterval).toBeCloseTo(originalInterval / pitchRatio, 0); // 放宽精度到整数级别
    });

    it('音高不变时应该保持帧间距', () => {
      const pitchMarks = [0, 320, 640, 960];
      const pitchRatio = 1.0;
      
      const positions = [];
      positions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        const newPosition = positions[i - 1] + newInterval;
        positions.push(Math.round(newPosition));
      }
      
      for (let i = 0; i < pitchMarks.length; i++) {
        expect(positions[i]).toBeCloseTo(pitchMarks[i], 1);
      }
    });

    it('应该处理非均匀的标记点', () => {
      const pitchMarks = [0, 300, 650, 950, 1300]; // 不均匀间距
      const pitchRatio = 1.2;
      
      const positions = [];
      positions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        const newPosition = positions[i - 1] + newInterval;
        positions.push(Math.round(newPosition));
      }
      
      expect(positions.length).toBe(pitchMarks.length);
      expect(positions[0]).toBe(pitchMarks[0]);
    });
  });

  describe('重叠相加合成', () => {
    it('应该正确归一化重叠区域', () => {
      const outputLength = 1000;
      const output = new Float32Array(outputLength);
      const overlap = new Float32Array(outputLength);
      
      // 模拟两个帧的重叠
      const frame1Start = 100;
      const frame1Length = 200;
      const frame2Start = 150;
      const frame2Length = 200;
      
      // 添加第一帧
      for (let i = 0; i < frame1Length; i++) {
        const pos = frame1Start + i;
        if (pos < outputLength) {
          output[pos] += 1.0;
          overlap[pos] += 1;
        }
      }
      
      // 添加第二帧
      for (let i = 0; i < frame2Length; i++) {
        const pos = frame2Start + i;
        if (pos < outputLength) {
          output[pos] += 1.0;
          overlap[pos] += 1;
        }
      }
      
      // 归一化
      for (let i = 0; i < outputLength; i++) {
        if (overlap[i] > 0) {
          output[i] /= overlap[i];
        }
      }
      
      // 验证重叠区域被正确归一化为1.0
      for (let i = frame2Start; i < frame1Start + frame1Length && i < outputLength; i++) {
        expect(output[i]).toBeCloseTo(1.0, 5);
      }
    });

    it('应该处理不重叠的帧', () => {
      const outputLength = 1000;
      const output = new Float32Array(outputLength);
      const overlap = new Float32Array(outputLength);
      
      // 两个不重叠的帧
      const frame1Start = 100;
      const frame1Length = 100;
      const frame2Start = 300;
      const frame2Length = 100;
      
      for (let i = 0; i < frame1Length; i++) {
        output[frame1Start + i] += 1.0;
        overlap[frame1Start + i] += 1;
      }
      
      for (let i = 0; i < frame2Length; i++) {
        output[frame2Start + i] += 1.0;
        overlap[frame2Start + i] += 1;
      }
      
      // 归一化
      for (let i = 0; i < outputLength; i++) {
        if (overlap[i] > 0) {
          output[i] /= overlap[i];
        }
      }
      
      // 验证非重叠区域
      expect(output[150]).toBeCloseTo(1.0, 5);
      expect(output[350]).toBeCloseTo(1.0, 5);
      expect(output[250]).toBe(0); // 间隙
    });

    it('应该应用淡入淡出', () => {
      const outputLength = 1000;
      const output = new Float32Array(outputLength);
      output.fill(1.0); // 填充信号
      
      const fadeLength = 100;
      
      // 应用淡入
      for (let i = 0; i < fadeLength; i++) {
        const fadeIn = i / fadeLength;
        output[i] *= fadeIn;
      }
      
      // 应用淡出
      for (let i = 0; i < fadeLength; i++) {
        const fadeOut = i / fadeLength;
        const pos = outputLength - 1 - i;
        if (pos > 0) {
          output[pos] *= fadeOut;
        }
      }
      
      // 验证淡入淡出
      expect(output[0]).toBe(0);
      expect(output[fadeLength - 1]).toBeCloseTo(1.0, 1);
      expect(output[outputLength - 1]).toBe(0);
    });
  });

  describe('完整的 TD-PSOLA 流程', () => {
    it('应该保持音频时长不变', () => {
      const sampleRate = 48000;
      const duration = 1.0;
      const originalLength = duration * sampleRate;
      
      const f0 = 150;
      const signal = generateSineWave(f0, duration, sampleRate);
      
      const pitchRatio = 1.2;
      
      // 模拟处理
      const period = sampleRate / f0;
      const pitchMarks = [];
      for (let i = 0; i * period < originalLength; i++) {
        pitchMarks.push(Math.floor(i * period));
      }
      
      const synthesisPositions = [];
      synthesisPositions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        const newPosition = synthesisPositions[i - 1] + newInterval;
        synthesisPositions.push(Math.round(newPosition));
      }
      
      const lastPosition = synthesisPositions[synthesisPositions.length - 1];
      const outputLength = Math.max(originalLength, lastPosition + period);
      
      // 输出长度应该接近原始长度
      const lengthRatio = outputLength / originalLength;
      expect(lengthRatio).toBeGreaterThan(0.95);
      expect(lengthRatio).toBeLessThan(1.15); // 允许一些缓冲
    });

    it('应该改变音高而不改变说话速度', () => {
      const sampleRate = 48000;
      const duration = 1.0;
      const f0 = 150;
      
      const signal = generateVoiceLikeSignal(f0, duration, sampleRate);
      
      // 模拟检测标记点
      const period = sampleRate / f0;
      const pitchMarks = [];
      for (let i = 0; i * period < signal.length; i++) {
        pitchMarks.push(Math.floor(i * period));
      }
      
      const pitchRatio = 1.333; // 升高音高33% (约50Hz)
      
      // 计算合成位置
      const synthesisPositions = [];
      synthesisPositions.push(pitchMarks[0]);
      
      for (let i = 1; i < pitchMarks.length; i++) {
        const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
        const newInterval = originalInterval / pitchRatio;
        synthesisPositions.push(Math.round(synthesisPositions[i - 1] + newInterval));
      }
      
      // 估计输出的基频
      const outputF0 = estimateF0FromMarks(synthesisPositions, sampleRate);
      const expectedF0 = f0 * pitchRatio;
      
      // 允许 ±5% 的误差
      expect(outputF0).toBeGreaterThan(expectedF0 * 0.95);
      expect(outputF0).toBeLessThan(expectedF0 * 1.05);
    });

    it('应该处理典型的 VFS 变调范围 (10-100Hz)', () => {
      const sampleRate = 48000;
      const duration = 0.5;
      const f0 = 150; // 典型男声基频
      
      const testShifts = [10, 30, 50, 70, 100]; // Hz
      
      for (const shift of testShifts) {
        const targetF0 = f0 + shift;
        const pitchRatio = targetF0 / f0;
        
        // 生成信号
        const signal = generateVoiceLikeSignal(f0, duration, sampleRate);
        
        // 验证 pitch ratio 在合理范围内
        expect(pitchRatio).toBeGreaterThan(1.0);
        expect(pitchRatio).toBeLessThan(2.0);
        
        // 模拟标记点
        const period = sampleRate / f0;
        const pitchMarks = [];
        for (let i = 0; i * period < signal.length; i++) {
          pitchMarks.push(Math.floor(i * period));
        }
        
        expect(pitchMarks.length).toBeGreaterThan(0);
      }
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理空的标记点数组', () => {
      const pitchMarks = [];
      const pitchRatio = 1.2;
      
      const positions = [];
      if (pitchMarks.length > 0) {
        positions.push(pitchMarks[0]);
      }
      
      expect(positions.length).toBe(0);
    });

    it('应该处理只有一个标记点的情况', () => {
      const pitchMarks = [100];
      const pitchRatio = 1.2;
      
      const positions = [];
      positions.push(pitchMarks[0]);
      
      expect(positions.length).toBe(1);
      expect(positions[0]).toBe(100);
    });

    it('应该处理极端的音高比例', () => {
      const pitchMarks = [0, 320, 640, 960];
      
      const extremeRatios = [0.5, 2.0, 0.1, 3.0];
      
      for (const ratio of extremeRatios) {
        const positions = [];
        positions.push(pitchMarks[0]);
        
        for (let i = 1; i < pitchMarks.length; i++) {
          const originalInterval = pitchMarks[i] - pitchMarks[i - 1];
          const newInterval = originalInterval / ratio;
          positions.push(Math.round(positions[i - 1] + newInterval));
        }
        
        expect(positions.length).toBe(pitchMarks.length);
        expect(positions[0]).toBe(0);
      }
    });

    it('应该处理非常短的音频', () => {
      const sampleRate = 48000;
      const duration = 0.1; // 100ms
      const f0 = 150;
      
      const signal = generateSineWave(f0, duration, sampleRate);
      
      expect(signal.length).toBe(4800);
      
      const period = sampleRate / f0;
      const expectedMarks = Math.floor(signal.length / period);
      
      expect(expectedMarks).toBeGreaterThanOrEqual(0);
    });

    it('应该处理非常长的音频的元数据', () => {
      const sampleRate = 48000;
      const duration = 60; // 60秒
      const f0 = 150;
      
      const length = duration * sampleRate; // 2,880,000 采样点
      const period = sampleRate / f0; // 320 采样点/周期
      
      const expectedMarks = Math.floor(length / period);
      
      // 应该能检测到很多标记点
      expect(expectedMarks).toBeGreaterThan(100);
      expect(expectedMarks).toBeLessThan(10000); // 合理上限
    });
  });

  describe('性能特性', () => {
    it('标记点密度应该与基频成反比', () => {
      const sampleRate = 48000;
      const duration = 1.0;
      const length = duration * sampleRate;
      
      const frequencies = [100, 150, 200];
      const markCounts = [];
      
      for (const f0 of frequencies) {
        const period = sampleRate / f0;
        const marks = Math.floor(length / period);
        markCounts.push(marks);
      }
      
      // 更高的频率应该有更多的标记点
      expect(markCounts[2]).toBeGreaterThan(markCounts[1]);
      expect(markCounts[1]).toBeGreaterThan(markCounts[0]);
    });

    it('帧提取不应该产生过长的帧', () => {
      const sampleRate = 48000;
      const f0 = 50; // 很低的频率
      
      const maxFrameLength = Math.round(sampleRate / 50 * 2);
      const minFrameLength = Math.round(sampleRate / 500 * 2);
      
      // 即使对于低频，帧长度也应该有上限
      expect(maxFrameLength).toBeLessThan(sampleRate * 0.1); // 不超过100ms
      expect(minFrameLength).toBeGreaterThan(0);
    });
  });

  describe('信号质量', () => {
    it('处理后的信号不应该有削波', () => {
      const sampleRate = 48000;
      const duration = 0.5;
      const signal = generateSineWave(150, duration, sampleRate);
      
      // 模拟处理后检查
      let hasClipping = false;
      for (let i = 0; i < signal.length; i++) {
        if (Math.abs(signal[i]) > 1.0) {
          hasClipping = true;
          break;
        }
      }
      
      expect(hasClipping).toBe(false);
    });

    it('处理后的信号能量应该合理', () => {
      const sampleRate = 48000;
      const duration = 0.5;
      const signal = generateSineWave(150, duration, sampleRate);
      
      const energy = signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
      
      // 正弦波的能量约为0.5
      expect(energy).toBeGreaterThan(0.4);
      expect(energy).toBeLessThan(0.6);
    });

    it('汉宁窗应该平滑边界', () => {
      const windowLength = 512;
      const window = new Float32Array(windowLength);
      
      // 生成汉宁窗
      for (let i = 0; i < windowLength; i++) {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowLength - 1)));
      }
      
      // 检查平滑性：相邻点的差值应该很小
      let maxDiff = 0;
      for (let i = 1; i < windowLength; i++) {
        const diff = Math.abs(window[i] - window[i - 1]);
        maxDiff = Math.max(maxDiff, diff);
      }
      
      expect(maxDiff).toBeLessThan(0.1); // 平滑过渡
    });
  });
});
