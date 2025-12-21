/**
 * @file 管理后台应用入口
 * 管理后台的路由配置和主应用组件
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AWSClientProvider, useAWSClients } from './contexts/AWSClientContext';
import AdminLogin from './components/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import UserListPage from './components/UserListPage';
import EventListPage from './components/EventListPage';
import TestListPage from './components/TestListPage';
import RateLimitConfigPage from './components/RateLimitConfigPage';

/**
 * 受保护的路由组件
 * 如果未认证则重定向到登录页面
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAWSClients();

  // 加载中显示空白（避免闪烁）
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">正在检查登录状态...</p>
        </div>
      </div>
    );
  }

  // 未认证则重定向到登录页面
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

/**
 * 管理后台路由组件
 * 在 AWSClientProvider 内部使用
 */
function AdminRoutes() {
  const { isAuthenticated, loading } = useAWSClients();

  return (
    <Routes>
      {/* 登录页面 */}
      <Route 
        path="login" 
        element={
          // 如果已登录则重定向到仪表盘
          isAuthenticated && !loading 
            ? <Navigate to="/admin" replace />
            : <AdminLogin />
        } 
      />

      {/* 受保护的管理页面 */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Routes>
                {/* 仪表盘（默认页面） */}
                <Route index element={<AdminDashboard />} />
                
                {/* 用户管理 */}
                <Route path="users" element={<UserListPage />} />
                
                {/* 事件管理 */}
                <Route path="events" element={<EventListPage />} />
                
                {/* 嗓音测试管理 */}
                <Route path="tests" element={<TestListPage />} />

                {/* 速率限制配置 */}
                <Route path="settings/rate-limit" element={<RateLimitConfigPage />} />

                {/* 未匹配的路由重定向到仪表盘 */}
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </AdminLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

/**
 * 管理后台应用组件
 * 提供 AWS 客户端上下文并渲染路由
 */
export default function AdminApp() {
  return (
    <AWSClientProvider>
      <AdminRoutes />
    </AWSClientProvider>
  );
}
