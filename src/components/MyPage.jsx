import React, { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getEventsByUserId } from '../api';
import EventForm from './EventForm';
import VoiceFrequencyChart from './VoiceFrequencyChart';
// import InteractiveTimeline from './InteractiveTimeline';
import NewTimeline from './NewTimeline';
import EventManager from './EventManager';

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

  // @en Always call useAuthenticator, but handle gracefully when not in Authenticator context
  // @zh 始终调用 useAuthenticator，但在非 Authenticator 上下文中优雅处理
  let authenticatorUser = null;
  let authError = null;

  try {
    const { user } = useAuthenticator((context) => [context.user]);
    authenticatorUser = user;
  } catch (error) {
    // 记录错误但不抛出，使用默认用户
    authError = error;
    console.log('🔧 useAuthenticator 不在 Authenticator.Provider 上下文中，使用模拟用户');
  }

  // @en Use authenticated user in production, or fallback to mock user
  // @zh 在生产环境中使用已认证用户，或回退到模拟用户
  const user = (productionReady && authenticatorUser && !authError) ? authenticatorUser : {
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
  /**
   * @en Callback function passed to EventForm. It adds a newly created event
   * to the top of the events list to update the UI instantly.
   * @zh 传递给 EventForm 的回调函数。它将新创建的事件添加到事件列表的顶部，以立即更新 UI。
   * @param {object} newEvent - The new event object returned from the API.
   */
  const handleEventAdded = (newEvent) => {
    // @en Add the new event to the top of the list for immediate UI feedback.
    // @zh 将新事件添加到列表顶部，以获得即时的 UI 反馈。
    setEvents(prevEvents => [newEvent, ...prevEvents]);
  };

  /**
   * @en Callback function for when an event is deleted from EventManager
   * @zh 从 EventManager 删除事件时的回调函数
   * @param {string} eventId - The ID of the deleted event
   */
  const handleEventDeleted = (eventId) => {
    setEvents(prevEvents => prevEvents.filter(event => event.eventId !== eventId));
  };

  /**
   * @en Callback function for when an event is updated from EventManager
   * @zh 从 EventManager 更新事件时的回调函数
   * @param {object} updatedEvent - The updated event object
   */
  const handleEventUpdated = (updatedEvent) => {
    setEvents(prevEvents =>
      prevEvents.map(event =>
        event.eventId === updatedEvent.eventId ? updatedEvent : event
      )
    );
  };

  // --- RENDER ---
  return (
    <div className="dashboard-container min-h-screen bg-gradient-to-br from-rose-100 via-purple-100 to-blue-100 -m-4 sm:-m-6 lg:-m-8">
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
        />
      </div>

      {/* 事件记录表单 */}
      <div className="dashboard-card">
        <h2 className="dashboard-card-title">
          <span className="dashboard-card-emoji">✨</span>
          添加新事件
        </h2>
        <EventForm onEventAdded={handleEventAdded} />
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
        <NewTimeline
          events={events}
          isProductionReady={isProductionReady}
          isLoading={isLoading}
        />
      </div>

      {/* 事件管理功能卡片 */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">
            <span className="dashboard-card-emoji">🗂️</span>
            事件管理
          </h2>
          <p className="dashboard-card-description">筛选、查看、编辑和删除您的事件记录</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48 space-x-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-500"></div>
            <span className="text-xl text-gray-600 font-medium">正在加载事件...</span>
          </div>
        ) : (
          <EventManager
            events={events}
            onEventUpdated={handleEventUpdated}
            onEventDeleted={handleEventDeleted}
            isProductionReady={isProductionReady}
          />
        )}
      </div>
    </div>
  );
};

export default MyPage;
