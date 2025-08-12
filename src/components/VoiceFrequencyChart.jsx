import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { getEventsByUserId } from '../api';

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
const extractVoiceDataFromEvents = (events, metric) => {
  const data = [];

  // 筛选包含声音参数的事件类型
  const eventsWithVoiceData = events.filter(event =>
      (event.type === 'self_test' || event.type === 'hospital_test') &&
      event.details &&
      event.details.fundamentalFrequency !== undefined
  );

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
      case 'shimmer': // Shimmer (dB)
        value = event.details.shimmer;
        break;
      case 'hnr': // Harmonics-to-Noise Ratio (dB)
        value = event.details.hnr;
        break;
      default:
        return;
    }

    if (value !== undefined && value !== null) {
      data.push({
        date: new Date(date).toISOString().split('T')[0],
        value: parseFloat(value),
        eventId: event.eventId,
        eventType: event.type
      });
    }
  });

  // 按日期排序
  return data.sort((a, b) => new Date(a.date) - new Date(b.date));
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

const VoiceFrequencyChart = ({ userId, isProductionReady }) => {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('f0');
  const [activeRange, setActiveRange] = useState('1m');

  // 紧凑模式：针对小屏进行视觉收紧
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px)');
    const onChange = (e) => setIsCompact(e.matches);
    setIsCompact(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  const metrics = [
    { key: 'f0', label: '基频 (F0)', unit: 'Hz' },
    { key: 'jitter', label: 'Jitter', unit: '%' },
    { key: 'shimmer', label: 'Shimmer', unit: 'dB' },
    { key: 'hnr', label: 'HNR', unit: 'dB' }
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

  // Fetch data when component mounts or when dependencies change
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        console.log('❌ VoiceFrequencyChart: 没有用户ID，跳过数据获取');
        setIsLoading(false);
        return;
      }

      console.log('🔍 VoiceFrequencyChart: 开始获取数据', {
        userId,
        selectedMetric,
        isProductionReady: isUsingProductionData
      });

      setIsLoading(true);

      try {
        let data;

        if (isUsingProductionData) {
          // 生产环境：从API获取真实数据
          console.log('🌐 VoiceFrequencyChart: 使用生产数据源');
          data = await fetchVoiceDataFromAPI(userId, selectedMetric);
          setIsDemoData(false);

          // 如果没有真实数据，回退到演示数据
          if (!data || data.length === 0) {
            console.log('⚠️ VoiceFrequencyChart: 没有真实数据，回退到演示数据');
            data = generateMockData(30, selectedMetric);
            setIsDemoData(true);
          }
        } else {
          // 开发环境：优先尝试从 mock API 获取数据
          console.log('🔧 VoiceFrequencyChart: 开发模式 - 尝试获取 mock 数据');
          data = await fetchVoiceDataFromAPI(userId, selectedMetric);

          if (data && data.length > 0) {
            console.log('✅ VoiceFrequencyChart: 使用真实 mock 数据', { dataCount: data.length });

            // 检查mock数据的日期范围，如果数据较老，自动调整时间范围为"全部"
            const now = new Date();
            const hasRecentData = data.some(item => {
              const itemDate = new Date(item.date);
              const oneMonthAgo = new Date(now);
              oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
              return itemDate > oneMonthAgo;
            });

            if (!hasRecentData) {
              console.log('⚠️ VoiceFrequencyChart: mock数据较老，自动切换到"全部"时间范围');
              setActiveRange('all');
            }

            setIsDemoData(false); // 这是真实的 mock 数据，不是生成的
          } else {
            console.log('⚠️ VoiceFrequencyChart: mock 数据不足，使用生成的演示数据');
            data = generateMockData(30, selectedMetric);
            setIsDemoData(true); // 这是生成的演示数据
          }
        }

        console.log('✅ VoiceFrequencyChart: 数据获取完成', {
          dataCount: data?.length || 0,
          isDemoData: !isUsingProductionData && (!data || data.length === 0),
          dataSource: data && data.length > 0 ? 'mock_api' : 'generated',
          firstDataPoint: data?.[0],
          lastDataPoint: data?.[data.length - 1]
        });

        setChartData(data || []);
      } catch (error) {
        console.error('❌ VoiceFrequencyChart: 数据获取失败:', error);
        // 错误时使用演示数据作为后备
        const fallbackData = generateMockData(30, selectedMetric);
        setChartData(fallbackData);
        setIsDemoData(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, selectedMetric, isUsingProductionData]);

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

  return (
      <ChartCard title="">
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

        <div style={{ width: '100%', height: chartHeight }}>
          <AnimatePresence>
            {isLoading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                  <p className="text-lg text-gray-500">加载数据中...</p>
                </motion.div>
            ) : filteredData.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
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
      </ChartCard>
  );
};

export default VoiceFrequencyChart;