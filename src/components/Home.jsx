import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Timeline from './Timeline';

/**
 * @en The Home page component, serving as the main landing page for the application.
 * It provides a welcome message and primary navigation links.
 * @zh 主页组件，作为应用程序的主要着陆页。
 * 它提供欢迎信息和主要导航链接。
 * @returns {JSX.Element} The rendered home page.
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

  // If the user is authenticated, show the Timeline component.
  if (isAuthenticated) {
    return <Timeline />;
  }

  // Otherwise, show the public landing page.
  return (
    <div className="space-y-12">
      <div className="text-center spacing-responsive-y spacing-responsive-x">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl mb-6">
          欢迎来到VFS Tracker!
        </h1>
        <p className="mt-6 text-responsive-lg leading-8 text-gray-600 max-w-2xl mx-auto">
          请登录以开始记录您的嗓音旅程，或查看公开的统计数据。
        </p>
        <div className="mt-10 button-group justify-center">
          <button
            onClick={handleViewDashboard}
            className="btn-primary"
          >
            查看数据汇总
          </button>
          <button 
            onClick={handleLearnMore}
            className="text-responsive-sm font-semibold leading-6 text-gray-900 hover:text-gray-700 transition-colors duration-300 bg-transparent border-none cursor-pointer"
          >
            了解更多 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div id="content-display" className="spacing-responsive-x content-display-margin">
        <div className="card max-w-4xl mx-auto">
          <h2 className="text-responsive-lg font-bold functionality-title-margin">功能区</h2>
          <p className="text-gray-600 leading-relaxed text-responsive-base">
            登录后，这里将显示您的个人事件时间线。现在，您可以先浏览公开的数据汇总。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
