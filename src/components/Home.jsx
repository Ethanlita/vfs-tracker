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
          <div className="bg-white rounded-xl shadow-md max-w-4xl mx-auto px-12 py-4">
            <h2 className="text-2xl font-bold mb-8">功能区</h2>
            <p className="text-gray-600 leading-relaxed text-lg mb-6">
              登录后，这里将显示您的个人事件时间线。现在，您可以先浏览公开的数据汇总。
            </p>
            
            {/* VFS效果预览入口 */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    🎵 VFS效果预览工具
                  </h3>
                  <p className="text-gray-700 mb-4">
                    想提前感受VFS后的声音效果吗？使用我们的在线预览工具，录制您的声音并体验不同程度的音高变化。
                    <span className="text-sm text-gray-600 block mt-1">
                      （无需登录，纯浏览器本地处理，您的录音不会上传到服务器）
                    </span>
                  </p>
                  <button
                    onClick={() => navigate('/vfs-effect-preview')}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    立即体验
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Home;