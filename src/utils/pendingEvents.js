/** @file 离线事件队列的统一读取入口；读取失败不得伪装为空队列。 */
import { StorageError } from './apiError.js';

export const OFFLINE_QUEUE_KEY = 'pendingEvents:v1';

/**
 * 读取本地离线事件，不修改或清理原始内容。
 * @returns {Array<object>} 已持久化的队列；仅键不存在或有效空数组表示无记录。
 * @throws {StorageError} 存储不可用、内容不是合法 JSON 数组时抛出。
 */
export function readPendingEvents() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (raw === null) return [];
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue)) throw new TypeError('离线队列必须是数组');
    // 单条坏记录留在队列中，允许同步流程独立处理其他有效记录。
    return queue;
  } catch (cause) {
    throw new StorageError('无法读取离线记录，请检查浏览器存储权限后重新读取。已有内容未被修改。', { cause });
  }
}

/**
 * 在同源跨标签页锁中更新队列，读、改、写之间不等待网络。
 * @param {Function} update - 接收最新队列，返回新队列的同步函数。
 * @returns {Promise<Array<object>>} 成功持久化后的队列。
 * @throws {StorageError} 无法安全加锁或读写失败时保留错误，不启用无锁写入。
 */
async function updatePendingEvents(update) {
  try {
    if (!navigator.locks?.request) throw new Error('浏览器不支持安全的离线队列写入，请使用支持 Web Locks 的浏览器');
    const result = await navigator.locks.request(OFFLINE_QUEUE_KEY, () => {
      const current = readPendingEvents();
      const next = update(current);
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        if (next.length) localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
        else localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
      return next;
    });
    window.dispatchEvent(new Event('pending-events-updated'));
    return result;
  } catch (cause) {
    if (cause instanceof StorageError) throw cause;
    throw new StorageError('无法更新离线记录，请检查浏览器存储权限后重试。', { cause });
  }
}

/**
 * 原子追加新事件；使用独立ID区分内容完全相同的两次测量。
 * @param {object} eventData - 符合新增事件契约的请求体。
 * @param {string} ownerUserId - 保存时的已登录账号，不从其他缓存推断。
 * @returns {Promise<object>} 新创建并持久化的队列条目。
 */
export async function enqueuePendingEvent(eventData, ownerUserId) {
  // 校验模块单独分包，避免把 Joi 加入首页主包；生产PWA会预缓存该模块。
  const { pendingEventSchema } = await import('../api/schemas.js');
  const item = { queueId: crypto.randomUUID(), ownerUserId, when: Date.now(), eventData };
  const { error } = pendingEventSchema.validate(item);
  if (error) throw new StorageError('离线记录格式不正确，未保存。', { cause: error });
  await updatePendingEvents(queue => [...queue, item]);
  return item;
}

/**
 * 为当前账号的记录补齐唯一ID并取得快照；无归属或其他账号记录原样保留。
 * @param {string} ownerUserId - 本次同步账号。
 * @returns {Promise<Array<object>>} ID已经落盘的快照，不包含之后新增的记录。
 */
export function preparePendingEvents(ownerUserId) {
  if (!ownerUserId) return Promise.reject(new StorageError('请先登录后再同步离线记录。'));
  return updatePendingEvents(queue => {
    const ids = new Set();
    return queue.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || item.ownerUserId !== ownerUserId) return item;
      const queueId = typeof item.queueId === 'string' && item.queueId && !ids.has(item.queueId)
        ? item.queueId : crypto.randomUUID();
      ids.add(queueId);
      return { ...item, queueId };
    });
  }).then(queue => queue.filter(item => item?.ownerUserId === ownerUserId));
}

/**
 * 从最新队列移除本次确认成功的ID，保留并发新增及失败条目。
 * @param {Array<string>} ids - 本次成功提交的记录ID。
 * @param {string} ownerUserId - 这些已确认记录所属账号。
 * @returns {Promise<Array<object>>} 剩余持久化队列。
 */
export function removeConfirmedPendingEvents(ids, ownerUserId) {
  if (!ownerUserId) return Promise.reject(new StorageError('缺少离线记录所属账号，未修改数据。'));
  const confirmed = new Set(ids);
  return updatePendingEvents(queue => queue.filter(item => item?.ownerUserId !== ownerUserId || !confirmed.has(item?.queueId)));
}
