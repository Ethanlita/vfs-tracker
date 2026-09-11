import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEventsByUserId } from '../api';
import EventManager from './EventManager';
import { useAsync } from '../utils/useAsync.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useAuth } from '../contexts/AuthContext'; // 使用AuthContext而不是直接使用useAuthenticator

/**
 * @en EventManagerPage component for viewing and deleting voice events
 * @zh 用于筛选、查看和删除嗓音事件的页面组件
 */
const EventManagerPage = () => {
  const navigate = useNavigate();

  // 使用AuthContext提供的用户信息，而不是直接使用useAuthenticator
  const { user } = useAuth();



  // 直接使用AuthContext提供的用户对象


  const [events, setEvents] = useState([]);
  // 使用AuthContext提供的用户ID
  const eventsAsync = useAsync(async () => {
    const userId = user?.userId || user?.attributes?.sub;


    if (!userId) {

      return [];
    }


    const userEvents = await getEventsByUserId(userId);


    const sortedEvents = userEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));


    return sortedEvents;
  }, [user?.userId, user?.attributes?.sub]); // 依赖AuthContext提供的用户ID

  useEffect(() => {

    if (eventsAsync.value) setEvents(eventsAsync.value);
  }, [eventsAsync.value]);

  const isLoading = eventsAsync.loading;
  const loadError = eventsAsync.error;
  const handleRetry = () => eventsAsync.execute();



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
          className="ml-4 mt-4 mb-6 flex items-center text-purple-600 hover:text-purple-700 transition-colors duration-200"
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
          筛选、搜索和查看您的嗓音事件记录，也可以删除不再需要的记录。
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
            已保存的事件不能直接编辑。如需纠正，请删除原记录后重新新增；点击事件卡片可查看详情。
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48 space-x-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-purple-500"></div>
            <span className="text-xl text-gray-600 font-medium">正在加载事件...</span>
          </div>
        ) : loadError ? (
          <div className="p-6">
            <ApiErrorNotice error={loadError} onRetry={handleRetry} />
          </div>
        ) : (
          <EventManager
            events={events}
            onEventDeleted={handleEventDeleted}
          />
        )}
      </div>
    </div>
  );
};

export default EventManagerPage;
