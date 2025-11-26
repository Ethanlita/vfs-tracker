import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Timeline from './Timeline';

/**
 * @en The Home page component, serving as the main landing page for the application.
 * @zh 主页组件，作为应用程序的主要着陆页。
 */
const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleViewDashboard = () => {
    navigate('/dashboard');
  };

  const handleLearnMore = () => {
    window.open('https://github.com/Ethanlita/vfs-tracker', '_blank', 'noopener,noreferrer');
  };

  if (isAuthenticated) {
    return <Timeline />;
  }

  return (
      <div className="space-y-12">
        <div className="text-center py-16 px-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl mb-6">
            欢迎来到VFS Tracker!
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
            请登录以开始记录您的嗓音旅程，或查看公开的统计数据。
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6 flex-wrap">
            <button
                onClick={handleViewDashboard}
                className="btn-primary mb-4 sm:mb-0"
            >
              查看数据汇总
            </button>
            <button
                onClick={handleLearnMore}
                className="text-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 transition-colors duration-300 bg-transparent border-none cursor-pointer mb-4 sm:mb-0"
            >
              了解更多 <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div id="content-display" className="px-4 mt-8">
          <div 
            className="bg-white rounded-xl shadow-md max-w-4xl mx-auto px-12 py-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/login?returnUrl=/')}
            role="button"
            tabIndex={0}
            aria-label="点击登录以查看个人事件时间线"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/login?returnUrl=/');
              }
            }}
          >
            <h2 className="text-2xl font-bold mb-8">功能区</h2>
            <p className="text-gray-600 leading-relaxed text-lg mb-6">
              点击此处登录后，这里将显示您的个人事件时间线。现在，您可以先浏览公开的数据汇总。
            </p>
          </div>
        </div>
      </div>
  );
};

export default Home;