import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserProfile, isUserProfileComplete, setupUserProfile } from '../api.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  // 加载用户资料
  const loadUserProfile = async (userId) => {
    if (!userId) return;

    setProfileLoading(true);
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);

      // 检查资料是否完整
      const isComplete = isUserProfileComplete(profile);
      setNeedsProfileSetup(!isComplete);

      console.log('📋 用户资料加载完成:', {
        profile,
        isComplete,
        needsSetup: !isComplete
      });
    } catch (error) {
      console.error('❌ 加载用户资料失败:', error);
      // 如果获取资料失败（如用户不存在），标记需要设置资料
      setNeedsProfileSetup(true);
      setUserProfile(null);
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

  // 登录时自动加载用户资料
  const login = (userData) => {
    setUser(userData);
    if (userData?.userId || userData?.attributes?.sub) {
      const userId = userData.userId || userData.attributes.sub;
      loadUserProfile(userId);
    }
  };

  // 注册后的回调处理
  const handleAuthSuccess = (amplifyUser) => {
    const userData = {
      userId: amplifyUser.attributes?.sub,
      username: amplifyUser.attributes?.nickname || amplifyUser.username,
      attributes: amplifyUser.attributes
    };

    // 设置用户状态
    setUser(userData);

    // 对于新注册用户，直接标记需要完善资料
    setNeedsProfileSetup(true);
    setUserProfile(null);

    console.log('🎉 认证成功，新用户需要完善资料:', userData);
  };

  const logout = () => {
    setUser(null);
    setUserProfile(null);
    setNeedsProfileSetup(false);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      profileLoading,
      needsProfileSetup,
      login,
      logout,
      isAuthenticated,
      loadUserProfile,
      completeProfileSetup,
      handleAuthSuccess
    }}>
      {children}
    </AuthContext.Provider>
  );
};
