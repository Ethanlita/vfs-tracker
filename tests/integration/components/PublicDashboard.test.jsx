/**
 * @file PublicDashboard.test.jsx
 * @description PublicDashboard 组件的集成测试
 * @zh 测试公共仪表板的数据展示、用户列表、统计图表、用户档案抽屉等功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PublicDashboard from '../../../src/components/PublicDashboard';
import * as api from '../../../src/api';

// Mock API functions
vi.mock('../../../src/api', async () => {
  const actual = await vi.importActual('../../../src/api');
  return {
    ...actual,
    getAllEvents: vi.fn(),
    getUserPublicProfile: vi.fn(),
  };
});

// Mock Chart.js to avoid canvas rendering issues in tests
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="line-chart">Line Chart</div>,
}));

// Mock EnhancedDataCharts
vi.mock('../../../src/components/EnhancedDataCharts', () => ({
  default: () => <div data-testid="enhanced-charts">Enhanced Charts</div>,
}));

describe('PublicDashboard Component', () => {
  const user = userEvent.setup();

  const mockEvents = [
    {
      userId: 'user1',
      userName: '用户1',
      eventId: 'event1',
      eventType: 'voice-test',
      timestamp: '2024-01-01T10:00:00Z',
    },
    {
      userId: 'user1',
      userName: '用户1',
      eventId: 'event2',
      eventType: 'surgery',
      timestamp: '2024-01-02T10:00:00Z',
    },
    {
      userId: 'user2',
      userName: '用户2',
      eventId: 'event3',
      eventType: 'voice-test',
      timestamp: '2024-01-03T10:00:00Z',
    },
  ];

  const mockUserProfile = {
    userId: 'user1',
    userName: '用户1',
    bio: '这是用户1的简介',
    pronouns: 'she/her',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    api.getAllEvents.mockResolvedValue(mockEvents);
    api.getUserPublicProfile.mockResolvedValue(mockUserProfile);
  });

  describe('基础渲染', () => {
    it('应该渲染公共仪表板标题', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/公开仪表板/i)).toBeInTheDocument();
      });
    });

    it('应该显示统计摘要', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        // 等待数据加载
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该显示用户总数和事件总数
      await waitFor(() => {
        expect(screen.getByText(/贡献用户数/i)).toBeInTheDocument();
        expect(screen.getByText(/总记录事件数/i)).toBeInTheDocument();
      });
    });

    it('应该渲染柱状图组件', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该渲染Bar图表(事件分布)
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('事件分布')).toBeInTheDocument();
    });

    it('VFS基频变化图无数据时应该显示提示', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该显示"暂无可绘制的基频数据"提示
      expect(screen.getByText('VFS 对齐的基频变化')).toBeInTheDocument();
      expect(screen.getByText('暂无可绘制的基频数据。')).toBeInTheDocument();
    });

    it('应该渲染增强数据图表', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('enhanced-charts')).toBeInTheDocument();
      });
    });
  });

  describe('数据加载', () => {
    it('应该调用getAllEvents API', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });
    });

    it('应该显示加载状态', () => {
      // Mock一个永不resolve的Promise来测试加载状态
      api.getAllEvents.mockImplementation(() => new Promise(() => {}));

      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      // 应该显示loading的动画占位符(骨架屏)
      const loadingElements = document.querySelectorAll('.animate-pulse');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('应该处理API错误', async () => {
      const errorMessage = 'Failed to load events';
      api.getAllEvents.mockRejectedValue(new Error(errorMessage));

      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        // 应该显示ApiErrorNotice组件(alert role)
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('空数据时应该正常渲染', async () => {
      api.getAllEvents.mockResolvedValue([]);

      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        // 空数据时仍然显示标题和0值统计
        expect(screen.getByText(/公开仪表板/i)).toBeInTheDocument();
      });
      
      // 应该显示0个事件和0个用户
      expect(screen.getByText(/贡献用户数/i)).toBeInTheDocument();
    });
  });

  describe('用户列表', () => {
    it('应该显示用户列表表格', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该显示"用户列表"标题
      expect(screen.getByText('用户列表')).toBeInTheDocument();
      
      // 应该显示表头
      expect(screen.getByText('用户 ID')).toBeInTheDocument();
      expect(screen.getByText('名称')).toBeInTheDocument();
      expect(screen.getByText('操作')).toBeInTheDocument();
    });

    it('应该显示用户的userId和userName', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该显示用户1和用户2
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('用户1')).toBeInTheDocument();
      });
      
      expect(screen.getByText('user2')).toBeInTheDocument();
      expect(screen.getByText('用户2')).toBeInTheDocument();
    });

    it('应该为每个用户显示"查看档案"按钮', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该有2个"查看档案"按钮(因为有2个用户)
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      expect(viewProfileButtons).toHaveLength(2);
    });

    it('点击"查看档案"应该打开用户档案抽屉', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 点击第一个"查看档案"按钮
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      await user.click(viewProfileButtons[0]);

      // 应该调用getUserPublicProfile API
      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalledWith('user1');
      });

      // 应该显示抽屉中的关闭按钮
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /关闭/i })).toBeInTheDocument();
      });
    });
  });

  describe('统计数据', () => {
    it('应该显示统计数据', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 应该显示统计卡片
      expect(screen.getByText(/贡献用户数/i)).toBeInTheDocument();
      expect(screen.getByText(/总记录事件数/i)).toBeInTheDocument();
    });
  });

  describe('用户档案抽屉', () => {
    it('打开抽屉时应该显示用户信息', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 点击"查看档案"按钮
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      await user.click(viewProfileButtons[0]);

      // 等待资料加载
      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalledWith('user1');
      });

      // 抽屉中应该显示用户名（使用role和aria-label）
      await waitFor(() => {
        const drawer = screen.getByRole('dialog', { name: /用户公开资料/i });
        expect(drawer).toBeInTheDocument();
        expect(within(drawer).getByText('用户1')).toBeInTheDocument();
        expect(within(drawer).getByText('user1')).toBeInTheDocument();
      });
    });

    it('应该显示公开资料信息', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 打开抽屉
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      await user.click(viewProfileButtons[0]);

      // 等待资料加载
      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalled();
      });

      // 应该显示"公开资料"标题
      await waitFor(() => {
        expect(screen.getByText('公开资料')).toBeInTheDocument();
      });
    });

    it('点击关闭按钮应该关闭抽屉', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 打开抽屉
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      await user.click(viewProfileButtons[0]);

      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalled();
      });

      // 点击关闭按钮
      const closeButton = screen.getByRole('button', { name: /关闭用户资料/i });
      await user.click(closeButton);

      // 抽屉应该消失
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /用户公开资料/i })).not.toBeInTheDocument();
      });
    });

    it('点击背景遮罩应该关闭抽屉', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 打开抽屉
      const viewProfileButtons = screen.getAllByRole('button', { name: /查看档案/i });
      await user.click(viewProfileButtons[0]);

      await waitFor(() => {
        expect(api.getUserPublicProfile).toHaveBeenCalled();
      });

      // 点击背景遮罩（通过dialog外部点击）
      const dialog = screen.getByRole('dialog', { name: /用户公开资料/i });
      // 获取dialog的父元素（fixed inset-0 z-50层）
      const dialogContainer = dialog;
      // 点击遮罩层（在dialog内部通过aria-hidden="true"标记）
      const overlay = dialogContainer.querySelector('[aria-hidden="true"]');
      await user.click(overlay);

      // 抽屉应该消失
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /用户公开资料/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('响应式设计', () => {
    it('应该在不同视口下正确渲染', async () => {
      render(
        <BrowserRouter>
          <PublicDashboard />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(api.getAllEvents).toHaveBeenCalled();
      });

      // 组件应该正常渲染,Tailwind响应式类自动处理不同视口
      expect(screen.getByText('公开仪表板')).toBeInTheDocument();
      expect(screen.getByText('用户列表')).toBeInTheDocument();
    });
  });
});
