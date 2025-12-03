/**
 * @file 事件详情模态框
 * 显示事件完整信息和状态控制
 */

import { useEffect, useState } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { updateEventStatus, getUser, EVENT_TYPES, EVENT_STATUS } from '../services/dynamodb';
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
 * 状态控制组件
 */
function EventStatusControl({ event, onUpdate }) {
  const { clients } = useAWSClients();
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState(event?.status || 'pending');
  const [error, setError] = useState(null);

  // 同步外部状态变化
  useEffect(() => {
    setActiveStatus(event?.status || 'pending');
  }, [event?.status]);

  const handleStatusChange = async (newStatus) => {
    if (!clients || loading || !event) return;
    setError(null);

    try {
      setLoading(true);
      const updated = await updateEventStatus(
        clients.dynamoDB,
        event.userId,
        event.eventId,
        newStatus
      );
      setActiveStatus(newStatus);
      onUpdate?.(updated);
    } catch (err) {
      console.error('更新状态失败:', err);
      setError(err.message);
      // 5秒后自动清除错误提示
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { 
      value: EVENT_STATUS.APPROVED, 
      label: '通过', 
      icon: '✓',
      activeClass: 'bg-green-600 border-green-500 text-white',
      inactiveClass: 'bg-gray-700 border-gray-600 text-gray-400 hover:border-green-500/50',
    },
    { 
      value: EVENT_STATUS.PENDING, 
      label: '待审', 
      icon: '○',
      activeClass: 'bg-yellow-600 border-yellow-500 text-white',
      inactiveClass: 'bg-gray-700 border-gray-600 text-gray-400 hover:border-yellow-500/50',
    },
    { 
      value: EVENT_STATUS.REJECTED, 
      label: '拒绝', 
      icon: '✗',
      activeClass: 'bg-red-600 border-red-500 text-white',
      inactiveClass: 'bg-gray-700 border-gray-600 text-gray-400 hover:border-red-500/50',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            disabled={loading}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${activeStatus === option.value ? option.activeClass : option.inactiveClass}`}
          >
            <span className="mr-1">{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="text-sm text-red-400 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2">
          ⚠ 更新失败: {error}
        </div>
      )}
    </div>
  );
}

/**
 * 附件预览组件
 * 附件数据结构: { fileUrl: string, fileType: string, fileName: string }
 * fileUrl 是 S3 对象键，如 "voice-tests/xxx/report.pdf"
 */
function AttachmentPreview({ attachment, s3Client }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUrl() {
      // 附件的 S3 key 存储在 fileUrl 字段中
      const s3Key = attachment?.fileUrl || attachment?.s3Key;
      if (!s3Key || !s3Client) {
        setLoading(false);
        return;
      }

      try {
        const presignedUrl = await getPresignedUrl(s3Client, s3Key);
        setUrl(presignedUrl);
      } catch (err) {
        console.error('获取附件 URL 失败:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadUrl();
  }, [attachment, s3Client]);

  if (loading) {
    return (
      <div className="w-20 h-20 bg-gray-700 rounded-lg animate-pulse" />
    );
  }

  // 获取显示用的文件名和 S3 key
  const fileName = attachment?.fileName || '文件';
  const s3Key = attachment?.fileUrl || attachment?.s3Key || '';

  if (!url) {
    return (
      <div className="w-20 h-20 bg-gray-700 rounded-lg flex flex-col items-center justify-center" title={error || '无法加载'}>
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-xs text-gray-500 mt-1 truncate max-w-[70px]">
          {fileName}
        </span>
      </div>
    );
  }

  // 检测文件类型
  const fileType = attachment?.fileType || '';
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(s3Key) || fileType.startsWith('image/');

  // 图片附件
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block" title={fileName}>
        <img 
          src={url} 
          alt={fileName}
          className="w-20 h-20 object-cover rounded-lg hover:opacity-80 transition-opacity"
        />
      </a>
    );
  }

  // PDF 和其他文件
  const isPdf = /\.pdf$/i.test(s3Key) || fileType === 'application/pdf';
  
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="w-20 h-20 bg-gray-700 rounded-lg flex flex-col items-center justify-center hover:bg-gray-600 transition-colors"
      title={fileName}
    >
      {isPdf ? (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )}
      <span className="text-xs text-gray-500 mt-1 truncate max-w-[70px]">
        {fileName}
      </span>
    </a>
  );
}

/**
 * 事件详情模态框
 */
export default function EventDetailModal({ event, open, onClose, onUpdate }) {
  const { clients } = useAWSClients();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  // 加载用户信息
  useEffect(() => {
    async function loadUser() {
      if (!event?.userId || !clients) {
        setUser(null);
        return;
      }

      try {
        setLoadingUser(true);
        const userData = await getUser(clients.dynamoDB, event.userId);
        setUser(userData);
      } catch (err) {
        console.error('加载用户信息失败:', err);
      } finally {
        setLoadingUser(false);
      }
    }

    if (open && event) {
      loadUser();
    }
  }, [event, open, clients]);

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

  if (!open || !event) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* 模态框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-white">事件详情</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {EVENT_TYPES[event.type] || event.type}
              </p>
            </div>
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
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
            {/* 状态控制 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                审核状态
              </h3>
              <EventStatusControl event={event} onUpdate={onUpdate} />
            </section>

            {/* 用户信息 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                用户信息
              </h3>
              <div className="bg-gray-800 rounded-lg p-4">
                {loadingUser ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full animate-pulse" />
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                      <div className="w-32 h-3 bg-gray-700 rounded animate-pulse" />
                    </div>
                  </div>
                ) : user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {(user.displayName || user.userId || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white font-medium">
                        {user.displayName || '未设置昵称'}
                      </div>
                      <code className="text-xs text-gray-500">
                        {user.userId}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    用户信息不可用
                  </div>
                )}
              </div>
            </section>

            {/* 事件信息 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                事件信息
              </h3>
              <dl className="bg-gray-800 rounded-lg px-4">
                <InfoRow label="Event ID" value={event.eventId} mono />
                <InfoRow label="事件类型" value={EVENT_TYPES[event.type] || event.type} />
                <InfoRow label="事件日期" value={formatDateTime(event.date)} />
                {event.note && <InfoRow label="备注" value={event.note} />}
                {event.location && <InfoRow label="位置" value={event.location} />}
              </dl>
            </section>

            {/* 类型特定信息 */}
            {event.type === 'self_test' && event.testResult && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  测试结果
                </h3>
                <dl className="bg-gray-800 rounded-lg px-4">
                  {event.testResult.meanF0 && (
                    <InfoRow label="平均基频 (Hz)" value={event.testResult.meanF0.toFixed(1)} />
                  )}
                  {event.testResult.f0Range && (
                    <InfoRow 
                      label="基频范围 (Hz)" 
                      value={`${event.testResult.f0Range.min?.toFixed(1)} - ${event.testResult.f0Range.max?.toFixed(1)}`} 
                    />
                  )}
                </dl>
              </section>
            )}

            {/* 附件 */}
            {event.attachments && event.attachments.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  附件 ({event.attachments.length})
                </h3>
                <div className="flex flex-wrap gap-3">
                  {event.attachments.map((attachment, index) => (
                    <AttachmentPreview 
                      key={index} 
                      attachment={attachment} 
                      s3Client={clients?.s3}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 时间信息 */}
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                时间信息
              </h3>
              <dl className="bg-gray-800 rounded-lg px-4">
                <InfoRow label="创建时间" value={formatDateTime(event.createdAt)} />
                <InfoRow label="更新时间" value={formatDateTime(event.updatedAt)} />
              </dl>
            </section>

            {/* 原始数据（调试用） */}
            <section>
              <details className="group">
                <summary className="text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer 
                                    hover:text-gray-400 transition-colors">
                  原始数据 (JSON)
                </summary>
                <pre className="mt-3 bg-gray-800 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </details>
            </section>
          </div>

          {/* 底部 */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
