import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../../src/components/LoginPage';

// Mock Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    getConfig: vi.fn(() => ({
      Auth: {
        Cognito: {
          userPoolId: 'mock-pool-id'
        }
      }
    }))
  }
}));

// Mock aws-amplify/utils
vi.mock('aws-amplify/utils', () => ({
  I18n: {
    putVocabularies: vi.fn(),
    setLanguage: vi.fn()
  }
}));

// Mock @aws-amplify/ui-react
vi.mock('@aws-amplify/ui-react', () => ({
  Authenticator: vi.fn(({ children }) => {
    if (typeof children === 'function') {
      return children({ user: null });
    }
    return <div data-testid="authenticator-mock">Mock Authenticator</div>;
  }),
  useAuthenticator: vi.fn(() => ({
    authStatus: 'unauthenticated',
    user: null
  })),
  translations: {}
}));

// Mock AuthContext
vi.mock('../../../src/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(() => ({
    handleAuthSuccess: vi.fn(),
    authInitialized: true
  }))
}));

/**
 * LoginPage 组件集成测试
 * 
 * 测试独立登录页面的渲染、URL参数处理和用户体验
 */
describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染登录页面的基本元素', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    // 等待配置加载
    await waitFor(() => {
      expect(screen.getByText('VFS Tracker')).toBeInTheDocument();
    });

    // 验证标题和副标题
    expect(screen.getByText('嗓音数据测试和跟踪工具')).toBeInTheDocument();
    
    // 验证默认提示信息
    expect(screen.getByText(/请登录以继续访问您的嗓音数据和分析/i)).toBeInTheDocument();
    
    // 验证返回首页按钮
    expect(screen.getByText('返回首页')).toBeInTheDocument();
  });

  it('应该显示 URL 参数中的自定义消息', async () => {
    const customMessage = '请先登录以访问该功能';
    
    render(
      <MemoryRouter initialEntries={[`/login?message=${encodeURIComponent(customMessage)}`]}>
        <LoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(customMessage)).toBeInTheDocument();
    });
  });

  it('应该默认显示 CustomAuthenticator 登录表单', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    // 等待配置加载完成（先看到 VFS Tracker 标题）
    await waitFor(() => {
      expect(screen.getByText('VFS Tracker')).toBeInTheDocument();
    });

    // 验证 CustomAuthenticator 的登录表单元素
    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名或邮箱')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    
    // 使用 getAllByRole 获取所有登录按钮，验证至少有一个
    const loginButtons = screen.getAllByRole('button', { name: /登录/i });
    expect(loginButtons.length).toBeGreaterThan(0);
    
    // 验证切换按钮存在
    expect(screen.getByText(/切换到旧版登录页/i)).toBeInTheDocument();
  });

  it('应该在配置加载时显示加载指示器', async () => {
    // Mock Amplify.getConfig 返回空配置
    const { Amplify } = await import('aws-amplify');
    const originalGetConfig = Amplify.getConfig;
    Amplify.getConfig = vi.fn(() => ({}));

    const { unmount } = render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText('正在加载认证服务...')).toBeInTheDocument();
    
    // 清理：先卸载组件，然后恢复原始函数
    unmount();
    Amplify.getConfig = originalGetConfig;
  });

  it('应该包含服务条款和隐私政策提示', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/登录即表示您同意我们的服务条款和隐私政策/i)).toBeInTheDocument();
    });
  });

  it('应该使用美观的渐变背景', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const mainDiv = container.querySelector('.bg-gradient-to-br');
      expect(mainDiv).toBeInTheDocument();
      expect(mainDiv).toHaveClass('from-pink-50', 'via-purple-50', 'to-blue-50');
    });
  });
});
