import React, { useState, useMemo } from 'react';
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

const EnhancedDataCharts = ({ allEvents = [] }) => {
  const [chartType, setChartType] = useState('training'); // 'training', 'non-training', 'vfs-only'
  const [vfsFilter, setVfsFilter] = useState('all'); // 'all', 'doctor', 'method'
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');

  // 提取所有医生和手术方法
  const { doctors, surgeryMethods } = useMemo(() => {
    const doctorSet = new Set();
    const methodSet = new Set();

    allEvents.forEach(event => {
      if (event.type === 'surgery' && event.details) {
        if (event.details.doctor) doctorSet.add(event.details.doctor);
        if (event.details.customDoctor) doctorSet.add(event.details.customDoctor);
        // 这里可以添加手术方法的提取逻辑，目前mock数据中没有这个字段
      }
    });

    return {
      doctors: Array.from(doctorSet).filter(d => d),
      surgeryMethods: Array.from(methodSet).filter(m => m)
    };
  }, [allEvents]);

  // 生成图表数据
  const chartData = useMemo(() => {
    let filteredEvents = allEvents;

    // 根据图表类型过滤事件
    if (chartType === 'training') {
      filteredEvents = allEvents.filter(event =>
        event.type === 'voice_training' || event.type === 'self_practice'
      );
    } else if (chartType === 'non-training') {
      filteredEvents = allEvents.filter(event =>
        event.type !== 'voice_training' && event.type !== 'self_practice'
      );
    } else if (chartType === 'vfs-only') {
      filteredEvents = allEvents.filter(event => event.type === 'surgery');

      // 应用VFS过滤器
      if (vfsFilter === 'doctor' && selectedDoctor) {
        filteredEvents = filteredEvents.filter(event =>
          event.details?.doctor === selectedDoctor ||
          event.details?.customDoctor === selectedDoctor
        );
      } else if (vfsFilter === 'method' && selectedMethod) {
        filteredEvents = filteredEvents.filter(event =>
          event.details?.surgeryMethod === selectedMethod
        );
      }
    }

    if (filteredEvents.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: '无数据',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
        }]
      };
    }

    // 按用户分组
    const userEvents = {};
    filteredEvents.forEach(event => {
      if (!userEvents[event.userId]) {
        userEvents[event.userId] = [];
      }
      userEvents[event.userId].push(event);
    });

    const colors = [
      'rgb(255, 99, 132)',
      'rgb(54, 162, 235)',
      'rgb(255, 205, 86)',
      'rgb(75, 192, 192)',
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)'
    ];

    // 计算对齐的天数
    let maxDays = 0;
    const userDatasets = Object.entries(userEvents).map(([userId, events], index) => {
      // 按日期排序
      events.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

      let referenceDate;
      if (chartType === 'training') {
        // 以第一次训练为第0天
        referenceDate = new Date(events[0].date || events[0].createdAt);
      } else {
        // 以第一次事件为第0天
        referenceDate = new Date(events[0].date || events[0].createdAt);
      }

      const dataPoints = events
        .filter(event =>
          (event.type === 'self_test' || event.type === 'hospital_test') &&
          event.details?.fundamentalFrequency
        )
        .map(event => {
          const eventDate = new Date(event.date || event.createdAt);
          const daysDiff = Math.floor((eventDate - referenceDate) / (1000 * 60 * 60 * 24));
          return {
            x: daysDiff,
            y: event.details.fundamentalFrequency
          };
        });

      if (dataPoints.length > 0) {
        const maxX = Math.max(...dataPoints.map(p => p.x));
        maxDays = Math.max(maxDays, maxX);
      }

      return {
        label: `用户 ${userId.slice(-4)}`,
        data: dataPoints,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.2)'),
        fill: false,
      };
    });

    // 生成X轴标签
    const labels = [];
    for (let i = 0; i <= maxDays; i += Math.max(1, Math.floor(maxDays / 20))) {
      labels.push(`第${i}天`);
    }

    return {
      labels,
      datasets: userDatasets.filter(dataset => dataset.data.length > 0)
    };
  }, [allEvents, chartType, vfsFilter, selectedDoctor, selectedMethod]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: chartType === 'training' ? '训练数据图表（以第一次训练为第0天对齐）' :
              chartType === 'non-training' ? '非训练数据图表（以第一次事件为第0天对齐）' :
              '手术数据图表���VFS）',
      },
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: '天数'
        }
      },
      y: {
        title: {
          display: true,
          text: '声音基频 (Hz)'
        }
      }
    },
  };

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">图表设置</h3>

        {/* 图表类型选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            图表类型
          </label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="training">训练数据（以第一次训练为第0天对齐）</option>
            <option value="non-training">非训练数据（以第一次事件为第0天对齐）</option>
            <option value="vfs-only">VFS手术数据</option>
          </select>
        </div>

        {/* VFS过滤选项 */}
        {chartType === 'vfs-only' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                过滤方式
              </label>
              <select
                value={vfsFilter}
                onChange={(e) => {
                  setVfsFilter(e.target.value);
                  setSelectedDoctor('');
                  setSelectedMethod('');
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="all">显示所有</option>
                <option value="doctor">按医生过滤</option>
                <option value="method">��手术方法过滤</option>
              </select>
            </div>

            {vfsFilter === 'doctor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择医生
                </label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">请选择医生</option>
                  {doctors.map(doctor => (
                    <option key={doctor} value={doctor}>{doctor}</option>
                  ))}
                </select>
              </div>
            )}

            {vfsFilter === 'method' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择手术方法
                </label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">请选择手术方法</option>
                  {surgeryMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 图表 */}
      <div className="bg-white p-4 rounded-lg border">
        <div style={{ height: '500px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* 数据统计 */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">数据统计</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">总用户数:</span>
            <span className="ml-2 font-medium">{chartData.datasets.length}</span>
          </div>
          <div>
            <span className="text-gray-500">总数据点:</span>
            <span className="ml-2 font-medium">
              {chartData.datasets.reduce((sum, dataset) => sum + dataset.data.length, 0)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">图表类型:</span>
            <span className="ml-2 font-medium">
              {chartType === 'training' ? '训练数据' :
               chartType === 'non-training' ? '非训练数据' : 'VFS手术数据'}
            </span>
          </div>
          {chartType === 'vfs-only' && vfsFilter !== 'all' && (
            <div>
              <span className="text-gray-500">过滤条件:</span>
              <span className="ml-2 font-medium">
                {vfsFilter === 'doctor' ? selectedDoctor : selectedMethod}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedDataCharts;
