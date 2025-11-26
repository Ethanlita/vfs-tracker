import React, { useEffect, useState } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Amplify } from 'aws-amplify';
import { Home } from 'lucide-react';
import CustomAuthenticator from './CustomAuthenticator';

/**
 * 独立的登录页面组件
 * 
 * 提供全页面的登录/注册体验，支持登录后重定向回原页面。
 * 与弹窗登录并存，作为未来替换弹窗登录的基础设施。
 * 
 * 特性：
 * - 支持 returnUrl 参数，登录后返回原页面
 * - 支持 message 参数，显示自定义提示信息
 * - 已登录用户自动跳转
 * - 响应式设计，美观的品牌一致性UI
 * 
 * @returns {JSX.Element} 登录页面
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleAuthSuccess, authInitialized } = useAuth();
  const { authStatus, user } = useAuthenticator((context) => [context.authStatus, context.user]);
  
  // 获取 returnUrl，默认为 /mypage
  const searchParams = new URLSearchParams(location.search);
  const returnUrl = searchParams.get('returnUrl') || '/mypage';
  const message = searchParams.get('message');

  const [configReady, setConfigReady] = useState(false);
  const [useLegacyAuth, setUseLegacyAuth] = useState(false);

  // 检查 Amplify 配置
  useEffect(() => {
    const checkConfig = async () => {
      try {
        // 简单的延时以确保配置加载（如果需要）
        await new Promise(resolve => setTimeout(resolve, 100));
        const config = Amplify.getConfig();
        if (config?.Auth?.Cognito?.userPoolId) {
          setConfigReady(true);
        }
      } catch (err) {
        console.error('[LoginPage] 配置检查失败:', err);
      }
    };
    checkConfig();
  }, []);

  // 处理登录成功后的跳转
  useEffect(() => {
    if (authStatus === 'authenticated' && user && authInitialized) {
      console.log(`[LoginPage] 用户已登录，跳转至: ${returnUrl}`);
      // 确保 AuthContext 更新状态
      handleAuthSuccess(user);
      navigate(returnUrl, { replace: true });
    }
  }, [authStatus, user, authInitialized, navigate, returnUrl, handleAuthSuccess]);

  if (!configReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载认证服务...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[640px] space-y-8">
        {/* Logo 和标题区域 */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/icons/icon_origin.png" 
              alt="VFS Tracker Logo" 
              className="w-24 h-24 object-cover rounded-full drop-shadow-lg"
            />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-700 to-pink-500 bg-clip-text text-transparent mb-2">
            VFS Tracker
          </h1>
          <h2 className="text-xl font-semibold text-gray-600 mb-4">
            嗓音数据测试和跟踪工具
          </h2>
          
          {message ? (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              请登录以继续访问您的嗓音数据和分析
            </p>
          )}
        </div>
        
        {/* 登录表单区域 */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          {!useLegacyAuth ? (
            <>
              <CustomAuthenticator 
                hideSignUp={false}
                loginMechanisms={['username', 'email']}
              >
                {({ user }) => {
                  // 登录成功后立即跳转（兼容 Amplify Authenticator API）
                  if (user) {
                    console.log('[LoginPage] 登录成功，即将跳转至:', returnUrl);
                    // 确保 AuthContext 更新状态
                    handleAuthSuccess(user);
                    // 立即跳转
                    navigate(returnUrl, { replace: true });
                  }
                  return null;
                }}
              </CustomAuthenticator>

              <div className="mt-4 text-center text-sm">
                <span className="text-gray-600">遇到了问题？</span>
                <span className="mx-2 text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => setUseLegacyAuth(true)}
                  className="text-pink-600 hover:text-pink-500 font-medium"
                >
                  切换到旧版登录页
                </button>
              </div>
            </>
          ) : (
            <>
              <Authenticator hideSignUp={false} loginMechanisms={['username', 'email']}>
                {({ user }) => {
                  if (user) {
                    handleAuthSuccess(user);
                    navigate(returnUrl, { replace: true });
                  }
                  return null;
                }}
              </Authenticator>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setUseLegacyAuth(false)}
                  className="text-pink-600 hover:text-pink-500 font-medium"
                >
                  切换至新版登录页面
                </button>
              </div>
            </>
          )}
        </div>

        {/* 底部链接 */}
        <div className="text-center space-y-2">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-pink-600 transition-colors"
          >
            <Home className="w-4 h-4 mr-1" />
            返回首页
          </button>
          <p className="text-xs text-gray-500">
            登录即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
