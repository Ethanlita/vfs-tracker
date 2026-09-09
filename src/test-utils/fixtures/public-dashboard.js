/** @file 公共仪表板首屏及按需明细的确定性测试数据。 */
import { minimalSelfTest } from './events/index.js';

/**
 * 生成单用户多页数据，复用标准事件 fixture；ID 顺序与日期顺序一致。
 * @param {number} count 事件数量。
 * @returns {{light: object[], details: object[]}} 首屏和明细。
 */
export function dashboardFixture(count = 3) {
  const details = Array.from({ length: count }, (_, index) => ({
    userId: 'user1', eventId: `event-${String(index).padStart(3, '0')}`,
    type: minimalSelfTest.type, date: new Date(Date.UTC(2024, 0, index + 1)).toISOString(),
    details: { fundamentalFrequency: 150 + index, notes: `明细 ${index + 1}` }
  }));
  return { details, light: details.map(event => ({ userId: event.userId, eventId: event.eventId,
    userName: '用户1', type: event.type, date: event.date,
    details: { fundamentalFrequency: event.details.fundamentalFrequency } })) };
}

export const chartEvents = [
  { userId: 'user1', eventId: 'before', type: 'self_test', date: '2024-01-01', details: { fundamentalFrequency: 120 } },
  { userId: 'user1', eventId: 'training', type: 'voice_training', date: '2024-01-02', details: {} },
  { userId: 'user1', eventId: 'surgery', type: 'surgery', date: '2024-01-03', details: { doctor: '医生甲', surgeryMethod: '术式甲' } },
  { userId: 'user1', eventId: 'after', type: 'hospital_test', date: '2024-01-04', details: { fundamentalFrequency: 180 } },
  { userId: 'user1', eventId: 'revision', type: 'surgery', date: '2024-01-05', details: { doctor: '医生乙' } }
].map(event => ({ ...event, userName: '用户1' }));
