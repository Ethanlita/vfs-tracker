import React from 'react';
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
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '声音频率分析',
      },
    },
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">声音频率图表</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">我的动态</h2>
        <div className="space-y-6">
          {Object.entries(actions).map(([day, dayActions]) => (
            <div key={day}>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">{day}</h3>
              <ul className="space-y-2">
                {dayActions.map((action, index) => (
                  <li key={index} className="bg-white p-3 rounded-lg shadow-sm">
                    <span className="font-mono text-sm text-gray-500 mr-4">{action.time}</span>
                    <span className="text-gray-700">{action.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;

