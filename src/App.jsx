import { Authenticator } from '@aws-amplify/ui-react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import RouteAccessGuard from './routes/RouteAccessGuard.jsx';

import Layout from './components/Layout';
import Auth from './components/Auth';
import Home from './components/Home';
import RegionSwitchBanner from './components/RegionSwitchBanner.jsx';
import NotFoundPage from './components/NotFoundPage'; // 404 页面
import ServiceWorkerUpdateBanner from './components/ServiceWorkerUpdateBanner.jsx';

// 每个业务页面按路由加载，首页不再解析图表、录音、Markdown 或管理端依赖。
const MyPage = lazy(() => import('./components/MyPage'));
const AddEvent = lazy(() => import('./components/AddEvent.jsx'));
const EventManagerPage = lazy(() => import('./components/EventManagerPage'));
const PublicDashboard = lazy(() => import('./components/PublicDashboard'));
const PostList = lazy(() => import('./components/PostList'));
const PostViewer = lazy(() => import('./components/PostViewer'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const APITestPage = lazy(() => import('./components/APITestPage'));
const ProfileSetupWizard = lazy(() => import('./components/ProfileSetupWizard'));
const UserProfileManager = lazy(() => import('./components/UserProfileManager'));
const VoiceTestWizard = lazy(() => import('./components/VoiceTestWizard'));
const QuickF0Test = lazy(() => import('./components/QuickF0Test'));
const ScalePractice = lazy(() => import('./components/ScalePractice'));
const VFSEffectPreview = lazy(() => import('./components/VFSEffectPreview'));
const NoteFrequencyTool = lazy(() => import('./components/NoteFrequencyTool.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

/** 业务路由下载期间保留页面框架，并向读屏明确说明当前状态。 */
const PageLoadingFallback = () => (
  <div role="status" className="min-h-[16rem] flex items-center justify-center text-gray-600">
    正在加载页面…
  </div>
);

/**
 * 管理后台加载状态组件
 */
const AdminLoadingFallback = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
      <p className="text-gray-400">加载管理后台...</p>
    </div>
  </div>
);

/**
 * 当检测到有新的 Service Worker 版本准备就绪时，提示用户刷新
 */
/**
 * @en The main content container of the application. It wraps the router
 * with a consistent layout.
 * @zh 应用程序的主要内容容器。它用一个一致的布局来包裹路由器。
 * @returns {JSX.Element} The rendered application content with layout.
 */
const AppContent = () => {
  const navigate = useNavigate();

  // 处理资料设置按钮点击（直接跳转向导页面）
  const handleProfileSetupClick = () => {
    navigate('/profile-setup-wizard', { replace: false });
  };

  return (
    <>
      <RegionSwitchBanner />
      <Layout
        AuthComponent={Auth}
        onProfileSetupClick={handleProfileSetupClick}
      >
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* 普通页面会把已登录且资料不完整的用户送入引导。 */}
            <Route element={<RouteAccessGuard />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<PublicDashboard />} />
              <Route path="/posts" element={<PostList />} />
              <Route path="/docs" element={<PostViewer />} />
              {/* @en A catch-all route to show 404 page for unknown paths. @zh 显示 404 页面的通配路由，用于处理未知路径。 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* 本地计算与登录恢复允许资料不完整；工具内单独保护云端写入。 */}
            <Route element={<RouteAccessGuard allowIncompleteProfile />}>
              <Route path="/note-frequency-tool" element={<NoteFrequencyTool />} />
              <Route path="/vfs-effect-preview" element={<VFSEffectPreview />} />
              <Route path="/quick-f0-test" element={<QuickF0Test />} />
              <Route path="/scale-practice" element={<ScalePractice />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RouteAccessGuard requiresAuth />}>
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/add-event" element={<AddEvent />} />
              <Route path="/event-manager" element={<EventManagerPage />} />
              <Route path="/api-test" element={<APITestPage />} /> {/* 新增的API测试页面路由 */}
              <Route path="/profile-manager" element={<UserProfileManager />} /> {/* 用户资料管理 */}
              <Route path="/voice-test" element={<VoiceTestWizard />} /> {/* 新增嗓音测试路由 */}
            </Route>

            <Route element={<RouteAccessGuard requiresAuth allowIncompleteProfile />}>
              <Route path="/profile-setup-wizard" element={<ProfileSetupWizard />} /> {/* 用户引导设置 */}
            </Route>
          </Routes>
        </Suspense>
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
    <Routes>
      {/* 管理后台路由 - 完全独立，不使用 Amplify Authenticator */}
      <Route 
        path="/admin/*" 
        element={
          <Suspense fallback={<AdminLoadingFallback />}>
            <AdminApp />
          </Suspense>
        } 
      />
      
      {/* 主应用路由 */}
      <Route 
        path="/*" 
        element={
          <Authenticator.Provider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </Authenticator.Provider>
        } 
      />
    </Routes>
  );
}

export default App;
