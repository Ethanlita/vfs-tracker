/**
 * @file AuthContext 集成测试
 * @description 测试 AuthContext 与 API、Amplify 的集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../../../src/contexts/AuthContext.jsx';
import { QUERY_CACHE_STORAGE_KEY } from '../../../src/query/AppQueryProvider.jsx';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { completeProfileUser } from '../../../src/test-utils/fixtures/index.js';
import { http, HttpResponse } from 'msw';
import { 
  getCurrentUser, 
  fetchUserAttributes, 
  fetchAuthSession,
  updateUserAttributes,
  updatePassword,
  sendUserAttributeVerificationCode,
  confirmUserAttribute,
} from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

// Mock Amplify UI React
const mockUseAuthenticator = vi.fn(() => ({
  authStatus: 'configuring', // 使用 'configuring' 避免触发登出逻辑
  user: null,
}));

vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: (...args) => mockUseAuthenticator(...args),
}));

describe('AuthContext 集成测试', () => {
  
  const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';
  
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
    
    // 清理所有 mocks
    vi.clearAllMocks();
    // mockReturnValue 会跨用例保留，逐例恢复默认状态以隔离登录/登出场景。
    mockUseAuthenticator.mockReset();
    mockUseAuthenticator.mockReturnValue({
      authStatus: 'configuring',
      user: null,
    });
    
    // 设置默认的 auth mock 行为
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: 'us-east-1:test-user-001',
      username: 'testuser',
    });
    
    vi.mocked(fetchUserAttributes).mockResolvedValue({
      email: 'test@example.com',
      nickname: 'Test User',
      email_verified: 'true',
    });
    
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => 'mock-id-token-12345',
        },
      },
    });
    
    vi.mocked(updateUserAttributes).mockResolvedValue();
    vi.mocked(updatePassword).mockResolvedValue();
    vi.mocked(sendUserAttributeVerificationCode).mockResolvedValue({
      destination: 'n***@example.com',
      deliveryMedium: 'EMAIL',
      attributeName: 'email',
    });
    vi.mocked(confirmUserAttribute).mockResolvedValue();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================
  // Amplify 认证集成测试
  // ============================================
  
  describe('Amplify 认证集成', () => {
    it('应该在 Amplify 认证成功后自动加载用户信息', async () => {
      // Mock 用户已通过 Amplify 认证
      const mockAmplifyUser = {
        userId: 'us-east-1:test-user-001',
        username: 'testuser',
      };
      
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: mockAmplifyUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 等待初始化完成和用户信息加载
      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      }, { timeout: 3000 });

      expect(result.current.user).toBeDefined();
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('Amplify 认证后应该自动加载用户资料', async () => {
      // Mock getUserProfile API
      server.use(
        http.get(`${API_URL}/user/:userId`, () => {
          return HttpResponse.json({
            userId: 'us-east-1:test-user-001',
            profile: {
              nickname: 'Test User',
              gender: 'female',
              birthYear: 1990,
            },
          });
        })
      );

      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      // 等待资料加载
      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      }, { timeout: 3000 });

      // 应该已加载资料 (或至少尝试加载)
      expect(result.current.userProfile !== null || result.current.needsProfileSetup).toBe(true);
    });
  });

  // ============================================
  // 登出功能
  // ============================================
  
  describe('登出功能', () => {
    it('应该清除所有用户状态', async () => {
      // 先设置为已认证状态
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result, rerender } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // 模拟登出 - 改变 authStatus
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'unauthenticated',
        user: null,
      });

      // 触发重新渲染以应用新的 mock 值
      rerender();

      // 等待登出完成
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
      expect(result.current.cognitoUserInfo).toBeNull();
      expect(result.current.needsProfileSetup).toBe(false);
    });

    it('登出应该清除持久化查询中的账号资料', async () => {
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result, rerender } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.userProfile?.userId).toBe('us-east-1:test-user-001');
      });

      // Provider 恢复完成后再触发一次同一查询，确保本用例验证的是登出清理而非恢复订阅时序。
      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toContain('us-east-1:test-user-001');
      }, { timeout: 2000 });

      // 登出
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'unauthenticated',
        user: null,
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      // 用户状态和持久化资料必须同时清除。
      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
      expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY) || '').not.toContain('us-east-1:test-user-001');
    });
  });

  // ============================================
  // 加载用户资料 (loadUserProfile 方法)
  // ============================================
  
  describe('加载用户资料', () => {
    it('应该从 API 加载用户资料', async () => {
      const mockProfile = {
        userId: 'us-east-1:test-user-001',
        profile: {
          nickname: 'Test User',
          gender: 'female',
          birthYear: 1990,
          bio: 'Test bio',
        },
      };

      // Mock getUserProfile API - 直接匹配完整路径(包含冒号)
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning test-user-001 profile');
          return HttpResponse.json(mockProfile);
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      // 加载资料
      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.userProfile?.userId).toBe(mockProfile.userId);
      });
    });

    it('应该用按账号 queryKey 持久化已校验资料', async () => {
      const mockProfile = {
        userId: 'us-east-1:test-user-001',
        profile: {
          nickname: 'Test User',
          gender: 'female',
          birthYear: 1990,
        },
      };

      // 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning test-user-001 profile for cache test');
          return HttpResponse.json(mockProfile);
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => expect(result.current.userProfile?.userId).toBe(mockProfile.userId));
      await waitFor(() => {
        const cached = JSON.parse(localStorage.getItem(QUERY_CACHE_STORAGE_KEY));
        const profileQuery = cached.clientState.queries.find(
          query => query.queryKey[0] === 'profile' && query.queryKey[1] === mockProfile.userId,
        );
        expect(profileQuery.state.data).toMatchObject(mockProfile);
      }, { timeout: 2000 });
      expect(localStorage.getItem('userProfile:v1:us-east-1:test-user-001')).toBeNull();
    });

    it('重新挂载时恢复新鲜缓存且不重复读取资料', async () => {
      const cachedProfile = {
        ...completeProfileUser,
        exists: true,
        userId: 'us-east-1:test-user-001',
        profile: { ...completeProfileUser.profile, name: '离线可见名称' },
      };
      let getCalls = 0;
      server.use(
        http.get(`${API_URL}/user/us-east-1:test-user-001`, () => {
          getCalls += 1;
          return HttpResponse.json(cachedProfile);
        }),
      );
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: { userId: cachedProfile.userId, username: 'testuser' },
      });

      const firstMount = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(firstMount.result.current.userProfile?.profile?.name).toBe('离线可见名称'));
      await act(async () => {
        await firstMount.result.current.loadUserProfile(cachedProfile.userId);
      });
      await waitFor(() => {
        expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toContain('离线可见名称');
      }, { timeout: 2000 });
      const readsAfterSeed = getCalls;
      firstMount.unmount();

      // 若恢复后仍绕过 staleTime，这个处理器会使测试失败并暴露重复读取。
      server.use(
        http.get(`${API_URL}/user/us-east-1:test-user-001`, () => {
          getCalls += 1;
          return HttpResponse.json({ message: 'temporary failure' }, { status: 503 });
        }),
      );
      const restoredMount = renderHook(() => useAuth(), { wrapper: AuthProvider });
      // 持久化恢复由异步 Provider 完成；繁忙 CI 上允许与写入等待相同的时间窗口。
      await waitFor(() => {
        expect(restoredMount.result.current.userProfile?.profile?.name).toBe('离线可见名称');
      }, { timeout: 2000 });
      expect(restoredMount.result.current.needsProfileSetup).toBe(false);
      expect(getCalls).toBe(readsAfterSeed);
    });

    it('切换账号时不会展示持久化的上一账号资料', async () => {
      const firstUser = {
        ...completeProfileUser,
        exists: true,
        userId: 'us-east-1:test-user-001',
        profile: { ...completeProfileUser.profile, name: '账号甲资料' },
      };
      server.use(
        http.get(`${API_URL}/user/us-east-1:test-user-001`, () => HttpResponse.json(firstUser)),
      );
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: { userId: firstUser.userId, username: 'user-a' },
      });
      const firstMount = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(firstMount.result.current.userProfile?.profile?.name).toBe('账号甲资料'));
      await act(async () => {
        await firstMount.result.current.loadUserProfile(firstUser.userId);
      });
      await waitFor(() => expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toContain('账号甲资料'));
      firstMount.unmount();

      const secondUserId = 'us-east-1:test-user-002';
      vi.mocked(getCurrentUser).mockResolvedValue({ userId: secondUserId, username: 'user-b' });
      vi.mocked(fetchUserAttributes).mockResolvedValue({
        email: 'user-b@example.com', nickname: 'User B', email_verified: 'true',
      });
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: { userId: secondUserId, username: 'user-b' },
      });
      server.use(
        http.get(`${API_URL}/user/${secondUserId}`, () => HttpResponse.json(
          { error: 'User not found' },
          { status: 404 },
        )),
      );

      const secondMount = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(secondMount.result.current.user?.userId).toBe(secondUserId));
      await waitFor(() => expect(secondMount.result.current.needsProfileSetup).toBe(true));
      expect(secondMount.result.current.userProfile).toBeNull();
    });

    it('资料不完整时应该设置 needsProfileSetup=true', async () => {
      const incompleteProfile = {
        userId: 'us-east-1:test-user-001',
        profile: {
          nickname: 'Test User',
          // 缺少必需字段
        },
      };

      // 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning incomplete profile');
          return HttpResponse.json(incompleteProfile);
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => expect(result.current.needsProfileSetup).toBe(true));
    });

    it('用户不存在时应该设置 needsProfileSetup=true', async () => {
      // Mock API 返回 404 - 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning 404 for nonexistent user');
          return HttpResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => expect(result.current.needsProfileSetup).toBe(true));
      expect(result.current.userProfile).toBeNull();
    });
  });

  // ============================================
  // 刷新用户资料 (refreshUserProfile 方法)
  // ============================================
  
  // ============================================
  // 刷新用户资料
  // ============================================
  
  describe('刷新用户资料', () => {
    it('应该重新加载用户资料', async () => {
      const mockProfile = {
        userId: 'us-east-1:test-user-001',
        profile: {
          nickname: 'Updated User',
          gender: 'female',
          birthYear: 1990,
        },
      };

      // 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning updated profile for refresh test');
          return HttpResponse.json(mockProfile);
        })
      );

      // 设置已认证状态
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      // 刷新资料
      await act(async () => {
        await result.current.refreshUserProfile();
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      expect(result.current.userProfile).toBeDefined();
    });

    it('保存资料后立即更新同一缓存且不追加 GET', async () => {
      let getCalls = 0;
      const originalProfile = {
        exists: true,
        userId: 'us-east-1:test-user-001',
        updatedAt: '2026-09-11T00:00:00.000Z',
        profile: {
          name: '旧名称', nickname: 'Test User', isNamePublic: false,
          socials: [], areSocialsPublic: false,
        },
      };
      server.use(
        http.get(`${API_URL}/user/us-east-1:test-user-001`, () => {
          getCalls += 1;
          return HttpResponse.json(originalProfile);
        }),
        http.put(`${API_URL}/user/us-east-1:test-user-001`, async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            message: 'Profile updated successfully',
            user: {
              ...originalProfile,
              updatedAt: '2026-09-11T01:00:00.000Z',
              profile: { ...originalProfile.profile, ...body.profilePatch },
            },
          });
        }),
      );
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: { userId: 'us-east-1:test-user-001', username: 'testuser' },
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.userProfile?.profile?.name).toBe('旧名称'));
      const readsBeforeSave = getCalls;

      await act(async () => {
        await result.current.updateUserProfile({ profile: { name: '新名称' } });
      });

      // Query 缓存通知由微任务批处理；等待消费者观察到写请求确认的数据。
      await waitFor(() => {
        expect(result.current.userProfile.profile.name).toBe('新名称');
      });
      expect(getCalls).toBe(readsBeforeSave);
      await waitFor(() => {
        expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toContain('新名称');
      }, { timeout: 2000 });
    });
  });

  // ============================================
  // 完善用户资料 (completeProfileSetup 方法)
  // ============================================
  
  describe('完善用户资料', () => {
    it('应该调用 setupUserProfile API', async () => {
      const profileData = {
        profile: {
          name: 'New User',
          bio: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false,
        },
      };

      const mockResponse = {
        message: '用户资料创建成功',
        user: {
          userId: 'us-east-1:test-user-001',
          profile: profileData.profile,
        },
      };

      // Mock setupUserProfile API - 直接匹配完整路径(注意路径是 /user/profile-setup)
      server.use(
        http.post('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/profile-setup', async ({ request }) => {
          console.log('[MSW Override] Handling POST /user/profile-setup');
          const body = await request.json();
          expect(body.profile).toBeDefined();
          return HttpResponse.json(mockResponse);
        })
      );
      
      // 同时 mock getUserProfile 以便后续验证 - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning user profile after setup');
          return HttpResponse.json(mockResponse.user);
        })
      );

      // 设置已认证状态
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      // 完善资料
      await act(async () => {
        const response = await result.current.completeProfileSetup(profileData);
        expect(response).toBeDefined();
        expect(response.message).toBe('用户资料创建成功');
      });

      expect(result.current.userProfile).toBeDefined();
      expect(result.current.needsProfileSetup).toBe(false);
    });

    it('完善资料失败应该抛出错误', async () => {
      server.use(
        http.post(`${API_URL}/user/profile-setup`, () => {
          return HttpResponse.json(
            { error: 'Invalid data' },
            { status: 400 }
          );
        })
      );

      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      await expect(async () => {
        await act(async () => {
          await result.current.completeProfileSetup({
            profile: { name: '' } // 无效数据 - name为空
          });
        });
      }).rejects.toThrow();
    });
  });

  // ============================================
  // Cognito 用户信息管理
  // ============================================
  
  describe('Cognito 用户信息', () => {
    it('loadCognitoUserInfo 应该获取 Cognito 用户信息', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.loadCognitoUserInfo();
      });

      expect(result.current.cognitoUserInfo).toBeDefined();
      // Mock 返回的是 'testuser',不是 'dev_user'
      expect(result.current.cognitoUserInfo.username).toBe('testuser');
      expect(result.current.cognitoUserInfo.email).toBe('test@example.com');
      expect(result.current.cognitoLoading).toBe(false);
    });

    it('用户认证后应该自动加载 Cognito 信息', async () => {
      mockUseAuthenticator.mockReturnValue({
        authStatus: 'authenticated',
        user: {
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      // 等待自动加载
      await waitFor(() => {
        expect(result.current.cognitoUserInfo).not.toBeNull();
      }, { timeout: 3000 });

      expect(result.current.cognitoUserInfo).toBeDefined();
    });

    it('昵称成功但改密失败时重读已保存资料并返回部分成功', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.authInitialized).toBe(true));
      await act(async () => { await result.current.loadCognitoUserInfo(); });

      vi.mocked(fetchUserAttributes).mockResolvedValue({
        email: 'test@example.com',
        nickname: '已保存的新昵称',
        email_verified: 'true',
      });
      vi.mocked(updatePassword).mockRejectedValueOnce(new Error('Incorrect password'));

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateCognitoUserInfo({
          nickname: '已保存的新昵称',
          currentPassword: 'Old!123456',
          password: 'New!123456',
        });
      });

      expect(updateUserAttributes).toHaveBeenCalledWith({
        userAttributes: { nickname: '已保存的新昵称' },
      });
      expect(updatePassword).toHaveBeenCalledWith({
        oldPassword: 'Old!123456',
        newPassword: 'New!123456',
      });
      expect(updateResult).toMatchObject({
        success: false,
        partialSuccess: true,
        refreshed: true,
        message: expect.stringContaining('昵称已保存，但密码修改失败'),
      });
      expect(result.current.cognitoUserInfo.nickname).toBe('已保存的新昵称');
    });

    it('属性更新失败时不尝试改密', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.authInitialized).toBe(true));
      vi.mocked(updateUserAttributes).mockRejectedValueOnce(new Error('Attribute update failed'));

      await expect(act(async () => {
        await result.current.updateCognitoUserInfo({
          nickname: '不会保存',
          currentPassword: 'Old!123456',
          password: 'New!123456',
        });
      })).rejects.toThrow('Attribute update failed');

      expect(updatePassword).not.toHaveBeenCalled();
    });

    it('邮箱变更需要验证码时保存待验证状态，刷新后仍可恢复', async () => {
      vi.mocked(updateUserAttributes).mockResolvedValueOnce({
        email: {
          isUpdated: false,
          nextStep: {
            updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE',
            codeDeliveryDetails: {
              destination: 'n***@example.com',
              deliveryMedium: 'EMAIL',
              attributeName: 'email',
            },
          },
        },
      });
      const first = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(first.result.current.authInitialized).toBe(true));
      await act(async () => { await first.result.current.loadCognitoUserInfo(); });

      let updateResult;
      await act(async () => {
        updateResult = await first.result.current.updateCognitoUserInfo({ email: 'new@example.com' });
      });

      expect(updateResult).toMatchObject({
        success: true,
        needsEmailVerification: true,
        emailVerification: {
          email: 'new@example.com',
          previousEmail: 'test@example.com',
          destination: 'n***@example.com',
        },
      });
      expect(first.result.current.pendingEmailVerification.email).toBe('new@example.com');
      first.unmount();

      const restored = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(restored.result.current.pendingEmailVerification?.email).toBe('new@example.com'));
    });

    it('使用属性验证 API 重发并确认验证码，成功后清除恢复记录', async () => {
      vi.mocked(updateUserAttributes).mockResolvedValueOnce({
        email: {
          isUpdated: false,
          nextStep: {
            updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE',
            codeDeliveryDetails: { destination: 'n***@example.com', deliveryMedium: 'EMAIL' },
          },
        },
      });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.authInitialized).toBe(true));
      await act(async () => { await result.current.loadCognitoUserInfo(); });
      await act(async () => { await result.current.updateCognitoUserInfo({ email: 'new@example.com' }); });

      await act(async () => { await result.current.resendEmailVerification(); });
      expect(sendUserAttributeVerificationCode).toHaveBeenCalledWith({ userAttributeKey: 'email' });

      vi.mocked(fetchUserAttributes).mockResolvedValue({
        email: 'new@example.com', nickname: 'Test User', email_verified: 'true',
      });
      await act(async () => { await result.current.confirmEmailVerification(' 123456 '); });
      expect(confirmUserAttribute).toHaveBeenCalledWith({
        userAttributeKey: 'email',
        confirmationCode: '123456',
      });
      expect(result.current.pendingEmailVerification).toBeNull();
      expect(result.current.cognitoUserInfo).toMatchObject({ email: 'new@example.com', email_verified: true });
    });

    it('邮箱等待验证且改密失败时保留验证码流程并准确报告部分成功', async () => {
      vi.mocked(updateUserAttributes).mockResolvedValueOnce({
        email: {
          isUpdated: false,
          nextStep: {
            updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE',
            codeDeliveryDetails: { destination: 'n***@example.com', deliveryMedium: 'EMAIL' },
          },
        },
      });
      vi.mocked(updatePassword).mockRejectedValueOnce(new Error('Incorrect password'));
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.authInitialized).toBe(true));
      await act(async () => { await result.current.loadCognitoUserInfo(); });

      let updateResult;
      await act(async () => {
        updateResult = await result.current.updateCognitoUserInfo({
          email: 'new@example.com',
          currentPassword: 'Old!123456',
          password: 'New!123456',
        });
      });

      expect(updateResult).toMatchObject({
        success: false,
        partialSuccess: true,
        needsEmailVerification: true,
        message: expect.stringContaining('邮箱更换等待验证码确认，但密码修改失败'),
      });
      expect(result.current.pendingEmailVerification?.email).toBe('new@example.com');
    });

    it('取消邮箱更换时恢复原邮箱，Cognito 确认后才清除待验证状态', async () => {
      vi.mocked(updateUserAttributes)
        .mockResolvedValueOnce({
          email: {
            isUpdated: false,
            nextStep: {
              updateAttributeStep: 'CONFIRM_ATTRIBUTE_WITH_CODE',
              codeDeliveryDetails: { destination: 'n***@example.com', deliveryMedium: 'EMAIL' },
            },
          },
        })
        .mockResolvedValueOnce({
          email: { isUpdated: true, nextStep: { updateAttributeStep: 'DONE' } },
        });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.authInitialized).toBe(true));
      await act(async () => { await result.current.loadCognitoUserInfo(); });
      await act(async () => { await result.current.updateCognitoUserInfo({ email: 'new@example.com' }); });
      await act(async () => { await result.current.cancelEmailChange(); });

      expect(updateUserAttributes).toHaveBeenLastCalledWith({
        userAttributes: { email: 'test@example.com' },
      });
      expect(result.current.pendingEmailVerification).toBeNull();
    });
  });

  // ============================================
  // 错误处理
  // ============================================
  
  describe('错误处理', () => {
    it('API 调用失败应该正确处理', async () => {
      // Mock API 返回错误 - 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:test-user-001', () => {
          console.log('[MSW Override] Returning 500 error');
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      // 5xx 无法证明用户不存在，不能误开首次资料向导。
      expect(result.current.needsProfileSetup).toBe(false);
    });
  });

  // ============================================
  // Cognito 错误场景 (P1.2.3 - Phase 3.3 Code Review)
  // ============================================
  
  describe('Cognito 错误场景', () => {
    it('getCurrentUser 失败应该清除用户状态', async () => {
      // Mock getCurrentUser 失败 - 必须在 renderHook 之前设置
      vi.mocked(getCurrentUser).mockRejectedValue(
        new Error('User is not confirmed')
      );
      vi.mocked(fetchUserAttributes).mockRejectedValue(
        new Error('User is not confirmed')
      );
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 等待加载完成
      await waitFor(() => {
        expect(result.current.cognitoLoading).toBe(false);
      });

      // 应该保持未认证状态
      expect(result.current.cognitoUserInfo).toBeNull();
      expect(result.current.cognitoLoading).toBe(false);
    });

    it('fetchUserAttributes 失败应该记录错误但不崩溃', async () => {
      // Mock fetchUserAttributes 失败
      vi.mocked(fetchUserAttributes).mockRejectedValueOnce(
        new Error('Failed to fetch attributes')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.loadCognitoUserInfo();
        } catch (error) {
          // 预期可能失败
        }
      });

      // 应该完成加载（即使失败）
      expect(result.current.cognitoLoading).toBe(false);
    });

    it('fetchAuthSession token 过期应该返回 null', async () => {
      // Mock token 为 null (过期场景)
      vi.mocked(fetchAuthSession).mockResolvedValueOnce({
        tokens: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.loadCognitoUserInfo();
        } catch (error) {
          // 可能会失败
        }
      });

      // 应该完成加载
      expect(result.current.cognitoLoading).toBe(false);
    });

    it('updateUserAttributes 失败应该抛出错误', async () => {
      // Mock updateUserAttributes 失败
      vi.mocked(updateUserAttributes).mockRejectedValueOnce(
        new Error('Failed to update attributes')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      // 尝试更新属性应该失败
      await expect(async () => {
        await act(async () => {
          await result.current.updateCognitoUserAttributes({
            nickname: 'New Nickname'
          });
        });
      }).rejects.toThrow();
    });

    it('网络错误应该正确处理', async () => {
      // Mock 网络错误
      vi.mocked(getCurrentUser).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.authInitialized).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.loadCognitoUserInfo();
        } catch (error) {
          expect(error.message).toContain('Network');
        }
      });

      expect(result.current.cognitoLoading).toBe(false);
    });

    it('Cognito 会话过期应该清除状态', async () => {
      // Mock session 返回错误 - 必须在 renderHook 之前设置
      vi.mocked(getCurrentUser).mockRejectedValue(
        new Error('Session expired')
      );
      vi.mocked(fetchUserAttributes).mockRejectedValue(
        new Error('Session expired')
      );
      vi.mocked(fetchAuthSession).mockRejectedValue(
        new Error('Session expired')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 等待加载完成
      await waitFor(() => {
        expect(result.current.cognitoLoading).toBe(false);
      });

      // 应该完成加载，保持未认证状态
      expect(result.current.cognitoLoading).toBe(false);
      expect(result.current.cognitoUserInfo).toBeNull();
    });
  });
});
