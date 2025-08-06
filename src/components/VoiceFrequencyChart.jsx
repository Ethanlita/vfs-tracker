import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

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


// --- Sub-components ---

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-4 bg-gray-800 bg-opacity-80 backdrop-blur-sm text-white rounded-lg shadow-xl border border-gray-700">
        <p className="label text-sm font-bold">{`日期 : ${label}`}</p>
        <p className="intro text-lg">{`数值 : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const ChartCard = ({ title, children }) => (
  <div className="relative w-full h-full p-1 bg-gradient-to-br from-slate-50 via-white to-slate-100 rounded-2xl shadow-inner-lg border border-gray-200/80">
    <div className="absolute -top-px -left-px -right-px h-16 bg-gradient-to-b from-white to-transparent rounded-t-2xl"></div>
    <div className="relative w-full h-full p-6 bg-white/70 backdrop-blur-sm rounded-xl border border-white/80">
      <h3 className="text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  </div>
);

const StatusIndicator = ({ isDemo, isLoading }) => (
    <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
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
      setIsLoading(true);
      let data;
      // FIX: Correctly call the function to check the environment
      if (isProductionReady()) {
        data = await fetchRealData(userId, selectedMetric, activeRange);
        if (data.length === 0) {
          setIsDemoData(true);
          data = generateMockData(90, selectedMetric); // Fallback to mock data
        } else {
          setIsDemoData(false);
        }
      } else {
        setIsDemoData(true);
        data = generateMockData(90, selectedMetric);
      }
      setChartData(data);
      setIsLoading(false);
    };
    loadData();
    // This effect should re-run when the user or selected metric changes.
    // The time range is handled by the filtering logic below, not by re-fetching.
  }, [userId, selectedMetric, isProductionReady]);

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

  return (
    <ChartCard title="声音频率时间轴">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        {/* Metric Selection */}
        <div className="flex flex-wrap items-center bg-gray-100 p-1.5 rounded-full">
          {metrics.map(metric => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${
                selectedMetric === metric.key
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>

        {/* Time Range Selection */}
        <div className="flex items-center bg-gray-100 p-1.5 rounded-full">
          {timeRanges.map(range => (
            <button
              key={range.key}
              onClick={() => setActiveRange(range.key)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${
                activeRange === range.key
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
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
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" unit={currentMetric?.unit} domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex justify-between items-center border-t border-gray-200 pt-4">
        <StatusIndicator isDemo={isDemoData} isLoading={isLoading} />
        <div className="flex space-x-6 text-right">
            <div>
                <p className="text-sm text-gray-500">最新值</p>
                <p className="text-xl font-semibold text-gray-800">{latestValue} <span className="text-sm font-normal text-gray-500">{currentMetric?.unit}</span></p>
            </div>
            <div>
                <p className="text-sm text-gray-500">平均值</p>
                <p className="text-xl font-semibold text-gray-800">{averageValue} <span className="text-sm font-normal text-gray-500">{currentMetric?.unit}</span></p>
            </div>
        </div>
      </div>
    </ChartCard>
  );
};

export default VoiceFrequencyChart;
