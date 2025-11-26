import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Layout from './components/Layout';
import Auth from './components/Auth';
import MyPage from './components/MyPage';
import AddEvent from './components/AddEvent.jsx';
import EventManagerPage from './components/EventManagerPage';
import PublicDashboard from './components/PublicDashboard';
import Home from './components/Home';
import PostList from './components/PostList';
import PostViewer from './components/PostViewer';
import LoginPage from './components/LoginPage';

import APITestPage from './components/APITestPage';
import ProfileSetupWizard from './components/ProfileSetupWizard';
import UserProfileManager from './components/UserProfileManager';
import EnhancedDataCharts from './components/EnhancedDataCharts';
import VoiceTestWizard from './components/VoiceTestWizard'; // 新增导入
import QuickF0Test from './components/QuickF0Test'; // 新增导入
import ScalePractice from './components/ScalePractice'; // 新增导入
import VFSEffectPreview from './components/VFSEffectPreview'; // VFS效果预览
import RegionSwitchBanner from './components/RegionSwitchBanner.jsx';
import NoteFrequencyTool from './components/NoteFrequencyTool.jsx';

/**
 * @en A component to protect routes that require authentication.
 * It checks the user's authentication status and redirects to the home page if not logged in.
 * @zh 一个用于保护需要身份验证的路由的组件。
 * 它会检查用户的身份验证状态，如果未登录则重定向到主页。
 * @returns {JSX.Element} The child component if authenticated, or a redirect.
 */
const ProtectedRoute = () => {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const { needsProfileSetup, profileLoading, authInitialized } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // @en If the user is authenticated, redirect to their profile page on first login
  // @zh 如果用户已认证，在首次登录时重定向到他们的个人页面
  useEffect(() => {
    if (authStatus === 'authenticated' && location.pathname === '/' && authInitialized) {
      if (!profileLoading && needsProfileSetup && isOnline) {
        navigate('/profile-setup-wizard', { replace: true });
      } else {
        navigate('/mypage', { replace: true });
      }
    }
  }, [authStatus, location.pathname, navigate, needsProfileSetup, profileLoading, authInitialized, isOnline]);

  // @en While Amplify is figuring out the auth status, show a loading indicator.
  // @zh 在 Amplify 确定身份验证状态时，显示加载指示器。
  if (authStatus === 'configuring') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份认证状态...</p>
        </div>
      </div>
    );
  }

  // @en If the user is not authenticated, redirect them to the home page.
  // @zh 如果用户未通过身份验证，则将他们重定向到主页。
  return authStatus === 'authenticated' ? <Outlet /> : <Navigate to="/" replace />;
};

/**
 * 当检测到有新的 Service Worker 版本准备就绪时，提示用户刷新
 */
const ServiceWorkerUpdateBanner = () => {
  const [visible, setVisible] = useState(false);
  const [updateSW, setUpdateSW] = useState(null);

  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      setVisible(true);
      if (event.detail && event.detail.updateSW) {
        setUpdateSW(() => event.detail.updateSW);
      }
    };

    window.addEventListener('sw:update-available', handleUpdateAvailable);
    return () => {
      window.removeEventListener('sw:update-available', handleUpdateAvailable);
    };
  }, []);

  if (!visible) return null;

  const handleReload = () => {
    if (updateSW) {
      updateSW(true);
    } else {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center z-[1000] pointer-events-none">
      <div className="pointer-events-auto mx-4 sm:mx-0 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex flex-col gap-3 sm:flex-row sm:items-center">
        <span>检测到应用有新版本可用。</span>
        <div className="flex gap-2 justify-end sm:justify-start">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md bg-white text-gray-900 font-medium hover:bg-gray-100 transition"
            onClick={handleReload}
          >
            立即刷新
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-white/40 text-white hover:bg-white/10 transition"
            onClick={handleDismiss}
          >
            稍后提醒
          </button>
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
  const { isAuthenticated, needsProfileSetup, profileLoading, authInitialized } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // 处理资料设置按钮点击（直接跳转向导页面）
  const handleProfileSetupClick = () => {
    navigate('/profile-setup-wizard', { replace: false });
  };

  // 自动跳转到ProfileSetupWizard的逻辑
  useEffect(() => {
    if (
      authInitialized &&
      isAuthenticated &&
      needsProfileSetup &&
      !profileLoading &&
      isOnline &&
      location.pathname !== '/profile-setup-wizard'
    ) {
      console.log('🚀 检测到用户需要完善资料，自动跳转到引导页面');
      navigate('/profile-setup-wizard', { replace: true });
    }
  }, [authInitialized, isAuthenticated, needsProfileSetup, profileLoading, isOnline, location.pathname, navigate]);

  return (
    <>
      <RegionSwitchBanner />
      <Layout
        AuthComponent={Auth}
        onProfileSetupClick={handleProfileSetupClick}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<PublicDashboard />} />
          <Route path="/note-frequency-tool" element={<NoteFrequencyTool />} />
          <Route path="/vfs-effect-preview" element={<VFSEffectPreview />} />
          <Route path="/posts" element={<PostList />} />
          <Route path="/docs" element={<PostViewer />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/add-event" element={<AddEvent />} />
            <Route path="/event-manager" element={<EventManagerPage />} />
            <Route path="/api-test" element={<APITestPage />} /> {/* 新增的API测试页面路由 */}
            <Route path="/profile-manager" element={<UserProfileManager />} /> {/* 用户资料管理 */}
            <Route path="/profile-setup-wizard" element={<ProfileSetupWizard />} /> {/* 用户引导设置 */}
            <Route path="/voice-test" element={<VoiceTestWizard />} /> {/* 新增嗓音测试路由 */}
            <Route path="/quick-f0-test" element={<QuickF0Test />} /> {/* 新增快速基频测试路由 */}
            <Route path="/scale-practice" element={<ScalePractice />} /> {/* 新增音阶练习路由 */}
          </Route>
          {/* @en A catch-all route to redirect any unknown paths to the homepage. @zh 一个包罗万象的路由，可将任何未知路径重定向到主页。 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>

      <ServiceWorkerUpdateBanner />
    </>
  );
};

/**
 * @en The root component of the application.
 * @zh 应用程序的根组件。
 * @returns {JSX.Element} The main application component.
 */
function App() {
  // 生产模式：使用 Authenticator.Provider 包装
  return (
    <Authenticator.Provider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Authenticator.Provider>
  );
}

export default App;
