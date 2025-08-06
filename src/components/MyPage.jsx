import React, { useState, useEffect, useCallback } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getEventsByUserId } from '../api';
import EventForm from './EventForm';
import VoiceFrequencyChart from './VoiceFrequencyChart';
import InteractiveTimeline from './InteractiveTimeline';

/**
 * @en The MyPage component serves as the user's personal dashboard. It fetches,
 * displays, and manages the user's voice events. It includes a form to add new
 * events and a timeline to view existing ones.
 * @zh MyPage 组件作为用户的个人仪表板。它获取、显示和管理用户的嗓音事件。
 * 它包括一个用于添加新事件的表单和一个用于查看现有事件的时间线。
 * @returns {JSX.Element} The rendered personal dashboard page.
 */
const MyPage = () => {
  // 检查是否为生产环境 - 使用函数调用
  const isProductionReady = () => {
    return !!(import.meta.env.VITE_COGNITO_USER_POOL_ID &&
             import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID &&
             import.meta.env.VITE_AWS_REGION);
  };

  // --- STATE MANAGEMENT ---
  // @en Get the authenticated user object conditionally based on production readiness.
  // @zh 根据生产环境就绪状态有条件地获取经过身份验证的用户对象。
  const authenticatorContext = isProductionReady() ? useAuthenticator((context) => [context.user]) : null;
  const user = authenticatorContext?.user || {
    attributes: {
      email: 'demo@example.com',
      sub: 'demo-user-123'
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
    if (!user?.attributes?.sub) return; // @en Don't fetch if there's no user. @zh 如果没有用户则不获取。
    try {
      setIsLoading(true);
      // @en Use user.attributes.sub for consistency with other components like EventForm.
      // @zh 与 EventForm 等其他组件保持一致，使用 user.attributes.sub。
      const userEvents = await getEventsByUserId(user.attributes.sub);
      // @en Sort events by creation date, newest first.
      // @zh 按创建日期对事件进行排序，最新的在前。
      const sortedEvents = userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEvents(sortedEvents);
    } catch (error) {
      console.error("Failed to fetch user events:", error);
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

  // --- RENDER ---
  return (
    <div className="space-y-8">
      {/* 页面标题 */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          我的个人仪表板
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          欢迎，{user?.attributes?.email || '用户'}！在这里您可以记录和分析您的嗓音数据。
        </p>
      </div>

      {/* 声音频率图表 */}
      <VoiceFrequencyChart
        userId={user?.attributes?.sub}
        isProductionReady={isProductionReady}
      />

      {/* 事件记录表单 */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">添加新事件</h2>
        <EventForm onEventAdded={handleEventAdded} />
      </div>

      {/* 交互式时间轴 */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">我的动态时间轴</h2>
          <p className="text-gray-600">点击事件卡片查看详细信息</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            <span className="ml-3 text-gray-600">正在加载事件...</span>
          </div>
        ) : (
          <InteractiveTimeline
            events={events}
            isProductionReady={isProductionReady}
          />
        )}
      </div>
    </div>
  );
};

export default MyPage;
