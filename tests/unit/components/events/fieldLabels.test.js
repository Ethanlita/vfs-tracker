/**
 * @file fieldLabels 工具函数单元测试
 * @description 测试字段标签映射的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  BASE_FIELD_LABELS,
  VOICE_TEST_LABELS,
  SURGERY_LABELS,
  FEELING_LOG_LABELS,
  VOICE_TRAINING_LABELS,
  SELF_PRACTICE_LABELS,
  FULL_METRICS_LABELS,
  FORMANT_LABELS,
  ANALYSIS_SECTION_LABELS,
  getFieldLabel,
  getEventTypeLabel,
  getStatusLabel
} from '../../../../src/components/events/utils/fieldLabels.js';

describe('fieldLabels.js 单元测试', () => {
  
  // ============================================
  // 事件类型标签测试
  // ============================================
  
  describe('EVENT_TYPE_LABELS', () => {
    it('应该包含所有必需的事件类型', () => {
      const requiredTypes = [
        'self_test',
        'hospital_test',
        'voice_training',
        'self_practice',
        'surgery',
        'feeling_log'
      ];
      
      requiredTypes.forEach(type => {
        expect(EVENT_TYPE_LABELS[type]).toBeDefined();
        expect(typeof EVENT_TYPE_LABELS[type]).toBe('string');
        expect(EVENT_TYPE_LABELS[type].length).toBeGreaterThan(0);
      });
    });
    
    it('事件类型标签应该是中文', () => {
      expect(EVENT_TYPE_LABELS.self_test).toBe('自我测试');
      expect(EVENT_TYPE_LABELS.surgery).toBe('VFS 手术');
      expect(EVENT_TYPE_LABELS.feeling_log).toBe('感受日志');
    });
    
    it('应该支持连字符格式的类型名', () => {
      expect(EVENT_TYPE_LABELS['self-test']).toBe('自我测试');
      expect(EVENT_TYPE_LABELS['feeling-log']).toBe('感受日志');
    });
  });
  
  // ============================================
  // 状态标签测试
  // ============================================
  
  describe('STATUS_LABELS', () => {
    it('应该包含所有必需的状态', () => {
      expect(STATUS_LABELS.pending).toBe('待审核');
      expect(STATUS_LABELS.approved).toBe('已通过');
      expect(STATUS_LABELS.rejected).toBe('已拒绝');
    });
  });
  
  // ============================================
  // 基础字段标签测试
  // ============================================
  
  describe('BASE_FIELD_LABELS', () => {
    it('应该包含通用的事件字段', () => {
      const commonFields = [
        'date',
        'status',
        'createdAt',
        'updatedAt',
        'type',
        'notes'
      ];
      
      commonFields.forEach(field => {
        expect(BASE_FIELD_LABELS[field]).toBeDefined();
      });
    });
    
    it('字段标签应该是中文', () => {
      expect(BASE_FIELD_LABELS.date).toBe('事件日期');
      expect(BASE_FIELD_LABELS.status).toBe('审核状态');
      expect(BASE_FIELD_LABELS.type).toBe('事件类型');
    });
  });
  
  // ============================================
  // 嗓音测试字段标签测试
  // ============================================
  
  describe('VOICE_TEST_LABELS', () => {
    it('应该包含嗓音测试相关字段', () => {
      expect(VOICE_TEST_LABELS.fundamentalFrequency).toBe('平均基频');
      expect(VOICE_TEST_LABELS.jitter).toBe('频率抖动 (Jitter)');
      expect(VOICE_TEST_LABELS.shimmer).toBe('振幅抖动 (Shimmer)');
      expect(VOICE_TEST_LABELS.hnr).toBe('谐噪比 (HNR)');
    });
    
    it('应该包含共振峰字段', () => {
      expect(VOICE_TEST_LABELS['formants.f1']).toBe('第一共振峰 (F1)');
      expect(VOICE_TEST_LABELS['formants.f2']).toBe('第二共振峰 (F2)');
      expect(VOICE_TEST_LABELS['formants.f3']).toBe('第三共振峰 (F3)');
    });
    
    it('应该包含音高字段', () => {
      expect(VOICE_TEST_LABELS['pitch.max']).toBe('最高音');
      expect(VOICE_TEST_LABELS['pitch.min']).toBe('最低音');
    });
  });
  
  // ============================================
  // 手术字段标签测试
  // ============================================
  
  describe('SURGERY_LABELS', () => {
    it('应该包含手术相关字段', () => {
      expect(SURGERY_LABELS.doctor).toBe('手术医生');
      expect(SURGERY_LABELS.location).toBe('手术地点');
      expect(SURGERY_LABELS.notes).toBe('手术备注');
    });
  });
  
  // ============================================
  // 感受日志字段标签测试
  // ============================================
  
  describe('FEELING_LOG_LABELS', () => {
    it('应该包含感受日志相关字段', () => {
      expect(FEELING_LOG_LABELS.content).toBe('感受内容');
      expect(FEELING_LOG_LABELS.feeling).toBe('感受');
      expect(FEELING_LOG_LABELS.note).toBe('备注');
    });
  });
  
  // ============================================
  // 嗓音训练字段标签测试
  // ============================================
  
  describe('VOICE_TRAINING_LABELS', () => {
    it('应该包含嗓音训练相关字段', () => {
      expect(VOICE_TRAINING_LABELS.trainingContent).toBe('训练内容');
      expect(VOICE_TRAINING_LABELS.instructor).toBe('指导者');
      expect(VOICE_TRAINING_LABELS.voiceStatus).toBe('嗓音状态');
    });
  });
  
  // ============================================
  // 自我练习字段标签测试
  // ============================================
  
  describe('SELF_PRACTICE_LABELS', () => {
    it('应该包含自我练习相关字段', () => {
      expect(SELF_PRACTICE_LABELS.practiceContent).toBe('练习内容');
      expect(SELF_PRACTICE_LABELS.hasInstructor).toBe('有指导者');
      expect(SELF_PRACTICE_LABELS.feelings).toBe('感受');
    });
  });
  
  // ============================================
  // full_metrics 标签测试
  // ============================================
  
  describe('FULL_METRICS_LABELS', () => {
    it('应该包含持续音测试字段', () => {
      expect(FULL_METRICS_LABELS['sustained.f0_mean']).toBe('持续音基频均值');
      expect(FULL_METRICS_LABELS['sustained.f0_sd']).toBe('持续音基频标准差');
      expect(FULL_METRICS_LABELS['sustained.hnr_db']).toBe('谐噪比');
    });
    
    it('应该包含朗读测试字段', () => {
      expect(FULL_METRICS_LABELS['reading.f0_mean']).toBe('朗读基频均值');
      expect(FULL_METRICS_LABELS['reading.duration_s']).toBe('朗读时长');
    });
    
    it('应该包含问卷结果字段', () => {
      expect(FULL_METRICS_LABELS['questionnaires.RBH.R']).toBe('粗糙度 (R)');
      expect(FULL_METRICS_LABELS['questionnaires.RBH.B']).toBe('气息音 (B)');
      expect(FULL_METRICS_LABELS['questionnaires.RBH.H']).toBe('嘶哑度 (H)');
    });
    
    it('应该包含声域图字段', () => {
      expect(FULL_METRICS_LABELS['vrp.f0_min']).toBe('最低音高');
      expect(FULL_METRICS_LABELS['vrp.f0_max']).toBe('最高音高');
    });
  });
  
  // ============================================
  // 共振峰标签测试
  // ============================================
  
  describe('FORMANT_LABELS', () => {
    it('应该包含共振峰相关字段', () => {
      expect(FORMANT_LABELS.F1).toBe('第一共振峰 (F1)');
      expect(FORMANT_LABELS.F2).toBe('第二共振峰 (F2)');
      expect(FORMANT_LABELS.F3).toBe('第三共振峰 (F3)');
    });
    
    it('应该包含带宽字段', () => {
      expect(FORMANT_LABELS.B1).toBe('F1 带宽');
      expect(FORMANT_LABELS.B2).toBe('F2 带宽');
      expect(FORMANT_LABELS.B3).toBe('F3 带宽');
    });
  });
  
  // ============================================
  // 分析区域标签测试
  // ============================================
  
  describe('ANALYSIS_SECTION_LABELS', () => {
    it('应该包含所有分析区域', () => {
      expect(ANALYSIS_SECTION_LABELS.sustained).toBe('持续元音测试');
      expect(ANALYSIS_SECTION_LABELS.reading).toBe('朗读测试');
      expect(ANALYSIS_SECTION_LABELS.spontaneous).toBe('自发语音测试');
      expect(ANALYSIS_SECTION_LABELS.vrp).toBe('声域图 (VRP)');
      expect(ANALYSIS_SECTION_LABELS.questionnaires).toBe('问卷结果');
    });
  });
  
  // ============================================
  // getFieldLabel 函数测试
  // ============================================
  
  describe('getFieldLabel', () => {
    it('应该返回基础字段的中文标签', () => {
      expect(getFieldLabel('date')).toBe('事件日期');
      expect(getFieldLabel('status')).toBe('审核状态');
    });
    
    it('应该返回嗓音测试字段的中文标签', () => {
      expect(getFieldLabel('fundamentalFrequency')).toBe('平均基频');
      expect(getFieldLabel('jitter')).toBe('频率抖动 (Jitter)');
    });
    
    it('应该返回手术字段的中文标签', () => {
      expect(getFieldLabel('doctor')).toBe('手术医生');
      expect(getFieldLabel('location')).toBe('手术地点');
    });
    
    it('应该返回 full_metrics 字段的中文标签', () => {
      expect(getFieldLabel('full_metrics.sustained.f0_mean')).toBe('持续音基频均值');
      expect(getFieldLabel('full_metrics.reading.f0_mean')).toBe('朗读基频均值');
    });
    
    it('未知字段应该返回格式化后的字段名', () => {
      // 驼峰转空格分隔
      const result = getFieldLabel('unknownFieldName');
      expect(result).toContain('Unknown');
    });
  });
  
  // ============================================
  // getEventTypeLabel 函数测试
  // ============================================
  
  describe('getEventTypeLabel', () => {
    it('应该返回事件类型的中文名称', () => {
      expect(getEventTypeLabel('self_test')).toBe('自我测试');
      expect(getEventTypeLabel('surgery')).toBe('VFS 手术');
      expect(getEventTypeLabel('feeling_log')).toBe('感受日志');
    });
    
    it('未知类型应该返回原值', () => {
      expect(getEventTypeLabel('unknown_type')).toBe('unknown_type');
    });
  });
  
  // ============================================
  // getStatusLabel 函数测试
  // ============================================
  
  describe('getStatusLabel', () => {
    it('应该返回状态的中文名称', () => {
      expect(getStatusLabel('pending')).toBe('待审核');
      expect(getStatusLabel('approved')).toBe('已通过');
      expect(getStatusLabel('rejected')).toBe('已拒绝');
    });
    
    it('未知状态应该返回原值', () => {
      expect(getStatusLabel('unknown_status')).toBe('unknown_status');
    });
  });
});
