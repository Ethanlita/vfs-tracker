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

  // 从 API 获取的事件数据状态
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);

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

  // 生成动态数据
  const actions = generateTimelineActions(timelineEvents);

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
                {isLoadingChart ? (
                  <div className="flex items-center justify-center h-full">
                    <svg className="animate-spin h-10 w-10 text-pink-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4.293 12.293a1 1 0 011.414 0L12 18.586l6.293-6.293a1 1 0 111.414 1.414l-7 7a1 1 0 01-1.414 0l-7-7a1 1 0 010-1.414z"></path>
                    </svg>
                  </div>
                ) : (
                  <Line data={chartData} options={chartOptions} />
                )}
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
                style={{width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover'}}
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
