/** @file 离线队列读取契约：空态、坏数据、权限失败和原始数据保留。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalSelfTest } from '../../../src/test-utils/fixtures/index.js';
import { StorageError } from '../../../src/utils/apiError.js';
import { OFFLINE_QUEUE_KEY, readPendingEvents, enqueuePendingEvent, preparePendingEvents, removeConfirmedPendingEvents } from '../../../src/utils/pendingEvents.js';
import { pendingEventSchema } from '../../../src/api/schemas.js';

const eventData = { type: minimalSelfTest.type, date: minimalSelfTest.date, details: minimalSelfTest.details };
beforeEach(() => {
  vi.stubGlobal('navigator', { locks: { request: async (_name, callback) => callback() } });
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

describe('readPendingEvents', () => {
  it.each([null, '[]'])('只有键不存在或有效空数组表示空队列：%s', raw => {
    if (raw !== null) localStorage.setItem(OFFLINE_QUEUE_KEY, raw);
    expect(readPendingEvents()).toEqual([]);
  });

  it.each(['', '{bad', 'null', '{}', '1', '"text"'])('损坏内容抛出存储错误且原文保留：%s', raw => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, raw);
    expect(() => readPendingEvents()).toThrow(StorageError);
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBe(raw);
  });

  it('保留有效项和混合坏条目，不因一个坏项丢掉全部队列', () => {
    const queue = [null, { ownerUserId: minimalSelfTest.userId, when: 1, eventData: minimalSelfTest }];
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    expect(readPendingEvents()).toEqual(queue);
    expect(JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY))).toEqual(queue);
  });

  it('读取权限失败抛错，恢复权限后原始记录仍可读取', () => {
    const queue = [{ ownerUserId: minimalSelfTest.userId, when: 1, eventData: minimalSelfTest }];
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    const denied = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('拒绝访问', 'SecurityError'); });
    expect(() => readPendingEvents()).toThrow(StorageError);
    denied.mockRestore();
    expect(readPendingEvents()).toEqual(queue);
  });

  it('环境不支持本地存储时明确报错', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => readPendingEvents()).toThrow(StorageError);
  });
});

describe('离线队列按记录身份更新', () => {
  it('新记录满足schema，内容相同的测量仍拥有不同ID', async () => {
    const first = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    const second = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    expect(pendingEventSchema.validate(first).error).toBeUndefined();
    expect(first.queueId).not.toBe(second.queueId);
    expect(readPendingEvents()).toHaveLength(2);
  });

  it('同步快照之后新增的同内容记录不会被旧成功结果删除', async () => {
    const first = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    const snapshot = await preparePendingEvents(minimalSelfTest.userId);
    const later = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    await removeConfirmedPendingEvents(snapshot.map(item => item.queueId), minimalSelfTest.userId);
    expect(readPendingEvents()).toEqual([later]);
    expect(later.queueId).not.toBe(first.queueId);
  });

  it('部分成功仅移除成功ID，保留失败、新增以及坏条目', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([null,{ ownerUserId: minimalSelfTest.userId, when:1,eventData},{ ownerUserId: minimalSelfTest.userId, when:2,eventData}]));
    const snapshot = await preparePendingEvents(minimalSelfTest.userId);
    const added = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    await removeConfirmedPendingEvents([snapshot[0].queueId], minimalSelfTest.userId);
    expect(readPendingEvents()).toEqual([null,snapshot[1],added]);
  });

  it('旧条目的ID先持久化再同步，重复准备不改变身份', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ ownerUserId: minimalSelfTest.userId, when:1,eventData}]));
    const first = await preparePendingEvents(minimalSelfTest.userId);
    expect(first[0].queueId).toBeTruthy();
    expect(await preparePendingEvents(minimalSelfTest.userId)).toEqual(first);
    expect(readPendingEvents()).toEqual(first);
  });

  it('重复的旧ID会区分，避免一个成功结果同时删除两项', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ ownerUserId: minimalSelfTest.userId, queueId:'same',when:1,eventData},{ ownerUserId: minimalSelfTest.userId, queueId:'same',when:1,eventData}]));
    const snapshot = await preparePendingEvents(minimalSelfTest.userId);
    expect(snapshot[0].queueId).not.toBe(snapshot[1].queueId);
    await removeConfirmedPendingEvents([snapshot[0].queueId], minimalSelfTest.userId);
    expect(readPendingEvents()).toEqual([snapshot[1]]);
  });

  it('存储写入失败时不返回可提交的快照', async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ ownerUserId: minimalSelfTest.userId, when:1,eventData}]));
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(preparePendingEvents(minimalSelfTest.userId)).rejects.toThrow(StorageError);
    expect(readPendingEvents()[0].queueId).toBeUndefined();
  });

  it('没有跨标签页锁时拒绝写入，而非使用不安全的替代路径', async () => {
    vi.stubGlobal('navigator', {});
    await expect(enqueuePendingEvent(eventData, minimalSelfTest.userId)).rejects.toThrow(StorageError);
    expect(readPendingEvents()).toEqual([]);
  });

  it('清理写入失败后原队列仍在，恢复可只重试清理', async () => {
    const saved = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    const remove = vi.spyOn(Storage.prototype,'removeItem').mockImplementation(() => { throw new Error('denied'); });
    await expect(removeConfirmedPendingEvents([saved.queueId], minimalSelfTest.userId)).rejects.toThrow(StorageError);
    expect(readPendingEvents()).toEqual([saved]);
    remove.mockRestore();
    await removeConfirmedPendingEvents([saved.queueId], minimalSelfTest.userId);
    expect(readPendingEvents()).toEqual([]);
  });
});

describe('离线记录账号归属', () => {
  it('旧无归属记录不认领、不修改、不提交', async () => {
    const legacy = { when: 1, eventData };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([legacy]));
    expect(await preparePendingEvents(minimalSelfTest.userId)).toEqual([]);
    expect(readPendingEvents()).toEqual([legacy]);
  });

  it('不同账号仅获取和清理各自记录，ID相同也不跨账号删除', async () => {
    const a = await enqueuePendingEvent(eventData, minimalSelfTest.userId);
    const b = { ...a, ownerUserId: 'other-account' };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([a,b]));
    expect(await preparePendingEvents('other-account')).toEqual([b]);
    await removeConfirmedPendingEvents([a.queueId], minimalSelfTest.userId);
    expect(readPendingEvents()).toEqual([b]);
  });

  it('无账号不允许创建、准备或清理队列', async () => {
    await expect(enqueuePendingEvent(eventData)).rejects.toThrow(StorageError);
    await expect(preparePendingEvents()).rejects.toThrow(StorageError);
    await expect(removeConfirmedPendingEvents([])).rejects.toThrow(StorageError);
    expect(readPendingEvents()).toEqual([]);
  });
});
