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

// @en Register the necessary components for Chart.js.
// @zh 为 Chart.js 注册必要的组件。
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

/**
 * @en The PublicDashboard component displays aggregated and anonymized data from all users.
 * It includes summary statistics, a user list with profile view, an event distribution bar chart,
 * and a VFS-aligned multi-user fundamental frequency line chart with statistics.
 * @zh PublicDashboard 展示所有用户的汇总数据、用户列表与档案、事件分布柱状图，
 * 以及基于 VFS 对齐的多用户基频变化折线图与统计指标。
 * @returns {JSX.Element} The rendered public dashboard component.
 */
const PublicDashboard = () => {
  // --- STATE MANAGEMENT ---
  const [barChartData, setBarChartData] = useState(null);
  const [lineChartData, setLineChartData] = useState(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersList, setUsersList] = useState([]); // [{userId, userName}]
  const [allEventsState, setAllEventsState] = useState([]);
  const [stats, setStats] = useState({
    avgImprovement: 0,
    variance: 0,
    doubleVariance: 0,
    usedUsers: 0,
  });

  // 替换局部 isProductionReady 逻辑
  const ready = globalIsProductionReady();
  const forceReal = !!import.meta.env.VITE_FORCE_REAL;

  // User profile drawer
  const [selectedUserId, setSelectedUserId] = useState(null);
  const selectedUser = useMemo(
    () => usersList.find((u) => u.userId === selectedUserId) || null,
    [selectedUserId, usersList]
  );

  // --- UTILITIES ---
  const parseDate = (d) => (d instanceof Date ? d : new Date(d));
  const diffInDays = (a, b) => {
    const A = parseDate(a).setHours(0, 0, 0, 0);
    const B = parseDate(b).setHours(0, 0, 0, 0);
    return Math.round((A - B) / (1000 * 60 * 60 * 24));
  };

  // Generate additional mock events when data is insufficient
  const generateMockEvents = (userCount = 25) => {
    const events = [];
    const now = new Date();
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randInt = (min, max) => Math.floor(rand(min, max));
    const pick = (arr) => arr[randInt(0, arr.length)];
    const names = [
      'Alex','Sam','Taylor','Jordan','Casey','Morgan','Jamie','Riley','Avery','Quinn',
      'Logan','Parker','Drew','Reese','Rowan','Emerson','Kai','Cameron','Blake','Eden',
      'Hayden','Skyler','Shawn','Noel','Robin','Kendall','Shawn','Corey','Jessie','Sage'
    ];

    for (let i = 0; i < userCount; i++) {
      const userId = `user_${Date.now()}_${i}_${randInt(1000, 9999)}`;
      const userName = `${pick(names)} ${String.fromCharCode(65 + (i % 26))}.`;
      // Anchor VFS at day 0 relative to a random date within last 120 days
      const anchor = new Date(now);
      anchor.setDate(now.getDate() - randInt(15, 120));

      // Base f0 and trend
      const base = rand(105, 190);
      const postGain = rand(8, 28); // average improvement after VFS
      const noise = () => rand(-5, 5);

      // Create measurement schedule around anchor
      const relDays = [-21, -14, -7, 0, 7, 14, 21, 28];
      relDays.forEach((d) => {
        const dt = new Date(anchor);
        dt.setDate(anchor.getDate() + d);
        const type = d === 0
          ? 'hospital_test'
          : d > 0
            ? pick(['self_test', 'voice_training', 'self_practice'])
            : pick(['self_test', 'voice_training', 'self_practice']);
        const f0 = d < 0 ? base + noise() : base + postGain + noise();
        events.push({
          id: `${userId}_${d}`,
          userId,
          userName,
          type,
          date: dt.toISOString(),
          pitch: Math.round(f0 * 10) / 10,
        });
      });

      // Add a surgery event randomly for some users
      if (Math.random() < 0.25) {
        const dt = new Date(anchor);
        dt.setDate(anchor.getDate() - randInt(40, 90));
        events.push({
          id: `${userId}_sx`,
          userId,
          userName,
          type: 'surgery',
          date: dt.toISOString(),
        });
      }
    }
    return events;
  };

  // 使用 useAsync 加载事件数据
  const eventsAsync = useAsync(async () => {
    let allEvents = await getAllEvents();

    // 计算当前的唯一用户数
    const uniqueUsers = new Set(
      (Array.isArray(allEvents) ? allEvents : []).map(e => e.userId).filter(Boolean)
    ).size;

    // 仅在事件数少于20且用户数少于5时补充模拟数据
    if (!forceReal &&
        (!Array.isArray(allEvents) || allEvents.length < 20) &&
        uniqueUsers < 5) {
      const extra = generateMockEvents(25);
      allEvents = [...(Array.isArray(allEvents) ? allEvents : []), ...extra];
    }
    return allEvents;
  }, []);

  // 根据加载结果构建派生状态
  useEffect(() => {
    if (!eventsAsync.value) return;
    const allEvents = eventsAsync.value;
    setAllEventsState(allEvents);
    setTotalEvents(allEvents.length);

    // 计算唯一用户
    const usersMap = new Map();
    allEvents.forEach((e) => {
      const userId = e.userId;
      if (!userId) return;
      if (!usersMap.has(userId)) {
        usersMap.set(userId, {
          userId,
          userName: e.userName || `用户${String(userId).slice(-4)}`,
        });
      } else {
        // Prefer a non-empty userName if found later
        const cur = usersMap.get(userId);
        if (!cur.userName && e.userName) {
          usersMap.set(userId, { ...cur, userName: e.userName });
        }
      }
    });
    const usersArr = Array.from(usersMap.values());
    setUsersList(usersArr);
    setTotalUsers(usersArr.length);

    // 构建事件分布柱状图数据
    const eventTypes = ['hospital_test', 'self_test', 'voice_training', 'self_practice', 'surgery'];
    const counts = eventTypes.reduce((acc, type) => {
      acc[type] = allEvents.filter((event) => event.type === type).length;
      return acc;
    }, {});
    setBarChartData({
      labels: ['医院检测', '自我测试', '嗓音训练', '自我练习', '手术'],
      datasets: [
        {
          label: '事件数量',
          data: eventTypes.map((type) => counts[type]),
          backgroundColor: 'rgba(236, 72, 153, 0.6)',
          borderColor: 'rgba(236, 72, 153, 1)',
          borderWidth: 1,
        },
      ],
    });

    // 构建 VFS 对齐的基频折线图数据
    const diffInDaysLocal = (a,b)=>{const A=new Date(a).setHours(0,0,0,0);const B=new Date(b).setHours(0,0,0,0);return Math.round((A-B)/(1000*60*60*24));};
    const byUser = Array.from(usersMap.keys()).map((uid) => ({
      userId: uid,
      userName: usersMap.get(uid)?.userName || `用户${String(uid).slice(-4)}`,
      events: allEvents
        .filter((e) => e.userId === uid)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    }));

    const datasets = [];
    const improvements = [];

    byUser.forEach((u, idx) => {
      // 以首个医院检测作为 VFS 锚点（若后端另有明确标识可替换）
      const anchor = u.events.find((e) => e.type === 'hospital_test')?.date;
      if (!anchor) return;

      // 只使用包含 pitch 的测量点
      const points = u.events
        .filter((e) => typeof e.pitch === 'number' && !Number.isNaN(e.pitch))
        .map((e) => ({
          x: diffInDaysLocal(e.date, anchor), // 相对天数
          y: e.pitch,
        }))
        // 保留有限且有序的点，���免重复 x
        .sort((a, b) => a.x - b.x)
        .filter((pt, i, arr) => i === 0 || pt.x !== arr[i - 1].x);

      // 要求至少两个点，且包含 anchor 前后两侧数据才能计算改善
      if (points.length < 2) return;

      // 计算统计：��后均值与提升
      const before = points.filter((p) => p.x < 0).map((p) => p.y);
      const after = points.filter((p) => p.x > 0).map((p) => p.y);
      if (before.length === 0 || after.length === 0) {
        // 无法计算改善则仅用于图表
      } else {
        const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
        const improvement = mean(after) - mean(before);
        improvements.push(improvement);
      }

      datasets.push({
        label: u.userName,
        data: points,
        borderColor: `hsl(${(idx * 53) % 360} 70% 50%)`,
        backgroundColor: `hsl(${(idx * 53) % 360} 70% 50%)`,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.2,
      });
    });

    setLineChartData({
      datasets,
    });

    // 统计指标：平均提升、方差、二倍方差（以总体方差为准）
    if (improvements.length > 0) {
      const n = improvements.length;
      const mean =
        improvements.reduce((s, v) => s + v, 0) / n;
      const variance =
        improvements.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
      setStats({
        avgImprovement: mean,
        variance,
        doubleVariance: variance * 2,
        usedUsers: n,
      });
    } else {
      setStats({
        avgImprovement: 0,
        variance: 0,
        doubleVariance: 0,
        usedUsers: 0,
      });
    }
  }, [eventsAsync.value]);

  const isLoading = eventsAsync.loading;
  const error = eventsAsync.error;

  // --- RENDER HELPERS ---
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
  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 mb-4">加载公开仪表板失败：{error.message || '未知错误'}</p>
        <button onClick={eventsAsync.execute} className="px-4 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-500">重试</button>
      </div>
    );
  }

  return (
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
          横轴为相对日期（天），VFS 记为第 0 ��；仅展示含有 VFS 且包含基频数据的用户。
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
              parsing: false, // using {x,y} pairs
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
  );
};

export default PublicDashboard;
