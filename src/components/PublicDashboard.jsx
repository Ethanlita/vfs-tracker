import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { getAllEvents } from '../api';
import { useAsync } from '../utils/useAsync.js';
import { isProductionReady as globalIsProductionReady } from '../env.js';
import EnhancedDataCharts from './EnhancedDataCharts.jsx';
/**
 * @en The PublicDashboard component displays aggregated and anonymized data from all users.
 * It includes summary statistics, a user list with profile view, an event distribution bar chart,
 * and a VFS-aligned multi-user fundamental frequency line chart with statistics.
 * @zh PublicDashboard 展示所有用户的汇总数据、用户列表与档案、事件分布柱状图，
 * 以及基于 VFS 对齐的多用户基频变化折线图与统计指标。
 * @returns {JSX.Element} The rendered public dashboard component.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const PublicDashboard = () => {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [stats, setStats] = useState({
    avgImprovement: 0,
    variance: 0,
    doubleVariance: 0,
    usedUsers: 0,
  });

  console.log('🎯 PublicDashboard: 组件渲染开始');

  const eventsAsync = useAsync(getAllEvents);
  const allEventsState = eventsAsync.value || [];

  console.log('📊 PublicDashboard: 事件数据状态', {
    loading: eventsAsync.loading,
    error: eventsAsync.error,
    eventsCount: allEventsState.length,
    events: allEventsState.slice(0, 2) // 只显示前两个事件作为预览
  });

  useEffect(() => {
    console.log('🔄 PublicDashboard: 开始获取所有事件');
    eventsAsync.execute();
  }, []);

  // Calculate date difference in days
  const diffInDays = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
  };

  // Get summary statistics
  const totalEvents = allEventsState.length;
  const totalUsers = new Set(allEventsState.map(e => e.userId)).size;

  // Get users list
  const usersList = useMemo(() => {
    const userMap = new Map();
    allEventsState.forEach(e => {
      if (!userMap.has(e.userId)) {
        userMap.set(e.userId, {
          userId: e.userId,
          userName: e.userName || 'Unknown User'
        });
      }
    });
    return Array.from(userMap.values());
  }, [allEventsState]);

  // Selected user data
  const selectedUser = selectedUserId ? usersList.find(u => u.userId === selectedUserId) : null;

  // Bar chart data
  const barChartData = useMemo(() => {
    if (!allEventsState.length) return null;

    const typeCount = {};
    allEventsState.forEach(e => {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    });

    return {
      labels: Object.keys(typeCount),
      datasets: [{
        data: Object.values(typeCount),
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      }],
    };
  }, [allEventsState]);

  // Line chart data for VFS-aligned frequency changes
  const lineChartData = useMemo(() => {
    if (!allEventsState.length) return null;

    const userGroups = {};
    allEventsState.forEach(e => {
      if (!userGroups[e.userId]) userGroups[e.userId] = [];
      userGroups[e.userId].push(e);
    });

    const datasets = [];
    Object.entries(userGroups).forEach(([userId, events], index) => {
      const vfsEvent = events.find(e => e.type === 'hospital_test');
      if (!vfsEvent) return;

      const pitchEvents = events
        .filter(e => typeof e.pitch === 'number')
        .map(e => ({
          x: diffInDays(e.date, vfsEvent.date),
          y: e.pitch
        }))
        .sort((a, b) => a.x - b.x);

      if (pitchEvents.length > 0) {
        datasets.push({
          label: `User ${index + 1}`,
          data: pitchEvents,
          borderColor: `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
          backgroundColor: `hsla(${(index * 137.5) % 360}, 70%, 50%, 0.1)`,
          tension: 0.1,
        });
      }
    });

    return datasets.length > 0 ? { datasets } : null;
  }, [allEventsState]);

  // Calculate improvement statistics
  useEffect(() => {
    if (!allEventsState.length) return;

    const userGroups = {};
    allEventsState.forEach(e => {
      if (!userGroups[e.userId]) userGroups[e.userId] = [];
      userGroups[e.userId].push(e);
    });

    const improvements = [];
    Object.values(userGroups).forEach(events => {
      const vfsEvent = events.find(e => e.type === 'hospital_test');
      if (!vfsEvent) return;

      const pitchEvents = events.filter(e => typeof e.pitch === 'number');
      const before = pitchEvents.filter(e => diffInDays(e.date, vfsEvent.date) < 0).map(e => e.pitch);
      const after = pitchEvents.filter(e => diffInDays(e.date, vfsEvent.date) > 0).map(e => e.pitch);

      if (before.length && after.length) {
        const avgBefore = before.reduce((s, v) => s + v, 0) / before.length;
        const avgAfter = after.reduce((s, v) => s + v, 0) / after.length;
        improvements.push(avgAfter - avgBefore);
      }
    });

    if (improvements.length) {
      const mean = improvements.reduce((s, v) => s + v, 0) / improvements.length;
      const variance = improvements.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / improvements.length;

      setStats({
        avgImprovement: mean,
        variance,
        doubleVariance: variance * 2,
        usedUsers: improvements.length,
      });
    } else {
      setStats({
        avgImprovement: 0,
        variance: 0,
        doubleVariance: 0,
        usedUsers: 0,
      });
    }
  }, [allEventsState]);

  const isLoading = eventsAsync.loading;
  const error = eventsAsync.error;

  // Helper functions
  const formatNumber = (v, digits = 2) =>
    Number.isFinite(v) ? Number(v).toFixed(digits) : '-';
  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return String(d);
    }
  };
  const userEvents = useMemo(() => {
    if (!selectedUserId) return [];
    return allEventsState
      .filter((e) => e.userId === selectedUserId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedUserId, allEventsState]);

  const userProfileInfo = useMemo(() => {
    if (!selectedUserId) return null;
    const events = userEvents;
    if (!events.length) return null;
    const firstDate = events[0]?.date;
    const lastDate = events[events.length - 1]?.date;
    const vfsAnchor = events.find((e) => e.type === 'hospital_test')?.date || null;
    const pitchEvents = events.filter((e) => typeof e.pitch === 'number');
    let avgBefore = null;
    let avgAfter = null;
    if (vfsAnchor && pitchEvents.length) {
      const before = pitchEvents.filter((e) => diffInDays(e.date, vfsAnchor) < 0).map((e) => e.pitch);
      const after = pitchEvents.filter((e) => diffInDays(e.date, vfsAnchor) > 0).map((e) => e.pitch);
      const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
      avgBefore = mean(before);
      avgAfter = mean(after);
    }
    return {
      eventsCount: events.length,
      firstDate,
      lastDate,
      hasVFS: Boolean(vfsAnchor),
      avgBefore,
      avgAfter,
    };
  }, [selectedUserId, userEvents]);

  // --- RENDER ---
  if (isLoading) {
    return (
      <div className="space-y-6 p-8 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-28 bg-gray-200 rounded" />
          <div className="h-28 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
        <div className="h-80 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-200 rounded" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 mb-4">加载公开仪表板失败：{error.message || '未知错误'}</p>
        <button onClick={eventsAsync.execute} className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500">重试</button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">公开仪表板</h1>
          <p className="mt-1 text-sm text-gray-500">来自所有用户的匿名数据汇总。</p>
        </div>

        {/* 摘要统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
            <h3 className="text-lg font-medium text-gray-500">总记录事件数</h3>
            <p className="mt-2 text-4xl font-bold text-indigo-600">{totalEvents}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
            <h3 className="text-lg font-medium text-gray-500">贡献用户数</h3>
            <p className="mt-2 text-4xl font-bold text-pink-600">{totalUsers}</p>
          </div>
        </div>

        {/* 统计数据卡片：VFS 前后提升与方差 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
            <h3 className="text-lg font-medium text-gray-500">VFS 后平均提升 (Hz)</h3>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{formatNumber(stats.avgImprovement, 2)}</p>
            <p className="mt-1 text-xs text-gray-400">基于 {stats.usedUsers} 名用户</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
            <h3 className="text-lg font-medium text-gray-500">提升方差</h3>
            <p className="mt-2 text-3xl font-bold text-sky-600">{formatNumber(stats.variance, 2)}</p>
            <p className="mt-1 text-xs text-gray-400">总体方差</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center">
            <h3 className="text-lg font-medium text-gray-500">二倍方差</h3>
            <p className="mt-2 text-3xl font-bold text-fuchsia-600">{formatNumber(stats.doubleVariance, 2)}</p>
            <p className="mt-1 text-xs text-gray-400">2 × Variance</p>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">用户列表</h2>
            <span className="text-sm text-gray-500">仅显示 ID 和名称</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户 ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersList.map((u) => (
                  <tr key={u.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-700 truncate max-w-[280px]">{u.userId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{u.userName}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.userId)}
                        className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600"
                      >
                        查看档案
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 增强数据图表 */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">增强数据分析</h2>
          <p className="text-sm text-gray-500 mb-6">
            更多维度的数据图表分析，包括训练数据对齐、非训练数据对齐和VFS手术数据分组分析。
          </p>
          <EnhancedDataCharts allEvents={allEventsState} />
        </div>

        {/* 事件分布柱状图 */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">事件分布</h2>
          {barChartData ? (
            <Bar
              data={barChartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  title: { display: true, text: '所有用户的事件类型分布' },
                },
                scales: {
                  y: { beginAtZero: true },
                },
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">无图表数据可用。</p>
          )}
        </div>

        {/* VFS 对齐的基频变化折线图 */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">VFS 对齐的基频变化</h2>
          <p className="text-sm text-gray-500 mb-4">
            横轴为相对日期（天），VFS 记为第 0 天；仅展示含有 VFS 且包含基频数据的用户。
          </p>
          {lineChartData && lineChartData.datasets?.length ? (
            <Line
              data={lineChartData}
              options={{
                responsive: true,
                normalized: true,
                plugins: {
                  legend: { display: true, position: 'bottom' },
                  title: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const y = ctx.parsed.y;
                        const x = ctx.parsed.x;
                        return `${ctx.dataset.label}: 第${x}天, ${y} Hz`;
                      },
                    },
                  },
                },
                parsing: false,
                scales: {
                  x: {
                    type: 'linear',
                    title: { display: true, text: '相对天数 (VFS=0)' },
                    ticks: { stepSize: 7 },
                    grid: { display: false },
                  },
                  y: {
                    title: { display: true, text: '基频 (Hz)' },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                  },
                },
                elements: {
                  line: { borderWidth: 2 },
                },
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">暂无可绘制的基频数据。</p>
          )}
        </div>

        {/* 用户档案抽屉 */}
        {selectedUser && (
          <div className="fixed inset-0 z-50">
            {/* 背景遮罩 */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSelectedUserId(null)}
            />
            {/* 抽屉面板 */}
            <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-gray-200 flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedUser.userName}</h3>
                  <p className="text-xs text-gray-500 font-mono truncate max-w-[32rem]">{selectedUser.userId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400"
                >
                  关闭
                </button>
              </div>

              <div className="px-6 py-4 overflow-y-auto">
                {/* 公开信息 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">事件总数</p>
                    <p className="mt-1 text-2xl font-semibold text-indigo-600">{userEvents.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">时间范围</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {userProfileInfo?.firstDate ? formatDate(userProfileInfo.firstDate) : '-'}
                      {' '}~{' '}
                      {userProfileInfo?.lastDate ? formatDate(userProfileInfo.lastDate) : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">是否包含 VFS</p>
                    <p className="mt-1 text-base font-medium">
                      {userProfileInfo?.hasVFS ? (
                        <span className="text-emerald-600">是</span>
                      ) : (
                        <span className="text-gray-500">否</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-500">VFS 前/后平均基频</p>
                    <p className="mt-1 text-sm text-gray-700">
                      前：{userProfileInfo?.avgBefore != null ? `${formatNumber(userProfileInfo.avgBefore)} Hz` : '-'}
                      {' '} / 后：{userProfileInfo?.avgAfter != null ? `${formatNumber(userProfileInfo.avgAfter)} Hz` : '-'}
                    </p>
                  </div>
                </div>

                {/* 时间轴 */}
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-3">时间轴</h4>
                  <ul className="space-y-3">
                    {userEvents.map((e) => (
                      <li key={e.id} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">
                              {e.type === 'hospital_test'
                                ? '医院检测'
                                : e.type === 'self_test'
                                ? '自我测试'
                                : e.type === 'voice_training'
                                ? '嗓音训练'
                                : e.type === 'self_practice'
                                ? '自我练习'
                                : e.type === 'surgery'
                                ? '手术'
                                : e.type}
                            </span>{' '}
                            <span className="text-gray-500">· {formatDate(e.date)}</span>
                          </p>
                          {typeof e.pitch === 'number' && (
                            <p className="text-xs text-gray-600 mt-0.5">基频：{e.pitch} Hz</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicDashboard;
