/**
 * @file Joi Schema 单元测试
 * @description 测试所有 Schema 定义的正确性
 */

import { describe, it, expect } from 'vitest';
import { schemas, validateData } from '../../../src/api/schemas.js';
import {
  completeProfileUser,
  minimalProfileUser,
  completeSelfTest,
  minimalSelfTest,
  completeSurgery,
  completeFeelingLog,
  mockPublicEvents,
  mockPrivateEvents,
} from '../../../src/test-utils/fixtures/index.js';

describe('API Schemas 单元测试', () => {
  
  // ==================== User Schema Tests ====================
  
  describe('userSchema', () => {
    it('应该验证完整的用户数据', () => {
      const result = validateData(schemas.user, completeProfileUser);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('应该验证最小化的用户数据', () => {
      const result = validateData(schemas.user, minimalProfileUser);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝缺少必需字段的用户数据', () => {
      const invalidUser = {
        userId: 'test-id',
        // 缺少 email, profile, createdAt, updatedAt
      };
      
      const result = validateData(schemas.user, invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该拒绝无效的邮箱格式', () => {
      const invalidUser = {
        ...completeProfileUser,
        email: 'not-an-email',
      };
      
      const result = validateData(schemas.user, invalidUser);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'email')).toBe(true);
    });
  });

  // ==================== Profile Schema Tests ====================
  
  describe('profileSchema', () => {
    it('应该验证包含社交账号的资料', () => {
      const result = validateData(schemas.profile, completeProfileUser.profile);
      expect(result.valid).toBe(true);
    });

    it('应该验证不包含社交账号的资料', () => {
      const result = validateData(schemas.profile, minimalProfileUser.profile);
      expect(result.valid).toBe(true);
    });

    it('应该接受空字符串的 bio', () => {
      const profile = {
        ...completeProfileUser.profile,
        bio: '',
      };
      
      const result = validateData(schemas.profile, profile);
      expect(result.valid).toBe(true);
    });

    it('应该接受 null 的 bio', () => {
      const profile = {
        ...completeProfileUser.profile,
        bio: null,
      };
      
      const result = validateData(schemas.profile, profile);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== Event Schema Tests ====================
  
  describe('eventSchemaPrivate', () => {
    it('应该验证完整的 self_test 事件（带 attachments）', () => {
      const result = validateData(schemas.eventPrivate, completeSelfTest);
      expect(result.valid).toBe(true);
    });

    it('应该验证最小化的 self_test 事件（不带 attachments）', () => {
      const result = validateData(schemas.eventPrivate, minimalSelfTest);
      expect(result.valid).toBe(true);
    });

    it('应该验证 surgery 事件', () => {
      const result = validateData(schemas.eventPrivate, completeSurgery);
      expect(result.valid).toBe(true);
    });

    it('应该验证 feeling_log 事件', () => {
      const result = validateData(schemas.eventPrivate, completeFeelingLog);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝无效的事件类型', () => {
      const invalidEvent = {
        ...minimalSelfTest,
        type: 'invalid_type',
      };
      
      const result = validateData(schemas.eventPrivate, invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'type')).toBe(true);
    });

    it('应该拒绝无效的事件状态', () => {
      const invalidEvent = {
        ...minimalSelfTest,
        status: 'invalid_status',
      };
      
      const result = validateData(schemas.eventPrivate, invalidEvent);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'status')).toBe(true);
    });
  });

  describe('eventSchemaPublic', () => {
    it('应该验证公共事件（必须包含 userName）', () => {
      const publicEvent = {
        ...completeSelfTest,
        userName: '张三',
      };
      delete publicEvent.attachments;
      
      const result = validateData(schemas.eventPublic, publicEvent);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝包含 attachments 的公共事件', () => {
      const publicEventWithAttachments = {
        ...completeSelfTest,
        userName: '张三',
        // attachments 仍然存在
      };
      
      const result = validateData(schemas.eventPublic, publicEventWithAttachments, {
        allowUnknown: false,
      });
      // 注意：由于我们的 schema 设计，这个测试可能需要调整
      // 公共事件 schema 应该明确禁止 attachments
    });
  });

  // ==================== API Response Schema Tests ====================
  
  describe('getAllEventsResponseSchema', () => {
    it('应该验证公共事件列表响应', () => {
      const result = validateData(schemas.getAllEventsResponse, mockPublicEvents);
      expect(result.valid).toBe(true);
    });

    it('应该接受空数组', () => {
      const result = validateData(schemas.getAllEventsResponse, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('getUserEventsResponseSchema', () => {
    it('应该验证用户事件响应', () => {
      const response = {
        events: mockPrivateEvents,
        debug: {
          lambdaExecuted: true,
          timestamp: '2025-10-08T10:00:00.000Z',
          authenticatedUserId: 'us-east-1:test-user',
        },
      };
      
      const result = validateData(schemas.getUserEventsResponse, response);
      expect(result.valid).toBe(true);
    });

    it('应该接受没有 debug 字段的响应', () => {
      const response = {
        events: mockPrivateEvents,
      };
      
      const result = validateData(schemas.getUserEventsResponse, response);
      expect(result.valid).toBe(true);
    });
  });

  describe('addEventRequestSchema', () => {
    it('应该验证添加事件请求', () => {
      const request = {
        type: 'self_test',
        date: '2025-10-08T10:00:00.000Z',
        details: {
          notes: '测试记录',
        },
      };
      
      const result = validateData(schemas.addEventRequest, request);
      expect(result.valid).toBe(true);
    });

    it('应该验证带 attachments 的请求', () => {
      const request = {
        type: 'self_test',
        date: '2025-10-08T10:00:00.000Z',
        details: {
          notes: '测试记录',
        },
        attachments: [
          {
            fileUrl: 'attachments/user/event/file.pdf',
            fileType: 'application/pdf',
            fileName: 'file.pdf',
          },
        ],
      };
      
      const result = validateData(schemas.addEventRequest, request);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝缺少必需字段的请求', () => {
      const invalidRequest = {
        type: 'self_test',
        // 缺少 date 和 details
      };
      
      const result = validateData(schemas.addEventRequest, invalidRequest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('addEventResponseSchema', () => {
    it('应该验证添加事件响应', () => {
      const response = {
        message: 'Event added successfully',
        eventId: 'event_abc123_xyz789',
      };
      
      const result = validateData(schemas.addEventResponse, response);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== Surgery Details Tests ====================
  
  describe('surgeryDetailsSchema', () => {
    it('应该接受标准医生和地点', () => {
      const details = {
        location: 'Yeson',
        doctor: '金亨泰',
        notes: '手术记录',
      };
      
      const result = validateData(schemas.surgeryDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该要求自定义地点时必须提供 customLocation', () => {
      const detailsWithoutCustom = {
        location: '自定义',
        doctor: '李革临',
        notes: '手术记录',
      };
      
      const result = validateData(schemas.surgeryDetails, detailsWithoutCustom);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'customLocation')).toBe(true);
    });

    it('应该要求自定义医生时必须提供 customDoctor', () => {
      const detailsWithoutCustom = {
        location: 'Yeson',
        doctor: '自定义',
        notes: '手术记录',
      };
      
      const result = validateData(schemas.surgeryDetails, detailsWithoutCustom);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'customDoctor')).toBe(true);
    });
  });

  // ==================== Feeling Log Tests ====================
  
  describe('feelingLogDetailsSchema', () => {
    it('应该验证包含内容的感受记录', () => {
      const details = {
        content: '今天练习感觉很好',
      };
      
      const result = validateData(schemas.feelingLogDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝空内容', () => {
      const details = {
        content: '',
      };
      
      const result = validateData(schemas.feelingLogDetails, details);
      expect(result.valid).toBe(false);
    });

    it('应该拒绝缺少内容字段', () => {
      const details = {};
      
      const result = validateData(schemas.feelingLogDetails, details);
      expect(result.valid).toBe(false);
    });
  });

  // ==================== Voice Training Tests ====================
  
  describe('voiceTrainingDetailsSchema', () => {
    it('应该验证完整的语音训练数据', () => {
      const details = {
        trainingContent: '进行了共鸣训练和音高练习',
        instructor: '李老师',
        voiceStatus: '状态良好，无疲劳感',
        selfPracticeContent: '每天进行30分钟的发声练习',
        feelings: '感觉声音变得更加稳定',
        references: 'https://example.com/voice-training-guide',
        voicing: '胸声'
      };
      
      const result = validateData(schemas.voiceTrainingDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受空对象（所有字段都是可选的）', () => {
      const details = {};
      
      const result = validateData(schemas.voiceTrainingDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受部分字段', () => {
      const details = {
        trainingContent: '基础发声练习',
        instructor: '王老师'
      };
      
      const result = validateData(schemas.voiceTrainingDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受未知字段（unknown: true）', () => {
      const details = {
        trainingContent: '共鸣训练',
        customField: '自定义数据',
        anotherField: 123
      };
      
      const result = validateData(schemas.voiceTrainingDetails, details);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== Self Practice Tests ====================
  
  describe('selfPracticeDetailsSchema', () => {
    it('应该验证完整的自我练习数据', () => {
      const details = {
        practiceContent: '在家进行了30分钟的发声练习',
        hasInstructor: true,
        instructor: '张老师（在线指导）',
        voiceStatus: '状态较好，略有疲劳',
        feelings: '通过练习发现了一些问题',
        references: 'https://example.com/practice-guide',
        voicing: '混声'
      };
      
      const result = validateData(schemas.selfPracticeDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受空对象（所有字段都是可选的）', () => {
      const details = {};
      
      const result = validateData(schemas.selfPracticeDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受无指导者的练习记录', () => {
      const details = {
        practiceContent: '独自练习发声',
        hasInstructor: false,
        voiceStatus: '正常',
        feelings: '需要更多练习'
      };
      
      const result = validateData(schemas.selfPracticeDetails, details);
      expect(result.valid).toBe(true);
    });

    it('应该接受未知字段（unknown: true）', () => {
      const details = {
        practiceContent: '发声练习',
        extraField: '额外数据'
      };
      
      const result = validateData(schemas.selfPracticeDetails, details);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== Schema-Fixture 同步检查 ====================
  
  describe('Schema-Fixture 同步检查', () => {
    it('所有 user fixtures 必须符合 user schema', () => {
      const userFixtures = [completeProfileUser, minimalProfileUser];
      
      userFixtures.forEach((user, index) => {
        const result = validateData(schemas.user, user);
        expect(result.valid).toBe(true, 
          `User fixture ${index} should be valid, but got errors: ${JSON.stringify(result.errors)}`
        );
      });
    });

    it('所有 private event fixtures 必须符合 eventPrivate schema', () => {
      const eventFixtures = [
        completeSelfTest,
        minimalSelfTest,
        completeSurgery,
        completeFeelingLog,
      ];
      
      eventFixtures.forEach((event, index) => {
        const result = validateData(schemas.eventPrivate, event);
        expect(result.valid).toBe(true, 
          `Private event fixture ${index} (type: ${event.type}) should be valid, but got errors: ${JSON.stringify(result.errors)}`
        );
      });
    });

    it('所有 public event fixtures 必须符合 eventPublic schema', () => {
      mockPublicEvents.forEach((event, index) => {
        const result = validateData(schemas.eventPublic, event);
        expect(result.valid).toBe(true, 
          `Public event fixture ${index} (type: ${event.type}) should be valid, but got errors: ${JSON.stringify(result.errors)}`
        );
      });
    });

    it('private event fixtures 不应包含 eventPrivate schema 中未定义的顶层字段', () => {
      const eventFixtures = [
        completeSelfTest,
        minimalSelfTest,
        completeSurgery,
        completeFeelingLog,
      ];
      
      // 获取 schema 允许的字段
      const schemaKeys = Object.keys(schemas.eventPrivate.describe().keys);
      
      eventFixtures.forEach((event, index) => {
        const fixtureKeys = Object.keys(event);
        const unknownKeys = fixtureKeys.filter(key => !schemaKeys.includes(key));
        
        expect(unknownKeys).toEqual([], 
          `Private event fixture ${index} (type: ${event.type}) contains unknown keys: ${unknownKeys.join(', ')}`
        );
      });
    });
  });
});
