import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useIsRestoring, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  updatePassword,
  sendUserAttributeVerificationCode,
  confirmUserAttribute
} from 'aws-amplify/auth';
import { isUserProfileComplete, setupUserProfile, updateUserProfile as updateUserProfileRequest } from '../api.js';
import AppQueryProvider, { removePersistedServerState } from '../query/AppQueryProvider.jsx';
import {
  profileQueryKey,
  profileQueryOptions,
  validateProfileQueryResponse,
} from '../query/profileQuery.js';
import {
  PENDING_PROFILE_EVENT,
  profileBaseVersion,
  readPendingProfileSetup,
  removePendingProfileSetup,
} from '../utils/pendingProfileSetup.js';
import {
  readPendingEmailVerification,
  removePendingEmailVerification,
  writePendingEmailVerification,
} from '../utils/pendingEmailVerification.js';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthContextStateProvider = ({ children }) => {


  const [user, setUser] = useState(null);
  const [cognitoUserInfo, setCognitoUserInfo] = useState(null); // 新增：Cognito用户详细信息
  const [pendingEmailVerification, setPendingEmailVerification] = useState(null);
  const [cognitoLoading, setCognitoLoading] = useState(false); // 新增：Cognito操作加载状态
  const [authInitialized, setAuthInitialized] = useState(false);
  const [pendingProfileSetup, setPendingProfileSetup] = useState(null);
  const [pendingProfileSyncing, setPendingProfileSyncing] = useState(false);
  const [pendingProfileError, setPendingProfileError] = useState(null);
  const [pendingProfileConflict, setPendingProfileConflict] = useState(false);
  const pendingProfileSyncRef = useRef(false);



  // 监听Amplify认证状态
  const { authStatus, user: amplifyUser } = useAuthenticator();

  const amplifyAuthHook = useMemo(() => ({ authStatus, user: amplifyUser }), [authStatus, amplifyUser]);
  const queryClient = useQueryClient();
  const isRestoringQueryCache = useIsRestoring();
  const activeUserId = user?.userId || user?.attributes?.sub || null;
  const profileQuery = useQuery({
    ...profileQueryOptions(activeUserId || 'signed-out'),
    enabled: Boolean(activeUserId),
  });
  const userProfile = profileQuery.data ?? null;
  // 离线且没有缓存时查询会暂停；此时不把页面锁在永久加载状态。
  const profileLoading = Boolean(activeUserId) && !profileQuery.data && (
    isRestoringQueryCache
    || (profileQuery.isPending && profileQuery.fetchStatus !== 'paused')
  );
  const profileStatusCode = profileQuery.error?.statusCode
    ?? profileQuery.error?.status
    ?? profileQuery.error?.$metadata?.httpStatusCode;
  const needsProfileSetup = Boolean(user) && (
    !activeUserId || (userProfile ? !isUserProfileComplete(userProfile) : profileStatusCode === 404)
  );



  /** 使用统一 queryKey 强制读取资料；失败状态留在 Query 中供界面判断与重试。 */
  const fetchUserProfileQuery = useCallback(
    userId => queryClient.fetchQuery({ ...profileQueryOptions(userId), staleTime: 0 }),
    [queryClient],
  );

  /** 兼容现有调用方的显式读取入口，错误由 Query 保存且不制造未处理拒绝。 */
  const loadUserProfile = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      return await fetchUserProfileQuery(userId);
    } catch {

      return null;
    }
  }, [fetchUserProfileQuery]);

  const profileSetupMutation = useMutation({
    mutationFn: ({ profileData, baseVersion }) => setupUserProfile(profileData, baseVersion),
  });
  const profileUpdateMutation = useMutation({
    mutationFn: ({ userId, profileData }) => updateUserProfileRequest(userId, profileData),
  });

  const handleAuthSuccess = useCallback(async (amplifyUser) => {



    try {
      // 使用Amplify v6标准API获取完整用户信息

      const [currentUser, userAttributes] = await Promise.all([
        getCurrentUser(),
        fetchUserAttributes()
      ]);





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




      // 设置用户状态
      setUser(userData);

      // userId 生效后由 useQuery 唯一负责读取；这样持久化恢复与 staleTime 不会被强制请求绕过。


    } catch {



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


      setUser(basicUserData);
    }
  }, []);

  const logout = useCallback(() => {
    // 同时移除内存与持久化查询，切换账号不能短暂显示前一用户资料。
    queryClient.removeQueries({ queryKey: ['profile'] });
    removePersistedServerState();
    setUser(null);
    setCognitoUserInfo(null);
    setPendingEmailVerification(null);
  }, [queryClient]);

  // 刷新页面或切换账号时，只恢复当前 Cognito 用户自己的待验证邮箱。
  useEffect(() => {
    const ownerUserId = user?.userId || user?.attributes?.sub;
    setPendingEmailVerification(readPendingEmailVerification(ownerUserId));
  }, [user]);

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

      return cognitoUserData;
    } catch {

      // 刷新失败时保留上次已确认状态；首次加载本来就是 null，登出另有显式清理。
      return null;
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

          // 认证和用户资料加载改为后台并行执行
          handleAuthSuccess(currentUser);
        }
      } catch {
      // 错误已由页面状态或恢复路径处理，不向控制台输出用户数据。

      } finally {
        // 现在，这只会在所有异步操作完成后执行
        setAuthInitialized(true);
      }
    };

    checkExistingAuth();
  }, [handleAuthSuccess]);

  // 监听Amplify的认证状态变化
  useEffect(() => {


    if (!authInitialized) return;

    const { authStatus, user: amplifyUser } = amplifyAuthHook;

    if (authStatus === 'authenticated' && amplifyUser && !user) {

      handleAuthSuccess(amplifyUser);
    } else if (authStatus === 'unauthenticated' && user) {

      logout();
    }
  }, [amplifyAuthHook, authInitialized, user, handleAuthSuccess, logout]);

  // 完善用户资料
  const completeProfileSetup = useCallback(async (profileData, baseVersion = profileBaseVersion(userProfile)) => {
    {
      const result = await profileSetupMutation.mutateAsync({ profileData, baseVersion });
      const userId = result.user?.userId || activeUserId;
      if (result.user && userId) {
        const confirmedUser = validateProfileQueryResponse(
          { ...result.user, exists: true, userId },
          userId,
        );
        queryClient.setQueryData(profileQueryKey(userId), confirmedUser);
        // 标记为待后台校验，但不立即覆盖刚由写请求确认的数据。
        await queryClient.invalidateQueries({
          queryKey: profileQueryKey(userId),
          exact: true,
          refetchType: 'none',
        });
      }


      return result;
    }
  }, [activeUserId, profileSetupMutation, queryClient, userProfile]);

  /** 保存资料补丁并立即写入同一查询缓存，所有消费者在本次渲染周期内同步。 */
  const updateUserProfile = useCallback(async (profileData) => {
    if (!activeUserId) throw new Error('未检测到当前登录账号。');
    const result = await profileUpdateMutation.mutateAsync({ userId: activeUserId, profileData });
    if (!result?.user) throw new TypeError('资料更新响应缺少用户数据。');
    const confirmedUser = validateProfileQueryResponse(
      { ...result.user, exists: true, userId: activeUserId },
      activeUserId,
    );
    queryClient.setQueryData(profileQueryKey(activeUserId), confirmedUser);
    await queryClient.invalidateQueries({
      queryKey: profileQueryKey(activeUserId),
      exact: true,
      refetchType: 'none',
    });
    return result;
  }, [activeUserId, profileUpdateMutation, queryClient]);

  /** 重新读取当前账号的离线资料草稿，读取失败保留明确错误状态。 */
  const refreshPendingProfileSetup = useCallback(async () => {
    const ownerUserId = user?.userId || user?.attributes?.sub;
    if (!ownerUserId) {
      setPendingProfileSetup(null);
      setPendingProfileError(null);
      setPendingProfileConflict(false);
      return null;
    }
    try {
      const draft = await readPendingProfileSetup(ownerUserId);
      setPendingProfileSetup(draft);
      setPendingProfileError(null);
      if (!draft) setPendingProfileConflict(false);
      return draft;
    } catch (error) {
      setPendingProfileSetup(null);
      setPendingProfileError(error);
      return null;
    }
  }, [user]);

  /**
   * 同步当前账号的资料草稿；冲突时仅在用户明确覆盖后换用最新服务端版本。
   * @param {{overwrite?:boolean}} options 是否由用户确认覆盖同字段的服务端更新。
   * @returns {Promise<boolean>} 草稿是否已由服务确认并安全清除。
   */
  const retryPendingProfileSetup = useCallback(async ({ overwrite = false } = {}) => {
    const ownerUserId = user?.userId || user?.attributes?.sub;
    if (!ownerUserId || pendingProfileSyncRef.current) return false;
    pendingProfileSyncRef.current = true;
    setPendingProfileSyncing(true);
    setPendingProfileError(null);
    try {
      const draft = await readPendingProfileSetup(ownerUserId);
      if (!draft) {
        setPendingProfileSetup(null);
        setPendingProfileConflict(false);
        return true;
      }
      setPendingProfileSetup(draft);
      if (draft.baseVersion === null && !overwrite) {
        setPendingProfileConflict(true);
        return false;
      }
      const baseVersion = overwrite
        ? profileBaseVersion(await fetchUserProfileQuery(ownerUserId))
        : draft.baseVersion;
      await completeProfileSetup(draft.payload, baseVersion);
      await removePendingProfileSetup(ownerUserId, draft.draftId);
      await refreshPendingProfileSetup();
      setPendingProfileConflict(false);
      return true;
    } catch (error) {
      const statusCode = error?.statusCode ?? error?.status ?? error?.$metadata?.httpStatusCode;
      if (statusCode === 409 || error?.errorCode === 'PROFILE_SETUP_CONFLICT') setPendingProfileConflict(true);
      setPendingProfileError(error);
      return false;
    } finally {
      pendingProfileSyncRef.current = false;
      setPendingProfileSyncing(false);
    }
  }, [user, completeProfileSetup, fetchUserProfileQuery, refreshPendingProfileSetup]);

  // 账号、其他标签页或本页草稿变化后，只读取当前账号独立的键。
  useEffect(() => {
    refreshPendingProfileSetup();
    const refresh = () => refreshPendingProfileSetup();
    window.addEventListener('storage', refresh);
    window.addEventListener(PENDING_PROFILE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(PENDING_PROFILE_EVENT, refresh);
    };
  }, [refreshPendingProfileSetup]);

  // 在线且无已知冲突/错误时自动同步；失败后等待联网事件或用户手动重试。
  useEffect(() => {
    if (!pendingProfileSetup || pendingProfileSyncing || pendingProfileError || pendingProfileConflict || navigator.onLine === false) return;
    retryPendingProfileSetup();
  }, [pendingProfileSetup, pendingProfileSyncing, pendingProfileError, pendingProfileConflict, retryPendingProfileSetup]);

  useEffect(() => {
    const retryWhenOnline = () => {
      setPendingProfileError(null);
      setPendingProfileConflict(false);
      refreshPendingProfileSetup();
    };
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [refreshPendingProfileSetup]);

  /**
   * 按“账户属性→密码”的唯一顺序更新 Cognito，并明确返回部分成功状态。
   * @param {{ nickname?: string, email?: string, password?: string, currentPassword?: string }} updates - 用户确认的账户修改。
   * @returns {Promise<{ success: boolean, partialSuccess?: boolean, message: string, needsEmailVerification: boolean, emailVerification?: object|null, refreshed?: boolean }>} 保存结果。
   */
  const updateCognitoUserInfo = async (updates) => {
    setCognitoLoading(true);
    try {
      const attributesToUpdate = {};
      let emailChanged = false;
      let emailVerification = null;
      let savedAttributeNames = [];

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
        savedAttributeNames = Object.keys(attributesToUpdate);

        const emailStep = result?.email?.nextStep;
        if (emailChanged && emailStep?.updateAttributeStep === 'CONFIRM_ATTRIBUTE_WITH_CODE') {
          const delivery = emailStep.codeDeliveryDetails || {};
          emailVerification = writePendingEmailVerification(
            cognitoUserInfo?.userId || user?.userId || user?.attributes?.sub,
            {
              email: updates.email,
              previousEmail: pendingEmailVerification?.previousEmail || cognitoUserInfo?.email || '',
              destination: delivery.destination,
              deliveryMedium: delivery.deliveryMedium,
            },
          );
          setPendingEmailVerification(emailVerification);
        } else if (emailChanged) {
          const ownerUserId = cognitoUserInfo?.userId || user?.userId || user?.attributes?.sub;
          removePendingEmailVerification(ownerUserId);
          setPendingEmailVerification(null);
        }
      }

      // 处理密码更新
      if (updates.password && updates.currentPassword) {
        try {
          await updatePassword({
            oldPassword: updates.currentPassword,
            newPassword: updates.password
          });
        } catch (passwordError) {
          if (!savedAttributeNames.length) throw passwordError;

          const refreshed = Boolean(await loadCognitoUserInfo());
          const savedLabels = savedAttributeNames
            .map((name) => {
              if (name === 'nickname') return '昵称已保存';
              return emailVerification ? '邮箱更换等待验证码确认' : '邮箱已保存';
            })
            .join('，');
          const refreshMessage = refreshed
            ? ''
            : ' 已保存状态暂时无法重新读取，当前输入已保留。';
          return {
            success: false,
            partialSuccess: true,
            message: `${savedLabels}，但密码修改失败，请检查当前密码后重试。${refreshMessage}`,
            needsEmailVerification: Boolean(emailVerification),
            emailVerification,
            refreshed
          };
        }
      }

      await loadCognitoUserInfo();

      const completedLabels = [];
      if (savedAttributeNames.includes('nickname')) completedLabels.push('昵称');
      if (savedAttributeNames.includes('email') && !emailVerification) completedLabels.push('邮箱');
      if (updates.password) completedLabels.push('密码');
      const completedMessage = completedLabels.length ? `${completedLabels.join('和')}已更新。` : '';
      const message = emailVerification
        ? `${completedMessage}验证码已发送至${emailVerification.destination || '新邮箱'}，输入验证码后才会完成邮箱更换。`
        : (updates.password ? '账户信息和密码更新成功！' : '账户信息更新成功！');

      return {
        success: true,
        message,
        needsEmailVerification: Boolean(emailVerification),
        emailVerification,
        completedMessage,
      };
    } finally {
      setCognitoLoading(false);
    }
  };

  /** 使用 Cognito 属性验证接口重新发送当前邮箱验证码。 */
  const resendEmailVerification = async () => {
    setCognitoLoading(true);
    try {
      const delivery = await sendUserAttributeVerificationCode({ userAttributeKey: 'email' });
      const ownerUserId = cognitoUserInfo?.userId || user?.userId || user?.attributes?.sub;
      const verification = writePendingEmailVerification(ownerUserId, {
        email: pendingEmailVerification?.email || cognitoUserInfo?.email || user?.attributes?.email,
        previousEmail: pendingEmailVerification?.previousEmail || cognitoUserInfo?.email || '',
        destination: delivery?.destination,
        deliveryMedium: delivery?.deliveryMedium,
      });
      setPendingEmailVerification(verification);
      return { success: true, message: '新的邮箱验证码已发送，请检查收件箱。', emailVerification: verification };
    } finally {
      setCognitoLoading(false);
    }
  };

  /** 提交邮箱属性验证码；确认成功后清除恢复记录并重读 Cognito。 */
  const confirmEmailVerification = async (confirmationCode) => {
    setCognitoLoading(true);
    try {
      await confirmUserAttribute({ userAttributeKey: 'email', confirmationCode: confirmationCode.trim() });
      const ownerUserId = cognitoUserInfo?.userId || user?.userId || user?.attributes?.sub;
      removePendingEmailVerification(ownerUserId);
      setPendingEmailVerification(null);
      const refreshed = Boolean(await loadCognitoUserInfo());
      return { success: true, message: '新邮箱验证成功，邮箱更换已完成。', refreshed };
    } finally {
      setCognitoLoading(false);
    }
  };

  /** 将邮箱属性改回变更前地址，仅在 Cognito 确认完成后清除待验证状态。 */
  const cancelEmailChange = async () => {
    const verification = pendingEmailVerification;
    if (!verification?.previousEmail || verification.previousEmail === verification.email) {
      throw new Error('无法确定变更前邮箱，请改为提交新的邮箱地址。');
    }
    setCognitoLoading(true);
    try {
      const result = await updateUserAttributes({ userAttributes: { email: verification.previousEmail } });
      if (result?.email?.nextStep?.updateAttributeStep === 'CONFIRM_ATTRIBUTE_WITH_CODE') {
        throw new Error('Cognito 要求重新验证原邮箱，当前更换尚未取消。');
      }
      const ownerUserId = cognitoUserInfo?.userId || user?.userId || user?.attributes?.sub;
      removePendingEmailVerification(ownerUserId);
      setPendingEmailVerification(null);
      await loadCognitoUserInfo();
      return { success: true, message: '邮箱更换已取消。' };
    } finally {
      setCognitoLoading(false);
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
  const refreshUserProfile = async () => activeUserId ? loadUserProfile(activeUserId) : null;

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
      authStatus: amplifyAuthHook.authStatus,
      logout,
      isAuthenticated,
      loadUserProfile,
      refreshUserProfile, // 确保暴露这个方法
      updateUserProfile,
      completeProfileSetup,
      pendingProfileSetup,
      pendingProfileSyncing,
      pendingProfileError,
      pendingProfileConflict,
      refreshPendingProfileSetup,
      retryPendingProfileSetup,
      handleAuthSuccess,
      cognitoUserInfo, // Cognito用户详细信息
      pendingEmailVerification,
      cognitoLoading, // Cognito操作加载状态
      loadCognitoUserInfo, // 加载Cognito用户信息
      updateCognitoUserInfo, // 更新Cognito用户信息
      resendEmailVerification,
      confirmEmailVerification,
      cancelEmailChange,
      refreshCognitoUserInfo // 刷新Cognito用户信息
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/** 为认证上下文安装独立服务器状态容器，测试和应用入口共享相同生命周期。 */
export const AuthProvider = ({ children }) => (
  <AppQueryProvider>
    <AuthContextStateProvider>{children}</AuthContextStateProvider>
  </AppQueryProvider>
);
