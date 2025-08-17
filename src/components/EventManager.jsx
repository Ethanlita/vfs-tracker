import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { deleteEvent } from '../api'; // 引入真实的删除API函数

/**
 * @en Event management component for filtering, viewing, editing, and deleting events
 * @zh 事件管理组件，用于筛选、查看、编辑和删除事件
 */
const EventManager = ({ events, onEventUpdated, onEventDeleted, isProductionReady }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // 事件类型配置
  const eventTypeConfig = {
    'self_test': { label: '自我测试', icon: '🔍', color: 'green' },
    'hospital_test': { label: '医院检测', icon: '🏥', color: 'blue' },
    'voice_training': { label: '嗓音训练', icon: '💪', color: 'purple' },
    'self_practice': { label: '自我练习', icon: '🎯', color: 'indigo' },
    'surgery': { label: '嗓音手术', icon: '⚕️', color: 'red' },
    'feeling_log': { label: '感受记录', icon: '💭', color: 'yellow' }
  };

  const dateRangeOptions = [
    { value: 'all', label: '全部时间' },
    { value: '1week', label: '最近一周' },
    { value: '1month', label: '最近一月' },
    { value: '3months', label: '最近三月' },
    { value: '6months', label: '最近半年' }
  ];

  const sortOptions = [
    { value: 'newest', label: '最新在前' },
    { value: 'oldest', label: '最早在前' },
    { value: 'type', label: '按类型排序' }
  ];

  // 筛选和排序逻辑
  const filteredAndSortedEvents = useMemo(() => {
    if (!events) return [];

    let filtered = events.filter(event => {
      // 搜索过滤
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        event.type.toLowerCase().includes(searchLower) ||
        (event.details?.notes && event.details.notes.toLowerCase().includes(searchLower)) ||
        (event.details?.content && event.details.content.toLowerCase().includes(searchLower)) ||
        eventTypeConfig[event.type]?.label.toLowerCase().includes(searchLower);

      // 类型过滤
      const matchesType = selectedType === 'all' || event.type === selectedType;

      // 日期范围过滤
      const eventDate = new Date(event.date || event.createdAt);
      const now = new Date();
      let matchesDateRange = true;

      if (selectedDateRange !== 'all') {
        const daysAgo = {
          '1week': 7,
          '1month': 30,
          '3months': 90,
          '6months': 180
        }[selectedDateRange];

        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        matchesDateRange = eventDate >= cutoffDate;
      }

      return matchesSearch && matchesType && matchesDateRange;
    });

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
        case 'oldest':
          return new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  }, [events, searchTerm, selectedType, selectedDateRange, sortBy]);

  // 事件统计
  const eventStats = useMemo(() => {
    if (!events) return {};

    const stats = {};
    events.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1;
    });

    return stats;
  }, [events]);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowDetails(true);
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('确定要删除这个事件吗？此操作无法撤销。')) {
      return;
    }

    try {
      // 调用真实的删除API，该函数已处理生产/开发模式
      await deleteEvent(eventId);

      // 通知父组件更新UI，从列表中移除事件
      if (onEventDeleted) {
        onEventDeleted(eventId);
      }

      // 关闭详情弹窗
      setShowDetails(false);

      // 提示用户成功
      alert('事件已成功删除。');

    } catch (error) {
      console.error('删除事件失败:', error);
      alert(`删除事件失败: ${error.message}`);
    }
  };

  const handleEditEvent = (event) => {
    // 编辑功能 - 可以扩展为完整的编辑表单
    console.log('编辑事件:', event);
    alert('编辑功能正在开发中。当前可以删除事件并重新添加。');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getEventSummary = (event) => {
    const config = eventTypeConfig[event.type];
    switch (event.type) {
      case 'self_test':
      case 'hospital_test':
        return event.details?.fundamentalFrequency
          ? `基频: ${event.details.fundamentalFrequency}Hz`
          : '无参数数据';
      case 'voice_training':
        return event.details?.trainingContent?.substring(0, 50) + '...' || '无训练内容';
      case 'self_practice':
        return event.details?.practiceContent?.substring(0, 50) + '...' || '无练习内容';
      case 'surgery':
        return event.details?.doctor || '无医生信息';
      case 'feeling_log':
        return event.details?.content?.substring(0, 50) + '...' || '无内容';
      default:
        return '无详细信息';
    }
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
              {eventTypeConfig[type]?.icon} {eventTypeConfig[type]?.label}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* 事件列表 */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 border-b">
          <h3 className="text-lg font-semibold text-gray-800">事件列表</h3>
        </div>

        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredAndSortedEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p>没有找到匹配的事件</p>
            </div>
          ) : (
            filteredAndSortedEvents.map((event) => {
              const config = eventTypeConfig[event.type];
              return (
                <motion.div
                  key={event.eventId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <h4 className="font-medium text-gray-800">{config.label}</h4>
                        <p className="text-sm text-gray-600">{getEventSummary(event)}</p>
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
                          className="text-xs text-red-600 hover:text-red-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.eventId);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* 事件详情弹窗 */}
      <AnimatePresence>
        {showDetails && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full max-h-screen overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {eventTypeConfig[selectedEvent.type]?.icon} {eventTypeConfig[selectedEvent.type]?.label}
                </h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">事件日期</h4>
                  <p className="text-gray-600">{formatDate(selectedEvent.date || selectedEvent.createdAt)}</p>
                </div>

                {/* 根据事件类型显示详细信息 */}
                {selectedEvent.details && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">详细信息</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {Object.entries(selectedEvent.details).map(([key, value]) => {
                        if (!value || key === 'attachmentUrl') return null;
                        return (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-600 capitalize">{key}:</span>
                            <span className="font-medium text-right">
                              {Array.isArray(value) ? value.join(', ') :
                               typeof value === 'object' ? JSON.stringify(value) :
                               value.toString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.eventId)}
                    className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    删除事件
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EventManager;
