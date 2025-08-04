import React from 'react';

/**
 * @en The Home page component, serving as the main landing page for the application.
 * It provides a welcome message and primary navigation links.
 * @zh 主页组件，作为应用程序的主要着陆页。
 * 它提供欢迎信息和主要导航链接。
 * @returns {JSX.Element} The rendered home page.
 */
const Home = () => {
  return (
    <div>
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          欢迎来到嗓音记录平台
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          请登录以开始记录您的嗓音旅程，或查看公开的统计数据。
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#/dashboard"
            className="bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            查看数据汇总
          </a>
          <a href="https://github.com/lita-x/vfs-tracker" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold leading-6 text-gray-900">
            了解更多 <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div id="content-display" className="mt-12">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">功能区</h2>
          <p className="text-gray-600">
            登录后，这里将显示您的个人事件时间线。现在，您可以先浏览公开的数据汇总。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
