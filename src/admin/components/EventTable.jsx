/**
 * @file 事件表格组件
 * 显示事件列表的表格，支持快速操作
 */

import { useState } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { updateEventStatus, EVENT_TYPES, EVENT_STATUS } from '../services/dynamodb';

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 状态徽章组件
 */
function StatusBadge({ status }) {
  const statusConfig = {
    pending: { 
      bg: 'bg-yellow-900/50', 
      text: 'text-yellow-400', 
      border: 'border-yellow-700/50', 
      label: '待审核',
      dot: 'bg-yellow-400',
    },
    approved: { 
      bg: 'bg-green-900/50', 
      text: 'text-green-400', 
      border: 'border-green-700/50', 
      label: '已通过',
      dot: 'bg-green-400',
    },
    rejected: { 
      bg: 'bg-red-900/50', 
      text: 'text-red-400', 
      border: 'border-red-700/50', 
      label: '已拒绝',
      dot: 'bg-red-400',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

/**
 * 事件类型标签
 */
function TypeTag({ type }) {
  const label = EVENT_TYPES[type] || type;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-900/30 text-purple-400 border border-purple-700/30">
      {label}
    </span>
  );
}

/**
 * 快速操作按钮组件
 */
function QuickActions({ event, onUpdate, disabled }) {
  const { clients } = useAWSClients();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStatusChange = async (newStatus) => {
    if (!clients || loading) return;
    setError(null);

    try {
      setLoading(true);
      const updated = await updateEventStatus(
        clients.dynamoDB,
        event.userId,
        event.eventId,
        newStatus
      );
      onUpdate?.(updated);
    } catch (err) {
      console.error('更新状态失败:', err);
      setError(err.message);
      // 3秒后自动清除错误提示
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 如果是待审核状态，显示通过和拒绝按钮
  if (event.status === EVENT_STATUS.PENDING || !event.status) {
    return (
      <div className="flex flex-col gap-1">
        {error && (
          <span className="text-xs text-red-400 truncate max-w-[150px]" title={error}>
            ⚠ {error}
          </span>
        )}
        <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatusChange(EVENT_STATUS.APPROVED);
          }}
          disabled={loading || disabled}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg 
                     hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="通过"
        >
          {loading ? '...' : '✓ 通过'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleStatusChange(EVENT_STATUS.REJECTED);
          }}
          disabled={loading || disabled}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg 
                     hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="拒绝"
        >
          {loading ? '...' : '✗ 拒绝'}
        </button>
        </div>
      </div>
    );
  }

  // 已处理的状态可以重新设为待审核
  return (
    <div className="flex flex-col gap-1">
      {error && (
        <span className="text-xs text-red-400 truncate max-w-[150px]" title={error}>
          ⚠ {error}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleStatusChange(EVENT_STATUS.PENDING);
        }}
        disabled={loading || disabled}
        className="px-3 py-1.5 text-xs font-medium bg-gray-600 text-white rounded-lg 
                   hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="重置为待审核"
      >
        {loading ? '...' : '↺ 重置'}
      </button>
    </div>
  );
}

/**
 * 事件表格组件
 * @param {object} props
 * @param {Array} props.events - 事件列表
 * @param {object} props.users - userId -> user 映射
 * @param {Function} props.onEventClick - 点击事件回调
 * @param {Function} props.onEventUpdate - 事件更新回调
 */
export default function EventTable({ events, users = {}, onEventClick, onEventUpdate }) {
  if (events.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-gray-400">暂无事件数据</p>
      </div>
    );
  }

  /**
   * 获取用户显示名称
   */
  const getUserDisplayName = (userId) => {
    const user = users[userId];
    if (!user) return null;
    return user.profile?.name || user.profile?.nickname || null;
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-left text-sm text-gray-400">
              <th className="px-6 py-3 font-medium">类型</th>
              <th className="px-6 py-3 font-medium">日期</th>
              <th className="px-6 py-3 font-medium">用户</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">备注</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {events.map((event) => {
              const displayName = getUserDisplayName(event.userId);
              
              return (
                <tr 
                  key={`${event.userId}-${event.eventId}`}
                  className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => onEventClick?.(event)}
                >
                  {/* 类型 */}
                  <td className="px-6 py-4">
                    <TypeTag type={event.type} />
                  </td>

                  {/* 日期 */}
                  <td className="px-6 py-4 text-white">
                    {formatDate(event.date)}
                  </td>

                  {/* 用户 */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      {displayName && (
                        <span className="text-white text-sm">{displayName}</span>
                      )}
                      <code className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-400 w-fit">
                        {event.userId?.length > 16 
                          ? `${event.userId.slice(0, 8)}...`
                          : event.userId}
                      </code>
                    </div>
                  </td>

                  {/* 状态 */}
                  <td className="px-6 py-4">
                    <StatusBadge status={event.status} />
                  </td>

                  {/* 备注 */}
                  <td className="px-6 py-4 text-gray-400 text-sm max-w-[200px]">
                    <span className="line-clamp-2">
                      {event.note || '-'}
                    </span>
                  </td>

                  {/* 操作 */}
                  <td className="px-6 py-4">
                    <QuickActions 
                      event={event} 
                      onUpdate={onEventUpdate}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
