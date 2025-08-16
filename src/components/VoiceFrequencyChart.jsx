import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getEventsByUserId } from '../api';
import { useAsync } from '../utils/useAsync.js';

// --- SVG Icon Components (replacing lucide-react) ---
const Lightbulb = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
);

const AlertTriangle = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
);

const CheckCircle = ({ className, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);


// --- Helper Functions ---

// 从事件数据中提取声音参数数据
const extractVoiceDataFromEvents = (events, metric, filters = {}) => {
  const data = [];

  // 筛选包含声音参数的事件类型
  let eventsWithVoiceData = events.filter(event =>
      (event.type === 'self_test' || event.type === 'hospital_test') &&
      event.details &&
      event.details.fundamentalFrequency !== undefined
  );

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
    if (!date) return;

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

    if (value !== undefined && value !== null) {
      data.push({
        date: new Date(date).toLocaleDateString('zh-CN'),
        value: parseFloat(value),
        rawDate: new Date(date),
        eventType: event.type,
        doctor: event.details.doctor || '未指定',
        surgeryMethod: event.details.surgeryMethod || '未指定'
      });
    }
  });

  // 按日期排序
  return data.sort((a, b) => a.rawDate - b.rawDate);
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

// Generates realistic mock data for demonstration purposes
const generateMockData = (days, metric) => {
  const data = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    let value;
    switch (metric) {
      case 'f0': // Fundamental Frequency (Hz)
        value = 120 + Math.sin(i / 20) * 20 + Math.random() * 10 - 5;
        break;
      case 'jitter': // Jitter (%)
        value = 0.5 + Math.sin(i / 15) * 0.2 + Math.random() * 0.1 - 0.05;
        break;
      case 'shimmer': // Shimmer (dB)
        value = 0.2 + Math.sin(i / 10) * 0.08 + Math.random() * 0.05 - 0.025;
        break;
      case 'hnr': // Harmonics-to-Noise Ratio (dB)
        value = 25 + Math.sin(i / 25) * 5 + Math.random() * 2 - 1;
        break;
      default:
        value = 0;
    }
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(0, parseFloat(value.toFixed(2))), // Ensure non-negative values
    });
  }
  return data;
};

// A placeholder for a real API call
const fetchRealData = async (userId, metric, timeRange) => {
  console.log(`Fetching real data for ${userId}, metric: ${metric}, range: ${timeRange}`);
  // In a real application, you would make an API call here.
  // await new Promise(resolve => setTimeout(resolve, 1000));
  return []; // Returning empty for now
};

// 获取用户事件数据并提取声音参数
const fetchVoiceDataFromAPI = async (userId, metric) => {
  console.log('🔍 fetchVoiceDataFromAPI: 开始获取数据', { userId, metric });

  try {
    const events = await getEventsByUserId(userId);
    console.log('📡 fetchVoiceDataFromAPI: API 返回的原始事件', {
      eventCount: events?.length || 0,
      events: events
    });

    const extractedData = extractVoiceDataFromEvents(events, metric);
    console.log('🎯 fetchVoiceDataFromAPI: 提取的声音数据', {
      extractedCount: extractedData.length,
      metric,
      data: extractedData
    });

    return extractedData;
  } catch (error) {
    console.error('❌ fetchVoiceDataFromAPI: 获取用户事件数据失败:', error);
    return [];
  }
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
        className="relative w-full h-full bg-gradient-to-br from-white/60 via-gray-50/20 to-purple-50/10 rounded-3xl shadow-inner-lg backdrop-blur-sm overflow-hidden"
        style={{ border: 'none' }}
    >
      {/* 顶部装饰性渐变 */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-pink-50/30 via-transparent to-transparent pointer-events-none"></div>

      {/* 主要内容区域 */}
      <div className="relative w-full h-full px-4 sm:px-12 pt-0 pb-4">
        {title ? <h3 className="font-bold text-gray-800 relative z-10 text-2xl sm:text-3xl mb-8">{title}</h3> : null}
        {children}
      </div>
    </div>
);

const StatusIndicator = ({ isDemo, isLoading }) => (
    <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm text-gray-600">
      {isLoading ? (
          <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          >
            <Lightbulb className="w-4 h-4 text-yellow-500" />
          </motion.div>
      ) : isDemo ? (
          <AlertTriangle className="w-4 h-4 text-orange-500" />
      ) : (
          <CheckCircle className="w-4 h-4 text-green-500" />
      )}
      <span>{isLoading ? "加载中..." : isDemo ? "演示数据源" : "实时数据源"}</span>
    </div>
);


// --- Main Component ---

const VoiceFrequencyChart = ({ userId, isProductionReady, compact = false, events }) => {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
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
    { key: 'shimmer', label: 'Shimmer', unit: 'dB' },
    { key: 'hnr', label: '谐噪比 (HNR)', unit: 'dB' }
  ];

  const timeRanges = [
    { key: '1w', label: '1周' },
    { key: '1m', label: '1月' },
    { key: '3m', label: '3月' },
    { key: 'all', label: '全部' }
  ];

  // 修复：统一数据来源判断逻辑
  const isUsingProductionData = useMemo(() => {
    return typeof isProductionReady === 'function' ? isProductionReady() : isProductionReady;
  }, [isProductionReady]);

  const metricConfig = {
    f0: { label: '基频 (F0)', unit: 'Hz', color: '#8b5cf6', target: { min: 165, max: 265 } },
    jitter: { label: '频率微变 (Jitter)', unit: '%', color: '#06b6d4', target: { max: 1.04 } },
    shimmer: { label: '振幅微变 (Shimmer)', unit: 'dB', color: '#10b981', target: { max: 0.35 } },
    hnr: { label: '谐噪比 (HNR)', unit: 'dB', color: '#f59e0b', target: { min: 20 } }
  };

  // 使用 useAsync 统一获取事件并抽取指标数据
  const forceReal = !!import.meta.env.VITE_FORCE_REAL; // 新增：强制真实模式
  const dataAsync = useAsync(async () => {
    if (!userId) return { data: [], demo: true };
    let data = [];
    let demo = false;
    if (isUsingProductionData) {
      data = await fetchVoiceDataFromAPI(userId, selectedMetric);
      if (!data.length) {
        if (forceReal) {
          // 强制真实：不生成 mock，直接返回空
          return { data: [], demo: false };
        }
        data = generateMockData(30, selectedMetric);
        demo = true;
      }
    } else {
      data = await fetchVoiceDataFromAPI(userId, selectedMetric);
      if (!data.length) {
        if (forceReal) {
          // 环境未就绪但强制真实：不造假数据
          return { data: [], demo: false };
        }
        data = generateMockData(30, selectedMetric);
        demo = true;
      } else {
        const now = new Date();
        const oneMonthAgo = new Date(now); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const hasRecent = data.some(d => new Date(d.date) > oneMonthAgo);
        if (!hasRecent) setActiveRange('all');
      }
    }
    return { data, demo };
  }, [userId, selectedMetric, isUsingProductionData, forceReal]);

  useEffect(() => {
    setIsLoading(dataAsync.loading);
    if (dataAsync.error) {
      const fallback = generateMockData(30, selectedMetric);
      setChartData(fallback);
      setIsDemoData(true);
    } else if (dataAsync.value) {
      setChartData(dataAsync.value.data);
      setIsDemoData(dataAsync.value.demo);
    }
  }, [dataAsync.loading, dataAsync.error, dataAsync.value, selectedMetric]);

  const filteredData = useMemo(() => {
    if (!chartData) return [];
    const now = new Date(); // Stable reference for this calculation
    return chartData.filter(item => {
      const itemDate = new Date(item.date);
      // FIX: The date mutation bug is fixed here by creating a new date for each comparison.
      switch (activeRange) {
        case "1w":
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return itemDate > oneWeekAgo;
        case "1m":
          const oneMonthAgo = new Date(now);
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          return itemDate > oneMonthAgo;
        case "3m":
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          return itemDate > threeMonthsAgo;
        case "all":
          return true;
        default:
          return true;
      }
    });
  }, [chartData, activeRange]);

  const currentMetric = metrics.find(m => m.key === selectedMetric);
  const latestValue = filteredData.length > 0 ? filteredData[filteredData.length - 1].value : 'N/A';
  const averageValue = filteredData.length > 0 ? (filteredData.reduce((acc, item) => acc + item.value, 0) / filteredData.length).toFixed(2) : 'N/A';

  const buttonClasses = "px-3 py-1 text-xs sm:text-sm sm:px-4 sm:py-1.5 font-semibold rounded-full transition-all duration-300 ease-in-out border border-transparent text-gray-600";
  const activeClasses = "bg-pink-500 text-white shadow-md";
  const inactiveClasses = "hover:bg-gray-200 hover:text-gray-800";

  // 紧凑模式参数
  const chartHeight = isCompact ? 300 : 350;
  const tickFontSize = isCompact ? 10 : 12;

  // 获取过滤选项
  const doctorOptions = useMemo(() => getDoctorOptions(events), [events]);
  const surgeryMethodOptions = useMemo(() => getSurgeryMethodOptions(events), [events]);

  // 应用过滤器提取数据
  const filteredChartData = useMemo(() => {
    return extractVoiceDataFromEvents(events, selectedMetric, filters);
  }, [events, selectedMetric, filters]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  return (
      <ChartCard title="">
        {/* 添加错误提示 */}
        {dataAsync.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>数据加载失败：{dataAsync.error.message || '未知错误'} (已使用演示数据)</span>
            <button onClick={dataAsync.execute} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs">重试</button>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          {/* Metric Selection */}
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1.5 rounded-full">
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
          <div className="flex items-center gap-1 bg-gray-100 p-1.5 rounded-full">
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm">
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

        {/* 图表容器 - 将毛玻璃效果限制在这个容器内 */}
        <div className="relative" style={{ width: '100%', height: chartHeight }}>
          <AnimatePresence>
            {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10 rounded-lg"
                >
                  <p className="text-lg text-gray-500">加载数据中...</p>
                </motion.div>
            ) : filteredData.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10 rounded-lg"
                >
                  <p className="text-lg text-gray-500">该时间范围内无数据</p>
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
              <Area type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 flex justify-between items-center pt-6">
          <StatusIndicator isDemo={isDemoData} isLoading={isLoading} />
          <div className="flex items-start space-x-8">
            {/* Latest Value */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <p className="text-sm font-medium text-gray-500">最新值</p>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-800">
                {latestValue}
                <span className="ml-1.5 text-sm font-normal text-gray-500">{currentMetric?.unit}</span>
              </p>
            </div>

            {/* Average Value */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <p className="text-sm font-medium text-gray-500">平均值</p>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-800">
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
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">医生:</label>
              <select
                value={filters.doctor}
                onChange={(e) => handleFilterChange('doctor', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
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
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">手术方法:</label>
              <select
                value={filters.surgeryMethod}
                onChange={(e) => handleFilterChange('surgeryMethod', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
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
            className="flex items-center px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-sm font-medium"
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
              {/* 洞察内容会在这里添加 */}
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
                {/* 可以添加更多洞察卡片 */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ChartCard>
  );
};

export default VoiceFrequencyChart;
