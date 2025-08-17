import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
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
import { getEncouragingMessage, getEventsByUserId } from '../api';
import { useAsync } from '../utils/useAsync.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isProductionReady } from '../env.js';
import DevModeTest from './DevModeTest.jsx';

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
  const DEFAULT_MESSAGE = "持续跟踪，持续进步 ✨";
  const { user } = useAuth();
  const isProdReady = isProductionReady();

  // 状态管理
  const [chartData, setChartData] = useState(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

  // 获取用户ID - 开发模式强制使用mock用户ID
  const getUserId = () => {
    console.log('🔍 Timeline: 环境检查', {
      isProdReady,
      hasUser: !!user,
      forceUseMockData: !isProdReady
    });

    if (!isProdReady) {
      // 开发模式：强制使用mock数据
      console.log('🔧 Timeline: 开发模式 - 使用mock用户ID');
      return 'mock-user-1';
    }

    if (user) {
      // 生产模式且有用户：使用真实用户ID
      const realUserId = user.userId || user.username || user.sub;
      console.log('✅ Timeline: 生产模式 - 使用真实用户ID', realUserId);
      return realUserId;
    }

    // 生产模式但无用户：回退到mock
    console.log('⚠️ Timeline: 生产模式但无用户 - 回退到mock用户ID');
    return 'mock-user-1';
  };

  const currentUserId = getUserId();

  // 图表配置选项
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#374151',
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: true,
        text: '声音基频分析',
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

  // 从事件数据生成图表数据
  const generateChartDataFromEvents = (events) => {
    // 筛选包含基频数据的事件
    const eventsWithFrequency = events.filter(event =>
      (event.type === 'self_test' || event.type === 'hospital_test') &&
      event.details &&
      event.details.fundamentalFrequency !== undefined
    );

    if (eventsWithFrequency.length === 0) {
      // 如果没有基频数据，返回空图表
      return {
        labels: [],
        datasets: [
          {
            label: '声音基频 (Hz)',
            data: [],
            fill: false,
            backgroundColor: 'rgb(219, 39, 119)',
            borderColor: 'rgba(219, 39, 119, 0.5)',
          },
        ],
      };
    }

    // 按日期排序并提取数据
    const sortedEvents = eventsWithFrequency
      .sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt))
      .slice(-10); // 只取最近10条记录

    const labels = sortedEvents.map((event) => {
      const date = new Date(event.date || event.createdAt);
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    });

    const data = sortedEvents.map(event => event.details.fundamentalFrequency);

    return {
      labels,
      datasets: [
        {
          label: '声音基频 (Hz)',
          data,
          fill: false,
          backgroundColor: 'rgb(219, 39, 119)',
          borderColor: 'rgba(219, 39, 119, 0.5)',
        },
      ],
    };
  };

  // 使用 useAsync 管理事件数据获取
  const eventsAsync = useAsync(async () => {
    console.log('🔍 Timeline: 开始获取事件数据', { currentUserId, user });
    const events = await getEventsByUserId(currentUserId);
    console.log('📡 Timeline: 获取到的事件数据', { eventCount: events?.length || 0 });
    return events;
  }, [currentUserId]);

  // AI 消息获取
  const aiAsync = useAsync(async () => {
    if (!timelineEvents.length) return DEFAULT_MESSAGE;

    // 构造用户数据用于AI分析
    const userData = {
      events: timelineEvents,
      voiceParameters: {} // 可以根据需要添加更多参数
    };

    try {
      return await getEncouragingMessage(userData);
    } catch (error) {
      console.error('获取AI消息失败:', error);
      return DEFAULT_MESSAGE;
    }
  }, [timelineEvents]);

  // 处理事件数据变化
  useEffect(() => {
    if (!eventsAsync.value) return;

    const events = eventsAsync.value;

    // 生成图表数据
    try {
      const chartConfig = generateChartDataFromEvents(events);
      setChartData(chartConfig);
    } catch (error) {
      console.error('生成图表失败:', error);
    }

    // 筛选最近的时间轴事件
    let recentEvents = events.filter(event => {
      const eventDate = new Date(event.date || event.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return eventDate >= thirtyDaysAgo;
    });

    // 如果30天内没有事件，则显示所有事件
    if (recentEvents.length === 0) {
      console.log('⚠️ Timeline: 30天内无事件，显示所有可用事件');
      recentEvents = events;
    }

    // 按时间排序并限制数量
    recentEvents = recentEvents
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 10);

    setTimelineEvents(recentEvents);
    setIsLoadingChart(false);
    setIsLoadingTimeline(false);
  }, [eventsAsync.value]);

  // 处理加载状态
  useEffect(() => {
    if (eventsAsync.loading) {
      setIsLoadingChart(true);
      setIsLoadingTimeline(true);
    }
    if (eventsAsync.error) {
      setIsLoadingChart(false);
      setIsLoadingTimeline(false);
    }
  }, [eventsAsync.loading, eventsAsync.error]);

  // 从事件数据生成时间轴显示数据
  const generateTimelineActions = (events) => {
    if (!events || events.length === 0) {
      return {};
    }

    // 事件类型描述映射
    const eventTypeDescriptions = {
      'self_test': '进行了自我测试',
      'hospital_test': '完成了医院检测',
      'voice_training': '参加了嗓音训练',
      'self_practice': '进行了自我练习',
      'surgery': '进行了手术',
      'feeling_log': '记录了感受'
    };

    // 按日期分组事件
    const groupedEvents = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    events.forEach(event => {
      const eventDate = new Date(event.date || event.createdAt);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

      let dayKey;
      if (eventDay.getTime() === today.getTime()) {
        dayKey = '今天';
      } else if (eventDay.getTime() === yesterday.getTime()) {
        dayKey = '昨天';
      } else {
        dayKey = eventDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
      }

      if (!groupedEvents[dayKey]) {
        groupedEvents[dayKey] = [];
      }

      const time = eventDate.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const description = eventTypeDescriptions[event.type] || '记录了一个事件';

      groupedEvents[dayKey].push({
        time,
        description,
        eventType: event.type,
        eventId: event.eventId
      });
    });

    // 按时间排序每组中的事件
    Object.keys(groupedEvents).forEach(dayKey => {
      groupedEvents[dayKey].sort((a, b) => {
        const timeA = new Date(`1970-01-01 ${a.time}`);
        const timeB = new Date(`1970-01-01 ${b.time}`);
        return timeB - timeA; // 最新的在前
      });
    });

    return groupedEvents;
  };

  // 错误处理
  const anyError = eventsAsync.error || aiAsync.error;

  const handleRetry = () => {
    eventsAsync.execute();
    aiAsync.reset();
  };

  // 生成时间轴数据
  const actions = generateTimelineActions(timelineEvents);

  return (
    <div className="dashboard-container relative px-3 sm:px-0">
      {/* 装饰性背景元素 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* 页面标题 */}
      <div className="dashboard-title-section relative z-10 pt-8 mb-8">
        <h1 className="text-4xl font-bold text-pink-600 mb-4">
          欢迎来到VFS Tracker！
        </h1>
        <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          这里是你的足迹，持续追踪，持续进步~⭐️
        </p>
      </div>

      {/* 错误提示 */}
      {anyError && (
        <div className="mb-8 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          <p className="font-semibold mb-2">数据加载失败</p>
          <p className="text-sm mb-3">{anyError?.message || '未知错误'}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-500"
          >
            重试
          </button>
        </div>
      )}

      {/* 声音频率图表卡片 */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">
            <span className="dashboard-card-emoji">📊</span>
            声音频率图表
          </h2>
          <p className="dashboard-card-description">查看您的声音基频随时间的变化</p>
        </div>
        <div className="h-96 relative">
          {isLoadingChart ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500"></div>
              <span className="ml-4 text-xl text-gray-600 font-medium">正在加载图表...</span>
            </div>
          ) : chartData ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>暂无图表数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 时间轴活动卡片 */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">
            <span className="dashboard-card-emoji">📈</span>
            最近活动
          </h2>
          <p className="dashboard-card-description">查看您最近的嗓音相关活动记录</p>
        </div>

        {isLoadingTimeline ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500"></div>
            <span className="ml-4 text-xl text-gray-600 font-medium">正在加载活动...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(actions).length > 0 ? (
              Object.keys(actions).map((day) => (
                <div key={day} className="border-l-4 border-pink-400 pl-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">{day}</h3>
                  <div className="space-y-2">
                    {actions[day].map((action, index) => (
                      <div key={index} className="flex items-center space-x-3 py-2">
                        <div className="flex-shrink-0 w-16 text-sm text-gray-500 font-mono">
                          {action.time}
                        </div>
                        <div className="flex-1 text-gray-700">
                          {action.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">暂无最近活动</p>
                <p className="text-sm mt-2">开始记录您的嗓音康复活动吧！</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI鼓励消息 */}
      <div className="relative z-10 mb-8">
        <div className="flex justify-center">
          <div className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="relative">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300 shadow-sm">
                  <img
                    src="/img.png"
                    alt="AI Assistant"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="relative bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-gray-200 max-w-full">
                  <div className="absolute -left-2 top-3 w-0 h-0 border-r-8 border-r-white border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>

                  <div className="text-gray-800 leading-relaxed">
                    {aiAsync.loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-pulse flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-500">正在加载</span>
                      </div>
                    ) : (
                      <p className="text-sm sm:text-base">{aiAsync.value}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 开发模式测试组件 - 仅在开发环境中显示 */}
      {!isProdReady && <DevModeTest />}
    </div>
  );
};

export default Timeline;
