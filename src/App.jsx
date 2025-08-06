import { useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import Layout from './components/Layout';
import Auth from './components/Auth';
import MyPage from './components/MyPage';
import PublicDashboard from './components/PublicDashboard';
import Home from './components/Home';
import PostList from './components/PostList';
import PostViewer from './components/PostViewer';

/**
 * @en A component to protect routes that require authentication in production mode.
 * @zh 生产模式下保护需要身份验证的路由的组件。
 */
const ProductionProtectedRoute = () => {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);

  // @en While Amplify is figuring out the auth status, show a loading indicator.
  // @zh 在 Amplify 确定身份验证状态时，显示加载指示器。
  if (authStatus === 'configuring') {
    return <div>正在加载...</div>;
  }

  // @en If the user is not authenticated, redirect them to the home page.
  // @zh 如果用户未通过身份验证，则将他们重定向到主页。
  return authStatus === 'authenticated' ? <Outlet /> : <Navigate to="/" replace />;
};

/**
 * @en A component to protect routes that require authentication.
 * It checks the user's authentication status and redirects to the home page if not logged in.
 * @zh 一个用于保护需要身份验证的路由的组件。
 * 它会检查用户的身份验证状态，如果未登录则重定向到主页。
 * @returns {JSX.Element} The child component if authenticated, or a redirect.
 */
const ProtectedRoute = () => {
  // 检查是否有AWS配置
  const isProductionReady = import.meta.env.VITE_COGNITO_USER_POOL_ID && 
                           import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID && 
                           import.meta.env.VITE_AWS_REGION;

  // 开发模式：总是允许访问
  if (!isProductionReady) {
    return <Outlet />;
  }

  // 生产模式：使用AWS认证组件
  return <ProductionProtectedRoute />;
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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<PublicDashboard />} />
        <Route path="/posts" element={<PostList />} />
        <Route path="/docs" element={<PostViewer />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/mypage" element={<MyPage />} />
        </Route>
        {/* @en A catch-all route to redirect any unknown paths to the homepage. @zh 一个包罗万象的路由，可将任何未知路径重定向到主页。 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

/**
 * @en The root component of the application.
 * @zh 应用程序的根组件。
 * @returns {JSX.Element} The main application component.
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
