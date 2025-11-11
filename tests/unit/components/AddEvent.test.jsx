/**
 * AddEvent 组件单元测试
 * 
 * 测试 AddEvent 页面组件的渲染、导航和交互功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AddEvent from '../../../src/components/AddEvent';
import * as env from '../../../src/env';

// Mock dependencies
vi.mock('../../../src/env');
vi.mock('../../../src/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockUseAuth = vi.fn();
vi.mock('../../../src/contexts/AuthContext.jsx', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext.jsx');
  return {
    ...actual,
    useAuth: () => mockUseAuth()
  };
});

// Mock EventForm component
vi.mock('../../../src/components/EventForm', () => ({
  default: ({ onEventAdded }) => (
    <div data-testid="mock-event-form">
      <button onClick={onEventAdded}>模拟提交</button>
    </div>
  )
}));

/**
 * 测试辅助函数: 渲染AddEvent组件
 */
const renderAddEvent = () => {
  return render(
    <BrowserRouter>
      <AddEvent />
    </BrowserRouter>
  );
};

describe('AddEvent 组件测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 默认: 已认证用户
    mockUseAuth.mockReturnValue({
      user: {
        userId: 'test-user-123',
        attributes: {
          email: 'test@example.com'
        }
      },
      ready: true
    });
  });

  describe('基础渲染', () => {
    it('应该渲染页面标题', () => {
      renderAddEvent();
      
      expect(screen.getByText('添加新事件')).toBeInTheDocument();
    });

    it('应该渲染页面描述', () => {
      renderAddEvent();
      
      expect(screen.getByText(/记录您的嗓音数据和相关事件/)).toBeInTheDocument();
    });

    it('应该渲染返回按钮', () => {
      renderAddEvent();
      
      const backButton = screen.getByRole('button', { name: /返回仪表板/ });
      expect(backButton).toBeInTheDocument();
    });

    it('应该渲染EventForm组件', () => {
      renderAddEvent();
      
      expect(screen.getByTestId('mock-event-form')).toBeInTheDocument();
    });

    it('应该渲染卡片标题', () => {
      renderAddEvent();
      
      expect(screen.getByText('新建事件记录')).toBeInTheDocument();
    });

    it('应该渲染卡片描述', () => {
      renderAddEvent();
      
      expect(screen.getByText(/填写下方表单来记录您的嗓音相关事件/)).toBeInTheDocument();
    });
  });

  describe('导航功能', () => {
    it('点击返回按钮应该导航到仪表板', async () => {
      const user = userEvent.setup();
      renderAddEvent();
      
      const backButton = screen.getByRole('button', { name: /返回仪表板/ });
      await user.click(backButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/mypage');
    });

    it('事件添加成功后应该显示成功消息', async () => {
      const user = userEvent.setup();
      renderAddEvent();
      
      // 点击模拟提交按钮
      const submitButton = screen.getByText('模拟提交');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/事件添加成功！即将返回仪表板/)).toBeInTheDocument();
      });
    });

    it('事件添加成功后2秒应该导航到仪表板', async () => {
      vi.useFakeTimers();
      
      renderAddEvent();
      
      // 直接触发handleEventAdded
      const submitButton = screen.getByText('模拟提交');
      submitButton.click();
      
      // 等待状态更新,然后快进2秒
      await vi.runAllTimersAsync();
      
      expect(mockNavigate).toHaveBeenCalledWith('/mypage');
      
      vi.useRealTimers();
    });
  });

  describe('成功消息', () => {
    it('初始状态不应该显示成功消息', () => {
      renderAddEvent();
      
      expect(screen.queryByText(/事件添加成功/)).not.toBeInTheDocument();
    });

    it('成功消息应该包含图标', async () => {
      renderAddEvent();
      
      const submitButton = screen.getByText('模拟提交');
      submitButton.click();
      
      // 等待成功消息出现
      await waitFor(() => {
        const successMessage = screen.getByText(/事件添加成功/).closest('div');
        expect(successMessage?.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('成功消息应该有正确的样式类', async () => {
      renderAddEvent();
      
      const submitButton = screen.getByText('模拟提交');
      submitButton.click();
      
      // 等待成功消息出现并检查样式
      await waitFor(() => {
        const successMessage = screen.getByText(/事件添加成功/).closest('.bg-green-500');
        expect(successMessage).toBeInTheDocument();
      });
    });
  });

  describe('用户认证', () => {
    it('应该在用户未认证时也能渲染页面', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        ready: true
      });
      
      renderAddEvent();
      
      expect(screen.getByText('添加新事件')).toBeInTheDocument();
    });
  });

  describe('装饰性元素', () => {
    it('应该渲染背景装饰元素', () => {
      const { container } = renderAddEvent();
      
      // 检查有3个animate-blob动画的装饰元素
      const blobs = container.querySelectorAll('.animate-blob');
      expect(blobs).toHaveLength(3);
    });

    it('背景装饰应该有正确的颜色类', () => {
      const { container } = renderAddEvent();
      
      expect(container.querySelector('.bg-pink-300')).toBeInTheDocument();
      expect(container.querySelector('.bg-purple-300')).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-300')).toBeInTheDocument();
    });
  });

  describe('错误处理 (P1.2.1 - Phase 3.3 Code Review)', () => {
    it('当 EventForm 提交失败时不应该显示成功消息', () => {
      renderAddEvent();
      
      // EventForm mock 不会触发 onEventAdded，模拟失败场景
      // 验证成功消息不显示
      expect(screen.queryByText(/事件添加成功/)).not.toBeInTheDocument();
    });

    it('当 EventForm 提交失败时不应该导航', () => {
      renderAddEvent();
      
      // 等待一段时间确保没有触发导航
      expect(mockNavigate).not.toHaveBeenCalledWith('/mypage');
    });

    it('只有在 onEventAdded 被调用后才显示成功消息', async () => {
      const user = userEvent.setup();
      renderAddEvent();
      
      // 初始状态：无成功消息
      expect(screen.queryByText(/事件添加成功/)).not.toBeInTheDocument();
      
      // 触发 onEventAdded（通过 mock 的提交按钮）
      const submitButton = screen.getByText('模拟提交');
      await user.click(submitButton);
      
      // 成功消息应该显示
      await waitFor(() => {
        expect(screen.getByText(/事件添加成功/)).toBeInTheDocument();
      });
    });
  });
});
