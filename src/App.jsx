import { useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useEffect } from 'react';

import Layout from './components/Layout';
import Auth from './components/Auth';
import MyPage from './components/MyPage';
import PublicDashboard from './components/PublicDashboard';

/**
 * @en A simple router based on the URL hash. It conditionally renders components
 * based on the hash value and user authentication status.
 * @zh 一个基于 URL哈希的简易路由器。它根据哈希值和用户认证状态来条件性地渲染组件。
 * @returns {JSX.Element} The component to be rendered for the current route.
 */
const SimpleRouter = () => {
  // Get authentication status and sign-in function from Amplify
  // 从 Amplify 获取身份验证状态和登录函数
  const { authStatus, toSignIn } = useAuthenticator((context) => [context.authStatus]);
  const hash = window.location.hash;

  // Effect to check authentication for protected routes
  // 用于检查受保护路由的身份验证的 Effect
  useEffect(() => {
    // If the user tries to access the 'mypage' route and is not authenticated, prompt them to sign in
    // 如果用户尝试访问 'mypage' 路由但未通过身份验证，则提示他们登录
    if (hash === '#/mypage' && authStatus !== 'authenticated') {
      toSignIn();
    }
  }, [hash, authStatus, toSignIn]);

  // Route for the user's personal page, protected by authentication
  // 用户个人页面的路由，受身份验证保护
  if (hash === '#/mypage') {
    if (authStatus === 'authenticated') {
      return <MyPage />;
    }
    // Display a loading message while authentication status is being checked
    // 在检查身份验证状态时显示加载消息
    return <div>Loading...</div>;
  }

  // Default view is the Public Dashboard, accessible to everyone
  // 默认视图是公共仪表板，所有人都可以访问
  return <PublicDashboard />;
};

/**
 * @en The main content container of the application. It wraps the router
 * with a consistent layout.
 * @zh 应用程序的主要内容容器。它用一个一致的布局来包裹路由器。
 * @returns {JSX.Element} The rendered application content with layout.
 */
const AppContent = () => {
  return (
    <Layout auth={<Auth />}>
      <SimpleRouter />
    </Layout>
  );
};

/**
 * @en The root component of the application.
 * @zh 应用程序的根组件。
 * @returns {JSX.Element} The main application component.
 */
function App() {
  return <AppContent />;
}

export default App;
