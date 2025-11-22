import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventsByUserId } from '../api';
import VoiceFrequencyChart from './VoiceFrequencyChart';
import InteractiveTimeline from './InteractiveTimeline';
import { useAsync } from '../utils/useAsync.js';
import { getUserDisplayName } from '../utils/avatar.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import PendingSyncButton from './PendingSyncButton.jsx';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

/**
 * @en The MyPage component serves as the user's personal dashboard. It fetches,
 * displays, and manages the user's voice events. It includes a form to add new
 * events and a timeline to view existing ones.
 * @zh MyPage 组件作为用户的个人仪表板。它获取、显示和管理用户的嗓音事件。
 * 它包括一个用于添加新事件的表单和一个用于查看现有事件的时间线。
 * @returns {JSX.Element} The rendered personal dashboard page.
 */
const MyPage = () => {
  // --- STATE MANAGEMENT ---
  const navigate = useNavigate();

  // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
  // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
  const { user: authContextUser, cognitoUserInfo } = useAuth();

  console.debug('📍 [验证点20] MyPage组件用户信息来源验证:', {
    source: 'AuthContext (使用Amplify v6标准API)',
    authContextUser: !!authContextUser,
    cognitoUserInfo: !!cognitoUserInfo,
    userIdFromContext: authContextUser?.userId,
    emailFromCognito: cognitoUserInfo?.email,
    nicknameFromCognito: cognitoUserInfo?.nickname,
    混合来源检查: '无 - 仅使用AuthContext'
  });

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

  console.log('🔍 MyPage: 最终用户对象 (仅来自AuthContext)', user ? {
    user,
    displayName: getUserDisplayName(user),
    hasNickname: !!user.attributes?.nickname
  } : null);

  // @en State for storing the list of user events.
  // @zh 用于存储用户事件列表的状态。
  const [events, setEvents] = useState([]);
  // 移除单独 isLoading state，改为 useAsync 管理
  const eventsAsync = useAsync(async () => {
    if (!user?.attributes?.sub) return [];
    console.log('🔍 MyPage: 开始获取用户事件', { userId: user.attributes.sub });
    const userEvents = await getEventsByUserId(user.attributes.sub);
    console.log('📊 MyPage: 获取到的事件数据', {
      count: userEvents?.length || 0,
      events: userEvents,
      hasVoiceData: userEvents?.filter(e =>
        (e.type === 'self_test' || e.type === 'hospital_test') &&
        e.details?.fundamentalFrequency
      ).length || 0
    });
    return userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [user?.attributes?.sub]);

  useEffect(() => {
    if (eventsAsync.value) setEvents(eventsAsync.value);
  }, [eventsAsync.value]);

  const isLoading = eventsAsync.loading;
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
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
        <PendingSyncButton className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105" />
      </div>

      {/* 错误处理 */}
      {loadError && (
        <div className="mb-8">
          <ApiErrorNotice error={loadError} onRetry={handleRetryFetch} />
        </div>
      )}

      {/* 声音频率图表 */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">声音频率分析</h2>
          {isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
          )}
        </div>
        <VoiceFrequencyChart userId={user?.attributes?.sub} events={events} />
      </div>

      {/* 交互式时间轴 */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">事件时间轴</h2>
          {events.length > 0 && (
            <span className="text-sm text-gray-500">共 {events.length} 个事件</span>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            <span className="ml-3 text-gray-600">正在加载事件...</span>
          </div>
        ) : events.length === 0 ? (
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
    </div>
  );
};

export default MyPage;
