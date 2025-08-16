import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from './env.js';

import Layout from './components/Layout';
import Auth from './components/Auth';
import MyPage from './components/MyPage';
import AddEvent from './components/AddEvent.jsx';
import EventManagerPage from './components/EventManagerPage';
import PublicDashboard from './components/PublicDashboard';
import Home from './components/Home';
import PostList from './components/PostList';
import PostViewer from './components/PostViewer';
import TimelineTest from './components/TimelineTest';
import ProfileSetup from './components/ProfileSetup';
import APITestPage from './components/APITestPage';

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
  const ready = globalIsProductionReady();
  if (!ready) return <Outlet />; // 未就绪使用开放访问 + mock
  return <ProductionProtectedRoute />; // 就绪使用真实认证
};

/**
 * 资料设置模态窗口组件
 */
const ProfileSetupModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
        <div className="relative z-10 w-full">
          <ProfileSetup
            onComplete={onClose}
            onSkip={onClose}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * @en The main content container of the application. It wraps the router
 * with a consistent layout.
 * @zh 应用程序的主要内容容器。它用一个一致的布局来包裹路由器。
 * @returns {JSX.Element} The rendered application content with layout.
 */
const AppContent = () => {
  const { isAuthenticated, needsProfileSetup, profileLoading } = useAuth();
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  // 处理资料设置按钮点击
  const handleProfileSetupClick = () => {
    setShowProfileSetup(true);
  };

  // 处理资料设置完成
  const handleProfileSetupClose = () => {
    setShowProfileSetup(false);
  };

  // 如果是认证用户且正在加载资料，显示加载状态
  if (isAuthenticated && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载用户资料...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout
        auth={<Auth />}
        onProfileSetupClick={handleProfileSetupClick}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<PublicDashboard />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/docs" element={<PostViewer />} />
          {/* Route for testing the new timeline component independently */}
          <Route path="/timeline-test" element={<TimelineTest />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/add-event" element={<AddEvent />} />
            <Route path="/event-manager" element={<EventManagerPage />} />
            <Route path="/api-test" element={<APITestPage />} /> {/* 新增的API测试页面路由 */}
          </Route>
          {/* @en A catch-all route to redirect any unknown paths to the homepage. @zh 一个包罗万象的路由，可将任何未知路径重定向到主页。 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>

      {/* 资料设置模态窗口 */}
      <ProfileSetupModal
        isOpen={showProfileSetup}
        onClose={handleProfileSetupClose}
      />
    </>
  );
};

/**
 * @en The root component of the application.
 * @zh 应用程序的根组件。
 * @returns {JSX.Element} The main application component.
 */
function App() {
  const ready = globalIsProductionReady();

  if (ready) {
    // 生产模式：需要 Authenticator.Provider 包装
    return (
      <Authenticator.Provider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Authenticator.Provider>
    );
  } else {
    // 开发模式：不需要 Authenticator.Provider
    return (
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    );
  }
}

export default App;
