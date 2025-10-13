/**
 * @file AuthContext 单元测试
 * @description 测试 AuthContext 的 Hook、初始状态和辅助函数
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth, AuthProvider } from '../../../src/contexts/AuthContext.jsx';

/**
 * Mock @aws-amplify/ui-react
 * AuthContext 依赖 useAuthenticator Hook
 */
vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: vi.fn(() => ({
    authStatus: 'unauthenticated',
    user: null,
  })),
}));

describe('AuthContext 单元测试', () => {
  
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================
  // Hook: useAuth
  // ============================================
  
  describe('useAuth Hook', () => {
    it('应该在 Provider 内返回 context 对象', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });
      
      expect(result.current).toBeDefined();
      expect(result.current.isAuthenticated).toBeDefined();
      expect(result.current.login).toBeDefined();
      expect(result.current.logout).toBeDefined();
      expect(result.current.user).toBeDefined(); // 可能是 null
      expect(result.current.userProfile).toBeDefined(); // 可能是 null
    });

    it('应该在 Provider 外使用时抛出错误', () => {
      // 捕获 console.error 以避免测试输出污染
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      // 恢复 console.error
      console.error = originalError;
    });
  });

  // ============================================
  // 初始状态
  // ============================================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态值', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 等待初始化完成
      await act(async () => {
        // AuthProvider 会在 mount 时执行 checkExistingAuth
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.user).toBeNull();
      expect(result.current.userProfile).toBeNull();
      expect(result.current.cognitoUserInfo).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.needsProfileSetup).toBe(false);
      expect(result.current.profileLoading).toBe(false);
      expect(result.current.cognitoLoading).toBe(false);
    });

    it('应该在初始化完成后设置 authInitialized=true', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // 初始化需要一些时间
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.authInitialized).toBe(true);
    });
  });

  // ============================================
  // isAuthenticated 计算属性
  // ============================================
  
  describe('isAuthenticated 计算属性', () => {
    it('无 user 时应该返回 false', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('应该根据 user 状态正确计算', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 初始状态: 无用户,isAuthenticated 应为 false
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  // ============================================
  // Context 提供的方法
  // ============================================
  
  describe('Context 提供的方法', () => {
    it('应该提供所有必需的方法', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 认证方法
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
      expect(typeof result.current.handleAuthSuccess).toBe('function');

      // 用户资料方法
      expect(typeof result.current.loadUserProfile).toBe('function');
      expect(typeof result.current.refreshUserProfile).toBe('function');
      expect(typeof result.current.completeProfileSetup).toBe('function');

      // Cognito 方法
      expect(typeof result.current.loadCognitoUserInfo).toBe('function');
      expect(typeof result.current.refreshCognitoUserInfo).toBe('function');
      expect(typeof result.current.updateCognitoUserInfo).toBe('function');
      expect(typeof result.current.resendEmailVerification).toBe('function');
    });
  });

  // ============================================
  // 状态值类型检查
  // ============================================
  
  describe('状态值类型检查', () => {
    it('所有状态值应该有正确的类型', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // null 或 object
      expect(result.current.user === null || typeof result.current.user === 'object').toBe(true);
      expect(result.current.userProfile === null || typeof result.current.userProfile === 'object').toBe(true);
      expect(result.current.cognitoUserInfo === null || typeof result.current.cognitoUserInfo === 'object').toBe(true);

      // boolean
      expect(typeof result.current.isAuthenticated).toBe('boolean');
      expect(typeof result.current.needsProfileSetup).toBe('boolean');
      expect(typeof result.current.profileLoading).toBe('boolean');
      expect(typeof result.current.cognitoLoading).toBe('boolean');
      expect(typeof result.current.authInitialized).toBe('boolean');
    });
  });
});
