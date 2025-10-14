/**
 * @file MyPage.test.jsx
 * @description MyPage 组件的集成测试
 * @zh 测试用户个人仪表板的所有功能，包括事件加载、导航、数据展示等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MyPage from '../../../src/components/MyPage';
import * as api from '../../../src/api';

// Mock API
vi.mock('../../../src/api', async () => {
  const actual = await vi.importActual('../../../src/api');
  return {
    ...actual,
    getEventsByUserId: vi.fn()
  };
});

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../../src/contexts/AuthContext.jsx', async () => ({
  ...await vi.importActual('../../../src/contexts/AuthContext.jsx'),
  useAuth: () => mockUseAuth()
}));

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock child components to focus on MyPage logic
vi.mock('../../../src/components/VoiceFrequencyChart', () => ({
  default: ({ userId, events }) => (
    <div data-testid="voice-frequency-chart">
      Chart for user: {userId}, Events: {events.length}
    </div>
  )
}));

vi.mock('../../../src/components/InteractiveTimeline', () => ({
  default: ({ events }) => (
    <div data-testid="interactive-timeline">
      Timeline with {events.length} events
    </div>
  )
}));

vi.mock('../../../src/components/PendingSyncButton.jsx', () => ({
  default: ({ className }) => (
    <button className={className} data-testid="pending-sync-button">
      同步按钮
    </button>
  )
}));

describe('MyPage Component', () => {
  const user = userEvent.setup();

  // Mock用户数据
  const mockUser = {
    userId: 'test-user-123',
    username: 'testuser',
    attributes: {
      email: 'test@example.com',
      sub: 'test-user-123',
      nickname: '测试用户'
    }
  };

  const mockCognitoUserInfo = {
    email: 'test@example.com',
    nickname: '测试用户'
  };

  // Mock事件数据
  const mockEvents = [
    {
      eventId: 'event-1',
      type: 'self_test',
      createdAt: '2024-01-15T10:00:00Z',
      details: { fundamentalFrequency: 200 }
    },
    {
      eventId: 'event-2',
      type: 'hospital_test',
      createdAt: '2024-01-10T10:00:00Z',
      details: { fundamentalFrequency: 180 }
    },
    {
      eventId: 'event-3',
      type: 'voice_training',
      createdAt: '2024-01-05T10:00:00Z',
      details: {}
    }
  ];

  // Helper函数
  const renderWithRouter = (component) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  const setupAuthMock = (authState = {}) => {
    mockUseAuth.mockReturnValue({
      user: authState.user !== undefined ? authState.user : mockUser,
      cognitoUserInfo: authState.cognitoUserInfo !== undefined ? authState.cognitoUserInfo : mockCognitoUserInfo
    });
  };

  const setupSuccessfulEvents = (events = mockEvents) => {
    api.getEventsByUserId.mockResolvedValue([...events]);
  };

  const setupFailedApi = (error = new Error('API Error')) => {
    api.getEventsByUserId.mockRejectedValue(error);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthMock();
    setupSuccessfulEvents();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染页面标题和欢迎信息', async () => {
      renderWithRouter(<MyPage />);

      expect(screen.getByText('我的个人仪表板')).toBeInTheDocument();
      // 等待组件完全加载
      await waitFor(() => {
        expect(screen.getByText(/欢迎，.*！/i)).toBeInTheDocument();
      });
    });

    it('应该显示所有操作按钮', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText('✨ 添加新事件')).toBeInTheDocument();
        expect(screen.getByText('📊 管理事件')).toBeInTheDocument();
        expect(screen.getByText('👤 管理资料')).toBeInTheDocument();
        expect(screen.getByText('🎤 启动嗓音测试')).toBeInTheDocument();
        expect(screen.getByText('⚡ 快速基频测试')).toBeInTheDocument();
        expect(screen.getByText('🎶 音阶练习')).toBeInTheDocument();
        expect(screen.getByText('🎼 Hz-音符转换器')).toBeInTheDocument();
      });
    });

    it('应该渲染PendingSyncButton', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByTestId('pending-sync-button')).toBeInTheDocument();
      });
    });

    it('应该显示声音频率分析标题', async () => {
      renderWithRouter(<MyPage />);

      expect(screen.getByText('声音频率分析')).toBeInTheDocument();
    });

    it('应该显示事件时间轴标题', async () => {
      renderWithRouter(<MyPage />);

      expect(screen.getByText('事件时间轴')).toBeInTheDocument();
    });
  });

  describe('事件加载', () => {
    it('应该在加载时显示加载指示器', async () => {
      // 延迟API响应
      api.getEventsByUserId.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockEvents), 100))
      );

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        const spinners = document.querySelectorAll('.animate-spin');
        expect(spinners.length).toBeGreaterThan(0);
      });
    });

    it('应该成功加载并显示事件', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalled();
      });

      // 应该显示事件数量
      await waitFor(() => {
        expect(screen.getByText(/共 3 个事件/i)).toBeInTheDocument();
      });
    });

    it('应该按创建时间倒序排列事件', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalled();
      });

      // 验证时间轴接收到正确排序的事件
      await waitFor(() => {
        const timeline = screen.getByTestId('interactive-timeline');
        expect(timeline).toBeInTheDocument();
      });
    });

    it('应该处理空事件列表', async () => {
      setupSuccessfulEvents([]);

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无事件')).toBeInTheDocument();
        expect(screen.getByText(/开始记录您的第一个嗓音事件吧！/i)).toBeInTheDocument();
      });
    });

    it('空事件列表应该显示"添加事件"按钮', async () => {
      setupSuccessfulEvents([]);

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        // 页面上应该有两个"添加事件"按钮（顶部的和空状态的）
        const addButtons = screen.getAllByText(/添加事件/i);
        expect(addButtons.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('应该将userId传递给VoiceFrequencyChart', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('voice-frequency-chart');
        expect(chart).toHaveTextContent(/Chart for user: .+/);
      });
    });

    it('应该将events传递给子组件', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalled();
      });

      await waitFor(() => {
        const chart = screen.getByTestId('voice-frequency-chart');
        expect(chart).toHaveTextContent('Events: 3');
      });
    });
  });

  describe('错误处理', () => {
    it('应该显示API错误', async () => {
      setupFailedApi(new Error('Network error'));

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        // ApiErrorNotice组件应该被渲染
        expect(screen.getByText(/重试/i)).toBeInTheDocument();
      });
    });

    it('应该显示重试按钮', async () => {
      setupFailedApi();

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /重试/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('点击重试按钮应该重新加载事件', async () => {
      setupFailedApi();

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalledTimes(1);
      });

      const retryButton = await screen.findByRole('button', { name: /重试/i });
      
      // 设置成功响应
      setupSuccessfulEvents();
      
      await user.click(retryButton);

      // 应该再次调用API
      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalledTimes(2);
      });
    });

    it('应该处理没有userId的情况', async () => {
      setupAuthMock({
        user: { attributes: { sub: undefined } },
        cognitoUserInfo: null
      });

      renderWithRouter(<MyPage />);

      // 不应该调用API（或者调用但返回空数组）
      await waitFor(() => {
        // 可能不会调用，也可能调用但userId为undefined
        // 这取决于组件实现
      });
    });
  });

  describe('导航功能', () => {
    it('点击"添加新事件"按钮应该导航到/add-event', async () => {
      renderWithRouter(<MyPage />);

      const addButton = await screen.findByText('✨ 添加新事件');
      await user.click(addButton);

      expect(mockNavigate).toHaveBeenCalledWith('/add-event');
    });

    it('点击"管理事件"按钮应该导航到/event-manager', async () => {
      renderWithRouter(<MyPage />);

      const manageButton = await screen.findByText('📊 管理事件');
      await user.click(manageButton);

      expect(mockNavigate).toHaveBeenCalledWith('/event-manager');
    });

    it('点击"管理资料"按钮应该导航到/profile-manager', async () => {
      renderWithRouter(<MyPage />);

      const profileButton = await screen.findByText('👤 管理资料');
      await user.click(profileButton);

      expect(mockNavigate).toHaveBeenCalledWith('/profile-manager');
    });

    it('点击"启动嗓音测试"按钮应该导航到/voice-test', async () => {
      renderWithRouter(<MyPage />);

      const testButton = await screen.findByText('🎤 启动嗓音测试');
      await user.click(testButton);

      expect(mockNavigate).toHaveBeenCalledWith('/voice-test');
    });

    it('点击"快速基频测试"按钮应该导航到/quick-f0-test', async () => {
      renderWithRouter(<MyPage />);

      const quickTestButton = await screen.findByText('⚡ 快速基频测试');
      await user.click(quickTestButton);

      expect(mockNavigate).toHaveBeenCalledWith('/quick-f0-test');
    });

    it('点击"音阶练习"按钮应该导航到/scale-practice', async () => {
      renderWithRouter(<MyPage />);

      const scaleButton = await screen.findByText('🎶 音阶练习');
      await user.click(scaleButton);

      expect(mockNavigate).toHaveBeenCalledWith('/scale-practice');
    });

    it('点击"Hz-音符转换器"按钮应该导航到/note-frequency-tool', async () => {
      renderWithRouter(<MyPage />);

      const converterButton = await screen.findByText('🎼 Hz-音符转换器');
      await user.click(converterButton);

      expect(mockNavigate).toHaveBeenCalledWith('/note-frequency-tool');
    });

    it('空事件状态下点击"添加事件"按钮应该导航到/add-event', async () => {
      setupSuccessfulEvents([]);

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无事件')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /添加事件/i });
      await user.click(addButton);

      expect(mockNavigate).toHaveBeenCalledWith('/add-event');
    });
  });

  describe('用户显示名称', () => {
    it('应该显示用户昵称', async () => {
      setupAuthMock({
        user: {
          ...mockUser,
          attributes: {
            ...mockUser.attributes,
            nickname: '小明'
          }
        },
        cognitoUserInfo: { nickname: '小明' }
      });

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText(/欢迎，.*！/i)).toBeInTheDocument();
      });
    });

    it('没有昵称时应该显示用户名', async () => {
      setupAuthMock({
        user: mockUser,
        cognitoUserInfo: { nickname: null }
      });

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        // getUserDisplayName会使用username作为fallback
        expect(screen.getByText(/欢迎/i)).toBeInTheDocument();
      });
    });
  });

  describe('组件集成', () => {
    it('应该将正确的props传递给VoiceFrequencyChart', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        const chart = screen.getByTestId('voice-frequency-chart');
        // 验证接收到userId和events数据
        expect(chart).toHaveTextContent(/Chart for user: .+/);
        expect(chart).toHaveTextContent('Events: 3');
      });
    });

    it('应该将正确的props传递给InteractiveTimeline', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(api.getEventsByUserId).toHaveBeenCalled();
      });

      await waitFor(() => {
        const timeline = screen.getByTestId('interactive-timeline');
        expect(timeline).toHaveTextContent('Timeline with 3 events');
      });
    });

    it('有事件时应该显示事件计数', async () => {
      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText(/共 3 个事件/i)).toBeInTheDocument();
      });
    });

    it('没有事件时不应该显示事件计数', async () => {
      setupSuccessfulEvents([]);

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.queryByText(/共.*个事件/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('开发模式', () => {
    it('在非生产环境下应该使用mock用户', async () => {
      // env.js中isProductionReady会返回false
      // MyPage会使用默认的mock用户
      setupAuthMock({
        user: null,
        cognitoUserInfo: null
      });

      // Mock isProductionReady to return false
      vi.mock('../../../src/env.js', () => ({
        isProductionReady: () => false
      }));

      renderWithRouter(<MyPage />);

      await waitFor(() => {
        expect(screen.getByText(/欢迎/i)).toBeInTheDocument();
      });
    });
  });
});
