/**
 * @file 管理后台六类事件详情测试数据
 * @description 所有字段均使用当前 eventSchemaPrivate 的 details 契约。
 */

import { minimalSelfTest } from './events/self-test/minimal.js';

const base = {
  ...minimalSelfTest,
  status: 'approved',
};

/** 覆盖管理列表与详情支持的全部事件类型。 */
export const adminEventDetailFixtures = [
  {
    ...base,
    eventId: 'admin-self-test',
    type: 'self_test',
    details: { fundamentalFrequency: 180, jitter: 1.25, notes: '自测备注' },
  },
  {
    ...base,
    eventId: 'admin-hospital-test',
    type: 'hospital_test',
    details: { location: '测试医院', fundamentalFrequency: 175, notes: '医院备注' },
    attachments: [{
      fileUrl: 'attachments/admin-user/模拟医院报告.pdf',
      fileType: 'application/pdf',
      fileName: '模拟医院报告.pdf',
    }],
  },
  {
    ...base,
    eventId: 'admin-voice-training',
    type: 'voice_training',
    details: { trainingContent: '训练内容', instructor: '训练老师', feelings: '训练感受' },
  },
  {
    ...base,
    eventId: 'admin-self-practice',
    type: 'self_practice',
    details: { practiceContent: '练习内容', hasInstructor: false, feelings: '练习感受' },
  },
  {
    ...base,
    eventId: 'admin-surgery',
    type: 'surgery',
    details: { location: '友谊医院', doctor: '李革临', notes: '手术备注' },
  },
  {
    ...base,
    eventId: 'admin-feeling-log',
    type: 'feeling_log',
    details: { content: '今天状态稳定' },
  },
];
