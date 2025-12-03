import { Link } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * 404 页面组件
 * @en 404 Not Found page component
 * @zh 当用户访问不存在的路由时显示此页面
 * 
 * 功能特性：
 * - 显示友好的 404 错误信息
 * - 提供返回首页和公共仪表板的快捷链接
 * - 添加 noindex meta 标签，告诉搜索引擎不要索引此页面
 * 
 * @returns {JSX.Element} 404 页面组件
 */
function NotFoundPage() {
  useEffect(() => {
    // 动态添加 noindex meta 标签，告诉搜索引擎不要索引这个页面
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);

    // 组件卸载时移除 meta 标签
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-4">
        {/* 大号 404 标题 */}
        <h1 className="text-9xl font-bold text-gray-200 select-none">404</h1>
        
        {/* 错误提示文字 */}
        <p className="mt-4 text-2xl font-semibold text-gray-700">
          页面不存在
        </p>
        <p className="mt-2 text-gray-500">
          您访问的页面可能已被移动或删除
        </p>
        
        {/* 导航按钮 */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
          >
            返回首页
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            查看公共仪表板
          </Link>
        </div>
        
        {/* 额外帮助信息 */}
        <p className="mt-8 text-sm text-gray-400">
          如果您认为这是一个错误，请
          <a 
            href="https://github.com/Ethanlita/vfs-tracker/issues" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-pink-500 hover:underline ml-1"
          >
            反馈问题
          </a>
        </p>
      </div>
    </div>
  );
}

export default NotFoundPage;
