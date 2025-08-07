import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getUrl } from 'aws-amplify/storage';

/**
 * @en Renders the specific details for an event based on its type.
 * @zh 根据事件类型渲染其特定详情。
 */
const EventDetails = ({ event }) => {
  if (!event.details) {
    return <p className="text-sm text-red-500">此事件缺少详细信息。</p>;
  }

  const { details } = event;
  const detailItems = [];

  // A helper to add details to the list
  const addDetail = (label, value) => {
    if (value) {
      detailItems.push(
        <div key={label} className="flex justify-between">
          <span className="text-gray-600">{label}:</span>
          <span className="font-medium text-right">{Array.isArray(value) ? value.join(', ') : value}</span>
        </div>
      );
    }
  };

  const addParameter = (label, value, unit) => {
    if (value !== undefined && value !== null) {
      detailItems.push(
        <div key={label} className="flex justify-between">
          <span className="text-gray-600">{label}:</span>
          <span className="font-medium">{value} {unit}</span>
        </div>
      )
    }
  }

  switch (event.type) {
    case 'self_test':
    case 'hospital_test':
      addDetail('地点', details.location);
      addDetail('设备', details.equipmentUsed);
      addDetail('App', details.appUsed);
      addDetail('声音状态', details.sound);
      addDetail('发声方式', details.voicing);
      addParameter('基频', details.fundamentalFrequency, 'Hz');
      addParameter('Jitter', details.jitter, '%');
      addParameter('Shimmer', details.shimmer, '%');
      addParameter('谐噪比', details.hnr, 'dB');
      if (details.pitch) {
        addParameter('最高音', details.pitch.max, 'Hz');
        addParameter('最低音', details.pitch.min, 'Hz');
      }
      if (details.formants) {
        addParameter('F1', details.formants.f1, 'Hz');
        addParameter('F2', details.formants.f2, 'Hz');
        addParameter('F3', details.formants.f3, 'Hz');
      }
      break;
    case 'voice_training':
      addDetail('指导者', details.instructor);
      addDetail('训练内容', details.trainingContent);
      addDetail('自我练习内容', details.selfPracticeContent);
      addDetail('嗓音状态', details.voiceStatus);
      addDetail('发声方式', details.voicing);
      addDetail('感受', details.feelings);
      addDetail('参考资料', details.references);
      break;
    case 'self_practice':
      addDetail('有无指导', details.hasInstructor ? '有' : '无');
      addDetail('指导者', details.instructor);
      addDetail('练习内容', details.practiceContent);
      addDetail('嗓音状态', details.voiceStatus);
      addDetail('发声方式', details.voicing);
      addDetail('感受', details.feelings);
      addDetail('参考资料', details.references);
      break;
    case 'surgery':
      addDetail('医生', details.doctor);
      addDetail('地点', details.location);
      break;
    case 'feeling_log':
      // The content is the main detail, which we can show separately.
      break;
    default:
      return <p className="text-sm text-gray-500">无法识别的事件类型。</p>;
  }

  return (
    <>
      {details.notes && (
        <div>
          <h4 className="font-medium text-gray-800 mb-1">详细备注</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{details.notes}</p>
        </div>
      )}
       {details.content && (
        <div>
          <h4 className="font-medium text-gray-800 mb-1">感受记录</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{details.content}</p>
        </div>
      )}
      {detailItems.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-2">事件参数</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {detailItems}
          </div>
        </div>
      )}
    </>
  );
};


/**
 * @en Interactive timeline component for displaying user events in a horizontal layout.
 * @zh 用于在水平布局中显示用户事件的交互式时间轴组件。
 */
const InteractiveTimeline = ({ events, isProductionReady }) => {
  const [expandedEvent, setExpandedEvent] = useState(null);

  // --- Event Type Configuration ---
  const eventTypeConfig = {
    'hospital_test': { label: '医院检测', icon: '🏥', color: 'blue', bgColor: 'bg-blue-500', lightBg: 'bg-blue-50' },
    'self_test': { label: '自我测试', icon: '📱', color: 'green', bgColor: 'bg-green-500', lightBg: 'bg-green-50' },
    'voice_training': { label: '嗓音训练', icon: '🎯', color: 'purple', bgColor: 'bg-purple-500', lightBg: 'bg-purple-50' },
    'self_practice': { label: '自我练习', icon: '✍️', color: 'indigo', bgColor: 'bg-indigo-500', lightBg: 'bg-indigo-50' },
    'surgery': { label: '手术', icon: '⚕️', color: 'red', bgColor: 'bg-red-500', lightBg: 'bg-red-50' },
    'feeling_log': { label: '感受记录', icon: '😊', color: 'yellow', bgColor: 'bg-yellow-500', lightBg: 'bg-yellow-50' },
  };

  // --- Handlers ---
  const handleDownload = async (attachmentKey) => {
    try {
      if (isProductionReady) {
        const getUrlResult = await getUrl({ key: attachmentKey, options: { download: true } });
        window.open(getUrlResult.url.toString(), '_blank');
      } else {
        alert(`演示模式：在生产环境中这里会下载文件: ${attachmentKey}`);
      }
    } catch (error) {
      console.error('下载文件错误:', error);
      alert('无法获取文件的下载链接。');
    }
  };

  // --- Helpers ---
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      day: date.getDate(),
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      full: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
    };
  };

  // --- Render Logic ---
  if (!events || events.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
        <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
      </motion.div>
    );
  }

  return (
    <div className="relative py-8">
      {/* 时间轴线 */}
      <div className="absolute top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>

      {/* 事件容器 */}
      <div className="flex overflow-x-auto space-x-8 pb-8 snap-x snap-mandatory">
        {events.map((event, index) => {
          const config = eventTypeConfig[event.type] || eventTypeConfig['self_test'];
          const dateInfo = formatDate(event.date); // Use event.date instead of createdAt
          const isExpanded = expandedEvent === event.eventId;

          return (
            <motion.div
              key={event.eventId}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative flex-shrink-0 w-80 snap-center pt-20"
            >
              {/* 时间轴节点和日期 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
                <div className="text-xs font-medium text-gray-500">{dateInfo.month}</div>
                <div className="text-lg font-bold text-gray-800">{dateInfo.day}</div>
                <motion.div
                  className={`absolute top-14 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full ${config.bgColor} ring-4 ring-white shadow-lg`}
                  whileHover={{ scale: 1.2 }}
                />
              </div>

              {/* 事件卡片 */}
              <motion.div
                className={`bg-white rounded-xl shadow-lg hover:shadow-xl overflow-hidden cursor-pointer transition-all duration-300 relative`}
                onClick={() => setExpandedEvent(isExpanded ? null : event.eventId)}
                whileHover={{ y: -2 }}
                layout
              >
                {/* 彩色顶部装饰条 */}
                <div className={`h-1 ${config.bgColor}`}></div>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-800">{config.label}</h3>
                        <p className="text-sm text-gray-500">{dateInfo.time}</p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>
                  {event.details.notes && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{event.details.notes}</p>}
                  {event.type === 'feeling_log' && event.details.content && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{event.details.content}</p>}
                </div>

                {/* 展开的详细内容 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className={`${config.lightBg}`}
                    >
                      <div className="p-4 space-y-3">
                        <div>
                          <h4 className="font-medium text-gray-800 mb-1">完整日期</h4>
                          <p className="text-sm text-gray-600">{dateInfo.full}</p>
                        </div>

                        <EventDetails event={event} />

                        {event.details.attachmentUrl && (
                          <div>
                            <motion.button
                              onClick={(e) => { e.stopPropagation(); handleDownload(event.details.attachmentUrl); }}
                              className={`w-full ${config.bgColor} text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity duration-200`}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
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
      <div className="mt-4 text-center">
        <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
          <div className={`w-2 h-2 rounded-full ${isProductionReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span>{isProductionReady ? '实时数据' : '演示数据'}</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTimeline;
