/**
 * @file 管理后台仪表盘
 * 显示系统概览统计
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAWSClients } from '../contexts/AWSClientContext';
import { getStats, EVENT_TYPES } from '../services/dynamodb';

/**
 * 统计卡片组件
 */
function StatCard({ title, value, subtitle, icon, color, link }) {
  const colorClasses = {
    purple: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
    blue: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-600/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-600/20 text-red-400 border-red-500/30',
  };

  const content = (
    <div className={`rounded-xl border p-6 ${colorClasses[color]} transition-transform hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-sm mt-1 opacity-80">{subtitle}</p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-gray-800/50">
          {icon}
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link to={link}>{content}</Link>;
  }

  return content;
}

/**
 * 管理后台仪表盘页面
 */
export default function AdminDashboard() {
  const { clients } = useAWSClients();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 加载统计数据
  useEffect(() => {
    async function loadStats() {
      if (!clients) return;

      try {
        setLoading(true);
        const data = await getStats(clients.dynamoDB);
        setStats(data);
      } catch (err) {
        console.error('加载统计数据失败:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [clients]);

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">加载统计数据...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
        <h3 className="text-red-400 font-medium mb-2">加载失败</h3>
        <p className="text-red-300/80 text-sm">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">系统概览</h1>
        <p className="text-gray-400 mt-1">VFS Tracker 管理后台数据统计</p>
      </div>

      {/* 主要统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="用户总数"
          value={stats?.users.total || 0}
          icon={
            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
          color="purple"
          link="/admin/users"
        />

        <StatCard
          title="事件总数"
          value={stats?.events.total || 0}
          subtitle={`${stats?.events.pending || 0} 待审核`}
          icon={
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          color="blue"
          link="/admin/events"
        />

        <StatCard
          title="嗓音测试"
          value={stats?.tests.total || 0}
          subtitle={`${stats?.tests.done || 0} 已完成`}
          icon={
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          }
          color="green"
          link="/admin/tests"
        />

        <StatCard
          title="待处理"
          value={(stats?.events.pending || 0) + (stats?.tests.processing || 0)}
          subtitle="需要关注"
          icon={
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="yellow"
        />
      </div>

      {/* 详细统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 事件状态分布 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">事件状态分布</h2>
          <div className="space-y-4">
            {/* 已通过 */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">已通过</span>
                <span className="text-green-400">{stats?.events.approved || 0}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${stats?.events.total ? (stats.events.approved / stats.events.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* 待审核 */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">待审核</span>
                <span className="text-yellow-400">{stats?.events.pending || 0}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${stats?.events.total ? (stats.events.pending / stats.events.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 已拒绝 */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">已拒绝</span>
                <span className="text-red-400">{stats?.events.rejected || 0}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${stats?.events.total ? (stats.events.rejected / stats.events.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 事件类型分布 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">事件类型分布</h2>
          <div className="space-y-3">
            {stats?.events.byType && Object.entries(stats.events.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-gray-400">{EVENT_TYPES[type] || type}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${stats.events.total ? (count / stats.events.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-white text-sm w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 测试状态 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">嗓音测试状态</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{stats?.tests.pending || 0}</div>
            <div className="text-sm text-gray-400 mt-1">等待中</div>
          </div>
          <div className="text-center p-4 bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{stats?.tests.processing || 0}</div>
            <div className="text-sm text-gray-400 mt-1">处理中</div>
          </div>
          <div className="text-center p-4 bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{stats?.tests.done || 0}</div>
            <div className="text-sm text-gray-400 mt-1">已完成</div>
          </div>
          <div className="text-center p-4 bg-gray-700/50 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{stats?.tests.failed || 0}</div>
            <div className="text-sm text-gray-400 mt-1">失败</div>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">快捷操作</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/admin/events?status=pending"
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            审核待处理事件
          </Link>
          
          <Link
            to="/admin/tests?status=failed"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            查看失败的测试
          </Link>
        </div>
      </div>
    </div>
  );
}
