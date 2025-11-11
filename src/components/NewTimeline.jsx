import React, { useState } from 'react';

/**
 * NewTimeline
 *
 * 横向时间轴：上方事件卡片 + 中央轴线圆点 + 下方日期卡片。
 * 修复点：
 * - 根容器使用 isolate，保证 z-index 层级不被外部干扰
 * - 轴线使用绝对定位 + pointer-events-none + z-0
 * - 滚动容器 overflow-x-auto 同时显式 overflow-y-visible
 * - 圆点改为绝对定位锚定在全局轴线（top-1/2）
 * - 卡片 hover 时提升 z-index，避免放大后被遮挡
 */

// 数据源状态指示器（保留原样）
const StatusIndicator = ({ isDemo, isLoading }) => {
  const Lightbulb = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
  const AlertTriangle = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
  const CheckCircle = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      {isLoading ? (
        <span className="animate-spin text-yellow-500"><Lightbulb /></span>
      ) : isDemo ? (
        <span className="text-orange-500"><AlertTriangle /></span>
      ) : (
        <span className="text-green-500"><CheckCircle /></span>
      )}
      <span>{isLoading ? '加载中...' : isDemo ? '演示数据源' : '实时数据源'}</span>
    </div>
  );
};

const NewTimeline = ({ events = [], isLoading = false }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return {
      month: d.toLocaleDateString('zh-CN', { month: 'short' }),
      day: d.getDate(),
      year: d.getFullYear(),
    };
  };

  const getSummary = (event) => {
    if (event.summary) return event.summary;
    if (event.details) {
      if (event.details.content) return event.details.content.slice(0, 50) + (event.details.content.length > 50 ? '…' : '');
      if (event.details.notes) return event.details.notes.slice(0, 50) + (event.details.notes.length > 50 ? '…' : '');
    }
    return '无摘要';
  };

  const typeConfig = {
    hospital_test: { label: '医院检测', icon: '🏥' },
    self_test: { label: '自我测试', icon: '📱' },
    voice_training: { label: '嗓音训练', icon: '🎯' },
    self_practice: { label: '自我练习', icon: '✍️' },
    surgery: { label: '手术', icon: '⚕️' },
    feeling_log: { label: '感受记录', icon: '😊' },
  };

  const closeModal = () => setSelectedEvent(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-pink-500"></div>
        <span className="text-md text-gray-600 font-medium">正在加载事件...</span>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
        <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
      </div>
    );
  }

  return (
    <div className="relative isolate w-full pt-12 pb-8" style={{ minHeight: '30rem' }}>
      {/* 全局横向轴线 */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gray-300/70 z-0" style={{ transform: 'translateY(-50%)' }}></div>

      {/* 水平滚动容器（显式允许纵向可见，避免放大裁剪） */}
      <div className="relative z-10 flex overflow-x-auto overflow-y-visible gap-20 px-8 snap-x snap-mandatory">
        {events.map((event) => {
          const cfg = typeConfig[event.type] || { label: event.type, icon: '📌' };
          const dateInfo = formatDate(event.date || event.createdAt);

          return (
            <div key={event.eventId} className="relative snap-center shrink-0" style={{ width: '18rem' }}>
              {/* 顶部事件卡片 */}
              <div
                onClick={() => setSelectedEvent(event)}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.05] hover:shadow-3xl z-10 hover:z-20"
                style={{ width: '16rem', height: '10rem', margin: '0 auto' }}
              >
                <div className="flex items-center mb-2 space-x-2">
                  <span className="text-xl">{cfg.icon}</span>
                  <h3 className="text-sm font-bold text-gray-800 truncate">{cfg.label}</h3>
                </div>
                <div className="border-t border-dashed border-gray-300 my-1"></div>
                <p className="text-xs text-gray-600 leading-snug overflow-y-auto" title={getSummary(event)} style={{ maxHeight: '6rem' }}>
                  {getSummary(event)}
                </p>
              </div>

              {/* 轴线圆点（绝对定位到全局轴线） */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                {/* 上下短连线，避免受卡片高度影响 */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-4 w-px h-3 bg-gray-300"></div>
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-px h-3 bg-gray-300"></div>
                <div className="w-3 h-3 bg-pink-500 border-2 border-white rounded-full shadow-md"></div>
              </div>

              {/* 底部日期卡片 */}
              <div
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 flex flex-col items-center justify-center p-4 z-10 transition-all duration-300 ease-out hover:shadow-3xl"
                style={{ width: '10rem', height: '5rem', margin: '0 auto', marginTop: '1.5rem' }}
              >
                <span className="text-sm text-gray-500">{dateInfo.month}</span>
                <span className="text-2xl font-bold text-gray-900 leading-none">{dateInfo.day}</span>
                <span className="text-xs font-bold text-gray-800 mt-1">{dateInfo.year} {dateInfo.month}{dateInfo.day}日</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 数据源状态指示 */}
      <div className="mt-6 flex justify-end px-8">
        <StatusIndicator isDemo={false} isLoading={isLoading} />
      </div>

      {/* 详情弹窗 */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal}></div>
          {/* 内容体 */}
          <div className="relative z-10 max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 m-4 overflow-y-auto max-h-[80vh]">
            <button onClick={closeModal} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">×</button>
            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-3xl">{(typeConfig[selectedEvent.type] || {}).icon || '📌'}</span>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{(typeConfig[selectedEvent.type] || {}).label || selectedEvent.type}</h3>
                <p className="text-xs text-gray-500">
                  {new Date(selectedEvent.date || selectedEvent.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            {/* Body */}
            {selectedEvent.details ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{JSON.stringify(selectedEvent.details, null, 2)}</pre>
            ) : (
              <p className="text-sm text-gray-600">没有详细信息可用。</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewTimeline;