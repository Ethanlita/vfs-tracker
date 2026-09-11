import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventsByUserId } from '../api';
import VoiceFrequencyChart from './VoiceFrequencyChart';
import InteractiveTimeline from './InteractiveTimeline';
import { useAsync } from '../utils/useAsync.js';
import { getUserDisplayName } from '../utils/avatar.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import PendingSyncButton from './PendingSyncButton.jsx';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/**
 * @en The MyPage component serves as the user's personal dashboard. It fetches,
 * displays, and manages the user's voice events. It includes a form to add new
 * events and a timeline to view existing ones.
 * @zh MyPage 组件作为用户的个人仪表板。它获取、显示和管理用户的嗓音事件。
 * 它包括一个用于添加新事件的表单和一个用于查看现有事件的时间线。
 * @returns {JSX.Element} The rendered personal dashboard page.
 */
const MyPage = () => {
  // 设置页面 meta 标签
  useDocumentMeta({
    title: '我的页面',
    description: '管理您的嗓音女性化训练记录，查看个人基频变化图表和事件时间线。'
  });

  // --- STATE MANAGEMENT ---
  const navigate = useNavigate();

  // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
  // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
  const {
    user: authContextUser,
    cognitoUserInfo,
    pendingProfileSetup,
    pendingProfileSyncing,
    pendingProfileError,
    pendingProfileConflict,
    retryPendingProfileSetup,
  } = useAuth();



  // @en Create user object with proper data from AuthContext (which uses Amplify v6 APIs)
  // @zh 从 AuthContext 创建用户对象（AuthContext 使用 Amplify v6 API）
  const user = authContextUser ? {
    attributes: {
      email: cognitoUserInfo?.email || authContextUser.attributes?.email,
      sub: authContextUser.userId,
      nickname: cognitoUserInfo?.nickname,
      name: cognitoUserInfo?.name || authContextUser.attributes?.name,
      preferred_username: authContextUser.attributes?.preferred_username,
    },
    username: authContextUser.username
  } : null;



  // @en State for storing the list of user events.
  // @zh 用于存储用户事件列表的状态。
  // 事件数据直接使用读取结果，避免复制状态落后于请求状态。
  // 移除单独 isLoading state，改为 useAsync 管理
  const eventsAsync = useAsync(async () => {
    if (!user?.attributes?.sub) return { userId: null, events: [] };

    const userEvents = await getEventsByUserId(user.attributes.sub);

    return { userId: user.attributes.sub, events: [...userEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
  }, [user?.attributes?.sub], { preserveValue: false });

  // 只有当前账号成功读取后才展示数据；请求中或失败时不把旧记录标成最新。
  const currentResult = eventsAsync.value?.userId === (user?.attributes?.sub || null) ? eventsAsync.value : null;
  const events = currentResult?.events || [];
  const isLoading = eventsAsync.loading || (!currentResult && !eventsAsync.error);
  const loadError = eventsAsync.error;
  const handleRetryFetch = () => eventsAsync.execute();

  // --- HANDLERS ---
  // @en Navigation handlers for the action buttons
  // @zh 操作按钮的导航处理器
  const handleNavigateToAddEvent = () => {
    navigate('/add-event');
  };

  const handleNavigateToEventManager = () => {
    navigate('/event-manager');
  };

  const handleNavigateToQuickF0Test = () => {
    navigate('/quick-f0-test');
  };

  const handleNavigateToScalePractice = () => {
    navigate('/scale-practice');
  };

  // @en Handler that jumps to the Hz-note conversion tool.
  // @zh 导航到 Hz-音符转换器的处理函数。
  const handleNavigateToNoteFrequencyTool = () => {
    navigate('/note-frequency-tool');
  };

  // --- RENDER ---
  return (
    <div className="container mx-auto min-w-0 px-2 sm:px-6 lg:px-8 py-6 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-pink-600 mb-4">
          我的个人仪表板
        </h1>
        <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          欢迎，{getUserDisplayName(user)}！在这里您可以记录和分析您的嗓音数据。
        </p>
      </div>

      {/* 操作按钮组 */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        <button
          onClick={handleNavigateToAddEvent}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105"
        >
          ✨ 添加新事件
        </button>
        <button
          onClick={handleNavigateToEventManager}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          📊 管理事件
        </button>
        <button
          onClick={() => navigate('/profile-manager')}
          className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-purple-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105"
        >
          👤 管理资料
        </button>
        <button
          onClick={() => navigate('/voice-test')}
          className="bg-gradient-to-r from-green-500 to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105"
        >
          🎤 启动嗓音测试
        </button>
        <button
          onClick={handleNavigateToQuickF0Test}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105"
        >
          ⚡ 快速基频测试
        </button>
        <button
          onClick={handleNavigateToScalePractice}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105"
        >
          🎶 音阶练习
        </button>
        <button
          onClick={handleNavigateToNoteFrequencyTool}
          className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-sky-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105"
        >
          🎼 Hz-音符转换器
        </button>
        <button
          onClick={() => navigate('/vfs-effect-preview')}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-violet-600 hover:to-fuchsia-700 transition-all duration-300 transform hover:scale-105"
        >
          🔊 VFS效果预览
        </button>
        <PendingSyncButton className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105" />
      </div>

      {(pendingProfileSetup || pendingProfileError) && (
        <section role="status" aria-label="离线资料同步状态" className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <h2 className="text-lg font-semibold">
            {pendingProfileConflict
              ? '离线资料与服务器资料有冲突'
              : pendingProfileError
                ? '离线资料尚未同步'
                : pendingProfileSyncing
                  ? '正在同步离线资料…'
                  : '资料已离线保存'}
          </h2>
          <p className="mt-1 text-sm">
            {pendingProfileConflict
              ? '服务器资料在草稿保存后发生了变化。请查看草稿，或明确选择覆盖。'
              : pendingProfileError?.message || '恢复网络后会自动同步；同步成功前草稿会保留在当前账号下。'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {pendingProfileSetup && navigator.onLine !== false && (
              <button type="button" disabled={pendingProfileSyncing} onClick={() => retryPendingProfileSetup({ overwrite: false })} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pendingProfileSyncing ? '同步中…' : '重试同步'}
              </button>
            )}
            {pendingProfileSetup && pendingProfileConflict && navigator.onLine !== false && (
              <button type="button" disabled={pendingProfileSyncing} onClick={() => retryPendingProfileSetup({ overwrite: true })} className="rounded-lg border border-red-500 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">
                使用离线草稿覆盖
              </button>
            )}
            {pendingProfileSetup && (
              <button type="button" onClick={() => navigate(`/profile-setup-wizard?returnUrl=${encodeURIComponent('/mypage')}`)} className="rounded-lg border border-amber-600 bg-white px-4 py-2 text-sm font-semibold text-amber-800">
                查看草稿
              </button>
            )}
          </div>
        </section>
      )}

      {/* 历史读取状态与成功内容互斥，空态只能来自成功响应。 */}
      {isLoading ? (
        <div role="status" className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">正在加载事件...</div>
      ) : loadError ? (
        <section aria-label="历史记录读取失败" className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">无法加载历史记录</h2>
          <ApiErrorNotice error={loadError} onRetry={handleRetryFetch} />
        </section>
      ) : <>
      {/* 声音频率图表 */}
      <div className="min-w-0 bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">声音频率分析</h2>
        </div>
        <VoiceFrequencyChart userId={user?.attributes?.sub} events={events} />
      </div>

      {/* 交互式时间轴 */}
      <div className="min-w-0 bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">事件时间轴</h2>
          {events.length > 0 && (
            <span className="text-sm text-gray-500">共 {events.length} 个事件</span>
          )}
        </div>
        {events.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">暂无事件</h3>
            <p className="mt-2 text-sm text-gray-500">开始记录您的第一个嗓音事件吧！</p>
            <div className="mt-6">
              <button
                onClick={handleNavigateToAddEvent}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700"
              >
                添加事件
              </button>
            </div>
          </div>
        ) : (
          <InteractiveTimeline events={events} />
        )}
      </div>
      </>}
    </div>
  );
};

export default MyPage;
