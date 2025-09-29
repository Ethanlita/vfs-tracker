import React, { useCallback, useEffect, useState } from 'react';
import { addEvent } from '../api';

const OFFLINE_QUEUE_KEY = 'pendingEvents:v1';

const readQueue = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('无法读取离线队列', error);
    return [];
  }
};

const PendingSyncButton = ({ className = '' }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(() => {
    try {
      setPendingCount(readQueue().length);
    } catch (error) {
      console.warn('刷新离线队列计数失败', error);
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === OFFLINE_QUEUE_KEY) {
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

  const syncPending = async () => {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      alert('当前仍处于离线状态，请联网后再同步。');
      return;
    }

    const queue = readQueue();
    if (!queue.length) {
      alert('没有离线记录');
      return;
    }

    setSyncing(true);
    const failed = [];
    for (const item of queue) {
      try {
        await addEvent(item.eventData);
      } catch (error) {
        console.error('同步离线记录失败', error);
        failed.push(item);
      }
    }

    try {
      if (failed.length) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch (error) {
      console.warn('更新离线队列失败', error);
    }

    refreshCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pending-events-updated'));
    }
    setSyncing(false);
    alert(`同步完成：成功 ${queue.length - failed.length} 条，失败 ${failed.length} 条`);
  };

  const label = pendingCount > 0
    ? `🔄 同步离线记录 (${pendingCount})`
    : '🔄 同步离线记录';

  return (
    <button
      type="button"
      onClick={syncPending}
      className={className || 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 hover:from-yellow-600 hover:to-amber-700'}
      disabled={syncing}
    >
      {syncing ? '同步中...' : label}
    </button>
  );
};

export default PendingSyncButton;
