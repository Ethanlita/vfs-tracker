/** @file 公共图表的基频校验、队列选择及时间对齐规则。 */

/**
 * 解析正基频；空值、布尔值和非正数不是一次测量。
 * @param {unknown} value 原始基频。
 * @returns {number|null} 有效 Hz 数值或 null。
 */
export function parseFrequency(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * 查找首次有效日期的手术，供总体统计、曲线和个人资料统一使用。
 * @param {object[]} events 用户事件。
 * @returns {object|undefined} 最早的手术。
 */
export const firstSurgery = events => events.filter(event => event.type === 'surgery' && event.date && Number.isFinite(Date.parse(event.date)))
  .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];

/**
 * 先按锚点选择用户，再从该用户完整测量集生成曲线，保留锚点前的负天数。
 * @param {object[]} allEvents 轻量公开事件。
 * @param {object} options 图表模式及手术筛选条件。
 * @returns {object} Chart.js 数据集。
 */
export function alignedChartData(allEvents, { mode, doctor = '', method = '' }) {
  const groups = new Map();
  allEvents.forEach(event => {
    if (!groups.has(event.userId)) groups.set(event.userId, []);
    groups.get(event.userId).push(event);
  });
  const datasets = [];
  for (const events of groups.values()) {
    const sorted = events.filter(event => event.date && Number.isFinite(Date.parse(event.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const isTraining = event => ['voice_training', 'self_practice'].includes(event.type);
    const surgery = firstSurgery(sorted);
    // 医生/术式筛选针对首次手术，避免同一用户在各视图中改变时间锚点。
    if (mode === 'vfs-only' && (!surgery || (doctor && surgery.details?.doctor !== doctor && surgery.details?.customDoctor !== doctor)
      || (method && surgery.details?.surgeryMethod !== method))) continue;
    const anchor = mode === 'training' ? sorted.find(isTraining)
      : mode === 'vfs-only' ? surgery : sorted.find(event => !isTraining(event));
    if (!anchor) continue;
    const data = sorted.filter(event => ['self_test', 'hospital_test'].includes(event.type))
      .map(event => ({ x: Math.floor((Date.parse(event.date) - Date.parse(anchor.date)) / 86400000),
        y: parseFrequency(event.details?.fundamentalFrequency) })).filter(point => point.y !== null);
    if (data.length) datasets.push({ label: events[0].userName || '（非公开）', data,
      borderColor: `hsl(${datasets.length * 137.5 % 360}, 70%, 50%)`, fill: false });
  }
  return { datasets };
}
