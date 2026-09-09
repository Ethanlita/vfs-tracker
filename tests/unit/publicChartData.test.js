/** @file 图表行为回归：保留测量点、统一首次手术、排除缺失基频。 */
import { describe, it, expect } from 'vitest';
import { alignedChartData, parseFrequency, firstSurgery } from '../../src/utils/publicChartData.js';
import { chartEvents } from '../../src/test-utils/fixtures/index.js';

describe('公共图表', () => {
  it.each([null, undefined, '', ' ', false, true, 0, -1, Infinity, 'NaN'])('忽略无效基频 %s', value => {
    expect(parseFrequency(value)).toBeNull();
  });
  it('接受历史数字字符串', () => expect(parseFrequency('180')).toBe(180));
  it('训练队列仍包含训练前后测量', () => {
    expect(alignedChartData(chartEvents, { mode: 'training' }).datasets[0].data).toEqual([{ x: -1, y: 120 }, { x: 2, y: 180 }]);
  });
  it('所有手术视图以首次手术对齐，与输入顺序无关', () => {
    expect(firstSurgery([...chartEvents].reverse()).eventId).toBe('surgery');
    expect(alignedChartData([...chartEvents].reverse(), { mode: 'vfs-only', doctor: '医生甲' }).datasets[0].data)
      .toEqual([{ x: -2, y: 120 }, { x: 1, y: 180 }]);
    expect(alignedChartData(chartEvents, { mode: 'vfs-only', doctor: '医生乙' }).datasets).toEqual([]);
  });
  it('术式筛选保留匹配用户的全部测量', () => {
    expect(alignedChartData(chartEvents, { mode: 'vfs-only', method: '术式甲' }).datasets).toHaveLength(1);
    expect(alignedChartData(chartEvents, { mode: 'vfs-only', method: '其他' }).datasets).toHaveLength(0);
  });
});
