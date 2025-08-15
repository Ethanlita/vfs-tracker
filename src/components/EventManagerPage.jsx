import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { getEventsByUserId } from '../api';
import EventManager from './EventManager';
import { useAsync } from '../utils/useAsync.js';
import { isProductionReady as globalIsProductionReady } from '../env.js';

/**
 * @en EventManagerPage component for managing voice events
 * @zh 用于管理嗓音事件的页面组件
 */
const EventManagerPage = () => {
  const navigate = useNavigate();
  const productionReady = globalIsProductionReady();

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

  const { user: authenticatorUser } = useAuthenticatorSafe();
  const user = (productionReady && authenticatorUser) ? authenticatorUser : {
    attributes: {
      email: 'public-user@example.com',
      sub: 'mock-user-1'
    }
  };

  const [events, setEvents] = useState([]);
  // 移除独立 isLoading，使用 useAsync
  const eventsAsync = useAsync(async () => {
    if (!user?.attributes?.sub) return [];
    const userEvents = await getEventsByUserId(user.attributes.sub);
    return userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [user?.attributes?.sub]);

  useEffect(() => { if (eventsAsync.value) setEvents(eventsAsync.value); }, [eventsAsync.value]);
  const isLoading = eventsAsync.loading;
  const loadError = eventsAsync.error;
  const handleRetry = () => eventsAsync.execute();

  const handleEventUpdated = (updatedEvent) => {
    setEvents(prevEvents =>
        prevEvents.map(event =>
            event.eventId === updatedEvent.eventId ? updatedEvent : event
        )
    );
  };

  const handleEventDeleted = (eventId) => {
    setEvents(prevEvents => prevEvents.filter(event => event.eventId !== eventId));
  };

  const handleBack = () => {
    navigate('/mypage');
  };

  return (
    <div className="dashboard-container relative px-3 sm:px-0">
      {/* 装饰性背景元素 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* 页面标题 */}
      <div className="dashboard-title-section relative z-10">
        <button
          onClick={handleBack}
          className="mb-6 flex items-center text-purple-600 hover:text-purple-700 transition-colors duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回仪表板
        </button>

        <h1 className="text-4xl font-bold text-purple-600 mb-4">
          事件管理
        </h1>
        <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          查看、编辑和管理您的所有嗓音事件记录。您可以筛选、搜索和修改现有的事件数据。
        </p>
      </div>

      {/* 事件管理卡片 */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">
            <span className="dashboard-card-emoji">🗂️</span>
            我的事件记录
          </h2>
          <p className="dashboard-card-description">
            筛选、查看、编辑和删除您的事件记录。点击任何事件卡片来查看详细信息或进行编辑。
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48 space-x-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500"></div>
            <span className="text-xl text-gray-600 font-medium">正在加载事件...</span>
          </div>
        ) : loadError ? (
          <div className="p-6 text-center">
            <p className="text-red-600 mb-4">加载事件失败：{loadError.message || '未知错误'}</p>
            <button onClick={handleRetry} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm">重试</button>
          </div>
        ) : (
          <EventManager
            events={events}
            onEventUpdated={handleEventUpdated}
            onEventDeleted={handleEventDeleted}
            isProductionReady={globalIsProductionReady}
          />
        )}
      </div>
    </div>
  );
};

export default EventManagerPage;
