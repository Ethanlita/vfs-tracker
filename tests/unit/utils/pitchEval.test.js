/**
 * 单元测试: src/utils/pitchEval.js
 * 
 * 测试音频基频评估工具函数
 */

import { describe, it, expect } from 'vitest';
import {
  gateByEnergy,
  gateByStability,
  accumulateStableWindow,
  adaptiveParamsFromMAD
} from '../../../src/utils/pitchEval.js';

describe('pitchEval.js 单元测试', () => {

  // ============================================
  // gateByEnergy 函数测试
  // ============================================
  
  describe('gateByEnergy', () => {
    it('RMS 大于阈值时应该返回 true', () => {
      const baseline = 0.1;
      const deltaDb = 12;
      // threshold = 0.1 * 10^(12/20) = 0.1 * 3.98 ≈ 0.398
      const rms = 0.5; // 大于阈值
      
      expect(gateByEnergy(rms, baseline, deltaDb)).toBe(true);
    });

    it('RMS 小于阈值时应该返回 false', () => {
      const baseline = 0.1;
      const deltaDb = 12;
      const rms = 0.2; // 小于阈值 (0.398)
      
      expect(gateByEnergy(rms, baseline, deltaDb)).toBe(false);
    });

    it('RMS 等于阈值时应该返回 true', () => {
      const baseline = 0.1;
      const deltaDb = 12;
      const threshold = baseline * Math.pow(10, deltaDb / 20);
      
      expect(gateByEnergy(threshold, baseline, deltaDb)).toBe(true);
    });

    it('默认 deltaDb 应该是 12', () => {
      const baseline = 0.1;
      const rms = 0.5;
      
      const result1 = gateByEnergy(rms, baseline);
      const result2 = gateByEnergy(rms, baseline, 12);
      
      expect(result1).toBe(result2);
    });

    it('deltaDb 为 0 时阈值应该等于 baseline', () => {
      const baseline = 0.1;
      const rms = 0.15;
      
      expect(gateByEnergy(rms, baseline, 0)).toBe(true);
      expect(gateByEnergy(0.05, baseline, 0)).toBe(false);
    });

    it('baseline 为 0 时应该正常工作', () => {
      const rms = 0.5;
      // threshold = 0 * 10^(12/20) = 0
      expect(gateByEnergy(rms, 0, 12)).toBe(true);
      expect(gateByEnergy(0, 0, 12)).toBe(true); // 0 >= 0
    });
  });

  // ============================================
  // gateByStability 函数测试
  // ============================================
  
  describe('gateByStability', () => {
    it('clarity 大于阈值时应该返回 true', () => {
      expect(gateByStability(0.8, 0.6)).toBe(true);
    });

    it('clarity 小于阈值时应该返回 false', () => {
      expect(gateByStability(0.5, 0.6)).toBe(false);
    });

    it('clarity 等于阈值时应该返回 true', () => {
      expect(gateByStability(0.6, 0.6)).toBe(true);
    });

    it('默认 theta 应该是 0.6', () => {
      const clarity = 0.7;
      const result1 = gateByStability(clarity);
      const result2 = gateByStability(clarity, 0.6);
      
      expect(result1).toBe(result2);
    });

    it('theta 为 0 时任何 clarity >= 0 都应该通过', () => {
      expect(gateByStability(0, 0)).toBe(true);
      expect(gateByStability(0.1, 0)).toBe(true);
    });

    it('theta 为 1 时只有 clarity = 1 才能通过', () => {
      expect(gateByStability(1, 1)).toBe(true);
      expect(gateByStability(0.99, 1)).toBe(false);
    });
  });

  // ============================================
  // accumulateStableWindow 函数测试
  // ============================================
  
  describe('accumulateStableWindow', () => {
    it('所有帧都通过时应该累加全部时长', () => {
      const frames = [
        { pitch: 440, clarity: 0.8, rms: 0.5 },
        { pitch: 440, clarity: 0.8, rms: 0.5 },
        { pitch: 440, clarity: 0.8, rms: 0.5 }
      ];
      const targetFreq = 440;
      const tolerance = 50; // cents
      const baseline = 0.1;
      const deltaDb = 12;
      const theta = 0.6;
      const dt = 100; // ms

      const result = accumulateStableWindow(
        frames,
        targetFreq,
        tolerance,
        baseline,
        deltaDb,
        theta,
        dt
      );

      expect(result).toBe(300); // 3 frames * 100ms
    });

    it('没有帧通过时应该返回 0', () => {
      const frames = [
        { pitch: 0, clarity: 0.3, rms: 0.01 }, // pitch = 0 不通过
        { pitch: 500, clarity: 0.3, rms: 0.01 }, // clarity 和 rms 不通过
        { pitch: 440, clarity: 0.8, rms: 0.01 } // rms 不通过
      ];

      const result = accumulateStableWindow(
        frames,
        440, // targetFreq
        50,  // tolerance
        0.1, // baseline
        12,  // deltaDb
        0.6, // theta
        100  // dt
      );

      expect(result).toBe(0);
    });

    it('部分帧通过时应该返回最长连续时长', () => {
      const frames = [
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 0, clarity: 0.8, rms: 0.5 },   // fail (pitch = 0)
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 440, clarity: 0.8, rms: 0.5 }  // pass
      ];

      const result = accumulateStableWindow(
        frames,
        440,
        50,
        0.1,
        12,
        0.6,
        100
      );

      // 最长连续序列是最后 3 帧
      expect(result).toBe(300);
    });

    it('多个相等长度的稳定窗口时应该返回其中一个', () => {
      const frames = [
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 0, clarity: 0.8, rms: 0.5 },   // fail
        { pitch: 440, clarity: 0.8, rms: 0.5 }, // pass
        { pitch: 440, clarity: 0.8, rms: 0.5 }  // pass
      ];

      const result = accumulateStableWindow(
        frames,
        440,
        50,
        0.1,
        12,
        0.6,
        100
      );

      expect(result).toBe(200); // 两个连续序列都是 200ms
    });

    it('pitch 超出 tolerance 时应该失败', () => {
      const frames = [
        { pitch: 440, clarity: 0.8, rms: 0.5 },  // pass
        { pitch: 500, clarity: 0.8, rms: 0.5 },  // fail (超出 tolerance)
        { pitch: 440, clarity: 0.8, rms: 0.5 }   // pass
      ];

      const result = accumulateStableWindow(
        frames,
        440,
        50, // ±50 cents, 440->500 约为 +230 cents
        0.1,
        12,
        0.6,
        100
      );

      expect(result).toBe(100); // 只有单独的帧通过
    });

    it('空数组应该返回 0', () => {
      const result = accumulateStableWindow(
        [],
        440,
        50,
        0.1,
        12,
        0.6,
        100
      );

      expect(result).toBe(0);
    });

    it('dt 为 0 时应该始终返回 0', () => {
      const frames = [
        { pitch: 440, clarity: 0.8, rms: 0.5 },
        { pitch: 440, clarity: 0.8, rms: 0.5 }
      ];

      const result = accumulateStableWindow(
        frames,
        440,
        50,
        0.1,
        12,
        0.6,
        0 // dt = 0
      );

      expect(result).toBe(0);
    });
  });

  // ============================================
  // adaptiveParamsFromMAD 函数测试
  // ============================================
  
  describe('adaptiveParamsFromMAD', () => {
    it('MAD > 50 时应该返回高容差和长窗口', () => {
      const result = adaptiveParamsFromMAD(60);
      expect(result).toEqual({
        tolerance: 75,
        windowMs: 350
      });
    });

    it('MAD < 15 时应该返回低容差和短窗口', () => {
      const result = adaptiveParamsFromMAD(10);
      expect(result).toEqual({
        tolerance: 30,
        windowMs: 250
      });
    });

    it('15 <= MAD <= 50 时应该返回默认参数', () => {
      const result1 = adaptiveParamsFromMAD(15);
      const result2 = adaptiveParamsFromMAD(30);
      const result3 = adaptiveParamsFromMAD(50);

      expect(result1).toEqual({
        tolerance: 50,
        windowMs: 300
      });
      expect(result2).toEqual({
        tolerance: 50,
        windowMs: 300
      });
      expect(result3).toEqual({
        tolerance: 50,
        windowMs: 300
      });
    });

    it('边界值 MAD = 50 应该返回默认参数', () => {
      const result = adaptiveParamsFromMAD(50);
      expect(result).toEqual({
        tolerance: 50,
        windowMs: 300
      });
    });

    it('边界值 MAD = 15 应该返回默认参数', () => {
      const result = adaptiveParamsFromMAD(15);
      expect(result).toEqual({
        tolerance: 50,
        windowMs: 300
      });
    });

    it('MAD = 51 应该返回高容差参数', () => {
      const result = adaptiveParamsFromMAD(51);
      expect(result).toEqual({
        tolerance: 75,
        windowMs: 350
      });
    });

    it('MAD = 14 应该返回低容差参数', () => {
      const result = adaptiveParamsFromMAD(14);
      expect(result).toEqual({
        tolerance: 30,
        windowMs: 250
      });
    });

    it('MAD = 0 应该返回低容差参数', () => {
      const result = adaptiveParamsFromMAD(0);
      expect(result).toEqual({
        tolerance: 30,
        windowMs: 250
      });
    });

    it('负数 MAD 应该返回低容差参数', () => {
      const result = adaptiveParamsFromMAD(-10);
      expect(result).toEqual({
        tolerance: 30,
        windowMs: 250
      });
    });

    it('极大的 MAD 应该返回高容差参数', () => {
      const result = adaptiveParamsFromMAD(1000);
      expect(result).toEqual({
        tolerance: 75,
        windowMs: 350
      });
    });
  });
});
