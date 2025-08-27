import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventsByUserId } from '../api';
import VoiceFrequencyChart from './VoiceFrequencyChart';
import InteractiveTimeline from './InteractiveTimeline';
import { useAsync } from '../utils/useAsync.js';
import { isProductionReady as globalIsProductionReady } from '../env.js';
import { getUserDisplayName } from '../utils/avatar.js';
import { useAuth } from '../contexts/AuthContext.jsx';

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
  // @en Check if the environment is production-ready.
  // @zh 检查是否为生产环境。
  const productionReady = globalIsProductionReady();
  const navigate = useNavigate();

  // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
  // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
  const { user: authContextUser, cognitoUserInfo } = useAuth();

  console.log('📍 [验证点20] MyPage组件用户信息来源验证:', {
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
  const user = productionReady && authContextUser ? {
    attributes: {
      email: cognitoUserInfo?.email || authContextUser.attributes?.email,
      sub: authContextUser.userId,
      nickname: cognitoUserInfo?.nickname,
      name: cognitoUserInfo?.name || authContextUser.attributes?.name,
      preferred_username: authContextUser.attributes?.preferred_username,
      picture: authContextUser.attributes?.picture
    },
    username: authContextUser.username
  } : {
    attributes: {
      email: 'public-user@example.com',
      sub: 'mock-user-1',
      nickname: '开发用户',
      name: '开发用户'
    }
  };

  console.log('🔍 MyPage: 最终用户对象 (仅来自AuthContext)', {
    user,
    displayName: getUserDisplayName(user),
    hasNickname: !!user.attributes?.nickname
  });

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
      </div>

      {/* 错误处理 */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                加载数据时发生错误
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{loadError.message || '未知错误'}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleRetryFetch}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  重试
                </button>
              </div>
            </div>
          </div>
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
