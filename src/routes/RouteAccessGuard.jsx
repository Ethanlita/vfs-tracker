/**
 * @file 应用主站统一路由守卫。
 * @description 集中处理认证等待、登录跳转、资料完善跳转与离线例外，路由本身只需声明访问规则。
 */
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { profileSetupUrl, safeReturnUrl } from './authReturn.js';

/** 在认证状态同步完成前显示稳定的页面级状态，避免先跳登录再跳回。 */
const AuthenticationLoading = () => (
  <div role="status" className="min-h-[16rem] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
      <p className="text-gray-600">正在验证身份认证状态...</p>
    </div>
  </div>
);

/** 读取浏览器网络状态；在线或离线变化后使用同一套路由判断重新渲染。 */
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

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

  return isOnline;
};

/**
 * 按路由组执行唯一的访问判断路径。
 * @param {{requiresAuth?: boolean, allowIncompleteProfile?: boolean}} props 路由组访问规则。
 * @returns {JSX.Element} 当前子路由、加载状态或声明式重定向。
 */
const RouteAccessGuard = ({ requiresAuth = false, allowIncompleteProfile = false }) => {
  const {
    authStatus,
    isAuthenticated,
    needsProfileSetup,
    profileLoading,
    authInitialized,
    pendingProfileSetup,
  } = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();

  const sessionIsHydrating = authStatus === 'authenticated' && !isAuthenticated;
  if (!authInitialized || authStatus === 'configuring' || sessionIsHydrating) {
    return <AuthenticationLoading />;
  }

  const currentUrl = location.pathname + location.search + location.hash;
  if (requiresAuth && !isAuthenticated) {
    // 向导自身失去会话时返回原目标，避免登录后再次进入已失效的向导地址。
    const returnUrl = location.pathname === '/profile-setup-wizard'
      ? safeReturnUrl(new URLSearchParams(location.search).get('returnUrl'))
      : currentUrl;
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }

  const shouldStartProfileSetup = (
    isAuthenticated
    && needsProfileSetup
    && !profileLoading
    && !pendingProfileSetup
    && isOnline
    && !allowIncompleteProfile
  );
  if (shouldStartProfileSetup) {
    return <Navigate to={profileSetupUrl(currentUrl)} replace />;
  }

  return <Outlet />;
};

export default RouteAccessGuard;
