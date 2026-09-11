import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { eventSummary } from './events/utils/eventSummary';
import ModalDialog from './ModalDialog';
import { parseEventDate, isInRecentDays } from '../utils/calendarDate.js';
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { deleteEvent } from '../api';
import EventDetailsPanel from './events/EventDetailsPanel';

// 防止某些构建下 motion 被判定未使用
void motion;

/**
 * @en Event management component for filtering, viewing, and deleting events
 * @zh 事件管理组件，用于筛选、查看和删除事件
 */
const eventTypeConfig = {
  'self_test': { label: '自我测试', icon: '🔍', color: 'green' },
  'hospital_test': { label: '医院检测', icon: '🏥', color: 'blue' },
  'voice_training': { label: '嗓音训练', icon: '💪', color: 'purple' },
  'self_practice': { label: '自我练习', icon: '🎯', color: 'indigo' },
  'surgery': { label: '嗓音手术', icon: '⚕️', color: 'red' },
  'feeling_log': { label: '感受记录', icon: '💭', color: 'yellow' }
};

const EventManager = ({ events, onEventDeleted }) => { // 移除未使用参数
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const deletingRef = useRef(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());
  const selectedEventRef = useRef(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 安全获取类型配置（兜底）
  const getTypeConfig = useCallback((type) => {
    if (!type) return { label: '未分类', icon: '📌', color: 'gray' };
    return eventTypeConfig[type] || { label: type, icon: '📌', color: 'gray' };
  }, []);

  const dateRangeOptions = [
    { value: 'all', label: '全部时间' },
    { value: '1week', label: '最近7天' },
    { value: '1month', label: '最近30天' },
    { value: '3months', label: '最近90天' },
    { value: '6months', label: '最近180天' }
  ];

  const sortOptions = [
    { value: 'newest', label: '最新在前' },
    { value: 'oldest', label: '最早在前' },
    { value: 'type', label: '按类型排序' }
  ];

  // 预先解析日期和搜索文本，输入时复用，避免每个字符重复排序。
  const indexedEvents = useMemo(() => (events || []).map(event => ({
    event,
    date: parseEventDate(event.date || event.createdAt),
    search: [event.type, getTypeConfig(event.type).label,
      ...Object.values(event.details || {}).flatMap(value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : typeof value === 'string' ? [value] : [])
    ].join(' ').toLowerCase()
  })), [events, getTypeConfig]);
  const sortedEvents = useMemo(() => [...indexedEvents].sort((a, b) => {
    if (sortBy === 'type') return (a.event.type || '').localeCompare(b.event.type || '');
    return sortBy === 'oldest' ? a.date - b.date : b.date - a.date;
  }), [indexedEvents, sortBy]);
  const filteredAndSortedEvents = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const now = new Date();
    const days = { '1week': 7, '1month': 30, '3months': 90, '6months': 180 }[selectedDateRange];
    return sortedEvents.filter(item => (!search || item.search.includes(search)) &&
      (selectedType === 'all' || item.event.type === selectedType) &&
      (!days || isInRecentDays(item.date, days, now))).map(item => item.event);
  }, [sortedEvents, searchTerm, selectedType, selectedDateRange]);
  // 分页只限制挂载数量，搜索仍覆盖全部已读取记录。
  const pagination = usePagination({ items: filteredAndSortedEvents, itemsPerPage: 20 });
  const { currentPage, paginatedItems, reset: resetPagination } = pagination;
  const listRef = useRef(null);
  useEffect(() => { resetPagination(); }, [searchTerm, selectedType, selectedDateRange, sortBy, resetPagination]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [currentPage, searchTerm, selectedType, selectedDateRange, sortBy]);

  // 事件统计（忽略无类型的）
  const eventStats = useMemo(() => {
    if (!events) return {};
    const stats = {};
    events.forEach(event => {
      if (!event.type) return; // 跳过无类型
      stats[event.type] = (stats[event.type] || 0) + 1;
    });
    return stats;
  }, [events]);

  const handleEventClick = (event) => {
    selectedEventRef.current = event;
    setSelectedEvent(event);
    setShowDetails(true);
  };

  /**
   * 按事件ID串行删除，迟到响应只处理自己的记录，不关闭其他详情。
   * @param {string} eventId - 用户确认删除的事件ID。
   * @returns {Promise<void>} 删除完成或取消后结束。
   */
  const handleDeleteEvent = async (eventId) => {
    // ref同步加锁，覆盖同一帧内来自列表与详情的重复操作。
    if (deletingRef.current.has(eventId)) return;
    if (!window.confirm('确定要删除这个事件吗？此操作无法撤销。')) return;
    deletingRef.current.add(eventId);
    setDeletingIds(new Set(deletingRef.current));
    try {
      // 调用真实的删除API，该函数已处理生产/开发模式。
      await deleteEvent(eventId);
      if (!mountedRef.current) return;
      // 通知父组件移除准确记录，读取最新选择而非异步闭包中的旧选择。
      onEventDeleted?.(eventId);
      if (selectedEventRef.current?.eventId === eventId) setShowDetails(false);
      alert('事件已成功删除。');
    } catch (error) {
      if (!mountedRef.current) return;

      alert('删除事件失败: ' + error.message);
    } finally {
      deletingRef.current.delete(eventId);
      if (mountedRef.current) setDeletingIds(new Set(deletingRef.current));
    }
  };

  const formatDate = (dateString) => {
    const date = parseEventDate(dateString);
    if (isNaN(date.getTime())) return '无日期';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div className="space-y-6">
      {/* 筛选和搜索控件 */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">筛选条件</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索</label>
            <input
              type="text"
              placeholder="搜索事件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          {/* 事件类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">事件类型</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="all">全部类型</option>
                {Object.entries(eventTypeConfig).map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.icon} {config.label}
                  </option>
                ))}
                {/* 如果存在未分类事件，提供快捷过滤 */}
                {events?.some(ev => !ev.type) && (
                  <option value="__undefined">📌 未分类</option>
                )}
              </select>
            </div>

          {/* 日期范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">时间范围</label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 排序 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序方式</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600">
            显示 {filteredAndSortedEvents.length} / {events?.length || 0} 个事件
          </span>
          {Object.entries(eventStats).map(([type, count]) => (
            <span
              key={type}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
            >
              {getTypeConfig(type).icon} {getTypeConfig(type).label}: {count}
            </span>
          ))}
          {events?.some(ev => !ev.type) && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
              📌 未分类: {events.filter(ev => !ev.type).length}
            </span>
          )}
        </div>
      </div>

      {/* 事件列表 */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 border-b">
          <h3 className="text-lg font-semibold text-gray-800">事件列表</h3>
        </div>

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto" ref={listRef} data-testid="events-list">
          {filteredAndSortedEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p>没有找到匹配的事件</p>
            </div>
          ) : (
            paginatedItems.map((event) => {
              const cfg = getTypeConfig(event.type);
              return (
                <motion.div
                  key={event.eventId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors event-card"
                  data-testid="event-item"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{cfg.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-800">{cfg.label}</h4>
                        <p className="text-sm text-gray-600">{eventSummary(event)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">
                        {formatDate(event.date || event.createdAt)}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <button className="text-xs text-blue-600 hover:text-blue-800">
                          查看详情
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          disabled={deletingIds.has(event.eventId)}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-wait"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.eventId);
                          }}
                        >
                          {deletingIds.has(event.eventId) ? '删除中…' : '删除'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
        <Pagination {...pagination} variant="compact" />
      </div>

      {/* 事件详情弹窗 */}
      <>
        {showDetails && selectedEvent && (
          <ModalDialog label="事件详情" onClose={() => setShowDetails(false)} className="flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
              data-testid="event-detail"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  {getTypeConfig(selectedEvent.type).icon} {getTypeConfig(selectedEvent.type).label}
                </h3>
                <button
                  data-modal-close aria-label="关闭事件详情"
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 使用 EventDetailsPanel 展示详情 */}
              <EventDetailsPanel
                event={selectedEvent}
                showHeader={false}
                showAttachments={true}
                showMetadata={true}
              />

              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 break-words" role="status">
                已保存的事件不能直接编辑。如需纠正，请关闭详情，删除原记录后重新新增。
              </p>

              <div className="flex flex-wrap gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetails(false)}
                  className="min-w-28 flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  关闭
                </button>
                <button
                  disabled={deletingIds.has(selectedEvent.eventId)}
                  onClick={() => handleDeleteEvent(selectedEvent.eventId)}
                  className="min-w-28 flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {deletingIds.has(selectedEvent.eventId) ? '删除中…' : '删除事件'}
                </button>
              </div>
            </motion.div>
          </ModalDialog>
        )}
      </>
    </div>
  );
};

export default EventManager;
