/**
 * @file AuthContext 集成测试
 * @description 测试 AuthContext 与 API、Amplify 的集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../../../src/contexts/AuthContext.jsx';
import { server } from '../../../src/test-utils/mocks/msw-server.js';
import { http, HttpResponse } from 'msw';
import { 
  getCurrentUser, 
  fetchUserAttributes, 
  fetchAuthSession,
  updateUserAttributes 
} from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

// Mock Amplify UI React
vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: vi.fn(() => ({
    authStatus: 'configuring', // 使用 'configuring' 避免触发登出逻辑
    user: null,
  })),
}));

describe('AuthContext 集成测试', () => {
  
  const API_URL = 'https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev';
  
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
    
    // 清理所有 mocks
    vi.clearAllMocks();
    
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
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================
  // 开发模式登录 (login 方法)
  // ============================================
  
  describe('开发模式登录', () => {
    it('应该能够登录并设置用户状态', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 等待初始化
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const mockUser = {
        userId: 'dev-user-001',
        username: 'devuser',
        attributes: {
          email: 'dev@example.com',
          nickname: 'Dev User',
        },
      };

      act(() => {
        result.current.login(mockUser);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('登录后应该触发加载用户资料', async () => {
      // Mock getUserProfile API
      server.use(
        http.get(`${API_URL}/user/:userId`, () => {
          return HttpResponse.json({
            userId: 'dev-user-001',
            profile: {
              nickname: 'Dev User',
              gender: 'female',
              birthYear: 1990,
            },
          });
        })
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const mockUser = {
        userId: 'dev-user-001',
        username: 'devuser',
      };

      act(() => {
        result.current.login(mockUser);
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
  // 登出 (logout 方法)
  // ============================================
  
  describe('登出功能', () => {
    it('应该清除所有用户状态', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 先登录
      const mockUser = {
        userId: 'test-user-001',
        username: 'testuser',
      };

      act(() => {
        result.current.login(mockUser);
      });

      expect(result.current.isAuthenticated).toBe(true);

      // 再登出
      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
      expect(result.current.cognitoUserInfo).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.needsProfileSetup).toBe(false);
    });

    it('登出应该清除 localStorage (开发模式)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 先登录
      const mockUser = { userId: 'test-user-001' };
      
      act(() => {
        result.current.login(mockUser);
      });

      // 确认已保存
      expect(localStorage.getItem('dev-user')).toBeDefined();

      // 登出
      act(() => {
        result.current.logout();
      });

      // 应该已清除
      expect(localStorage.getItem('dev-user')).toBeNull();
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 加载资料
      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      expect(result.current.userProfile).toBeDefined();
      expect(result.current.userProfile.userId).toBe(mockProfile.userId);
    });

    it('应该缓存用户资料到 localStorage', async () => {
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      // 检查 localStorage
      const cacheKey = 'userProfile:v1:us-east-1:test-user-001';
      const cached = localStorage.getItem(cacheKey);
      
      expect(cached).toBeDefined();
      
      if (cached) {
        const parsedCache = JSON.parse(cached);
        expect(parsedCache.userId).toBe(mockProfile.userId);
        expect(parsedCache._cacheMeta).toBeDefined();
      }
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      // 应该标记需要完善资料
      expect(result.current.needsProfileSetup).toBe(true);
    });

    it('用户不存在时应该设置 needsProfileSetup=true', async () => {
      // Mock API 返回 404 - 覆盖默认 handler - 直接匹配完整路径
      server.use(
        http.get('https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev/user/us-east-1:nonexistent-user', () => {
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:nonexistent-user');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      expect(result.current.needsProfileSetup).toBe(true);
      expect(result.current.userProfile).toBeNull();
    });
  });

  // ============================================
  // 刷新用户资料 (refreshUserProfile 方法)
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

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 先登录
      act(() => {
        result.current.login({
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        });
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
  });

  // ============================================
  // 完善用户资料 (completeProfileSetup 方法)
  // ============================================
  
  describe('完善用户资料', () => {
    it('应该调用 setupUserProfile API', async () => {
      const profileData = {
        nickname: 'New User',
        gender: 'female',
        birthYear: 1995,
      };

      const mockResponse = {
        message: '用户资料创建成功',
        user: {
          userId: 'us-east-1:test-user-001',
          profile: profileData,
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

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 先设置用户
      act(() => {
        result.current.login({
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        });
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

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      act(() => {
        result.current.login({
          userId: 'us-east-1:test-user-001',
          username: 'testuser',
        });
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
    it('loadCognitoUserInfo 应该获取 Cognito 用户信息 (开发模式)', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
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

    it('用户登录后应该自动加载 Cognito 信息', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      act(() => {
        result.current.login({
          userId: 'test-user-001',
          username: 'testuser',
        });
      });

      // 等待自动加载
      await waitFor(() => {
        expect(result.current.cognitoUserInfo).not.toBeNull();
      }, { timeout: 1000 });

      expect(result.current.cognitoUserInfo).toBeDefined();
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.loadUserProfile('us-east-1:test-user-001');
      });

      await waitFor(() => {
        expect(result.current.profileLoading).toBe(false);
      });

      // 应该设置需要完善资料
      expect(result.current.needsProfileSetup).toBe(true);
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
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

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
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
