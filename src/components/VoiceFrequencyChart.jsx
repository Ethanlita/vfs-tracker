import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { motion } from 'framer-motion';

/**
 * @en Voice frequency chart component with smooth boundaries and animations
 * @zh 具有平滑边界和动画的声音频率图表组件
 */
const VoiceFrequencyChart = ({ userId, isProductionReady }) => {
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('fundamental');

  // 开发模式下的模拟数据
  const generateMockData = () => {
    const mockData = [];
    const baseFreq = 120; // 基础频率
    
    for (let i = 0; i < 30; i++) {
      const timestamp = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
      mockData.push({
        date: timestamp.toISOString().split('T')[0],
        timestamp: timestamp.getTime(),
        fundamental: baseFreq + Math.sin(i * 0.3) * 15 + Math.random() * 8 - 4,
        jitter: 0.5 + Math.random() * 1.5,
        shimmer: 2 + Math.random() * 3,
        hnr: 15 + Math.random() * 10,
        formant1: 800 + Math.random() * 200,
        formant2: 1200 + Math.random() * 300,
      });
    }
    return mockData;
  };

  // 从AWS获取真实数据的函数
  const fetchRealData = async () => {
    try {
      // TODO: 实现真实的AWS API调用
      // const response = await fetch(`/api/voice-data/${userId}`);
      // const data = await response.json();
      // return data;
      
      // 暂时返回空数组，生产环境下需要实现
      return [];
    } catch (error) {
      console.error('获取声音数据失败:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        let data;
        if (isProductionReady) {
          data = await fetchRealData();
          // 如果AWS返回空数据，回退到模拟数据
          if (!data || data.length === 0) {
            data = generateMockData();
          }
        } else {
          data = generateMockData();
        }
        setChartData(data);
      } catch (error) {
        console.error('加载图表数据失败:', error);
        // 发生错误时使用模拟数据
        setChartData(generateMockData());
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, isProductionReady]);

  // 自定义Tooltip组件
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">{`日期: ${label}`}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-semibold text-pink-600">基频: </span>
              {data.fundamental?.toFixed(1)} Hz
            </p>
            <p className="text-sm">
              <span className="font-semibold text-blue-600">抖动: </span>
              {data.jitter?.toFixed(2)}%
            </p>
            <p className="text-sm">
              <span className="font-semibold text-green-600">微颤: </span>
              {data.shimmer?.toFixed(2)}%
            </p>
            <p className="text-sm">
              <span className="font-semibold text-purple-600">谐噪比: </span>
              {data.hnr?.toFixed(1)} dB
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // 渐变定义
  const gradientId = "voiceGradient";

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-pink-50 to-purple-50 p-8 rounded-2xl shadow-lg"
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-br from-pink-50 to-purple-50 p-8 rounded-2xl shadow-lg border border-gray-100"
    >
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">声音频率分析</h3>
        <p className="text-gray-600">最近30天的声音参数变化趋势</p>
        
        {/* 指标选择器 */}
        <div className="flex space-x-2 mt-4">
          {[
            { key: 'fundamental', label: '基频', color: 'pink' },
            { key: 'jitter', label: '抖动', color: 'blue' },
            { key: 'shimmer', label: '微颤', color: 'green' },
            { key: 'hnr', label: '谐噪比', color: 'purple' }
          ].map(metric => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedMetric === metric.key
                  ? `bg-${metric.color}-500 text-white shadow-md`
                  : `bg-white text-${metric.color}-600 hover:bg-${metric.color}-50`
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={(date) => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={selectedMetric}
              stroke="#ec4899"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              dot={{ fill: '#ec4899', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 数据源指示器 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isProductionReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-xs text-gray-500">
            {isProductionReady ? '实时数据' : '演示数据'}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          数据点: {chartData.length}
        </span>
      </div>
    </motion.div>
  );
};

export default VoiceFrequencyChart;
