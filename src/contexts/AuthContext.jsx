/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import {
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  updatePassword,
  resendSignUpCode
} from 'aws-amplify/auth';
import { getUserProfile, isUserProfileComplete, setupUserProfile, PROFILE_CACHE_KEY } from '../api.js';

// Helper function to decode Base64URL-encoded strings, as used in JWTs.
const b64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if it's missing.
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    // Decode the string and then handle potential UTF-8 characters
    const decodedUtf8 = atob(base64);
    return decodeURIComponent(
      Array.prototype.map.call(decodedUtf8, (c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
  } catch (e) {
    console.error('Failed to decode base64 string:', e);
    return ''; // Return empty string on failure
  }
};


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

  console.log('🔍 AuthContext: 初始状态', {
    user,
    authInitialized
  });

  // 监听Amplify认证状态
  const { authStatus, user: amplifyUser } = useAuthenticator();

  const amplifyAuthHook = useMemo(() => ({ authStatus, user: amplifyUser }), [authStatus, amplifyUser]);

  console.log('🔍 AuthContext: amplifyAuthHook 状态', {
    authStatus: amplifyAuthHook.authStatus,
    hasUser: !!amplifyAuthHook.user,
    amplifyUser: amplifyAuthHook.user
  });

  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) return;

    const cacheKey = `userProfile:v1:${userId}`;
    // 先尝试从缓存恢复用户资料和 needsProfileSetup 状态
    // 这样即使后续 API 请求失败，也有一个合理的默认值
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          setUserProfile(parsed);
          setNeedsProfileSetup(!isUserProfileComplete(parsed));
          console.log('📦 从缓存恢复用户资料，isComplete:', isUserProfileComplete(parsed));
        }
      }
    } catch (error) {
      console.warn('⚠️ 解析用户资料缓存失败，忽略本地缓存', error);
    }

    setProfileLoading(true);
    try {
      console.log('🔍 正在从后端加载用户资料:', userId);
      const profile = await getUserProfile(userId);

      // 后端现在返回 exists 字段来区分用户是否存在于数据库中
      const userExists = profile.exists !== false;
      console.log('📋 后端返回用户资料:', { exists: profile.exists, userExists });

      setUserProfile(profile);

      if (userExists) {
        // 用户存在于数据库中，更新缓存
        try {
          const cachedProfile = {
            ...profile,
            _cacheMeta: { t: Date.now(), userId }
          };
          localStorage.setItem(cacheKey, JSON.stringify(cachedProfile));
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cachedProfile));
        } catch (error) {
          console.warn('⚠️ 无法写入用户资料缓存', error);
        }
      }

      // 检查资料是否完整 - 只根据资料内容判断，不考虑时间因素
      const isComplete = isUserProfileComplete(profile);
      setNeedsProfileSetup(!isComplete);

      console.log('📋 用户资料加载完成:', {
        exists: userExists,
        isComplete,
        needsSetup: !isComplete
      });
    } catch (error) {
      // API 请求失败（超时、网络错误、500 等）
      // 优先使用缓存判断 needsProfileSetup，避免因网络问题误判已有用户
      console.error('❌ 加载用户资料失败:', error);

      const cacheCandidates = [cacheKey, PROFILE_CACHE_KEY];
      let recoveredFromCache = false;

      for (const key of cacheCandidates) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            // 验证缓存属于当前用户，防止多账户场景下读到别人的缓存
            if (parsed && (!parsed._cacheMeta?.userId || parsed._cacheMeta.userId === userId)) {
              console.log('📦 API 失败，使用缓存的用户资料来判断状态');
              setUserProfile(parsed);
              setNeedsProfileSetup(!isUserProfileComplete(parsed));
              recoveredFromCache = true;
              break;
            } else if (parsed) {
              console.warn('⚠️ 缓存属于其他用户，跳过:', parsed._cacheMeta?.userId);
            }
          }
        } catch (cacheError) {
          console.warn('⚠️ 解析用户资料缓存失败，忽略本地缓存', cacheError);
        }
      }

      if (!recoveredFromCache) {
        // 完全没有缓存且请求失败：不启动 Wizard
        // 因为无法区分"真正的新用户"和"网络抖动"，宁可不弹 Wizard 也不误判
        // 用户下次请求成功时，如果确实需要设置，会正常触发
        console.log('⚠️ 无缓存可用且请求失败，暂不启动 Wizard（避免误判）');
        setNeedsProfileSetup(false);
        setUserProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const handleAuthSuccess = useCallback(async (amplifyUser) => {
    console.log('🔍 AuthContext: handleAuthSuccess 接收到的用户对象:', amplifyUser);
    console.log('📍 [验证点20] 开始使用Amplify v6标准API获取用户信息');

    try {
      // 使用Amplify v6标准API获取完整用户信息
      console.log('📍 [验证点20] 并行调用 getCurrentUser() 与 fetchUserAttributes()...');
      const [currentUser, userAttributes] = await Promise.all([
        getCurrentUser(),
        fetchUserAttributes()
      ]);

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
          avatarKey: userAttributes['custom:avatarKey'] || userAttributes.avatarKey,
          ...userAttributes // 包含所有其他属性
        }
      };

      console.log('🎉 AuthContext: 构建的标准用户数据:', userData);
      console.log('✅ [验证点20] 用户数据完全来自Amplify v6标准API，无混合来源');

      // 设置用户状态
      setUser(userData);

      // 加载用户资料
      if (userData.userId) {
        // 用户资料加载改为后台进行
        loadUserProfile(userData.userId);
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
          avatarKey: null
        }
      };

      console.log('⚠️ 使用基本用户信息:', basicUserData);
      setUser(basicUserData);

      if (basicUserData.userId) {
        loadUserProfile(basicUserData.userId);
      } else {
        setNeedsProfileSetup(true);
        setUserProfile(null);
      }
    }
  }, [loadUserProfile]);

  const logout = useCallback(() => {
    // 清理当前用户的 localStorage 缓存，防止多账户场景下读到旧缓存
    try {
      const currentUserId = user?.userId || user?.attributes?.sub;
      if (currentUserId) {
        localStorage.removeItem(`userProfile:v1:${currentUserId}`);
      }
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (e) {
      console.warn('⚠️ 登出时清理缓存失败', e);
    }

    setUser(null);
    setUserProfile(null);
    setCognitoUserInfo(null);
    setNeedsProfileSetup(false);
  }, [user]);

  const debugAuthCredentials = useCallback(async () => {
    try {
      console.group('🔍 [DEBUG] 认证凭据详细信息');
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      console.log('📋 完整认证会话:', {
        hasTokens: !!session.tokens,
        hasCredentials: !!session.credentials,
        hasIdToken: !!session.tokens?.idToken,
        hasRefreshToken: !!session.tokens?.refreshToken
      });
      if (session.tokens?.idToken) {
        const idToken = session.tokens.idToken;
        console.log('🆔 ID Token信息 (主要使用):', {
          tokenType: typeof idToken,
          tokenConstructor: idToken.constructor.name,
          tokenString: idToken.toString(),
          tokenLength: idToken.toString().length
        });
        try {
          const tokenParts = idToken.toString().split('.');
          if (tokenParts.length === 3) {
            const header = JSON.parse(b64UrlDecode(tokenParts[0]));
            const payload = JSON.parse(b64UrlDecode(tokenParts[1]));
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
      if (session.tokens?.refreshToken) {
        console.log('🔄 Refresh Token信息:', {
          hasRefreshToken: true,
          tokenType: typeof session.tokens.refreshToken,
          tokenLength: session.tokens.refreshToken.toString().length
        });
      }
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
  }, []);

  const loadCognitoUserInfo = useCallback(async () => {
    setCognitoLoading(true);
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const avatarKey = attributes['custom:avatarKey'] || attributes.avatarKey || null;
      const cognitoUserData = {
        username: currentUser.username,
        userId: currentUser.userId,
        email: attributes.email,
        nickname: attributes.nickname || attributes.preferred_username || '',
        email_verified: attributes.email_verified === 'true',
        avatarKey,
        attributes: { ...attributes, avatarKey }
      };
      setCognitoUserInfo(cognitoUserData);
      console.log('Cognito用户信息加载完成:', cognitoUserData);
    } catch (error) {
      console.error('获取Cognito用户信息失败:', error);
      setCognitoUserInfo(null);
    } finally {
      setCognitoLoading(false);
    }
  }, []);

  // 检查现有的认证会话
  useEffect(() => {
    const checkExistingAuth = async () => {
      // 检查Amplify认证状态
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          console.log('🔄 检测到现有认证会话:', currentUser);
          // 认证和用户资料加载改为后台并行执行
          handleAuthSuccess(currentUser);
        }
      } catch (error) {
        console.log('🔍 未检测到现有认证会话:', error.message);
      } finally {
        // 现在，这只会在所有异步操作完成后执行
        setAuthInitialized(true);
      }
    };

    checkExistingAuth();
  }, [handleAuthSuccess]);

  // 监听Amplify的认证状态变化
  useEffect(() => {
    console.log('🔍 AuthContext: useEffect 监听认证状态变化', {
      authInitialized,
      amplifyAuthStatus: amplifyAuthHook.authStatus,
      amplifyUser: amplifyAuthHook.user,
      currentUser: user
    });

    if (!authInitialized) return;

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
            user ? 'user already exists' : 'unknown'
      });
    }
  }, [amplifyAuthHook, authInitialized, user, handleAuthSuccess, debugAuthCredentials, logout]);

  // 完善用户资料
  const completeProfileSetup = async (profileData) => {
    try {
      const result = await setupUserProfile(profileData);
      setUserProfile(result.user);
      setNeedsProfileSetup(false);

      // 同步更新 localStorage 缓存，避免下次 API 失败时恢复旧的"不完整"缓存
      if (result.user) {
        try {
          const userId = result.user.userId || user?.userId || user?.attributes?.sub;
          const cachedProfile = {
            ...result.user,
            exists: true,
            _cacheMeta: { t: Date.now(), userId }
          };
          if (userId) {
            localStorage.setItem(`userProfile:v1:${userId}`, JSON.stringify(cachedProfile));
          }
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cachedProfile));
        } catch (cacheError) {
          console.warn('⚠️ 无法在 completeProfileSetup 后写入缓存', cacheError);
        }
      }

      console.log('✅ 用户资料设置完成:', result);
      return result;
    } catch (error) {
      console.error('❌ 用户资料设置失败:', error);
      throw error;
    }
  };

  // 更新Cognito用户属性 - 增强邮箱验证处理
  const updateCognitoUserInfo = async (updates) => {
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
    try {
      await resendSignUpCode({ username: cognitoUserInfo?.username });
      return { success: true, message: '验证邮件已重新发送，请检查邮箱' };
    } catch (error) {
      console.error('重新发送验证邮件失败:', error);
      throw error;
    }
  };

  const isAuthenticated = !!user;

  // 当用户认证成功时，自动加载Cognito用户信息
  useEffect(() => {
    if (user && !cognitoUserInfo) {
      loadCognitoUserInfo();
    }
  }, [user, cognitoUserInfo, loadCognitoUserInfo]);

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
