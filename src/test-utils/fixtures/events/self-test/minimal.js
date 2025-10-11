/**
 * @file Self Test 事件 - 最小数据
 * @description 只包含必需字段的 self_test 事件
 */

export const minimalSelfTest = {
  userId: 'us-east-1:minimal-user-002',
  eventId: 'event_selftest_minimal_001',
  type: 'self_test',
  date: '2025-10-05T09:00:00.000Z',
  status: 'pending',
  createdAt: '2025-10-05T09:15:00.000Z',
  updatedAt: '2025-10-05T09:15:00.000Z',
  details: {
    notes: '快速测试',
  },
};
