import React, { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { getEventsByUserId } from '../api';
import VoiceFrequencyChart from './VoiceFrequencyChart';
import InteractiveTimeline from './InteractiveTimeline';

// @en Check if the environment is production-ready.
// @zh 检查是否为生产环境。
const isProductionReady = () => {
  return !!(import.meta.env.VITE_COGNITO_USER_POOL_ID &&
      import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID &&
      import.meta.env.VITE_AWS_REGION);
};

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
  const productionReady = isProductionReady();
  const navigate = useNavigate();

  // @en Create a safe wrapper for useAuthenticator that doesn't throw
  // @zh 为 useAuthenticator 创建一个安全的包装器，避免抛出错误
  const useAuthenticatorSafe = () => {
    try {
      return useAuthenticator((context) => [context.user]);
    } catch (error) {
      console.log('🔧 useAuthenticator 不在 Authenticator.Provider 上下文中，使用模拟用户');
      return { user: null };
    }
  };

  // @en Always call the hook, but handle the result safely
  // @zh 始终调用 hook，但安全处理结果
  const { user: authenticatorUser } = useAuthenticatorSafe();

  // @en Use authenticated user in production, or fallback to mock user
  // @zh 在生产环境中使用已认证用户，或回退到模拟用户
  const user = (productionReady && authenticatorUser) ? authenticatorUser : {
    attributes: {
      email: 'public-user@example.com',
      sub: 'mock-user-1'
    }
  };

  // @en State for storing the list of user events.
  // @zh 用于存储用户事件列表的状态。
  const [events, setEvents] = useState([]);
  // @en State to manage the loading status while fetching data.
  // @zh 用于在获取数据时管理加载状态的状态。
  const [isLoading, setIsLoading] = useState(true);

  // --- DATA FETCHING ---
  /**
   * @en Fetches events for the current user from the API. It sorts the events
   * by creation date in descending order.
   * @zh 从 API 中为当前用户获取事件。它按创建日期降序对事件进行排序。
   */
  const fetchEvents = useCallback(async () => {
    if (!user?.attributes?.sub) {
      console.log('❌ MyPage: 没有用户ID，跳过数据获取');
      return;
    }

    console.log('🔍 MyPage: 开始获取事件数据', {
      userId: user.attributes.sub,
      isProduction: isProductionReady()
    });

    try {
      setIsLoading(true);
      const userEvents = await getEventsByUserId(user.attributes.sub);

      console.log('✅ MyPage: 成功获取事件数据', {
        eventCount: userEvents?.length || 0,
        events: userEvents
      });

      // @en Sort events by creation date, newest first.
      // @zh 按创建日期对事件进行排序，最新的在前。
      const sortedEvents = userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEvents(sortedEvents);

      console.log('📊 MyPage: 排序后的事件数据', {
        sortedCount: sortedEvents.length,
        firstEvent: sortedEvents[0]
      });
    } catch (error) {
      console.error("❌ MyPage: 获取用户事件失败:", error);
      // 在开发模式下不显示错误提示
      if (isProductionReady()) {
        alert("无法加载您的事件。请尝试重新加载页面。");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.attributes?.sub]); // @en Only depend on user ID to avoid loops. @zh 只依赖用户ID以避免循环。

  // --- EFFECTS ---
  // @en Effect to trigger fetching events when the component mounts or fetchEvents changes.
  // @zh 在组件挂载或 fetchEvents 变化时触发获取事件的 Effect。
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // --- HANDLERS ---
  // @en Navigation handlers for the action buttons
  // @zh 操作按钮的导航处理器
  const handleNavigateToAddEvent = () => {
    navigate('/add-event');
  };

  const handleNavigateToEventManager = () => {
    navigate('/event-manager');
  };

  // --- RENDER ---
  return (
      <div className="dashboard-container relative px-3 sm:px-0">
        {/* 装饰性背景元素 */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        {/* 页面标题 */}
        <div className="dashboard-title-section relative z-10">
          <h1 className="text-4xl font-bold text-pink-600 mb-4">
            我的个人仪表板
          </h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
            欢迎，{user?.attributes?.email || '用户'}！在这里您可以记录和分析您的嗓音数据。
          </p>
        </div>

        {/* 声音频率图表 */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">
              <span className="dashboard-card-emoji">📊</span>
              声音频率图表
            </h2>
            <p className="dashboard-card-description">查看您的声音基频随时间的变化</p>
          </div>
          <VoiceFrequencyChart
              userId={user?.attributes?.sub}
              isProductionReady={isProductionReady}
              compact={true} // 在手机屏幕上启用紧凑模式
          />
        </div>

        {/* 交互式时间轴 */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2 className="dashboard-card-title">
              <span className="dashboard-card-emoji">📈</span>
              我的动态时间轴
            </h2>
            <p className="dashboard-card-description">点击事件卡片查看详细信息</p>
          </div>

          {/* 使用新的时间轴组件替换旧的交互式时间轴。 */}
          <InteractiveTimeline
              events={events}
              isProductionReady={isProductionReady}
              isLoading={isLoading}
          />

          {/* 操作按钮区域 */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <button
                onClick={handleNavigateToAddEvent}
                className="group relative flex items-center justify-center sm:justify-start px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-pink-300"
              >
                <span className="text-2xl mr-3">✨</span>
                <div className="text-left">
                  <div className="font-semibold text-lg">添加新事件</div>
                  <div className="text-sm text-pink-100 opacity-90">记录您的嗓音数据</div>
                </div>
                <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>

              <button
                onClick={handleNavigateToEventManager}
                className="group relative flex items-center justify-center sm:justify-start px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300"
              >
                <span className="text-2xl mr-3">🗂️</span>
                <div className="text-left">
                  <div className="font-semibold text-lg">事件管理</div>
                  <div className="text-sm text-purple-100 opacity-90">查看和编辑记录</div>
                </div>
                <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default MyPage;