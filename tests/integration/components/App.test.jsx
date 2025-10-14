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

// Mock env.js
const mockIsProductionReady = vi.fn();

vi.mock('../../../src/env.js', () => ({
  isProductionReady: () => mockIsProductionReady()
}));

// Mock all page components
vi.mock('../../../src/components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>
}));

vi.mock('../../../src/components/Auth', () => ({
  default: () => <div data-testid="auth-component">Auth Component</div>
}));

vi.mock('../../../src/components/MyPage', () => ({
  default: () => <div data-testid="mypage">My Page</div>
}));

vi.mock('../../../src/components/Home', () => ({
  default: () => <div data-testid="home">Home Page</div>
}));

vi.mock('../../../src/components/PublicDashboard', () => ({
  default: () => <div data-testid="public-dashboard">Public Dashboard</div>
}));

vi.mock('../../../src/components/AddEvent', () => ({
  default: () => <div data-testid="add-event">Add Event Page</div>
}));

vi.mock('../../../src/components/EventManagerPage', () => ({
  default: () => <div data-testid="event-manager">Event Manager Page</div>
}));

vi.mock('../../../src/components/UserProfileManager', () => ({
  default: () => <div data-testid="profile-manager">Profile Manager</div>
}));

vi.mock('../../../src/components/ProfileSetupWizard', () => ({
  default: () => <div data-testid="profile-setup-wizard">Profile Setup Wizard</div>
}));

vi.mock('../../../src/components/PostList', () => ({
  default: () => <div data-testid="post-list">Post List</div>
}));

vi.mock('../../../src/components/PostViewer', () => ({
  default: () => <div data-testid="post-viewer">Post Viewer</div>
}));

vi.mock('../../../src/components/TimelineTest', () => ({
  default: () => <div data-testid="timeline-test">Timeline Test</div>
}));

vi.mock('../../../src/components/DevModeTest', () => ({
  default: () => <div data-testid="dev-mode-test">Dev Mode Test</div>
}));

vi.mock('../../../src/components/APITestPage', () => ({
  default: () => <div data-testid="api-test-page">API Test Page</div>
}));

vi.mock('../../../src/components/VoiceTestWizard', () => ({
  default: () => <div data-testid="voice-test-wizard">Voice Test Wizard</div>
}));

vi.mock('../../../src/components/QuickF0Test', () => ({
  default: () => <div data-testid="quick-f0-test">Quick F0 Test</div>
}));

vi.mock('../../../src/components/ScalePractice', () => ({
  default: () => <div data-testid="scale-practice">Scale Practice</div>
}));

vi.mock('../../../src/components/RegionSwitchBanner', () => ({
  default: () => <div data-testid="region-switch-banner">Region Switch Banner</div>
}));

vi.mock('../../../src/components/NoteFrequencyTool', () => ({
  default: () => <div data-testid="note-frequency-tool">Note Frequency Tool</div>
}));

vi.mock('../../../src/components/EnhancedDataCharts', () => ({
  default: () => <div data-testid="enhanced-data-charts">Enhanced Data Charts</div>
}));

describe('App Component', () => {
  const user = userEvent.setup();

  /**
   * 设置默认的开发模式 mock
   */
  const setupDevMode = () => {
    mockIsProductionReady.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      needsProfileSetup: false,
      profileLoading: false,
      authInitialized: true
    });
  };

  /**
   * 设置生产模式 mock
   */
  const setupProductionMode = (authStatus = 'unauthenticated') => {
    mockIsProductionReady.mockReturnValue(true);
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
    setupDevMode(); // 默认使用开发模式
  });

  describe('基础渲染', () => {
    it('在开发模式下应该渲染应用', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    it('在生产模式下应该包含 Authenticator.Provider', () => {
      setupProductionMode();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('authenticator-provider')).toBeInTheDocument();
      expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    });

    it('应该渲染 RegionSwitchBanner', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('region-switch-banner')).toBeInTheDocument();
    });
  });

  describe('公开路由', () => {
    it('应该渲染首页 (/)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('home')).toBeInTheDocument();
    });

    it('应该渲染公开仪表板 (/dashboard)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('public-dashboard')).toBeInTheDocument();
    });

    it('应该渲染文章列表 (/posts)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/posts']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('post-list')).toBeInTheDocument();
    });

    it('应该渲染文档查看器 (/docs)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/docs']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('post-viewer')).toBeInTheDocument();
    });

    it('应该渲染音频工具 (/note-frequency-tool)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/note-frequency-tool']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('note-frequency-tool')).toBeInTheDocument();
    });

    it('应该渲染时间轴测试页面 (/timeline-test)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/timeline-test']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('timeline-test')).toBeInTheDocument();
    });

    it('应该渲染开发模式测试页面 (/dev-test)', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/dev-test']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('dev-mode-test')).toBeInTheDocument();
    });
  });

  describe('保护路由 - 开发模式', () => {
    it('开发模式下应该允许访问保护路由', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mypage')).toBeInTheDocument();
    });

    it('开发模式下应该渲染添加事件页面', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/add-event']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('add-event')).toBeInTheDocument();
    });

    it('开发模式下应该渲染事件管理页面', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/event-manager']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('event-manager')).toBeInTheDocument();
    });

    it('开发模式下应该渲染资料管理页面', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/profile-manager']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('profile-manager')).toBeInTheDocument();
    });

    it('开发模式下应该渲染资料设置向导', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/profile-setup-wizard']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('profile-setup-wizard')).toBeInTheDocument();
    });

    it('开发模式下应该渲染嗓音测试向导', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/voice-test']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('voice-test-wizard')).toBeInTheDocument();
    });

    it('开发模式下应该渲染快速基频测试', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/quick-f0-test']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('quick-f0-test')).toBeInTheDocument();
    });

    it('开发模式下应该渲染音阶练习页面', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/scale-practice']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('scale-practice')).toBeInTheDocument();
    });
  });

  describe('保护路由 - 生产模式', () => {
    it('生产模式下未认证用户应该被重定向到首页', () => {
      setupProductionMode('unauthenticated');
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      // 应该重定向到首页
      expect(screen.getByTestId('home')).toBeInTheDocument();
      expect(screen.queryByTestId('mypage')).not.toBeInTheDocument();
    });

    it('生产模式下认证用户应该能访问保护路由', () => {
      setupProductionMode('authenticated');
      
      render(
        <MemoryRouter initialEntries={['/mypage']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('mypage')).toBeInTheDocument();
    });

    it('生产模式下配置中状态应该显示加载指示器', () => {
      setupProductionMode('configuring');
      
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
      mockIsProductionReady.mockReturnValue(false);
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

      // 应该自动跳转到资料设置向导
      await waitFor(() => {
        expect(screen.getByTestId('profile-setup-wizard')).toBeInTheDocument();
      });
    });

    it('资料加载中时不应该跳转', () => {
      mockIsProductionReady.mockReturnValue(false);
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

      // 应该停留在当前页面
      expect(screen.getByTestId('mypage')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-setup-wizard')).not.toBeInTheDocument();
    });
  });

  describe('Service Worker 更新横幅', () => {
    it('收到更新事件时应该显示横幅', async () => {
      setupDevMode();
      
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
      setupDevMode();
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
      setupDevMode();
      
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
    it('应该将未知路径重定向到首页', () => {
      setupDevMode();
      
      render(
        <MemoryRouter initialEntries={['/unknown-route']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByTestId('home')).toBeInTheDocument();
    });
  });

  describe('在线/离线状态处理', () => {
    it('离线时不应该自动跳转到资料设置', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      mockIsProductionReady.mockReturnValue(false);
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

      // 离线时应该停留在当前页面
      expect(screen.getByTestId('mypage')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-setup-wizard')).not.toBeInTheDocument();

      // 恢复 onLine 状态
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    });
  });
});
