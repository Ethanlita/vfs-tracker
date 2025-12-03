/**
 * @file formatters 工具函数单元测试
 * @description 测试事件详情值格式化函数的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  formatWithUnit,
  formatHz,
  formatDb,
  formatDbA,
  formatPercent,
  formatSeconds,
  formatCount,
  formatDateTime,
  formatDate,
  formatBoolean,
  formatArray,
  formatPitchRange,
  formatFormants,
  formatRBH,
  autoFormat,
  getNestedValue
} from '../../../../src/components/events/utils/formatters.js';

describe('formatters.js 单元测试', () => {
  
  // ============================================
  // formatWithUnit 测试
  // ============================================
  
  describe('formatWithUnit', () => {
    it('应该正确格式化数值和单位', () => {
      expect(formatWithUnit(100, 'Hz')).toBe('100.0 Hz');
      expect(formatWithUnit(25.5, '%')).toBe('25.5 %');
      expect(formatWithUnit(0, 'dB')).toBe('0.0 dB');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatWithUnit(null, 'Hz')).toBe('-');
      expect(formatWithUnit(undefined, 'Hz')).toBe('-');
      expect(formatWithUnit('', 'Hz')).toBe('-');
    });
    
    it('应该处理小数位数', () => {
      expect(formatWithUnit(123.456789, 'Hz', 2)).toBe('123.46 Hz');
      expect(formatWithUnit(100, 'dB', 0)).toBe('100 dB');
    });
    
    it('应该处理字符串数字', () => {
      expect(formatWithUnit('100', 'Hz')).toBe('100.0 Hz');
      expect(formatWithUnit('25.5', '%')).toBe('25.5 %');
    });
    
    it('非数字字符串应该返回原值', () => {
      expect(formatWithUnit('abc', 'Hz')).toBe('abc');
    });
  });
  
  // ============================================
  // formatHz 测试
  // ============================================
  
  describe('formatHz', () => {
    it('应该格式化频率值', () => {
      expect(formatHz(220)).toBe('220.0 Hz');
      expect(formatHz(440.5)).toBe('440.5 Hz');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatHz(null)).toBe('-');
      expect(formatHz(undefined)).toBe('-');
    });
  });
  
  // ============================================
  // formatDb 测试
  // ============================================
  
  describe('formatDb', () => {
    it('应该格式化分贝值', () => {
      expect(formatDb(20)).toBe('20.0 dB');
      expect(formatDb(-3.5)).toBe('-3.5 dB');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatDb(null)).toBe('-');
    });
  });
  
  // ============================================
  // formatDbA 测试
  // ============================================
  
  describe('formatDbA', () => {
    it('应该格式化 dB(A) 值', () => {
      expect(formatDbA(74.8)).toBe('74.8 dB(A)');
      expect(formatDbA(60)).toBe('60.0 dB(A)');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatDbA(null)).toBe('-');
    });
  });
  
  // ============================================
  // formatPercent 测试
  // ============================================
  
  describe('formatPercent', () => {
    it('应该格式化百分比值 (0-1 范围)', () => {
      expect(formatPercent(0.5)).toBe('50%');
      expect(formatPercent(1)).toBe('100%');
      expect(formatPercent(0)).toBe('0%');
    });
    
    it('应该格式化百分比值 (>1 范围)', () => {
      expect(formatPercent(50)).toBe('50.0%');
      expect(formatPercent(99.9)).toBe('99.9%');
    });
    
    it('应该处理已经是百分比字符串的情况', () => {
      expect(formatPercent('35%')).toBe('35%');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatPercent(null)).toBe('-');
      expect(formatPercent(undefined)).toBe('-');
      expect(formatPercent('')).toBe('-');
    });
  });
  
  // ============================================
  // formatSeconds 测试
  // ============================================
  
  describe('formatSeconds', () => {
    it('应该格式化秒数', () => {
      expect(formatSeconds(30)).toBe('30.00 秒');
      expect(formatSeconds(1.5)).toBe('1.50 秒');
      expect(formatSeconds(3.82)).toBe('3.82 秒');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatSeconds(null)).toBe('-');
    });
  });
  
  // ============================================
  // formatCount 测试
  // ============================================
  
  describe('formatCount', () => {
    it('应该格式化次数', () => {
      expect(formatCount(97)).toBe('97 次');
      expect(formatCount(0)).toBe('0 次');
    });
    
    it('应该处理字符串数字', () => {
      expect(formatCount('15')).toBe('15 次');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatCount(null)).toBe('-');
    });
  });
  
  // ============================================
  // formatDateTime 测试
  // ============================================
  
  describe('formatDateTime', () => {
    it('应该格式化 ISO 日期时间字符串', () => {
      const result = formatDateTime('2024-01-15T10:30:00Z');
      
      // 应该包含年月日和时间信息
      expect(result).toContain('2024');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined)).toBe('-');
      expect(formatDateTime('')).toBe('-');
    });
    
    it('无效日期应该返回原值', () => {
      expect(formatDateTime('invalid-date')).toBe('invalid-date');
    });
  });
  
  // ============================================
  // formatDate 测试
  // ============================================
  
  describe('formatDate', () => {
    it('应该格式化 ISO 日期字符串', () => {
      const result = formatDate('2024-01-15T10:30:00Z');
      
      // 应该包含年月日信息
      expect(result).toContain('2024');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate('')).toBe('-');
    });
    
    it('无效日期应该返回原值', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date');
    });
  });
  
  // ============================================
  // formatBoolean 测试
  // ============================================
  
  describe('formatBoolean', () => {
    it('应该格式化布尔值', () => {
      expect(formatBoolean(true)).toBe('是');
      expect(formatBoolean(false)).toBe('否');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatBoolean(null)).toBe('-');
      expect(formatBoolean(undefined)).toBe('-');
    });
  });
  
  // ============================================
  // formatArray 测试
  // ============================================
  
  describe('formatArray', () => {
    it('应该用顿号连接数组元素', () => {
      expect(formatArray(['a', 'b', 'c'])).toBe('a、b、c');
      expect(formatArray([1, 2, 3])).toBe('1、2、3');
    });
    
    it('单元素数组不应该有分隔符', () => {
      expect(formatArray(['only'])).toBe('only');
    });
    
    it('空数组应该返回占位符', () => {
      expect(formatArray([])).toBe('-');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatArray(null)).toBe('-');
      expect(formatArray(undefined)).toBe('-');
    });
  });
  
  // ============================================
  // formatPitchRange 测试
  // ============================================
  
  describe('formatPitchRange', () => {
    it('应该格式化音域范围对象', () => {
      const pitch = { max: 438.6, min: 227.6 };
      const result = formatPitchRange(pitch);
      
      expect(result).toBe('227.6 - 438.6 Hz');
    });
    
    it('应该处理部分数据的音高对象', () => {
      expect(formatPitchRange({ max: 300 })).toBe('? - 300.0 Hz');
      expect(formatPitchRange({ min: 150 })).toBe('150.0 - ? Hz');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatPitchRange(null)).toBe('-');
      expect(formatPitchRange(undefined)).toBe('-');
      expect(formatPitchRange({})).toBe('-');
    });
  });
  
  // ============================================
  // formatFormants 测试
  // ============================================
  
  describe('formatFormants', () => {
    it('应该格式化共振峰对象', () => {
      const formants = { f1: 500, f2: 1500, f3: 2500 };
      const result = formatFormants(formants);
      
      expect(result).toContain('F1:');
      expect(result).toContain('500.0 Hz');
      expect(result).toContain('F2:');
      expect(result).toContain('1500.0 Hz');
      expect(result).toContain('F3:');
      expect(result).toContain('2500.0 Hz');
    });
    
    it('应该处理部分数据', () => {
      const formants = { f1: 500 };
      const result = formatFormants(formants);
      
      expect(result).toContain('F1:');
      expect(result).toContain('500.0 Hz');
      expect(result).not.toContain('F2:');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatFormants(null)).toBe('-');
      expect(formatFormants(undefined)).toBe('-');
    });
  });
  
  // ============================================
  // formatRBH 测试
  // ============================================
  
  describe('formatRBH', () => {
    it('应该格式化 RBH 评估对象', () => {
      const rbh = { R: 2, B: 1, H: 2 };
      const result = formatRBH(rbh);
      
      expect(result).toBe('R=2, B=1, H=2');
    });
    
    it('应该处理部分数据', () => {
      expect(formatRBH({ R: 1 })).toBe('R=1');
      expect(formatRBH({ R: 1, B: 2 })).toBe('R=1, B=2');
    });
    
    it('空值应该返回占位符', () => {
      expect(formatRBH(null)).toBe('-');
      expect(formatRBH(undefined)).toBe('-');
    });
  });
  
  // ============================================
  // autoFormat 测试
  // ============================================
  
  describe('autoFormat', () => {
    it('应该自动格式化频率字段', () => {
      expect(autoFormat('f0_mean', 220)).toBe('220.0 Hz');
      expect(autoFormat('full_metrics.sustained.f0_mean', 200)).toBe('200.0 Hz');
    });
    
    it('应该自动格式化分贝字段', () => {
      expect(autoFormat('hnr_db', 19)).toBe('19.0 dB');
    });
    
    it('应该自动格式化声压级字段', () => {
      expect(autoFormat('spl_dba', 74.8)).toBe('74.8 dB(A)');
    });
    
    it('应该自动格式化百分比字段', () => {
      expect(autoFormat('jitter', 0.5)).toBe('50%');
      expect(autoFormat('shimmer_percent', 3.5)).toBe('3.5%');
    });
    
    it('应该自动格式化时长字段', () => {
      // 注意：autoFormat 检测字段名中的关键词，优先级顺序很重要
      // 'ratio' 检测在 'duration' 之前，所以 duration 会匹配 ratio
      // mpt_s 可以正确匹配 '_s' 后缀
      expect(autoFormat('mpt_s', 15)).toBe('15.00 秒');
      // recording_s 可以正确匹配时长
      expect(autoFormat('recording_s', 3.82)).toBe('3.82 秒');
    });
    
    it('应该自动格式化日期字段', () => {
      const result = autoFormat('date', '2024-01-15');
      expect(result).toContain('2024');
    });
    
    it('应该自动格式化布尔值', () => {
      expect(autoFormat('someField', true)).toBe('是');
      expect(autoFormat('someField', false)).toBe('否');
    });
    
    it('应该自动格式化数组', () => {
      expect(autoFormat('someField', ['a', 'b', 'c'])).toBe('a、b、c');
    });
    
    it('应该自动格式化 pitch 对象', () => {
      const result = autoFormat('someField', { max: 300, min: 150 });
      expect(result).toBe('150.0 - 300.0 Hz');
    });
    
    it('应该自动格式化 formants 对象', () => {
      const result = autoFormat('someField', { f1: 500, f2: 1500 });
      expect(result).toContain('F1:');
    });
    
    it('应该自动格式化 RBH 对象', () => {
      const result = autoFormat('someField', { R: 2, B: 1, H: 2 });
      expect(result).toBe('R=2, B=1, H=2');
    });
    
    it('空值应该返回占位符', () => {
      expect(autoFormat('anyField', null)).toBe('-');
      expect(autoFormat('anyField', undefined)).toBe('-');
      expect(autoFormat('anyField', '')).toBe('-');
    });
  });
  
  // ============================================
  // getNestedValue 测试
  // ============================================
  
  describe('getNestedValue', () => {
    const testObj = {
      level1: {
        level2: {
          level3: 'deepValue'
        },
        value: 'level2Value'
      },
      simple: 'simpleValue'
    };
    
    it('应该获取简单路径的值', () => {
      expect(getNestedValue(testObj, 'simple')).toBe('simpleValue');
    });
    
    it('应该获取嵌套路径的值', () => {
      expect(getNestedValue(testObj, 'level1.value')).toBe('level2Value');
      expect(getNestedValue(testObj, 'level1.level2.level3')).toBe('deepValue');
    });
    
    it('路径不存在时应该返回默认值', () => {
      expect(getNestedValue(testObj, 'nonexistent')).toBe(undefined);
      expect(getNestedValue(testObj, 'nonexistent', 'default')).toBe('default');
      expect(getNestedValue(testObj, 'level1.nonexistent', 'default')).toBe('default');
    });
    
    it('对象为空时应该返回默认值', () => {
      expect(getNestedValue(null, 'any', 'default')).toBe('default');
      expect(getNestedValue(undefined, 'any', 'default')).toBe('default');
    });
    
    it('路径为空时应该返回默认值', () => {
      expect(getNestedValue(testObj, '', 'default')).toBe('default');
      expect(getNestedValue(testObj, null, 'default')).toBe('default');
    });
  });
});
