import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { getEncouragingMessage } from '../api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Timeline = () => {
  // AI鼓励消息状态
  const [encouragingMessage, setEncouragingMessage] = useState("持续跟踪，持续进步 ✨");
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);

  // 模拟用户数据 - 在实际应用中这些数据应该从props或context获取
  const mockUserData = {
    events: [
      { type: 'training', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'training', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { type: 'self_test', createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    voiceParameters: {
      fundamental: 125.5,
      jitter: 1.2,
      shimmer: 3.1,
      hnr: 18.7
    }
  };

  // 获取AI鼓励消息
  const fetchEncouragingMessage = async () => {
    setIsLoadingMessage(true);
    try {
      const message = await getEncouragingMessage(mockUserData);
      setEncouragingMessage(message);
    } catch (error) {
      console.error('获取AI鼓励消息失败:', error);
      // 保持默认消息
    } finally {
      setIsLoadingMessage(false);
    }
  };

  // 组件挂载时获取AI消息
  useEffect(() => {
    // 延迟2秒后获取，避免页面加载时阻塞
    const timer = setTimeout(fetchEncouragingMessage, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Mock data for the chart
  const chartData = {
    labels: ['1s', '2s', '3s', '4s', '5s', '6s', '7s'],
    datasets: [
      {
        label: '声音频率 (Hz)',
        data: [120, 122, 118, 125, 123, 128, 126],
        fill: false,
        backgroundColor: 'rgb(219, 39, 119)',
        borderColor: 'rgba(219, 39, 119, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 14,
            family: 'Inter, sans-serif'
          },
          color: '#374151',
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: '声音频率分析',
        font: {
          size: 18,
          weight: 'bold',
          family: 'Inter, sans-serif'
        },
        color: '#1f2937',
        padding: {
          bottom: 30
        }
      },
    },
    scales: {
      x: {
        grid: {
          color: '#f3f4f6',
          borderDash: [2, 2]
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12
          }
        }
      },
      y: {
        grid: {
          color: '#f3f4f6',
          borderDash: [2, 2]
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12
          }
        }
      }
    },
    elements: {
      point: {
        radius: 6,
        hoverRadius: 8,
        borderWidth: 2
      },
      line: {
        tension: 0.4,
        borderWidth: 3
      }
    }
  };

  // Mock data for actions
  const actions = {
    '今天': [
      { time: '14:30', description: '完成了一次声音训练' },
      { time: '10:15', description: '更新了个人资料' },
    ],
    '昨天': [
      { time: '16:45', description: '进行了 15 分钟的发声练习' },
      { time: '09:00', description: '创建了账户' },
    ],
  };

  return (
    <div className="timeline-container">
      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="timeline-title-section">
          <h1 className="text-4xl font-bold text-pink-600 mb-2">
            欢迎来到VFS Tracker！
          </h1>
          <p className="text-gray-600 text-lg">这里是你的足迹</p>
        </div>

        {/* Two Cards Layout - Responsive */}
        <div className="timeline-cards-wrapper">
          {/* Chart Section */}
          <div className="timeline-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">
                <span className="dashboard-card-emoji">📊</span>
                声音频率图表
              </h2>
              <p className="dashboard-card-description">查看您的声音基频随时间的变化</p>
            </div>
            <div className="h-[500px] relative">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl opacity-50"></div>
              <div className="relative z-10 h-full">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="timeline-card">
            <div className="dashboard-card-header">
              <h2 className="dashboard-card-title">
                <span className="dashboard-card-emoji">📈</span>
                我的动态
              </h2>
              <p className="dashboard-card-description">记录您的声音训练历程</p>
            </div>
            <div className="space-y-8 overflow-y-auto max-h-[500px] pr-2">
              {Object.entries(actions).map(([day, dayActions]) => (
                <div key={day} className="relative">
                  {/* Day Header */}
                  <div className="sticky top-0 z-20 mb-6 bg-white/80 backdrop-blur-sm py-2 -mx-2 px-2 rounded-lg">
                    <div className="inline-block bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-full shadow-lg">
                      <h3 className="text-lg font-semibold">{day}</h3>
                    </div>
                  </div>

                  {/* Timeline Line */}
                  <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-indigo-300"></div>

                  {/* Actions */}
                  <div className="space-y-4 ml-4">
                    {dayActions.map((action, index) => (
                      <div key={index} className="relative group/action">
                        {/* Timeline Dot */}
                        <div className="absolute left-4 top-4 w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-lg transform group-hover/action:scale-125 transition-transform duration-200"></div>

                        {/* Action Card */}
                        <div className="ml-12 bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg hover:shadow-xl hover:bg-white/90 transition-all duration-300 transform hover:-translate-y-1">
                          <div className="flex items-center space-x-4">
                            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-2 rounded-lg">
                              <span className="font-mono text-sm font-semibold text-blue-700">{action.time}</span>
                            </div>
                            <div className="flex-1">
                              <span className="text-gray-700 text-lg">{action.description}</span>
                            </div>
                            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center opacity-0 group-hover/action:opacity-100 transition-opacity duration-200">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - AI助手对话框 */}
        <div className="ai-assistant-container">
          <div className="ai-assistant-wrapper">
            {/* AI助手头像 */}
            <div className="ai-assistant-avatar">
              <img
                src="/img.png"
                alt="AI助手头像"
                className="w-12 h-12 rounded-full object-cover"
                style={{width: '57px', height: '57px', borderRadius: '50%', objectFit: 'cover'}}
              />
            </div>

            {/* 对话框主体 */}
            <div className="ai-assistant-message">
              <p className="ai-assistant-text">
                {isLoadingMessage ? '加载中...' : encouragingMessage}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
