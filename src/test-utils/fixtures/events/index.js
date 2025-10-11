/**
 * @file 事件测试数据 - 统一导出
 */

// Self Test
export { completeSelfTest } from './self-test/complete.js';
export { minimalSelfTest } from './self-test/minimal.js';

// Surgery
export { completeSurgery, customDoctorSurgery } from './surgery/complete.js';

// Feeling Log
export { completeFeelingLog } from './feeling-log/complete.js';

import { completeSelfTest } from './self-test/complete.js';
import { minimalSelfTest } from './self-test/minimal.js';
import { completeSurgery, customDoctorSurgery } from './surgery/complete.js';
import { completeFeelingLog } from './feeling-log/complete.js';

/**
 * 私有事件集合（包含 attachments）
 */
export const mockPrivateEvents = [
  completeSelfTest,
  minimalSelfTest,
  completeSurgery,
  customDoctorSurgery,
  completeFeelingLog,
];

/**
 * 公共事件集合（不含 attachments, status, updatedAt，添加 userName）
 * 符合 eventSchemaPublic (src/api/schemas.js:404)
 */
export const mockPublicEvents = mockPrivateEvents
  .filter(event => event.status === 'approved')
  .map(event => {
    const { attachments, status, updatedAt, ...publicEvent } = event;
    return {
      ...publicEvent,
      userName: event.userId.includes('complete') ? '张三' 
        : event.userId.includes('public') ? '李明'
        : '（非公开）',
    };
  });
