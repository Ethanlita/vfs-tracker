import React, { useCallback, useEffect, useState } from 'react';
import { addEvent } from '../api';
import { ensureAppError, StorageError, ApiError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

const OFFLINE_QUEUE_KEY = 'pendingEvents:v1';

const readQueue = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    throw new StorageError('无法读取离线队列', { cause: error });
  }
};

const PendingSyncButton = ({ className = '' }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const refreshCount = useCallback(() => {
    try {
      setPendingCount(readQueue().length);
    } catch (err) {
      setError(ensureAppError(err));
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
    setError(null);
    setSuccessMessage('');

    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!isOnline) {
      setError(new ApiError('当前仍处于离线状态，请联网后再同步。'));
      return;
    }

    let queue;
    try {
      queue = readQueue();
      if (queue.length === 0) {
        setSuccessMessage('没有待同步的离线记录。');
        setTimeout(() => setSuccessMessage(''), 3000);
        return;
      }
    } catch (err) {
      setError(ensureAppError(err));
      return;
    }

    setSyncing(true);
    const failed = [];
    let firstError = null;

    for (const item of queue) {
      try {
        await addEvent(item.eventData);
      } catch (err) {
        console.error('同步离线记录失败', err);
        failed.push(item);
        if (!firstError) {
          firstError = ensureAppError(err);
        }
      }
    }

    try {
      if (failed.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch (err) {
      const storageErr = new StorageError('更新离线队列状态失败，部分记录可能已同步，但列表未更新。', { cause: err });
      setError(storageErr);
      setSyncing(false);
      refreshCount();
      return;
    }

    refreshCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pending-events-updated'));
    }
    setSyncing(false);

    const successCount = queue.length - failed.length;
    if (failed.length > 0) {
        const finalError = ensureAppError(firstError, {
            message: `同步部分失败：成功 ${successCount} 条，失败 ${failed.length} 条。请检查网络或稍后重试。`
        });
        setError(finalError);
    } else {
        setSuccessMessage(`同步完成：成功 ${successCount} 条。`);
        setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const label = pendingCount > 0
    ? `🔄 同步离线记录 (${pendingCount})`
    : '🔄 同步离线记录';

  return (
    <div className="w-full flex flex-col items-center">
      <button
        type="button"
        onClick={syncPending}
        className={className || 'w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 hover:from-yellow-600 hover:to-amber-700'}
        disabled={syncing || pendingCount === 0}
      >
        {syncing ? '同步中...' : label}
      </button>
      {error && (
        <div className="w-full mt-2">
          <ApiErrorNotice error={error} onRetry={syncPending} retryLabel="重试同步" compact/>
        </div>
      )}
      {successMessage && (
        <div className="w-full mt-2 text-sm text-center text-green-50 p-2 rounded-md">
          {successMessage}
        </div>
      )}
    </div>
  );
};

export default PendingSyncButton;