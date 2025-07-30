import React from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

/**
 * The Home page component.
 * This is the landing page for all users, providing a welcome message and navigation options.
 * @returns {JSX.Element} The rendered home page.
 */
const Home = () => {
  const { toSignIn } = useAuthenticator();

  return (
    <div>
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          欢迎来到嗓音记录平台
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          请先登录以开始记录您的嗓音旅程，或查看公开的统计数据。
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="#/dashboard"
            className="bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            查看数据汇总
          </a>
          <button
            onClick={toSignIn}
            className="text-sm font-semibold leading-6 text-gray-900"
          >
            登录以开始 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div id="content-display" className="mt-12">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-2xl font-bold mb-4">关于我们</h2>
          <p className="text-gray-600">
            VoiceFem Tracker 是一个开源项目，旨在为嗓音女性化训练和手术提供一个安全、私密且功能强大的记录工具。我们相信，通过记录和可视化数据，每个人都可以更好地了解自己的进步，并与社区分享（在自愿和匿名的前提下）宝贵的经验。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
