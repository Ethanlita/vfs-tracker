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
    <div className="relative w-full h-full" style={{ paddingLeft: '3rem', paddingRight: '3rem', paddingTop: '0rem', paddingBottom: '1rem' }}>
      <h3 className="font-bold text-gray-800 relative z-10" style={{ fontSize: '1.875rem', marginBottom: '2rem' }}>{title}</h3>
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
  const [activeRange, setActiveRange] = useState("all"); // FIX: Default to 'all' to ensure data is shown initially

  const metrics = [
    { key: 'f0', label: '基频 (F0)', unit: 'Hz' },
    { key: 'jitter', label: '抖动 (Jitter)', unit: '%' },
    { key: 'shimmer', label: '微颤 (Shimmer)', unit: 'dB' },
    { key: 'hnr', label: '谐噪比 (HNR)', unit: 'dB' },
  ];

  const timeRanges = [
    { key: '1w', label: '一周' },
    { key: '1m', label: '一月' },
    { key: '3m', label: '三月' },
    { key: 'all', label: '全部' }, // FIX: Add 'all' option
  ];

  useEffect(() => {
    const loadData = async () => {
      console.log('🔍 VoiceFrequencyChart: 开始加载数据', {
        userId,
        selectedMetric,
        timestamp: new Date().toISOString()
      });

      setIsLoading(true);
      try {
        let data;

        // 首先尝试从 API 获取真实的事件数据
        if (userId) {
          console.log(`📊 VoiceFrequencyChart: 正在为用户 ${userId} 加载 ${selectedMetric} 数据...`);
          data = await fetchVoiceDataFromAPI(userId, selectedMetric);

          console.log('📈 VoiceFrequencyChart: API 返回的原始数据', {
            dataLength: data.length,
            data: data
          });

          if (data.length > 0) {
            console.log(`✅ VoiceFrequencyChart: 成功从事件中提取到 ${data.length} 个 ${selectedMetric} 数据点`);
            setIsDemoData(false);
          } else {
            console.log(`⚠️ VoiceFrequencyChart: 未找到包含 ${selectedMetric} 参数的事件，使用模拟数据`);
            setIsDemoData(true);
            data = generateMockData(90, selectedMetric);
          }
        } else {
          console.log('🔧 VoiceFrequencyChart: 无用户ID，使用模拟数据');
          setIsDemoData(true);
          data = generateMockData(90, selectedMetric);
        }

        console.log('📊 VoiceFrequencyChart: 最终设置的图表数据', {
          dataLength: data.length,
          isDemoData: data.length === 0 || !userId,
          sampleData: data.slice(0, 3)
        });

        setChartData(data);
      } catch (error) {
        console.error('❌ VoiceFrequencyChart: 数据加载失败:', error);
        console.log('🔧 VoiceFrequencyChart: 回退到模拟数据');
        setIsDemoData(true);
        setChartData(generateMockData(90, selectedMetric));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, selectedMetric]); // 移除 isProductionReady 依赖，因为在 API 层已经处理了

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

  const buttonClasses = "px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-300 ease-in-out border border-transparent text-gray-600";
  const activeClasses = "bg-pink-500 text-white shadow-md";
  const inactiveClasses = "hover:bg-gray-200 hover:text-gray-800";

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

      <div style={{ width: '100%', height: 350 }}>
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
          <AreaChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" unit={currentMetric?.unit} domain={['dataMin - 1', 'dataMax + 1']} />
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
