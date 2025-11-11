/**
 * @file App.test.jsx
 * @description App组件的集成测试
 * 
 * 测试覆盖：
 * 1. 开发模式和生产模式的渲染
 * 2. 路由配置和导航
 * 3. 认证保护路由
 * 4. Service Worker 更新横幅
 * 5. 资料设置引导
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../../../src/App';

// Mock Amplify Authenticator
const mockAuthStatus = vi.fn();

vi.mock('@aws-amplify/ui-react', async () => {
  const actual = await vi.importActual('@aws-amplify/ui-react');
  return {
    ...actual,
    useAuthenticator: (selector) => {
      const context = {
        authStatus: mockAuthStatus()
      };
      // ProductionProtectedRoute 使用: useAuthenticator(context => [context.authStatus])
      // 这会解构第一个元素: const { authStatus } = useAuthenticator(...)
      if (selector) {
        const selected = selector(context);
        // 如果 selector 返回数组，返回包含 authStatus 的对象
        if (Array.isArray(selected)) {
          return { authStatus: selected[0] };
        }
        return selected;
      }
      return context;
    },
    Authenticator: {
      Provider: ({ children }) => <div data-testid="authenticator-provider">{children}</div>
    }
  };
});

// Mock AuthContext
const mockUseAuth = vi.fn();

vi.mock('../../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockUseAuth(),
    AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>
  };
});

/**
 * 注意：不再 mock 页面组件，使用真实组件进行集成测试
 * MSW handlers 会拦截所有 API 调用，提供模拟数据
 * 这样可以测试真实的组件行为和用户交互流程
 */

describe('App Component', () => {
  const user = userEvent.setup();

  /**
   * 设置默认的未认证状态 mock
   */
  const setupDefaultAuth = () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      needsProfileSetup: false,
      profileLoading: false,
      authInitialized: true
    });
  };

  /**
   * 设置已认证用户 mock
   */
  const setupAuthenticatedUser = (authStatus = 'unauthenticated') => {
    mockAuthStatus.mockReturnValue(authStatus);
    mockUseAuth.mockReturnValue({
      isAuthenticated: authStatus === 'authenticated',
      needsProfileSetup: false,
      profileLoading: false,
      authInitialized: true
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultAuth(); // 默认未认证状态
  });

  describe('基础渲染', () => {
    it('在开发模式下应该渲染应用', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
      
      // 验证真实的 Layout 组件渲染（包含导航栏）
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('在生产模式下应该包含 Authenticator.Provider', () => {
      setupAuthenticatedUser();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('authenticator-provider')).toBeInTheDocument();
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    });

    it('应该渲染应用导航栏', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的导航栏渲染
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });
  });

  describe('公开路由', () => {
    it('应该渲染首页 (/)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 Home 组件内容 - 使用更精确的查询（heading level 1）
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /欢迎来到VFS Tracker/i })).toBeInTheDocument();
      });
    });

    it('应该渲染公开仪表板 (/dashboard)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 PublicDashboard 组件内容（标题或数据展示）
      await waitFor(() => {
        expect(screen.getByText(/公开仪表板|数据展示|最新事件/i)).toBeInTheDocument();
      });
    });

    it('应该渲染文章列表 (/posts)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/posts']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 PostList 组件（页面标题或主内容区域）
      await waitFor(() => {
        // PostList 组件会显示 "所有文档" 或有主内容区域
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('应该渲染文档查看器 (/docs)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/docs']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 PostViewer 组件（主内容区域）
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('应该渲染音频工具 (/note-frequency-tool)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/note-frequency-tool']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 NoteFrequencyTool 组件（主内容区域）
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('应该渲染时间轴测试页面 (/timeline-test)', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/timeline-test']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 TimelineTest 组件（主内容区域）
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });

  describe('保护路由', () => {
    it('未认证用户应该被重定向到首页', async () => {
      setupAuthenticatedUser('unauthenticated');
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 应该重定向到首页并显示真实的 Home 组件内容 - 使用更精确的查询
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /欢迎来到VFS Tracker/i })).toBeInTheDocument();
      });
      
      // 不应该看到 MyPage 的内容（查找特定的 MyPage 元素）
      expect(screen.queryByRole('heading', { name: /我的页面|个人中心/i })).not.toBeInTheDocument();
    });

    it('认证用户应该能访问保护路由', async () => {
      setupAuthenticatedUser('authenticated');
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 验证真实的 MyPage 组件内容
      await waitFor(() => {
        expect(screen.getByText(/我的页面|个人中心|My Page/i)).toBeInTheDocument();
      });
    });

    it('配置中状态应该显示加载指示器', () => {
      setupAuthenticatedUser('configuring');
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByText('正在验证身份认证状态...')).toBeInTheDocument();
    });
  });

  describe('资料设置引导', () => {
    it('需要设置资料时应该自动跳转到向导页面', async () => {
      mockAuthStatus.mockReturnValue('authenticated');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        needsProfileSetup: true,
        profileLoading: false,
        authInitialized: true
      });
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 应该自动跳转到资料设置向导，验证真实组件内容
      // 查找向导页面的特定元素（如标题或步骤指示器）
      await waitFor(() => {
        const heading = screen.queryByRole('heading', { name: /资料设置|完善资料|Profile Setup/i });
        const setupButton = screen.queryByRole('button', { name: /完善资料/i });
        expect(heading || setupButton).toBeInTheDocument();
      });
    });

    it('资料加载中时不应该跳转', async () => {
      mockAuthStatus.mockReturnValue('authenticated');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        needsProfileSetup: true,
        profileLoading: true, // 正在加载
        authInitialized: true
      });
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 应该停留在当前页面，验证真实的 MyPage 组件
      await waitFor(() => {
        expect(screen.getByText(/我的页面|个人中心|My Page/i)).toBeInTheDocument();
      });
      
      // 不应该看到资料设置向导的主要标题（排除横幅按钮）
      expect(screen.queryByRole('heading', { name: /资料设置|完善资料|Profile Setup/i })).not.toBeInTheDocument();
    });
  });

  describe('Service Worker 更新横幅', () => {
    it('收到更新事件时应该显示横幅', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // 触发 SW 更新事件
      const event = new Event('sw:update-available');
      window.dispatchEvent(event);

      await waitFor(() => {
        expect(screen.getByText('检测到应用有新版本可用。')).toBeInTheDocument();
      });
    });

    it('点击立即刷新按钮应该重新加载页面', async () => {
      setupDefaultAuth();
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      });
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // 触发更新事件
      window.dispatchEvent(new Event('sw:update-available'));

      await waitFor(() => {
        expect(screen.getByText('检测到应用有新版本可用。')).toBeInTheDocument();
      });

      // 点击刷新按钮
      const reloadButton = screen.getByRole('button', { name: '立即刷新' });
      await user.click(reloadButton);

      expect(mockReload).toHaveBeenCalled();
    });

    it('点击稍后提醒应该隐藏横幅', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      // 触发更新事件
      window.dispatchEvent(new Event('sw:update-available'));

      await waitFor(() => {
        expect(screen.getByText('检测到应用有新版本可用。')).toBeInTheDocument();
      });

      // 点击稍后提醒
      const dismissButton = screen.getByRole('button', { name: '稍后提醒' });
      await user.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('检测到应用有新版本可用。')).not.toBeInTheDocument();
      });
    });
  });

  describe('未知路由', () => {
    it('应该将未知路径重定向到首页', async () => {
      setupDefaultAuth();
      
      render(
        <MemoryRouter initialEntries={['/unknown-route']}>
          <App />
        </MemoryRouter>
      );

      // 验证重定向到真实的 Home 组件 - 使用更精确的查询
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /欢迎来到VFS Tracker/i })).toBeInTheDocument();
      });
    });
  });

  describe('在线/离线状态处理', () => {
    it('离线时不应该自动跳转到资料设置', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      mockAuthStatus.mockReturnValue('authenticated');
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        needsProfileSetup: true,
        profileLoading: false,
        authInitialized: true
      });
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 离线时应该停留在当前页面，验证真实的 MyPage 组件（通过主内容区域验证）
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
      
      // 不应该看到资料设置向导的主要标题（排除横幅按钮）
      expect(screen.queryByRole('heading', { name: /资料设置|完善资料|Profile Setup/i })).not.toBeInTheDocument();

      // 恢复 onLine 状态
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    });
  });
});
