import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getUrl } from 'aws-amplify/storage';

const StatusIndicator = ({ isDemo, isLoading }) => {
  const CheckCircle = () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
  );
  const AlertTriangle = () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
  );
  const Lightbulb = () => (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M2 12a10 10 0 1 1 20 0c0 4.19-2.49 7.79-6 9.21V22H8v-.79C4.49 19.79 2 16.19 2 12Z" />
      </svg>
  );
  return (
      <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-gray-200">
        {isLoading ? (
            <span className="animate-spin text-yellow-500"><Lightbulb /></span>
        ) : isDemo ? (
            <span className="text-orange-500"><AlertTriangle /></span>
        ) : (
            <span className="text-green-500"><CheckCircle /></span>
        )}
        <span>{isLoading ? '加载中...' : isDemo ? '演示数据' : '实时数据'}</span>
      </div>
  );
};

const EventDetails = ({ event }) => {
  const d = event?.details || {};
  const rows = [];
  const shownKeys = new Set();

  const addRow = (label, key, valueOverride) => {
    const value = valueOverride !== undefined ? valueOverride : d[key];
    if (value !== undefined && value !== null && value !== '') {
      rows.push(
          <div key={label} className="flex justify-between">
            <span className="text-gray-600">{label}:</span>
            <span className="font-medium text-right break-all">
            {Array.isArray(value) ? value.join(', ') : String(value)}
          </span>
          </div>
      );
      if (key) shownKeys.add(key);
    }
  };
  const addParam = (label, key, unit) => {
    const v = d[key];
    if (v !== undefined && v !== null && v !== '') {
      rows.push(
          <div key={label} className="flex justify-between">
            <span className="text-gray-600">{label}:</span>
            <span className="font-medium">{v} {unit}</span>
          </div>
      );
      shownKeys.add(key);
    }
  };

  const headerBlocks = [];
  if (d.content) {
    headerBlocks.push(
        <div key="content" className="col-span-2">
          <h4 className="font-medium text-gray-800 mb-1">内容</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.content}</p>
        </div>
    );
    shownKeys.add('content');
  }
  if (d.notes || d.remark || d.remarks) {
    const n = d.notes || d.remark || d.remarks;
    headerBlocks.push(
        <div key="notes" className="col-span-2">
          <h4 className="font-medium text-gray-800 mb-1">备注</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{n}</p>
        </div>
    );
    shownKeys.add('notes'); shownKeys.add('remark'); shownKeys.add('remarks');
  }

  switch (event?.type) {
    case 'self_test':
    case 'hospital_test':
      addRow('地点', 'location');
      addRow('设备', 'equipmentUsed');
      addRow('App', 'appUsed');
      addRow('声音状态', 'sound');
      addRow('发声方式', 'voicing');
      addParam('基频', 'fundamentalFrequency', 'Hz');
      addParam('Jitter', 'jitter', '%');
      addParam('Shimmer', 'shimmer', '%');
      addParam('谐噪比', 'hnr', 'dB');
      if (d.pitch && typeof d.pitch === 'object') {
        const { max, min, avg } = d.pitch;
        addRow('最高音', null, `${max} Hz`);
        addRow('最低音', null, `${min} Hz`);
        addRow('平均音', null, `${avg} Hz`);
        shownKeys.add('pitch');
      }
      break;
    case 'voice_training':
    case 'self_practice':
      addRow('主题', 'topic');
      addRow('时长', 'duration');
      addRow('练习要点', 'keypoints');
      break;
    case 'feeling_log':
      break;
    case 'surgery':
      addRow('医院', 'hospital');
      addRow('医生', 'doctor');
      addRow('备注', 'notes');
      break;
    default:
      break;
  }

  const attachments = d.attachmentUrl || d.attachments || d.files;
  if (attachments) {
    shownKeys.add('attachmentUrl'); shownKeys.add('attachments'); shownKeys.add('files');
  }

  Object.entries(d).forEach(([k, v]) => {
    if (shownKeys.has(k)) return;
    if (v === undefined || v === null || v === '') return;
    if (typeof v === 'object') {
      try {
        rows.push(
            <div key={k} className="flex justify-between">
              <span className="text-gray-600">{k}:</span>
              <span className="font-medium text-right break-all">{JSON.stringify(v)}</span>
            </div>
        );
      } catch {}
    } else {
      addRow(k, k);
    }
  });

  return (
      <div className="space-y-4">
        {headerBlocks.length > 0 && <div className="space-y-3">{headerBlocks}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows}
        </div>

        {attachments && (
            <div className="pt-3">
              <h4 className="font-medium text-gray-800 mb-2">附件</h4>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(attachments) ? attachments : [attachments]).map((att, i) => (
                    <a
                        key={i}
                        href={typeof att === 'string' ? att : att?.url || '#'}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                    >
                      📎 附件 {i + 1}
                    </a>
                ))}
              </div>
            </div>
        )}
      </div>
  );
};

const InteractiveTimeline = ({ events = [], isProductionReady, isLoading = false }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const typeConfig = {
    hospital_test:   { label: '医院检测',  icon: '🏥', bg: 'bg-blue-500' },
    self_test:       { label: '自我测试',  icon: '📱', bg: 'bg-green-500' },
    voice_training:  { label: '嗓音训练',  icon: '🎯', bg: 'bg-purple-500' },
    self_practice:   { label: '自我练习',  icon: '✍️', bg: 'bg-indigo-500' },
    surgery:         { label: '手术',      icon: '⚕️', bg: 'bg-red-500' },
    feeling_log:     { label: '感受记录',  icon: '📝', bg: 'bg-orange-500' },
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      day: date.getDate(),
      full: date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (!events || events.length === 0) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有事件记录</h3>
          <p className="text-gray-500">使用上面的表单添加您的第一个嗓音事件！</p>
        </motion.div>
    );
  }

  const isDemo = !(typeof isProductionReady === 'function' ? isProductionReady() : !!isProductionReady);
  const ordered = [...events].sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

  // 尺寸与对齐参数
  const AXIS_THICKNESS = 1;       // 轴线 1px
  const DOT = 10;                 // 圆点直径
  const AXIS_GAP = 28;            // 轴线与卡片/日期距离
  const ALIGN_NUDGE = 10;        // 对齐微调：将圆点整体向下 0.5px，避免“略高”的视觉

  // 附件下载
  const handleDownload = async (attachmentPath) => {
    try {
      const res = await getUrl({ path: attachmentPath });
      const url = res?.url || attachmentPath;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(attachmentPath, '_blank', 'noopener,noreferrer');
    }
  };

  return (
      <div className="relative isolate pt-20 pb-16 sm:pt-24 sm:pb-20">
        <div className="overflow-x-auto overflow-y-visible">
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

              {ordered.map((event, index) => {
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
                      <motion.div
                          onClick={() => setSelectedEvent(event)}
                          className="absolute left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 p-4 cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl z-10"
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
                      </motion.div>

                      {/* 顶部连线（从轴线到卡片），长度对称并考虑 ALIGN_NUDGE */}
                      <div
                          className="absolute left-1/2 -translate-x-1/2 bg-gray-300"
                          style={{
                            top: `calc(50% - ${AXIS_GAP}px)`,
                            height: `calc(${AXIS_GAP}px - ${DOT / 2}px + ${ALIGN_NUDGE}px)`,
                            width: '1px'
                          }}
                      />

                      {/* 圆点：整体向下微移 0.5px，避免“略高” */}
                      <div
                          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${cfg.bg} z-20`}
                          style={{ top: `calc(50% + ${ALIGN_NUDGE}px)`, width: `${DOT}px`, height: `${DOT}px`, boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}
                      />

                      {/* 底部连线（从轴线到日期胶囊），与上连线严格对称 */}
                      <div
                          className="absolute left-1/2 -translate-x-1/2 bg-gray-300"
                          style={{
                            top: `calc(50% + ${ALIGN_NUDGE}px + ${DOT / 2}px)`,
                            height: `calc(${AXIS_GAP}px - ${DOT / 2}px - ${ALIGN_NUDGE}px)`,
                            width: '1px'
                          }}
                      />

                      {/* 日期胶囊（玻璃风格） */}
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

        {/* 右下角状态指示器 */}
        <div className="mt-6 px-6 sm:px-8 flex justify-end">
          <StatusIndicator isDemo={isDemo} isLoading={isLoading} />
        </div>

        {/* 详情弹窗 */}
        {selectedEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedEvent(null)} />
              <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl p-6 m-4 overflow-y-auto max-h-[80vh]">
                <button
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                    aria-label="关闭"
                >
                  ×
                </button>

                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-3xl">{(typeConfig[selectedEvent.type] || {}).icon || '📌'}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {(typeConfig[selectedEvent.type] || {}).label || selectedEvent.type}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(selectedEvent.date || selectedEvent.createdAt).toLocaleString('zh-CN', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <EventDetails event={selectedEvent} />

                {selectedEvent.details?.attachmentUrl && (
                    <div className="mt-5">
                      <button
                          onClick={async () => {
                            try {
                              const res = await getUrl({ path: selectedEvent.details.attachmentUrl });
                              const url = res?.url || selectedEvent.details.attachmentUrl;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } catch {
                              window.open(selectedEvent.details.attachmentUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-500 transition-colors"
                      >
                        📎 下载附件
                      </button>
                    </div>
                )}
              </div>
            </div>
        )}
      </div>
  );
};

export default InteractiveTimeline;