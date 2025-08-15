import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import EventForm from './EventForm';
import { isProductionReady as globalIsProductionReady } from '../env.js';

/**
 * @en AddEvent component for adding new voice events
 * @zh 用于添加新嗓音事件的页面组件
 */
const AddEvent = () => {
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

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleEventAdded = (newEvent) => {
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
      navigate('/mypage');
    }, 2000);
  };

  const handleBack = () => {
    navigate('/mypage');
  };

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
        <button
          onClick={handleBack}
          className="mb-6 flex items-center text-pink-600 hover:text-pink-700 transition-colors duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回仪表板
        </button>

        <h1 className="text-4xl font-bold text-pink-600 mb-4">
          添加新事件
        </h1>
        <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium">
          记录您的嗓音数据和相关事件，建立完整的健康档案。
        </p>
      </div>

      {/* 成功消息 */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            事件添加成功！即将返回仪表板...
          </div>
        </div>
      )}

      {/* 事件表单卡片 */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2 className="dashboard-card-title">
            <span className="dashboard-card-emoji">✨</span>
            新建事件记录
          </h2>
          <p className="dashboard-card-description">
            填写下方表单来记录您的嗓音相关事件。您可以添加自测数据、医院检查结果、治疗记录等。
          </p>
        </div>

        <EventForm onEventAdded={handleEventAdded} />
      </div>
    </div>
  );
};

export default AddEvent;
