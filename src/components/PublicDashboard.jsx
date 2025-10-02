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
import { getAllEvents, getUserPublicProfile } from '../api';
import { useAsync } from '../utils/useAsync.js';
import EnhancedDataCharts from './EnhancedDataCharts.jsx';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

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

// Helper function to calculate date difference in days
const diffInDays = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
};

// Helper to safely parse numeric values
const parseNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const PublicDashboard = () => {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [stats, setStats] = useState({
    avgImprovement: 0,
    variance: 0,
    doubleVariance: 0,
    usedUsers: 0,
  });

  // 使用useAsync钩子获取所有公开事件
  const eventsAsync = useAsync(getAllEvents);
  const allEventsState = eventsAsync.value || [];

  // 计算用户列表和统计数据
  const { usersList, totalEvents, totalUsers } = useMemo(() => {
    if (!allEventsState.length) return { usersList: [], totalEvents: 0, totalUsers: 0 };

    const userMap = new Map();

    allEventsState.forEach(e => {
      if (!userMap.has(e.userId)) {
        userMap.set(e.userId, {
          userId: e.userId,
          userName: e.userName || '（非公开）', // 使用API返回的用户名
          eventCount: 0
        });
      }
      const user = userMap.get(e.userId);
      user.eventCount += 1;
    });

    return {
      usersList: Array.from(userMap.values()).sort((a, b) => b.eventCount - a.eventCount),
      totalEvents: allEventsState.length,
      totalUsers: userMap.size
    };
  }, [allEventsState]);

  // 选中用户的数据
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return usersList.find(u => u.userId === selectedUserId);
  }, [selectedUserId, usersList]);

  // 当选择用户时，获取用户的公开资料
  useEffect(() => {
    if (selectedUserId) {
      getUserPublicProfile(selectedUserId)
        .then(profile => {
          setSelectedUserProfile(profile);
        })
        .catch(error => {
          console.error('获取用户公开资料失败:', error);
          setSelectedUserProfile(null);
        });
    } else {
      setSelectedUserProfile(null);
    }
  }, [selectedUserId]);

  // Bar chart data
  const barChartData = useMemo(() => {
    if (!allEventsState.length) return null;

    const typeCount = {};
    const typeNameMap = {
      'self_test': '自我测试',
      'hospital_test': '医院检测',
      'voice_training': '嗓音训练',
      'self_practice': '自我练习',
      'surgery': 'VFS手术',
      'feeling_log': '感受记录'
    };

    allEventsState.forEach(e => {
      const typeName = typeNameMap[e.type] || e.type;
      typeCount[typeName] = (typeCount[typeName] || 0) + 1;
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
          'rgba(168, 85, 247, 0.8)',
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
    Object.values(userGroups).forEach((events, index) => {
      const vfsEvent = events.find(e => e.type === 'surgery');
      if (!vfsEvent) return;

      const frequencyEvents = events
        .map(e => {
          const freq = parseNumber(e.details?.fundamentalFrequency);
          return freq !== null
            ? { x: diffInDays(e.date, vfsEvent.date), y: freq }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.x - b.x);

      if (frequencyEvents.length > 0) {
        const userName = events[0]?.userName || `用户 ${index + 1}`;
        datasets.push({
          label: userName,
          data: frequencyEvents,
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
      const vfsEvent = events.find(e => e.type === 'surgery');
      if (!vfsEvent) return;

      const freqEvents = events
        .map(e => {
          const freq = parseNumber(e.details?.fundamentalFrequency);
          return freq !== null ? { date: e.date, freq } : null;
        })
        .filter(Boolean);

      const before = freqEvents
        .filter(e => diffInDays(e.date, vfsEvent.date) < 0)
        .map(e => e.freq);
      const after = freqEvents
        .filter(e => diffInDays(e.date, vfsEvent.date) > 0)
        .map(e => e.freq);

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

  // 选中用户的事件数据
  const userEvents = useMemo(() => {
    if (!selectedUserId) return [];
    return allEventsState
      .filter((e) => e.userId === selectedUserId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedUserId, allEventsState]);

  // 选中用户的资料信息
  const userProfileInfo = useMemo(() => {
    if (!selectedUserId || !userEvents.length) return null;

    const firstDate = userEvents[0]?.date;
    const lastDate = userEvents[userEvents.length - 1]?.date;
    const vfsAnchor = userEvents.find((e) => e.type === 'surgery')?.date || null;
    const frequencyEvents = userEvents
      .map(e => {
        const freq = parseNumber(e.details?.fundamentalFrequency);
        return freq !== null ? { date: e.date, freq } : null;
      })
      .filter(Boolean);

    let avgBefore = null;
    let avgAfter = null;
    if (vfsAnchor && frequencyEvents.length) {
      const before = frequencyEvents
        .filter((e) => diffInDays(e.date, vfsAnchor) < 0)
        .map((e) => e.freq);
      const after = frequencyEvents
        .filter((e) => diffInDays(e.date, vfsAnchor) > 0)
        .map((e) => e.freq);
      const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
      avgBefore = mean(before);
      avgAfter = mean(after);
    }

    return {
      eventsCount: userEvents.length,
      firstDate,
      lastDate,
      hasVFS: Boolean(vfsAnchor),
      avgBefore,
      avgAfter,
    };
  }, [selectedUserId, userEvents]);

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
      <div className="p-10">
        <ApiErrorNotice error={error} onRetry={eventsAsync.execute} />
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
            <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl border-l border-gray-200 flex flex-col">
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

              <div className="px-6 py-4 overflow-y-auto flex-1">
                {/* 公开资料信息 */}
                {selectedUserProfile && (
                  <div className="mb-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">公开资料</h4>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <span className="text-sm text-gray-500">姓名：</span>
                          <span className="text-sm text-gray-900">{selectedUserProfile.profile?.name || '（非公开）'}</span>
                        </div>
                        {selectedUserProfile.profile?.bio && (
                          <div>
                            <span className="text-sm text-gray-500">个人简介：</span>
                            <span className="text-sm text-gray-900">{selectedUserProfile.profile.bio}</span>
                          </div>
                        )}
                        {selectedUserProfile.profile?.socials && selectedUserProfile.profile.socials.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-500">社交媒体：</span>
                            <div className="mt-1 space-y-1">
                              {selectedUserProfile.profile.socials.map((social, index) => (
                                <div key={index} className="text-sm text-gray-900">
                                  <span className="font-medium">{social.platform}:</span> {social.handle}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 统计信息 */}
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

                {/* 详细事件列表 */}
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-3">事件详情</h4>
                  <div className="space-y-4">
                    {userEvents.map((event, index) => (
                      <div key={event.eventId || index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">
                              {event.type === 'hospital_test'
                                ? '医院检测'
                                : event.type === 'self_test'
                                ? '自我测试'
                                : event.type === 'voice_training'
                                ? '嗓音训练'
                                : event.type === 'self_practice'
                                ? '自我练习'
                                : event.type === 'surgery'
                                ? 'VFS手术'
                                : event.type === 'feeling_log'
                                ? '感受记录'
                                : event.type}
                            </h5>
                            <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            已审核
                          </span>
                        </div>

                        {/* 事件详细信息 */}
                        {event.details && (
                          <div className="mt-3 space-y-2">
                            {/* 基频信息 */}
                            {event.details.fundamentalFrequency && (
                              <div className="text-sm">
                                <span className="text-gray-500">基频：</span>
                                <span className="text-gray-900 font-medium">{event.details.fundamentalFrequency} Hz</span>
                              </div>
                            )}

                            {/* 声音质量 */}
                            {event.details.sound && (
                              <div className="text-sm">
                                <span className="text-gray-500">声音质量：</span>
                                <span className="text-gray-900">{Array.isArray(event.details.sound) ? event.details.sound.join(', ') : event.details.sound}</span>
                                {event.details.customSoundDetail && (
                                  <span className="text-gray-700"> ({event.details.customSoundDetail})</span>
                                )}
                              </div>
                            )}

                            {/* 发音方式 */}
                            {event.details.voicing && (
                              <div className="text-sm">
                                <span className="text-gray-500">发音方式：</span>
                                <span className="text-gray-900">{Array.isArray(event.details.voicing) ? event.details.voicing.join(', ') : event.details.voicing}</span>
                                {event.details.customVoicingDetail && (
                                  <span className="text-gray-700"> ({event.details.customVoicingDetail})</span>
                                )}
                              </div>
                            )}

                            {/* 训练内容 */}
                            {event.details.trainingContent && (
                              <div className="text-sm">
                                <span className="text-gray-500">训练内容：</span>
                                <span className="text-gray-900">{event.details.trainingContent}</span>
                              </div>
                            )}

                            {/* 练习内容 */}
                            {event.details.practiceContent && (
                              <div className="text-sm">
                                <span className="text-gray-500">练习内容：</span>
                                <span className="text-gray-900">{event.details.practiceContent}</span>
                              </div>
                            )}

                            {/* 医生信息 */}
                            {event.details.doctor && (
                              <div className="text-sm">
                                <span className="text-gray-500">医生：</span>
                                <span className="text-gray-900">{event.details.doctor}</span>
                                {event.details.customDoctor && (
                                  <span className="text-gray-700"> ({event.details.customDoctor})</span>
                                )}
                              </div>
                            )}

                            {/* 地点信息 */}
                            {event.details.location && (
                              <div className="text-sm">
                                <span className="text-gray-500">地点：</span>
                                <span className="text-gray-900">{event.details.location}</span>
                                {event.details.customLocation && (
                                  <span className="text-gray-700"> ({event.details.customLocation})</span>
                                )}
                              </div>
                            )}

                            {/* 指导老师 */}
                            {event.details.instructor && (
                              <div className="text-sm">
                                <span className="text-gray-500">指导老师：</span>
                                <span className="text-gray-900">{event.details.instructor}</span>
                              </div>
                            )}

                            {/* 声音状态 */}
                            {event.details.voiceStatus && (
                              <div className="text-sm">
                                <span className="text-gray-500">声音状态：</span>
                                <span className="text-gray-900">{event.details.voiceStatus}</span>
                              </div>
                            )}

                            {/* 感受记录 */}
                            {event.details.feelings && (
                              <div className="text-sm">
                                <span className="text-gray-500">感受：</span>
                                <span className="text-gray-900">{event.details.feelings}</span>
                              </div>
                            )}

                            {/* 感受日志内容 */}
                            {event.details.content && (
                              <div className="text-sm">
                                <span className="text-gray-500">内容：</span>
                                <span className="text-gray-900">{event.details.content}</span>
                              </div>
                            )}

                            {/* 备注 */}
                            {event.details.notes && (
                              <div className="text-sm">
                                <span className="text-gray-500">备注：</span>
                                <span className="text-gray-900">{event.details.notes}</span>
                              </div>
                            )}

                            {/* 其他音频参数 */}
                            <div className="grid grid-cols-2 gap-4 mt-3">
                              {event.details.formants && (
                                <div className="text-xs">
                                  <span className="text-gray-500">共振峰：</span>
                                  <div className="text-gray-900">
                                    {Object.entries(event.details.formants).map(([key, value]) => (
                                      <div key={key}>{key.toUpperCase()}: {value} Hz</div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {event.details.pitch && (
                                <div className="text-xs">
                                  <span className="text-gray-500">音调范围：</span>
                                  <div className="text-gray-900">
                                    最高: {event.details.pitch.max} Hz<br/>
                                    最低: {event.details.pitch.min} Hz
                                  </div>
                                </div>
                              )}

                              {event.details.jitter !== undefined && (
                                <div className="text-xs">
                                  <span className="text-gray-500">频率变异：</span>
                                  <span className="text-gray-900">{event.details.jitter}</span>
                                </div>
                              )}

                              {event.details.shimmer !== undefined && (
                                <div className="text-xs">
                                  <span className="text-gray-500">振幅变异：</span>
                                  <span className="text-gray-900">{event.details.shimmer}</span>
                                </div>
                              )}

                              {event.details.hnr !== undefined && (
                                <div className="text-xs">
                                  <span className="text-gray-500">谐波噪音比：</span>
                                  <span className="text-gray-900">{event.details.hnr}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
