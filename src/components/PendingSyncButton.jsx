import React, { useCallback, useEffect, useRef, useState } from 'react';
import { addEvent } from '../api';
import { OFFLINE_QUEUE_KEY, readPendingEvents, preparePendingEvents, removeConfirmedPendingEvents } from '../utils/pendingEvents.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const PendingSyncButton = ({ className = '' }) => {
  const { user } = useAuth();
  const ownerUserId = user?.userId;
  const currentOwner = useRef(ownerUserId);
  currentOwner.current = ownerUserId;
  const mounted = useRef(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [readError, setReadError] = useState(null);
  const [cleanupError, setCleanupError] = useState(null);
  const [confirmedIds, setConfirmedIds] = useState([]);
  const [confirmedOwner, setConfirmedOwner] = useState(null);
  const [hasUnowned, setHasUnowned] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /**
   * 重新读取计数；失败时清除旧计数，显示可恢复错误而非空态。
   * @returns {void} 更新当前读取状态，不执行同步或修改存储。
   */
  const refreshCount = useCallback(() => {
    try {
      const queue = readPendingEvents();
      const activeOwner = currentOwner.current;
      setPendingCount(activeOwner ? queue.filter(item => item?.ownerUserId === activeOwner).length : 0);
      setHasUnowned(queue.some(item => !item?.ownerUserId));
      setReadError(null);
    } catch (error) {
      setReadError(error);
      setPendingCount(null);
    }
  }, []);

  useEffect(() => {
    setSubmitError(null);
    refreshCount();
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === OFFLINE_QUEUE_KEY || event.key === null) {
        refreshCount();
      }
    };
    const onPendingEvents = () => refreshCount();
    window.addEventListener('storage', onStorage);
    window.addEventListener('pending-events-updated', onPendingEvents);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pending-events-updated', onPendingEvents);
    };
  }, [refreshCount]);

  /**
   * 仅重试本地清理，不重新提交已经确认成功的记录。
   * @returns {Promise<void>} 清理成功后允许开始下一轮同步。
   */
  const retryCleanup = async () => {
    setSyncing(true);
    try {
      await removeConfirmedPendingEvents(confirmedIds, confirmedOwner);
      setCleanupError(null);
      setConfirmedIds([]);
      refreshCount();
    } catch (error) {
      setCleanupError(error);
    } finally { setSyncing(false); }
  };

  /**
   * 同步前再次读取，以捕获页面打开后发生的权限或数据变化。
   * @returns {Promise<void>} 读取失败时保留队列并停止提交。
   */
  const syncPending = async () => {
    if (syncing || cleanupError || !ownerUserId) return;
    const stillCurrent = () => mounted.current && currentOwner.current === ownerUserId;
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      alert('当前仍处于离线状态，请联网后再同步。');
      return;
    }

    let queue;
    setSyncing(true);
    try {
      queue = await preparePendingEvents(ownerUserId);
      if (!stillCurrent()) { if (mounted.current) setSyncing(false); return; }
      setReadError(null);
    } catch (error) {
      if (!mounted.current) return;
      setReadError(error);
      setPendingCount(null);
      setSyncing(false);
      return;
    }
    if (!queue.length) {
      alert('当前账号没有可同步的离线记录');
      setSyncing(false);
      return;
    }

    setSyncing(true);
    setSubmitError(null);
    const failed = [];
    const confirmed = [];
    for (const item of queue) {
      if (!stillCurrent()) break;
      try {
        // 坏条目不得进入提交或成功清理集合，保持原始内容供后续恢复。
        if (!item?.queueId || !item.eventData || typeof item.eventData !== 'object') {
          throw new Error('离线记录内容不完整');
        }
        await addEvent(item.eventData, { expectedUserId: ownerUserId, clientRequestId: item.queueId });
        confirmed.push(item.queueId);
      } catch (error) {

        if (stillCurrent()) setSubmitError(error);
        failed.push(item);
      }
    }

    try {
      await removeConfirmedPendingEvents(confirmed, ownerUserId);
    } catch (error) {
      if (!mounted.current) return;
      setConfirmedIds(confirmed);
      setConfirmedOwner(ownerUserId);
      setCleanupError(error);
      refreshCount();
      setSyncing(false);
      return;
    }

    if (!mounted.current) return;
    refreshCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pending-events-updated'));
    }
    setSyncing(false);
    if (stillCurrent()) alert(`同步完成：成功 ${confirmed.length} 条，失败 ${failed.length} 条`);
  };

  const label = pendingCount > 0
    ? `🔄 同步离线记录 (${pendingCount})`
    : '🔄 同步离线记录';

  return (
    <>
    <button
      type="button"
      onClick={syncPending}
      className={className || 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 hover:from-yellow-600 hover:to-amber-700'}
      disabled={!ownerUserId || syncing || !!readError || !!cleanupError}
    >
      {syncing ? '同步中...' : readError ? '离线记录读取失败' : label}
    </button>
    {hasUnowned && <p role="status" className="mt-3 text-sm text-amber-800">存在无法确认所属账号的旧离线记录，已保留且不会自动同步。</p>}
    {!ownerUserId && <p className="mt-2 text-sm text-gray-600">请登录后同步该账号的离线记录。</p>}
    <ApiErrorNotice error={readError} onRetry={refreshCount} retryLabel="重新读取" className="mt-3" />
    <ApiErrorNotice error={submitError} className="mt-3" />
    <ApiErrorNotice error={cleanupError} onRetry={syncing ? undefined : retryCleanup} retryLabel="重试本地清理" className="mt-3" />
    </>
  );
};

export default PendingSyncButton;
