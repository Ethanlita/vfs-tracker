/**
 * 将用户当地日历日期转换为date输入框格式，不截取UTC日期。
 * @param {Date} date - 要读取的当地日期，默认当前时刻。
 * @returns {string} YYYY-MM-DD。
 */
export function localCalendarDate(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 判断记录是否仅指定日历日期，不包含具体时刻。 */
export const isCalendarDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * 将事件日期用于当地展示和排序。日历日期不经过UTC换算，时间戳保持瞬时时间语义。
 * @param {string|Date|number} value - 日历日期或时间戳。
 * @returns {Date} 日期对象；非法日历日返回Invalid Date。
 */
export function parseEventDate(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : new Date(NaN);
}

/**
 * 判断事件是否在包含今天的最近N个当地日历日内；精确时间戳不得晚于当前时刻。
 * @param {string|Date} value - 事件日期。
 * @param {number} days - 日历日数，如7/30/90/180。
 * @param {Date} now - 范围结束时刻。
 * @returns {boolean} 是否位于闭区间内。
 */
export function isInRecentDays(value, days, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const date = parseEventDate(value);
  return date >= start && date <= now;
}
