import React, { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { getEncouragingMessage, getEventsByUserId } from '../api';
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

  // 图表数据状态
  const [chartData, setChartData] = useState(null);
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  // 从 API 获取的事件数据状态 - 移到前面声明
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

  // 模拟用户ID - 在实际应用中应该从认证上下文获取
  const mockUserId = 'mock-user-1';

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

  // 图表配置选项
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
      // 如果没有真实数据，返回模拟数据
      return {
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

  // 获取图表数据
  const fetchChartData = useCallback(async () => {
    console.log('🔍 Timeline: 开始获取图表数据', { mockUserId });
    setIsLoadingChart(true);
    try {
      const events = await getEventsByUserId(mockUserId);
      console.log('📡 Timeline: 获取到的原始事件数据', {
        eventCount: events?.length || 0,
        events: events
      });

      const chartConfig = generateChartDataFromEvents(events);
      console.log('📊 Timeline: 生成的图表配置', chartConfig);
      setChartData(chartConfig);
    } catch (error) {
      console.error('❌ Timeline: 获取图表数据失败:', error);
      // 使用默认模拟数据
      const fallbackChart = {
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
      console.log('🔧 Timeline: 使用回退图表数据', fallbackChart);
      setChartData(fallbackChart);
    } finally {
      setIsLoadingChart(false);
    }
  }, [mockUserId]);

  // 获取AI鼓励消息
  const fetchEncouragingMessage = useCallback(async () => {
    console.log('🤖 Timeline: 开始获取AI鼓励消息');
    setIsLoadingMessage(true);
    try {
      // 使用真实的用户事件数据
      const realUserData = {
        events: timelineEvents, // 使用从API获取的真实事件数据
        voiceParameters: {
          fundamental: 125.5,
          jitter: 1.2,
          shimmer: 3.1,
          hnr: 18.7
        }
      };

      console.log('📊 Timeline: 发送给AI的真实用户数据', {
        eventCount: timelineEvents.length,
        eventTypes: timelineEvents.map(e => e.type),
        events: timelineEvents
      });

      const message = await getEncouragingMessage(realUserData);
      console.log('✅ Timeline: 获取到AI消息', message);
      setEncouragingMessage(message);
    } catch (error) {
      console.error('❌ Timeline: 获取AI鼓励消息失败:', error);
      // 保持默认消息
    } finally {
      setIsLoadingMessage(false);
    }
  }, [timelineEvents]); // 依赖于timelineEvents，确保事件数据更新时会重新获取AI消息

  // 获取时间轴事件数据
  const fetchTimelineEvents = useCallback(async () => {
    console.log('🔍 Timeline: 开始获取时间轴事件数据', { mockUserId });
    setIsLoadingTimeline(true);
    try {
      const events = await getEventsByUserId(mockUserId);
      console.log('📡 Timeline: 获取到的时间轴原始事件', {
        totalEvents: events?.length || 0,
        events: events
      });

      // 修复：扩大时间范围到最近30天，如果还是没有数据，则显示所有事件
      let recentEvents = events
        .filter(event => {
          const eventDate = new Date(event.date || event.createdAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return eventDate >= thirtyDaysAgo;
        });

      // 如果30天内没有事件，则显示所有事件（开发模式下显示 mock 数据）
      if (recentEvents.length === 0) {
        console.log('⚠️ Timeline: 30天内无事件，显示所有可用事件');
        recentEvents = events;
      }

      recentEvents = recentEvents
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)) // 最新的在前
        .slice(0, 10); // 最多显示10个事件

      console.log('⏰ Timeline: 筛选出的显示事件', {
        recentCount: recentEvents.length,
        recentEvents: recentEvents
      });

      setTimelineEvents(recentEvents);
    } catch (error) {
      console.error('❌ Timeline: 获取时间轴事件数据失败:', error);
      setTimelineEvents([]); // 设置为空数组，将使用默认数据
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [mockUserId]);

  // 组件挂载时获取数据
  useEffect(() => {
    fetchChartData();
    fetchTimelineEvents(); // 获取时间轴数据
  }, [fetchChartData, fetchTimelineEvents]);

  // 当timelineEvents更新后获取AI消息
  useEffect(() => {
    if (timelineEvents.length > 0) {
      // 延迟2秒后获取AI消息，确保事件数据已加载完成
      const timer = setTimeout(fetchEncouragingMessage, 2000);
      return () => clearTimeout(timer);
    }
  }, [timelineEvents, fetchEncouragingMessage]);

  // 从事件数据生成动态时间轴数据
  const generateTimelineActions = (events) => {
    if (!events || events.length === 0) {
      // 如果没有事件数据，返回默认的模拟数据
      return {
        '今天': [
          { time: '14:30', description: '完成了一次声音训练' },
          { time: '10:15', description: '更新了个人资料' },
        ],
        '昨天': [
          { time: '16:45', description: '进行了 15 分钟的发声练习' },
          { time: '09:00', description: '创建了账户' },
        ],
      };
    }

    // 按日期分组事件
    const groupedEvents = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 事件类型到中文描述的映射
    const eventTypeDescriptions = {
      'self_test': '进行了自我测试',
      'hospital_test': '完成了医院检测',
      'voice_training': '参加了嗓音训练',
      'self_practice': '进行了自我练习',
      'surgery': '进行了手术',
      'feeling_log': '记录了感受'
    };

    // 处理每个事件
    events.forEach(event => {
      const eventDate = new Date(event.date || event.createdAt);
      const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

      let dayKey;
      if (eventDay.getTime() === today.getTime()) {
        dayKey = '今天';
      } else if (eventDay.getTime() === yesterday.getTime()) {
        dayKey = '昨天';
      } else {
        // 对于更早的日期，使用具体日期
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

    // 按时间排序每组中的事件（最新的在前）
    Object.keys(groupedEvents).forEach(dayKey => {
      groupedEvents[dayKey].sort((a, b) => {
        // 解析时间进行比较
        const timeA = new Date(`1970-01-01 ${a.time}`);
        const timeB = new Date(`1970-01-01 ${b.time}`);
        return timeB - timeA; // 降序排列（最新的在前）
      });
    });

    return groupedEvents;
  };

  // 生成动态数据
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
      <div className="dashboard-title-section relative z-10">
        <h1 className="text-4xl font-bold text-pink-600 mb-4">
          欢迎来到VFS Tracker！
        </h1>
        <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          这里是你的足迹，记录您的嗓音康复之路
        </p>
      </div>

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

      {/* AI鼓励消息 - 聊天对话框样式 */}
      <div className="relative z-10 mb-8">
        <div className="flex justify-center">
          <div className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="relative">
              {/* AI头像 */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-gray-300 shadow-sm">
                  <img
                    src="/img.png"
                    alt="AI Assistant"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 消息气泡 */}
                <div className="relative bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-gray-200 max-w-full">
                  {/* 小尾巴 */}
                  <div className="absolute -left-2 top-3 w-0 h-0 border-r-8 border-r-white border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>

                  {/* 消息内容 */}
                  <div className="text-gray-800 leading-relaxed">
                    {isLoadingMessage ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-pulse flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-sm text-gray-500">AI正在思考...</span>
                      </div>
                    ) : (
                      <p className="text-sm sm:text-base">{encouragingMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
