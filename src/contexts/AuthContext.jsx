import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import {
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  updatePassword,
  confirmUserAttribute,
  resendSignUpCode
} from 'aws-amplify/auth';
import { getUserProfile, isUserProfileComplete, setupUserProfile } from '../api.js';
import { isProductionReady as globalIsProductionReady } from '../env.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  console.log('🔍 AuthContext: AuthProvider 组件初始化');

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cognitoUserInfo, setCognitoUserInfo] = useState(null); // 新增：Cognito用户详细信息
  const [profileLoading, setProfileLoading] = useState(false);
  const [cognitoLoading, setCognitoLoading] = useState(false); // 新增：Cognito操作加载状态
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const ready = globalIsProductionReady();

  console.log('🔍 AuthContext: 初始状态', {
    ready,
    user,
    authInitialized
  });

  // 生产模式下监听Amplify认证状态
  const amplifyAuthHook = ready ? useAuthenticator(context => [
    context.authStatus,
    context.user
  ]) : { authStatus: 'unauthenticated', user: null };

  console.log('🔍 AuthContext: amplifyAuthHook 状态', {
    ready,
    authStatus: amplifyAuthHook.authStatus,
    hasUser: !!amplifyAuthHook.user,
    amplifyUser: amplifyAuthHook.user
  });

  // 检查现有的认证会话
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!ready) {
        // 开发模式：检查本地存储的模拟用户
        const savedUser = localStorage.getItem('dev-user');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            console.log('🔄 开发模式：恢复保存的用户会话', userData);
          } catch (error) {
            console.error('解析保存的用户数据失败:', error);
            localStorage.removeItem('dev-user');
          }
        }
        setAuthInitialized(true);
        return;
      }

      // 生产模式：检查Amplify认证状态
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          console.log('🔄 检测到现有认证会话:', currentUser);
          // 关键修复1: 必须等待整个认证和用户资料加载流程完成
          await handleAuthSuccess(currentUser);
        }
      } catch (error) {
        console.log('🔍 未检测到现有认证会话:', error.message);
      } finally {
        // 现在，这只会在所有异步操作完成后执行
        setAuthInitialized(true);
      }
    };

    checkExistingAuth();
  }, [ready]);

  // 监听生产模式下Amplify的认证状态变化
  useEffect(() => {
    console.log('🔍 AuthContext: useEffect 监听认证状态变化', {
      ready,
      authInitialized,
      amplifyAuthStatus: amplifyAuthHook.authStatus,
      amplifyUser: amplifyAuthHook.user,
      currentUser: user
    });

    if (!ready || !authInitialized) return;

    const { authStatus, user: amplifyUser } = amplifyAuthHook;

    if (authStatus === 'authenticated' && amplifyUser && !user) {
      console.log('🔄 Amplify认证状态变化 - 用户已认证:', amplifyUser);
      handleAuthSuccess(amplifyUser);

      // 🔍 DEBUG: 输出所有认证信息
      debugAuthCredentials();
    } else if (authStatus === 'unauthenticated' && user) {
      console.log('🔄 Amplify认证状态变化 - 用户已登出');
      logout();
    } else {
      console.log('🔍 AuthContext: useEffect 跳过处理', {
        authStatus,
        hasAmplifyUser: !!amplifyUser,
        hasCurrentUser: !!user,
        reason: authStatus !== 'authenticated' ? 'not authenticated' :
                !amplifyUser ? 'no amplify user' :
                !!user ? 'user already exists' : 'unknown'
      });
    }
  }, [amplifyAuthHook.authStatus, amplifyAuthHook.user, authInitialized, ready, user]);

  // 加载用户资料
  const loadUserProfile = async (userId) => {
    if (!userId) return;

    setProfileLoading(true);
    try {
      console.log('🔍 正在检查用户是否存在于数据库中:', userId);
      const profile = await getUserProfile(userId);

      console.log('✅ 用户存在于数据库中，加载用户资料:', profile);
      setUserProfile(profile);

      // 检查资料是否完整 - 只根据资料内容判断，不考虑时间因素
      const isComplete = isUserProfileComplete(profile);
      setNeedsProfileSetup(!isComplete);

      console.log('📋 用户资料加载完成:', {
        profile,
        isComplete,
        needsSetup: !isComplete
      });
    } catch (error) {
      console.error('❌ 用户不存在于数据库中或加载失败:', error);

      // 用户不在 VoiceFemUsers 表中，需要强制跳转到用户信息完善页面
      console.log('🚨 用户未在数据库中找到，强制跳转到用户信息完善页面');
      setNeedsProfileSetup(true);
      setUserProfile(null);

      // 注意：不在这里直接跳转，而是依赖 App.jsx 中的 useEffect 来处理跳转
      // 这样可以避免跳转逻辑冲突
      console.log('📍 设置 needsProfileSetup=true，等待 App.jsx 处理跳转');
    } finally {
      setProfileLoading(false);
    }
  };

  // 完善用户资料
  const completeProfileSetup = async (profileData) => {
    try {
      const result = await setupUserProfile(profileData);
      setUserProfile(result.user);
      setNeedsProfileSetup(false);

      console.log('✅ 用户资料设置完成:', result);
      return result;
    } catch (error) {
      console.error('❌ 用户资料设置失败:', error);
      throw error;
    }
  };

  // 开发模式登录
  const login = (userData) => {
    setUser(userData);
    // 保存到本地存储
    if (!ready) {
      localStorage.setItem('dev-user', JSON.stringify(userData));
    }

    if (userData?.userId || userData?.attributes?.sub) {
      const userId = userData.userId || userData.attributes.sub;
      loadUserProfile(userId);
    }
  };

  // 注册后的回调处理 - 使用Amplify v6标准API
  const handleAuthSuccess = async (amplifyUser) => {
    console.log('🔍 AuthContext: handleAuthSuccess 接收到的用户对象:', amplifyUser);
    console.log('📍 [验证点20] 开始使用Amplify v6标准API获取用户信息');

    try {
      // 使用Amplify v6标准API获取完整用户信息
      console.log('📍 [验证点20] 调用 getCurrentUser()...');
      const currentUser = await getCurrentUser();
      console.log('📍 [验证点20] 调用 fetchUserAttributes()...');
      const userAttributes = await fetchUserAttributes();

      console.log('🔍 AuthContext: Amplify v6 API获取的数据:', {
        currentUser,
        userAttributes
      });

      console.log('✅ [验证点20] 成功使用Amplify v6标准API获取用户信息:', {
        source: 'Amplify v6 getCurrentUser + fetchUserAttributes',
        currentUserKeys: Object.keys(currentUser || {}),
        userAttributesKeys: Object.keys(userAttributes || {}),
        userId: currentUser?.userId,
        email: userAttributes?.email,
        nickname: userAttributes?.nickname
      });

      // 构建标准用户对象
      const userData = {
        userId: currentUser.userId,
        username: currentUser.username,
        attributes: {
          sub: currentUser.userId, // v6中userId就是sub
          email: userAttributes.email,
          nickname: userAttributes.nickname,
          preferred_username: userAttributes.preferred_username,
          email_verified: userAttributes.email_verified,
          picture: userAttributes.picture,
          ...userAttributes // 包含所有其他属性
        }
      };

      console.log('🎉 AuthContext: 构建的标准用户数据:', userData);
      console.log('✅ [验证点20] 用户数据完全来自Amplify v6标准API，无混合来源');

      // 设置用户状态
      setUser(userData);

      // 加载用户资料
      if (userData.userId) {
        // 关键修复2: 等待用户资料加载完成
        await loadUserProfile(userData.userId);
      } else {
        setNeedsProfileSetup(true);
        setUserProfile(null);
      }

      console.log('🎉 认证成功，正在加载用户资料:', userData);

    } catch (error) {
      console.error('❌ 获取用户信息失败:', error);
      console.log('⚠️ [验证点20] Amplify v6 API调用失败，使用基本信息作为兜底');

      // 如果API调用失败，使用基本信息
      const basicUserData = {
        userId: amplifyUser.userId || amplifyUser.user?.userId,
        username: amplifyUser.username || amplifyUser.user?.username,
        attributes: {
          sub: amplifyUser.userId || amplifyUser.user?.userId,
          email: null,
          nickname: null,
          preferred_username: null,
          email_verified: 'false',
          picture: null
        }
      };

      console.log('⚠️ 使用基本用户信息:', basicUserData);
      setUser(basicUserData);

      if (basicUserData.userId) {
        await loadUserProfile(basicUserData.userId);
      }
    }
  };

  // 加载Cognito用户详细信息
  const loadCognitoUserInfo = async () => {
    if (!ready) {
      // 开发模式下的模拟数据
      setCognitoUserInfo({
        username: 'dev_user',
        userId: 'dev_user_id',
        email: 'dev@example.com',
        nickname: 'Dev User',
        email_verified: true,
        avatarUrl: null, // 开发模式下没有头像
        attributes: {
          email: 'dev@example.com',
          nickname: 'Dev User',
          email_verified: 'true'
        }
      });
      return;
    }

    setCognitoLoading(true);
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      const cognitoUserData = {
        username: currentUser.username,
        userId: currentUser.userId,
        email: attributes.email,
        nickname: attributes.nickname || attributes.preferred_username || '',
        email_verified: attributes.email_verified === 'true',
        avatarUrl: attributes.picture || null, // 从Cognito picture属性获取头像URL
        attributes: attributes
      };

      setCognitoUserInfo(cognitoUserData);
      console.log('Cognito用户信息加载完成:', cognitoUserData);
    } catch (error) {
      console.error('获取Cognito用户信息失败:', error);
      setCognitoUserInfo(null);
    } finally {
      setCognitoLoading(false);
    }
  };

  // 更新Cognito用户属性 - 增强邮箱验证处理
  const updateCognitoUserInfo = async (updates) => {
    if (!ready) {
      setCognitoUserInfo(prev => ({ ...prev, ...updates }));
      return { success: true, message: '开发模式：模拟更新成功' };
    }

    setCognitoLoading(true);
    try {
      const attributesToUpdate = {};
      let emailChanged = false;

      if (updates.nickname !== undefined) {
        attributesToUpdate.nickname = updates.nickname;
      }

      if (updates.email !== undefined && updates.email !== cognitoUserInfo?.email) {
        attributesToUpdate.email = updates.email;
        emailChanged = true;
      }

      // 支持头像URL更新
      if (updates.avatarUrl !== undefined) {
        attributesToUpdate.picture = updates.avatarUrl;
      }

      if (Object.keys(attributesToUpdate).length > 0) {
        const result = await updateUserAttributes({
          userAttributes: attributesToUpdate
        });

        // 检查是否有需要验证的属性
        if (result && result.email && result.email.isDeliveryMedium) {
          console.log('邮箱验证码已发送:', result.email);
        }
      }

      // 处理密码更新
      if (updates.password && updates.currentPassword) {
        await updatePassword({
          oldPassword: updates.currentPassword,
          newPassword: updates.password
        });
      }

      await loadCognitoUserInfo();

      let message = updates.password ? '账户信息和密码更新成功！' : '账户信息更新成功！';
      if (emailChanged) {
        message += ' 请检查新邮箱收件箱，点击验证链接完成邮箱验证。';
      }
      if (updates.avatarUrl) {
        message += ' 头像已更新！';
      }

      return {
        success: true,
        message,
        needsEmailVerification: emailChanged
      };
    } catch (error) {
      console.error('更新Cognito用户信息失败:', error);
      throw error;
    } finally {
      setCognitoLoading(false);
    }
  };

  // 重新发送邮箱验证码
  const resendEmailVerification = async () => {
    if (!ready) {
      return { success: true, message: '开发模式：模拟发送验证码' };
    }

    try {
      await resendSignUpCode({ username: cognitoUserInfo?.username });
      return { success: true, message: '验证邮件已重新发送，请检查邮箱' };
    } catch (error) {
      console.error('重新发送验证邮件失败:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setUserProfile(null);
    setCognitoUserInfo(null); // 修复：退出时清除Cognito用户信息
    setNeedsProfileSetup(false);
    // 清除本地存储
    if (!ready) {
      localStorage.removeItem('dev-user');
    }
  };

  const isAuthenticated = !!user;

  // 🔍 DEBUG: 详细输出认证凭据
  const debugAuthCredentials = async () => {
    if (!ready) return;

    try {
      console.group('🔍 [DEBUG] 认证凭据详细信息');

      // 获取完整的认证会话
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();

      console.log('📋 完整认证会话:', {
        hasTokens: !!session.tokens,
        hasCredentials: !!session.credentials,
        hasIdToken: !!session.tokens?.idToken,
        hasRefreshToken: !!session.tokens?.refreshToken
      });

      // ID Token详细信息 (主要关注)
      if (session.tokens?.idToken) {
        const idToken = session.tokens.idToken;
        console.log('🆔 ID Token信息 (主要使用):', {
          tokenType: typeof idToken,
          tokenConstructor: idToken.constructor.name,
          tokenString: idToken.toString(),
          tokenLength: idToken.toString().length
        });

        // 解析ID Token内容
        try {
          const tokenParts = idToken.toString().split('.');
          if (tokenParts.length === 3) {
            const header = JSON.parse(atob(tokenParts[0]));
            const payload = JSON.parse(atob(tokenParts[1]));

            console.log('🔍 ID Token Header:', header);
            console.log('🔍 ID Token Payload:', {
              ...payload,
              exp: new Date(payload.exp * 1000),
              iat: new Date(payload.iat * 1000)
            });

            console.log('🎯 ID Token关键信息:', {
              userId: payload.sub,
              username: payload.username || payload['cognito:username'],
              email: payload.email,
              audience: payload.aud,
              tokenUse: payload.token_use,
              expiresAt: new Date(payload.exp * 1000)
            });
          }
        } catch (parseError) {
          console.error('❌ ID Token解析失败:', parseError);
        }
      }

      // Refresh Token信息
      if (session.tokens?.refreshToken) {
        console.log('🔄 Refresh Token信息:', {
          hasRefreshToken: true,
          tokenType: typeof session.tokens.refreshToken,
          tokenLength: session.tokens.refreshToken.toString().length
        });
      }

      // AWS Credentials信息
      if (session.credentials) {
        console.log('🔐 AWS Credentials:', {
          hasAccessKeyId: !!session.credentials.accessKeyId,
          hasSecretAccessKey: !!session.credentials.secretAccessKey,
          hasSessionToken: !!session.credentials.sessionToken,
          expiration: session.credentials.expiration
        });
      }

      console.log('✅ 系统将只使用ID Token进行API调用');
      console.groupEnd();
    } catch (error) {
      console.error('❌ 获取认证凭据失败:', error);
    }
  };

  // 当用户认证成功时，自动加载Cognito用户信息
  useEffect(() => {
    if (user && !cognitoUserInfo) {
      loadCognitoUserInfo();
    }
  }, [user]);

  // 刷新用户资料的方法
  const refreshUserProfile = async () => {
    if (user?.userId || user?.attributes?.sub) {
      const userId = user.userId || user.attributes.sub;
      await loadUserProfile(userId);
    }
  };

  // 刷新Cognito用户信息的方法
  const refreshCognitoUserInfo = async () => {
    await loadCognitoUserInfo();
  };

  // 关键修复3: 在认证状态完全确定前，显示加载指示器
  // 这可以防止应用在不完整的状态下渲染，从而避免Hooks调用不一致的错误
  if (!authInitialized) {
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
    <AuthContext.Provider value={{
      user,
      userProfile,
      profileLoading,
      needsProfileSetup,
      authInitialized,
      login,
      logout,
      isAuthenticated,
      loadUserProfile,
      refreshUserProfile, // 确保暴露这个方法
      completeProfileSetup,
      handleAuthSuccess,
      cognitoUserInfo, // Cognito用户详细信息
      cognitoLoading, // Cognito操作加载状态
      loadCognitoUserInfo, // 加载Cognito用户信息
      updateCognitoUserInfo, // 更新Cognito用户信息
      resendEmailVerification, // 新增
      refreshCognitoUserInfo // 刷新Cognito用户信息
    }}>
      {children}
    </AuthContext.Provider>
  );
};
