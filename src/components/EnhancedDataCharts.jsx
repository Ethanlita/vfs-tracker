import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { alignedChartData } from '../utils/publicChartData.js';
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
        if (event.details.surgeryMethod) methodSet.add(event.details.surgeryMethod); // 收集已有术式供筛选。
      }
    });

    return {
      doctors: Array.from(doctorSet).filter(d => d),
      surgeryMethods: Array.from(methodSet).filter(m => m)
    };
  }, [allEvents]);

  // 先选择训练/手术队列，再保留同一用户完整测量数据。
  const chartData = useMemo(() => alignedChartData(allEvents, {
    mode: chartType,
    doctor: vfsFilter === 'doctor' ? selectedDoctor : '',
    method: vfsFilter === 'method' ? selectedMethod : ''
  }), [allEvents, chartType, vfsFilter, selectedDoctor, selectedMethod]);
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
              '手术数据图表（VFS）',
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
                <option value="method">按手术方法过滤</option>
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
