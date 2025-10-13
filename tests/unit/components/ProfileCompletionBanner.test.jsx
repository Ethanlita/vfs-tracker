/**
 * 单元测试: src/components/ProfileCompletionBanner.jsx
 * 
 * 测试个人资料完善提示横幅组件
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileCompletionBanner from '../../../src/components/ProfileCompletionBanner.jsx';
import { AuthProvider } from '../../../src/contexts/AuthContext.jsx';

// Mock useAuth hook
const mockUseAuth = vi.fn();

// Mock AuthContext模块
vi.mock('../../../src/contexts/AuthContext.jsx', async () => {
  const actual = await vi.importActual('../../../src/contexts/AuthContext.jsx');
  return {
    ...actual,
    useAuth: () => mockUseAuth()
  };
});

// 辅助函数：设置mock返回值
const setupAuthMock = (needsProfileSetup) => {
  mockUseAuth.mockReturnValue({
    needsProfileSetup,
    user: { username: 'testuser' },
    isAuthenticated: true
  });
};

const renderWithAuth = (component) => {
  return render(component);
};

describe('ProfileCompletionBanner 组件测试', () => {

  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('needsProfileSetup为true时应该显示横幅', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      expect(screen.getByText('欢迎使用 VFS Tracker！')).toBeInTheDocument();
      expect(screen.getByText(/完善您的个人资料/)).toBeInTheDocument();
    });

    it('needsProfileSetup为false时不应该显示横幅', () => {
      setupAuthMock(false);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      expect(container.firstChild).toBeNull();
    });

    it('应该显示欢迎表情', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      expect(screen.getByText('👋')).toBeInTheDocument();
    });

    it('应该显示完善资料按钮', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      expect(screen.getByRole('button', { name: '完善资料' })).toBeInTheDocument();
    });
  });

  // ============================================
  // 交互行为测试
  // ============================================
  
  describe('交互行为', () => {
    it('点击完善资料按钮应该触发onSetupClick回调', async () => {
      const user = userEvent.setup();
      setupAuthMock(true);
      const onSetupClick = vi.fn();
      
      renderWithAuth(<ProfileCompletionBanner onSetupClick={onSetupClick} />);
      
      const button = screen.getByRole('button', { name: '完善资料' });
      await user.click(button);
      
      expect(onSetupClick).toHaveBeenCalledTimes(1);
    });

    it('没有onSetupClick回调时按钮应该仍然可点击', async () => {
      const user = userEvent.setup();
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      const button = screen.getByRole('button', { name: '完善资料' });
      
      // 不应该抛出错误
      await expect(user.click(button)).resolves.not.toThrow();
    });
  });

  // ============================================
  // 文案内容测试
  // ============================================
  
  describe('文案内容', () => {
    it('应该显示主标题', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      expect(screen.getByText('欢迎使用 VFS Tracker！')).toBeInTheDocument();
    });

    it('应该显示提示文字', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      expect(screen.getByText('完善您的个人资料，获得更好的使用体验')).toBeInTheDocument();
    });
  });

  // ============================================
  // 样式测试
  // ============================================
  
  describe('样式', () => {
    it('应该有渐变背景色', () => {
      setupAuthMock(true);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      const banner = container.querySelector('.bg-gradient-to-r');
      expect(banner).toBeInTheDocument();
      expect(banner.className).toContain('from-purple-500');
      expect(banner.className).toContain('to-pink-500');
    });

    it('应该是白色文字', () => {
      setupAuthMock(true);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      const banner = container.querySelector('.bg-gradient-to-r');
      expect(banner.className).toContain('text-white');
    });

    it('完善资料按钮应该有正确的样式', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      const button = screen.getByRole('button', { name: '完善资料' });
      expect(button.className).toContain('bg-white');
      expect(button.className).toContain('text-purple-600');
      expect(button.className).toContain('rounded-lg');
    });

    it('按钮应该有hover效果类', () => {
      setupAuthMock(true);
      
      renderWithAuth(<ProfileCompletionBanner />);
      
      const button = screen.getByRole('button', { name: '完善资料' });
      expect(button.className).toContain('hover:bg-purple-50');
      expect(button.className).toContain('transition-colors');
    });
  });

  // ============================================
  // 响应式布局测试
  // ============================================
  
  describe('响应式布局', () => {
    it('应该有最大宽度限制', () => {
      setupAuthMock(true);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      const innerContainer = container.querySelector('.max-w-7xl');
      expect(innerContainer).toBeInTheDocument();
    });

    it('应该使用flex布局居中对齐', () => {
      setupAuthMock(true);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      const flexContainer = container.querySelector('.flex.items-center.justify-between');
      expect(flexContainer).toBeInTheDocument();
    });

    it('左侧内容应该有space-x间距', () => {
      setupAuthMock(true);
      
      const { container } = renderWithAuth(<ProfileCompletionBanner />);
      
      const leftContent = container.querySelector('.space-x-3');
      expect(leftContent).toBeInTheDocument();
    });
  });

  // ============================================
  // 边界情况测试
  // ============================================
  
  describe('边界情况', () => {
    it('处理undefined的onSetupClick', () => {
      setupAuthMock(true);
      
      expect(() => {
        renderWithAuth(<ProfileCompletionBanner onSetupClick={undefined} />);
      }).not.toThrow();
    });

    it('处理null的onSetupClick', () => {
      setupAuthMock(true);
      
      expect(() => {
        renderWithAuth(<ProfileCompletionBanner onSetupClick={null} />);
      }).not.toThrow();
    });

    it('needsProfileSetup从true变为false时应该隐藏横幅', () => {
      setupAuthMock(true);
      
      const { rerender, container } = renderWithAuth(<ProfileCompletionBanner />);
      
      // 最初应该显示
      expect(screen.getByText('欢迎使用 VFS Tracker！')).toBeInTheDocument();
      
      // 更新为false
      setupAuthMock(false);
      rerender(<ProfileCompletionBanner />);
      
      // 应该隐藏
      expect(container.firstChild).toBeNull();
    });

    it('needsProfileSetup从false变为true时应该显示横幅', () => {
      setupAuthMock(false);
      
      const { rerender, container } = renderWithAuth(<ProfileCompletionBanner />);
      
      // 最初不应该显示
      expect(container.firstChild).toBeNull();
      
      // 更新为true
      setupAuthMock(true);
      rerender(<ProfileCompletionBanner />);
      
      // 应该显示
      expect(screen.getByText('欢迎使用 VFS Tracker！')).toBeInTheDocument();
    });
  });
});
