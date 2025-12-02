/**
 * @file 用户详情抽屉组件
 * 侧边滑出的用户详情面板
 */

import { useEffect, useState } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { queryByUserId, TABLES, EVENT_TYPES } from '../services/dynamodb';
import { getPresignedUrl } from '../services/s3';

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 信息行组件
 */
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="py-3 border-b border-gray-700/50 last:border-b-0">
      <dt className="text-sm text-gray-500 mb-1">{label}</dt>
      <dd className={`text-white ${mono ? 'font-mono text-sm break-all' : ''}`}>
        {value || <span className="text-gray-600">-</span>}
      </dd>
    </div>
  );
}

/**
 * 状态徽章
 */
function StatusBadge({ status }) {
  const statusConfig = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', border: 'border-yellow-700/50', label: '待审核' },
    approved: { bg: 'bg-green-900/50', text: 'text-green-400', border: 'border-green-700/50', label: '已通过' },
    rejected: { bg: 'bg-red-900/50', text: 'text-red-400', border: 'border-red-700/50', label: '已拒绝' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  );
}

/**
 * 用户详情抽屉
 */
export default function UserDetailDrawer({ user, open, onClose }) {
  const { clients } = useAWSClients();
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // 当用户变化时加载其事件和头像
  useEffect(() => {
    async function loadUserData() {
      if (!user || !clients) {
        setEvents([]);
        setAvatarUrl(null);
        return;
      }

      try {
        setLoadingEvents(true);
        
        // 并行加载事件和头像
        const [userEvents, avatar] = await Promise.all([
          queryByUserId(clients.dynamoDB, TABLES.EVENTS, user.userId, { limit: 10 }),
          // 获取头像预签名 URL
          user.profile?.avatarKey 
            ? getPresignedUrl(clients.s3, user.profile.avatarKey).catch(() => null)
            : Promise.resolve(null),
        ]);
        
        setEvents(userEvents);
        setAvatarUrl(avatar);
      } catch (err) {
        console.error('加载用户数据失败:', err);
      } finally {
        setLoadingEvents(false);
      }
    }

    if (open && user) {
      loadUserData();
    }
  }, [user, open, clients]);

  // 处理 Escape 键关闭
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* 抽屉面板 */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700 
                    shadow-2xl z-50 transform transition-transform duration-300 
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">用户详情</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="h-[calc(100%-65px)] overflow-y-auto p-6 space-y-6">
          {user && (
            <>
              {/* 用户头像和名称 */}
              <section className="flex items-center gap-4">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={user.profile?.name || '用户头像'} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {(user.profile?.name || user.userId || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xl font-semibold text-white">
                    {user.profile?.name || '未设置'}
                  </div>
                  {user.profile?.nickname && user.profile.nickname !== user.profile.name && (
                    <div className="text-gray-400 text-sm">
                      昵称: {user.profile.nickname}
                    </div>
                  )}
                  <div className="text-gray-500 text-sm">
                    {user.email}
                  </div>
                </div>
              </section>

              {/* 基本信息 */}
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  基本信息
                </h3>
                <dl className="bg-gray-800 rounded-lg px-4">
                  <InfoRow label="User ID" value={user.userId} mono />
                  <InfoRow label="显示名称 (profile.name)" value={user.profile?.name} />
                  <InfoRow label="昵称 (profile.nickname)" value={user.profile?.nickname} />
                  <InfoRow label="邮箱" value={user.email} />
                  <InfoRow 
                    label="名称公开" 
                    value={user.profile?.isNamePublic ? '是' : '否'} 
                  />
                </dl>
              </section>

              {/* 个人资料 */}
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  个人资料
                </h3>
                <dl className="bg-gray-800 rounded-lg px-4">
                  <InfoRow label="个人简介" value={user.profile?.bio} />
                  <InfoRow 
                    label="头像 Key" 
                    value={user.profile?.avatarKey} 
                    mono 
                  />
                  <InfoRow 
                    label="社交媒体公开" 
                    value={user.profile?.areSocialsPublic ? '是' : '否'} 
                  />
                  {user.profile?.socials?.length > 0 && (
                    <InfoRow 
                      label="社交媒体" 
                      value={user.profile.socials.map(s => `${s.platform}: ${s.handle}`).join(', ')} 
                    />
                  )}
                </dl>
              </section>

              {/* 时间信息 */}
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  时间信息
                </h3>
                <dl className="bg-gray-800 rounded-lg px-4">
                  <InfoRow label="创建时间" value={formatDateTime(user.createdAt)} />
                  <InfoRow label="更新时间" value={formatDateTime(user.updatedAt)} />
                </dl>
              </section>

              {/* 用户事件 */}
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  最近事件 ({events.length})
                </h3>
                
                {loadingEvents ? (
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
                    暂无事件
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div 
                        key={event.eventId}
                        className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-medium truncate">
                              {EVENT_TYPES[event.type] || event.type}
                            </div>
                            <div className="text-gray-500 text-sm mt-1">
                              {formatDateTime(event.date)}
                            </div>
                          </div>
                          <StatusBadge status={event.status} />
                        </div>
                        {event.note && (
                          <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                            {event.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 原始数据（调试用） */}
              <section>
                <details className="group">
                  <summary className="text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer 
                                      hover:text-gray-400 transition-colors">
                    原始数据 (JSON)
                  </summary>
                  <pre className="mt-3 bg-gray-800 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </details>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
