import { parseEventDate } from '../utils/calendarDate.js';
import React, { useState, useMemo, useSyncExternalStore, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ModalDialog from './ModalDialog';
import { EventDetailsPanel } from './events';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';

// Prevent motion from being flagged as unused in some builds
void motion;

/**
 * 手机和桌面每页显示的事件数量
 * 可以根据需要调整
 */
const ITEMS_PER_PAGE = 10;
/** 订阅窗口宽度变化，仅在跨越桌面断点时更新布局。 */
const subscribeViewport = listener => {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
};
const desktopSnapshot = () => window.innerWidth >= 768;

const InteractiveTimeline = ({ events = [] }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const desktop = useSyncExternalStore(subscribeViewport, desktopSnapshot, () => false);
  const desktopScrollRef = useRef(null);




  const typeConfig = {
    hospital_test:   { label: '医院检测',  icon: '🏥', bg: 'bg-blue-500' },
    self_test:       { label: '自我测试',  icon: '📱', bg: 'bg-green-500' },
    voice_training:  { label: '嗓音训练',  icon: '🎯', bg: 'bg-purple-500' },
    self_practice:   { label: '自我练习',  icon: '✍️', bg: 'bg-indigo-500' },
    surgery:         { label: '手术',      icon: '⚕️', bg: 'bg-red-500' },
    feeling_log:     { label: '感受记录',  icon: '📝', bg: 'bg-orange-500' },
  };

  // 日期格式仅取决于传入字符串，跨数据页复用缓存不会保留事件对象。
  const formattedDates = useMemo(() => new Map(), []);
  const formatDate = (dateString) => {
    if (formattedDates.has(dateString)) return formattedDates.get(dateString);
    const date = parseEventDate(dateString);
    const formatted = {
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      day: date.getDate(),
      full: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    formattedDates.set(dateString, formatted);
    return formatted;
  };

  // 按时间排序的事件
  const ordered = useMemo(() => [...events].sort((a, b) => parseEventDate(a.date || a.createdAt) - parseEventDate(b.date || b.createdAt)), [events]);

  // 两种布局共用页码与数据，每次只挂载当前页。
  const pagination = usePagination({
    items: ordered,
    itemsPerPage: ITEMS_PER_PAGE,
  });

  useEffect(() => { if (desktopScrollRef.current) desktopScrollRef.current.scrollLeft = 0; }, [pagination.currentPage, desktop]);

  if (!events || events.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
        <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
      </motion.div>
    );
  }

  // 尺寸与对齐参数 （仅用于横向模式）
  const AXIS_THICKNESS = 1;       // 轴线 1px
  const DOT = 10;                 // 圆点直径
  const AXIS_GAP = 28;            // 轴线与卡片/日期距离
  const ALIGN_NUDGE = 8.5;        // 对齐微调：将圆点整体向下 0.5px，避免"略高"的视觉

  return (
    <div className="relative isolate pt-4 pb-4">
      {/* 移动端：纵向列表（使用分页） */}
      {!desktop && <div data-testid="timeline-mobile" className="px-1 space-y-4">
        {/* 分页后的事件列表 */}
        {pagination.paginatedItems.map((event, index) => {
          const cfg = typeConfig[event.type] || { label: event.type, icon: '📌', bg: 'bg-gray-400' };
          const dateInfo = formatDate(event.date || event.createdAt);
          const summary =
            event?.details?.notes ||
            (event?.type === 'feeling_log' && event?.details?.content) ||
            '无摘要';
          const summaryIsEmpty = summary === '无摘要';

          return (
            <div key={event.eventId || index} className="rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm p-4">
              <button
                data-testid="timeline-event" onClick={() => setSelectedEvent(event)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cfg.icon}</span>
                    <h3 className="text-sm font-bold text-gray-800">{cfg.label}</h3>
                  </div>
                  <div className="shrink-0 bg-white/70 backdrop-blur-sm rounded-xl px-3 py-1 border border-gray-200 text-center">
                    <div className="text-xs text-gray-500 leading-tight">{dateInfo.month}</div>
                    <div className="text-base font-bold text-gray-900 leading-tight">{dateInfo.day}</div>
                  </div>
                </div>
                <p className={`mt-2 text-sm ${summaryIsEmpty ? 'text-gray-400 italic' : 'text-gray-600'}`}>
                  {summary}
                </p>
              </button>
            </div>
          );
        })}

        {/* 移动端分页组件 - 使用紧凑模式 */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageRange={pagination.pageRange}
            hasPrevPage={pagination.hasPrevPage}
            hasNextPage={pagination.hasNextPage}
            goToPage={pagination.goToPage}
            prevPage={pagination.prevPage}
            nextPage={pagination.nextPage}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            totalItems={pagination.totalItems}
            variant="compact"
          />
        )}
      </div>}

      {/* 桌面端：横向时间轴（保留轴与箭头） */}
      {desktop && <div data-testid="timeline-desktop">
        <div ref={desktopScrollRef} className="overflow-x-auto overflow-y-visible">
          <div className="relative overflow-visible">
            <div className="relative flex gap-10 px-6 sm:px-8 pb-4 min-w-max h-[26rem] snap-x snap-mandatory overflow-visible">
              {/* 时间轴（居中，1px 厚度） */}
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"
                style={{ height: `${AXIS_THICKNESS}px` }}
              />

              {/* 右端箭头 */}
              <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-[-10px] text-purple-400">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </div>

              {pagination.paginatedItems.map((event, index) => {
                const cfg = typeConfig[event.type] || { label: event.type, icon: '📌', bg: 'bg-gray-400' };
                const dateInfo = formatDate(event.date || event.createdAt);
                const summary =
                  event?.details?.notes ||
                  (event?.type === 'feeling_log' && event?.details?.content) ||
                  '无摘要';
                const summaryIsEmpty = summary === '无摘要';

                return (
                  <div key={event.eventId || index} className="relative snap-center shrink-0 w-72 h-full overflow-visible">
                    {/* 顶部卡片 */}
                    <motion.button type="button"
                      data-testid="timeline-event" onClick={() => setSelectedEvent(event)}
                      className="text-left absolute left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl z-10"
                      style={{ bottom: `calc(50% + ${AXIS_GAP}px)`, width: '16rem', height: '10rem', transformOrigin: 'center bottom' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{cfg.icon}</span>
                          <h3 className="text-sm font-bold text-gray-800 truncate">{cfg.label}</h3>
                        </div>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <p className={`mt-2 text-sm ${summaryIsEmpty ? 'text-gray-400 italic' : 'text-gray-600'} line-clamp-3`}>
                        {summary}
                      </p>
                    </motion.button>

                    {/* 顶部连线 */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bg-gray-300"
                      style={{
                        top: `calc(50% - ${AXIS_GAP}px)`,
                        height: `calc(${AXIS_GAP}px - ${DOT / 2}px + ${ALIGN_NUDGE}px)`,
                        width: '1px'
                      }}
                    />
                    {/* 圆点（与轴线精确对齐） */}
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${cfg.bg} z-20`}
                      style={{ top: `calc(50% + ${ALIGN_NUDGE}px)`, width: `${DOT}px`, height: `${DOT}px`, boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}
                    />
                    {/* 底部连线 */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bg-gray-300"
                      style={{
                        top: `calc(50% + ${ALIGN_NUDGE}px + ${DOT / 2}px)`,
                        height: `calc(${AXIS_GAP}px - ${DOT / 2}px - ${ALIGN_NUDGE}px)`,
                        width: '1px'
                      }}
                    />
                    {/* 日期胶囊（玻璃） */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 rounded-2xl shadow-xl flex flex-col items-center justify-center p-4 bg-white/60 backdrop-blur-md ring-1 ring-white/60"
                      style={{ top: `calc(50% + ${AXIS_GAP}px)`, width: '10rem', height: '5rem' }}
                    >
                      <span className="text-sm text-gray-600">{dateInfo.month}</span>
                      <span className="text-2xl font-bold text-gray-900 leading-none">{dateInfo.day}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Pagination {...pagination} variant="compact" />
      </div>}

      {/* 事件详情弹窗 - 使用 EventDetailsPanel 组件展示格式化的事件详情 */}
      {selectedEvent && (
        <ModalDialog label="时间轴事件详情" onClose={() => setSelectedEvent(null)} className="flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            {/* 弹窗头部：关闭按钮 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 rounded-t-2xl flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                data-modal-close aria-label="关闭"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* 事件详情面板 */}
            <div className="p-6">
              <EventDetailsPanel event={selectedEvent} />
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
};

export default InteractiveTimeline;
