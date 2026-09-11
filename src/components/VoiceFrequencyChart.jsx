import { parseEventDate, isInRecentDays } from '../utils/calendarDate.js';
import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// Prevent motion from being flagged as unused in some builds
void motion;

// --- SVG Icon Components (replacing lucide-react) ---
const Lightbulb = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
);

const CheckCircle = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

// --- Helper Functions ---

/**
 * 按选定指标提取有限数值，保留零值并按事件日期排序。
 * @param {Array<object>} events - 已按契约读取的事件。
 * @param {string} metric - 当前指标键。
 * @param {object} filters - 医生和手术方式筛选。
 * @returns {Array<object>} 图表与统计共用的数据点。
 */
const extractVoiceDataFromEvents = (events, metric, filters = {}) => {


  const data = [];

  // 筛选包含声音参数的事件类型
  let eventsWithVoiceData = events.filter(event => {
    const hasVoiceType = event.type === 'self_test' || event.type === 'hospital_test';
    const hasDetails = event.details;
    // 各指标独立存在，不能以基频作为共同前提。



    return hasVoiceType && hasDetails;
  });



  // 应用过滤器
  if (filters.doctor && filters.doctor !== 'all') {
    eventsWithVoiceData = eventsWithVoiceData.filter(event =>
      event.details.doctor === filters.doctor
    );
  }

  if (filters.surgeryMethod && filters.surgeryMethod !== 'all') {
    eventsWithVoiceData = eventsWithVoiceData.filter(event =>
      event.details.surgeryMethod === filters.surgeryMethod
    );
  }

  eventsWithVoiceData.forEach(event => {
    const date = event.date || event.createdAt;
    if (!date) {

      return;
    }

    let value;
    switch (metric) {
      case 'f0': // Fundamental Frequency (Hz)
        value = event.details.fundamentalFrequency;
        break;
      case 'jitter': // Jitter (%)
        value = event.details.jitter;
        break;
      case 'shimmer': // Shimmer (%)
        value = event.details.shimmer;
        break;
      case 'hnr': // Harmonics-to-Noise Ratio (dB)
        value = event.details.hnr;
        break;
      default:
        value = event.details.fundamentalFrequency;
    }

    if (Number.isFinite(value)) {
      const dataPoint = {
        date: parseEventDate(date).toLocaleDateString('zh-CN'),
        value,
        rawDate: parseEventDate(date),
        eventType: event.type,
        doctor: event.details.doctor || '未指定',
        surgeryMethod: event.details.surgeryMethod || '未指定'
      };


      data.push(dataPoint);
    }
  });

  // 按日期排序
  const sortedData = data.sort((a, b) => a.rawDate - b.rawDate);


  return sortedData;
};

// 获取可用的医生列表
const getDoctorOptions = (events) => {
  const doctors = new Set();
  events.forEach(event => {
    if ((event.type === 'self_test' || event.type === 'hospital_test') &&
        event.details && event.details.doctor) {
      doctors.add(event.details.doctor);
    }
  });
  return Array.from(doctors);
};

// 获取可用的手术方法列表
const getSurgeryMethodOptions = (events) => {
  const methods = new Set();
  events.forEach(event => {
    if ((event.type === 'self_test' || event.type === 'hospital_test') &&
        event.details && event.details.surgeryMethod) {
      methods.add(event.details.surgeryMethod);
    }
  });
  return Array.from(methods);
};

// --- Sub-components ---

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
        <div className="p-4 bg-gray-900/90 backdrop-blur-sm text-white rounded-xl shadow-2xl">
          <p className="label text-sm font-bold">{`日期 : ${label}`}</p>
          <p className="intro text-lg">{`数值 : ${payload[0].value}`}</p>
        </div>
    );
  }
  return null;
};

const ChartCard = ({ title, children }) => (
    <div
        className="relative w-full min-w-0 h-full bg-gradient-to-br from-white/60 via-gray-50/20 to-purple-50/10 rounded-3xl shadow-inner-lg backdrop-blur-sm"
        style={{ border: 'none' }}
    >
      {/* 顶部装饰性渐变 */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-pink-50/30 via-transparent to-transparent pointer-events-none"></div>

      {/* 主要内容区域 */}
      <div className="relative w-full min-w-0 h-full px-0 sm:px-12 pt-0 pb-4">
        {title ? <h3 className="font-bold text-gray-800 relative z-10 text-2xl sm:text-3xl mb-8">{title}</h3> : null}
        {children}
      </div>
    </div>
);

// --- Main Component ---

const VoiceFrequencyChart = ({ events = [], compact = false }) => {
  const [selectedMetric, setSelectedMetric] = useState('f0');
  const [activeRange, setActiveRange] = useState('1m');
  const [showInsights, setShowInsights] = useState(false);
  const [filters, setFilters] = useState({
    doctor: 'all',
    surgeryMethod: 'all'
  });

  // 紧凑模式：结合父组件传入的compact属性和屏幕尺寸检测
  const [isCompact, setIsCompact] = useState(compact);
  useEffect(() => {
    if (compact) {
      setIsCompact(true);
    } else {
      const mq = window.matchMedia('(max-width: 640px)');
      const onChange = (e) => setIsCompact(e.matches);
      setIsCompact(mq.matches);
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else mq.addListener(onChange);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', onChange);
        else mq.removeListener(onChange);
      };
    }
  }, [compact]);

  const metrics = [
    { key: 'f0', label: '基频 (F0)', unit: 'Hz' },
    { key: 'jitter', label: 'Jitter', unit: '%' },
    { key: 'shimmer', label: 'Shimmer', unit: '%' },
    { key: 'hnr', label: '谐噪比 (HNR)', unit: 'dB' }
  ];

  const timeRanges = [
    { key: '1w', label: '7天' },
    { key: '1m', label: '30天' },
    { key: '3m', label: '90天' },
    { key: 'all', label: '全部' }
  ];

  // 从传入的events提取图表数据
  const chartData = useMemo(() => {

    const data = extractVoiceDataFromEvents(events, selectedMetric, filters);

    return data;
  }, [events, selectedMetric, filters]);

  const filteredData = useMemo(() => {
    if (!chartData.length) return [];
    const now = new Date();
    const days = { '1w': 7, '1m': 30, '3m': 90 }[activeRange];
    return days ? chartData.filter(item => isInRecentDays(item.rawDate, days, now)) : chartData;
  }, [chartData, activeRange]);

  const currentMetric = metrics.find(m => m.key === selectedMetric);
  const latestValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].value : 'N/A';
  const averageValue = filteredData.length > 0 ? (filteredData.reduce((acc, item) => acc + item.value, 0) / filteredData.length).toFixed(2) : 'N/A';

  const buttonClasses = "min-w-0 px-2 py-1 text-xs sm:text-sm sm:px-4 sm:py-1.5 font-semibold rounded-full whitespace-normal leading-tight transition-all duration-300 ease-in-out border border-transparent text-gray-600";
  const activeClasses = "bg-pink-500 text-white shadow-md";
  const inactiveClasses = "hover:bg-gray-200 hover:text-gray-800";

  // 紧凑模式参数
  const chartHeight = isCompact ? 300 : 350;
  const tickFontSize = isCompact ? 10 : 12;

  // 获取过滤选项
  const doctorOptions = useMemo(() => getDoctorOptions(events), [events]);
  const surgeryMethodOptions = useMemo(() => getSurgeryMethodOptions(events), [events]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  return (
      <ChartCard title="">
        <div className="flex min-w-0 flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          {/* Metric Selection */}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1 bg-gray-100 p-1.5 rounded-2xl md:w-auto">
            {metrics.map(metric => (
                <button
                    key={metric.key}
                    onClick={() => setSelectedMetric(metric.key)}
                    className={`${buttonClasses} ${selectedMetric === metric.key ? activeClasses : inactiveClasses}`}
                >
                  {metric.label}
                </button>
            ))}
          </div>

          {/* Time Range Selection */}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1 bg-gray-100 p-1.5 rounded-2xl md:w-auto">
            {timeRanges.map(range => (
                <button
                    key={range.key}
                    onClick={() => setActiveRange(range.key)}
                    className={`${buttonClasses} ${activeRange === range.key ? activeClasses : inactiveClasses}`}
                >
                  {range.label}
                </button>
            ))}
          </div>
        </div>

        {/* 过滤器状态显示 */}
        {(filters.doctor !== 'all' || filters.surgeryMethod !== 'all') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm [overflow-wrap:anywhere]">
                <span className="font-medium text-blue-900">当前过滤:</span>
                {filters.doctor !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    医生: {filters.doctor}
                  </span>
                )}
                {filters.surgeryMethod !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    手术方法: {filters.surgeryMethod}
                  </span>
                )}
              </div>
              <button
                onClick={() => setFilters({ doctor: 'all', surgeryMethod: 'all' })}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                清除过滤
              </button>
            </div>
          </div>
        )}

        {/* 图表容器 */}
        <div className="relative min-w-0" style={{ width: '100%', height: chartHeight }}>
          <AnimatePresence>
            {filteredData.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10 rounded-lg"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4">📊</div>
                    <p className="text-lg text-gray-500 mb-2">暂无声音参数数据</p>
                    <p className="text-sm text-gray-400">请添加包含声音参数的测试事件</p>
                  </div>
                </motion.div>
            ) : null}
          </AnimatePresence>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 24, left: 0, bottom: 18 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="date" tick={{ fontSize: tickFontSize }} stroke="#6b7280" />
              <YAxis tick={{ fontSize: tickFontSize }} stroke="#6b7280" unit={currentMetric?.unit} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip content={<CustomTooltip />} />
              {/* 显示采样点，只有一条记录时也能看到数据。 */}
              <Area dot={{ r: 3 }} type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 flex min-w-0 flex-wrap items-center gap-4 pt-6">
          <div className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-4 [overflow-wrap:anywhere]">
            {/* Latest Value */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <p className="text-sm font-medium text-gray-500">最新值</p>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-800 break-words">
                {latestValue}
                <span className="ml-1.5 text-sm font-normal text-gray-500">{currentMetric?.unit}</span>
              </p>
            </div>

            {/* Average Value */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <p className="text-sm font-medium text-gray-500">平均值</p>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-800 break-words">
                {averageValue}
                <span className="ml-1.5 text-sm font-normal text-gray-500">{currentMetric?.unit}</span>
              </p>
            </div>
          </div>
        </div>

        {/* 控制面板 */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          {/* 医生过滤 */}
          {doctorOptions.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-gray-700">医生:</label>
              <select
                value={filters.doctor}
                onChange={(e) => handleFilterChange('doctor', e.target.value)}
                className="min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="all">全部</option>
                {doctorOptions.map(doctor => (
                  <option key={doctor} value={doctor}>{doctor}</option>
                ))}
              </select>
            </div>
          )}

          {/* 手术方法过滤 */}
          {surgeryMethodOptions.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-gray-700">手术方法:</label>
              <select
                value={filters.surgeryMethod}
                onChange={(e) => handleFilterChange('surgeryMethod', e.target.value)}
                className="min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="all">全部</option>
                {surgeryMethodOptions.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          )}

          {/* 洞察按钮 */}
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex min-w-0 flex-wrap items-center px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-sm font-medium"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            {showInsights ? '隐藏洞察' : '显示洞察'}
          </button>
        </div>

        {/* 洞察面板 */}
        <AnimatePresence>
          {showInsights && chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-gray-200 pt-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                    <h4 className="font-medium text-green-900">数据统计</h4>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    共有 {chartData.length} 个数据点
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ChartCard>
  );
};

export default VoiceFrequencyChart;
