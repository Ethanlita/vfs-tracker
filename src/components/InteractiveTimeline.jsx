import React, { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';
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
      );
    }
  };

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
  const [selectedEvent, setSelectedEvent] = useState(null);

  const eventTypeConfig = {
    hospital_test: { label: '医院检测', icon: '🏥', color: 'blue', bgColor: 'bg-blue-500', lightBg: 'bg-blue-50' },
    self_test: { label: '自我测试', icon: '📱', color: 'green', bgColor: 'bg-green-500', lightBg: 'bg-green-50' },
    voice_training: { label: '嗓音训练', icon: '🎯', color: 'purple', bgColor: 'bg-purple-500', lightBg: 'bg-purple-50' },
    self_practice: { label: '自我练习', icon: '✍️', color: 'indigo', bgColor: 'bg-indigo-500', lightBg: 'bg-indigo-50' },
    surgery: { label: '手术', icon: '⚕️', color: 'red', bgColor: 'bg-red-500', lightBg: 'bg-red-50' },
    feeling_log: { label: '感受记录', icon: '😊', color: 'yellow', bgColor: 'bg-yellow-500', lightBg: 'bg-yellow-50' },
  };

  const handleDownload = async (attachmentKey) => {
    try {
      if (typeof isProductionReady === 'function' ? isProductionReady() : isProductionReady) {
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      day: date.getDate(),
      time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      full: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
      short: date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    };
  };

  const TimelineEventCard = ({ event, config, onClick }) => {
    const summary = event.details?.content || event.details?.notes || '暂无内容';
    return (
      <Motion.div
        className="w-64 h-40 bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-xl cursor-pointer transform transition-all duration-300 flex flex-col"
        whileHover={{ y: -4 }}
        onClick={onClick}
      >
        <div className="flex items-center px-4 pt-4 text-lg font-semibold text-gray-800">
          <span className="mr-2 text-2xl">{config.icon}</span>
          <span>{config.label}</span>
        </div>
        <div className="mx-4 my-2 border-b border-gray-200" />
        <div className="px-4 pb-4 flex-1">
          <p className="text-sm text-gray-600 line-clamp-3">{summary}</p>
        </div>
      </Motion.div>
    );
  };

  const StatusIndicator = ({ isDemo }) => (
    <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm text-gray-600">
      {isDemo ? (
        <AlertTriangle className="w-4 h-4 text-orange-500" />
      ) : (
        <CheckCircle className="w-4 h-4 text-green-500" />
      )}
      <span>{isDemo ? '演示数据源' : '实时数据源'}</span>
    </div>
  );

  if (!events || events.length === 0) {
    return (
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
        <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
      </Motion.div>
    );
  }

  const isDataFromProduction = typeof isProductionReady === 'function' ? isProductionReady() : isProductionReady;

  return (
    <div className="relative py-16">
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>

      <div className="flex overflow-x-auto space-x-12 pb-8 snap-x snap-mandatory">
        {events.map((event, index) => {
          const config = eventTypeConfig[event.type] || eventTypeConfig['self_test'];
          const dateInfo = formatDate(event.date || event.createdAt);
          const isTop = index % 2 === 0;
          return (
            <div key={event.eventId} className="relative flex flex-col items-center w-64 flex-shrink-0 snap-start">
              {isTop && (
                <>
                  <TimelineEventCard event={event} config={config} onClick={() => setSelectedEvent(event)} />
                  <div className="h-6 w-px bg-gray-300" />
                </>
              )}
              {!isTop && <div className="mb-2 text-sm text-gray-500">{dateInfo.short}</div>}
              <div className={`w-4 h-4 rounded-full ${config.bgColor} ring-4 ring-white shadow-md`} />
              {isTop && <div className="mt-2 text-sm text-gray-500">{dateInfo.short}</div>}
              {!isTop && (
                <>
                  <div className="h-6 w-px bg-gray-300" />
                  <TimelineEventCard event={event} config={config} onClick={() => setSelectedEvent(event)} />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <StatusIndicator isDemo={!isDataFromProduction} />
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <Motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEvent(null)}
          >
            <Motion.div
              className="bg-white rounded-lg p-6 max-w-lg w-full relative shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-2">{eventTypeConfig[selectedEvent.type]?.icon}</span>
                <h3 className="text-lg font-semibold text-gray-800">
                  {eventTypeConfig[selectedEvent.type]?.label}
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                {formatDate(selectedEvent.date || selectedEvent.createdAt).full}
              </p>
              <EventDetails event={selectedEvent} />
              {selectedEvent.details?.attachmentUrl && (
                <Motion.button
                  onClick={() => handleDownload(selectedEvent.details.attachmentUrl)}
                  className={`mt-4 w-full ${eventTypeConfig[selectedEvent.type]?.bgColor} text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity duration-200`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  📎 下载附件
                </Motion.button>
              )}
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveTimeline;

