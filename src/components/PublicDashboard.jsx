import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getAllEvents } from '../api';

// @en Register the necessary components for Chart.js.
// @zh 为 Chart.js 注册必要的组件。
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * @en The PublicDashboard component displays aggregated and anonymized data from all users.
 * It includes summary statistics and a bar chart showing the distribution of event types.
 * This component is publicly accessible.
 * @zh PublicDashboard 组件显示来自所有用户的聚合和匿名数据。
 * 它包括摘要统计信息和显示事件类型分布的条形图。
 * 此组件可公开访问。
 * @returns {JSX.Element} The rendered public dashboard component.
 */
const PublicDashboard = () => {
  // --- STATE MANAGEMENT ---
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  // --- DATA FETCHING AND PROCESSING ---
  useEffect(() => {
    /**
     * @en Fetches all public events, processes the data for display, and updates the component's state.
     * @zh 获取所有公共事件，处理用于显示的数据，并更新组件的状态。
     */
    const fetchAndProcessData = async () => {
      try {
        setIsLoading(true);
        // @en Fetch all events from the API.
        // @zh 从 API 获取所有事件。
        const allEvents = await getAllEvents();
        setTotalEvents(allEvents.length);

        // @en Calculate the number of unique users.
        // @zh 计算唯一用户数。
        const uniqueUsers = new Set(allEvents.map(event => event.userId));
        setTotalUsers(uniqueUsers.size);

        // @en Process data for the bar chart.
        // @zh 为条形图处理数据。
        const eventTypes = ['hospital_test', 'self_test', 'training', 'surgery'];
        const counts = eventTypes.reduce((acc, type) => {
          acc[type] = allEvents.filter(event => event.type === type).length;
          return acc;
        }, {});

        // @en Set the processed data for the chart.
        // @zh 设置图表的已处理数据。
        setChartData({
          labels: ['医院检测', '自我测试', '训练', '手术'],
          datasets: [
            {
              label: '事件数量',
              data: eventTypes.map(type => counts[type]),
              backgroundColor: 'rgba(236, 72, 153, 0.6)', // @en Pink color @zh 粉色
              borderColor: 'rgba(236, 72, 153, 1)',
              borderWidth: 1,
            },
          ],
        });
      } catch (error) {
        console.error("Failed to fetch public data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessData();
  }, []); // @en Empty dependency array means this effect runs once on mount. @zh 空依赖数组表示此效果在挂载时运行一次。

  // --- RENDER ---
  if (isLoading) {
    return <div className="text-center spacing-responsive-y">正在加载仪表板...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">公开仪表板</h1>
        <p className="mt-1 text-responsive-sm text-gray-500">
          来自所有用户的匿名数据汇总。
        </p>
      </div>

      {/* @en Summary statistics cards. @zh 摘要统计卡片。 */}
      <div className="grid-responsive">
        <div className="stats-card">
          <h3 className="text-responsive-base font-medium text-gray-500">总记录事件数</h3>
          <p className="mt-2 text-3xl font-bold text-indigo-600 sm:text-4xl">{totalEvents}</p>
        </div>
        <div className="stats-card">
          <h3 className="text-responsive-base font-medium text-gray-500">贡献用户数</h3>
          <p className="mt-2 text-3xl font-bold text-pink-600 sm:text-4xl">{totalUsers}</p>
        </div>
      </div>

      {/* @en Bar chart for event distribution. @zh 事件分布的条形图。 */}
      <div className="card">
        <h2 className="text-responsive-lg font-semibold text-gray-900 mb-4">事件分布</h2>
        {chartData ? (
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                title: {
                  display: true,
                  text: '所有用户的事件类型分布',
                  font: {
                    size: window.innerWidth < 640 ? 12 : 14
                  }
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    font: {
                      size: window.innerWidth < 640 ? 10 : 12
                    }
                  }
                },
                x: {
                  ticks: {
                    font: {
                      size: window.innerWidth < 640 ? 10 : 12
                    }
                  }
                }
              }
            }}
          />
        ) : (
          <p className="text-responsive-sm text-gray-500">无可用数据。</p>
        )}
      </div>
    </div>
  );
};

export default PublicDashboard;
