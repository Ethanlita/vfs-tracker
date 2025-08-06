import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUrl } from 'aws-amplify/storage';

/**
 * @en Interactive timeline component for displaying user events
 * @zh 用于显示用户事件的交互式时间轴组件
 */
const InteractiveTimeline = ({ events, isProductionReady }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);

  // 事件类型配置
  const eventTypeConfig = {
    'hospital_test': {
      label: '医院检测',
      icon: '🏥',
      color: 'blue',
      bgColor: 'bg-blue-500',
      lightBg: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    'self_test': {
      label: '自我测试',
      icon: '📱',
      color: 'green',
      bgColor: 'bg-green-500',
      lightBg: 'bg-green-50',
      textColor: 'text-green-700'
    },
    'training': {
      label: '训练',
      icon: '🎯',
      color: 'purple',
      bgColor: 'bg-purple-500',
      lightBg: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    'surgery': {
      label: '手术',
      icon: '⚕️',
      color: 'red',
      bgColor: 'bg-red-500',
      lightBg: 'bg-red-50',
      textColor: 'text-red-700'
    }
  };

  // 处理附件下载
  const handleDownload = async (attachmentKey) => {
    try {
      if (isProductionReady) {
        const getUrlResult = await getUrl({
          key: attachmentKey,
          options: { download: true },
        });
        window.open(getUrlResult.url.toString(), '_blank');
      } else {
        // 开发模式下的模拟下载
        alert('演示模式：在生产环境中这里会下载实际文件');
      }
    } catch (error) {
      console.error('下载文件错误:', error);
      alert('无法获取文件的下载链接。');
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      day: date.getDate(),
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      full: date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    };
  };

  if (!events || events.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
        <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      {/* 时间轴线 */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pink-500 via-purple-500 to-blue-500"></div>

      <div className="space-y-6">
        {events.map((event, index) => {
          const config = eventTypeConfig[event.type] || eventTypeConfig['self_test'];
          const dateInfo = formatDate(event.createdAt);
          const isExpanded = expandedEvent === event.eventId;

          return (
            <motion.div
              key={event.eventId}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative pl-20"
            >
              {/* 时间轴节点 */}
              <motion.div
                className={`absolute left-6 w-4 h-4 rounded-full ${config.bgColor} ring-4 ring-white shadow-lg`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{
                    boxShadow: selectedEvent === event.eventId
                      ? `0 0 0 6px ${config.color === 'blue' ? 'rgba(59, 130, 246, 0.3)' : 
                          config.color === 'green' ? 'rgba(34, 197, 94, 0.3)' :
                          config.color === 'purple' ? 'rgba(147, 51, 234, 0.3)' :
                          'rgba(239, 68, 68, 0.3)'}`
                      : 'none'
                  }}
                />
              </motion.div>

              {/* 日期标签 */}
              <div className="absolute left-0 top-0 text-center">
                <div className="text-xs font-medium text-gray-500">{dateInfo.month}</div>
                <div className="text-lg font-bold text-gray-800">{dateInfo.day}</div>
              </div>

              {/* 事件卡片 */}
              <motion.div
                className={`bg-white rounded-xl shadow-md border-l-4 border-${config.color}-500 overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200`}
                onClick={() => {
                  setSelectedEvent(selectedEvent === event.eventId ? null : event.eventId);
                  setExpandedEvent(isExpanded ? null : event.eventId);
                }}
                whileHover={{ y: -2 }}
                layout
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-800">{config.label}</h3>
                        <p className="text-sm text-gray-500">{dateInfo.time}</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>

                  {/* 简短预览 */}
                  {event.notes && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {event.notes}
                    </p>
                  )}
                </div>

                {/* 展开的详细内容 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className={`${config.lightBg} border-t border-gray-100`}
                    >
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-medium text-gray-800 mb-1">完整日期</h4>
                          <p className="text-sm text-gray-600">{dateInfo.full}</p>
                        </div>

                        {event.notes && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-1">详细备注</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.notes}</p>
                          </div>
                        )}

                        {/* 声音参数 */}
                        {event.voiceParameters && (
                          <div>
                            <h4 className="font-medium text-gray-800 mb-2">声音参数</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {event.voiceParameters.fundamental && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">基频:</span>
                                  <span className="font-medium">{event.voiceParameters.fundamental} Hz</span>
                                </div>
                              )}
                              {event.voiceParameters.jitter && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">抖动:</span>
                                  <span className="font-medium">{event.voiceParameters.jitter}%</span>
                                </div>
                              )}
                              {event.voiceParameters.shimmer && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">微颤:</span>
                                  <span className="font-medium">{event.voiceParameters.shimmer}%</span>
                                </div>
                              )}
                              {event.voiceParameters.hnr && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">谐噪比:</span>
                                  <span className="font-medium">{event.voiceParameters.hnr} dB</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 附件下载 */}
                        {event.attachment && (
                          <div>
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(event.attachment);
                              }}
                              className={`w-full ${config.bgColor} text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity duration-200`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              📎 下载附件
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* 数据源指示器 */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
          <div className={`w-2 h-2 rounded-full ${isProductionReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span>{isProductionReady ? '实时数据' : '演示数据'}</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTimeline;
