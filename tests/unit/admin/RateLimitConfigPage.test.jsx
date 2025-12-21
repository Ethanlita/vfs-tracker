/**
 * @file RateLimitConfigPage 组件测试
 * 测试管理员速率限制配置页面的渲染和交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RateLimitConfigPage from '../../../src/admin/components/RateLimitConfigPage.jsx';

// Mock SSM 服务
vi.mock('../../../src/admin/services/ssm', () => ({
  getRateLimitConfig: vi.fn(),
  updateRateLimitConfig: vi.fn(),
}));

// Mock AWSClientContext
const mockSSMClient = { send: vi.fn() };
vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({
    clients: { ssm: mockSSMClient },
    isReady: true,
  }),
}));

import { getRateLimitConfig, updateRateLimitConfig } from '../../../src/admin/services/ssm';

describe('RateLimitConfigPage 组件测试', () => {
  const defaultConfig = {
    adviceWindowHours: 24,
    adviceMaxRequests: 10,
    songWindowHours: 24,
    songMaxRequests: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getRateLimitConfig.mockResolvedValue(defaultConfig);
    updateRateLimitConfig.mockResolvedValue();
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      // 让 getRateLimitConfig 一直 pending
      getRateLimitConfig.mockReturnValue(new Promise(() => {}));
      
      render(<RateLimitConfigPage />);
      
      expect(screen.getByText('加载配置...')).toBeInTheDocument();
    });
  });

  describe('渲染和显示', () => {
    it('应该显示页面标题', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });
    });

    it('应该显示两个配置卡片', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('AI 建议分析')).toBeInTheDocument();
        expect(screen.getByText('歌曲推荐')).toBeInTheDocument();
      });
    });

    it('应该显示所有输入字段', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        // 应该有 4 个 "时间窗口（小时）" 和 "最大请求次数" 标签（各 2 个）
        expect(screen.getAllByText('时间窗口（小时）')).toHaveLength(2);
        expect(screen.getAllByText('最大请求次数')).toHaveLength(2);
      });
    });

    it('应该显示加载的配置值', async () => {
      getRateLimitConfig.mockResolvedValue({
        adviceWindowHours: 48,
        adviceMaxRequests: 20,
        songWindowHours: 12,
        songMaxRequests: 5,
      });

      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs[0]).toHaveValue(48);
        expect(inputs[1]).toHaveValue(20);
        expect(inputs[2]).toHaveValue(12);
        expect(inputs[3]).toHaveValue(5);
      });
    });

    it('应该显示说明信息', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('管理员账户不受速率限制影响', { exact: false })).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该显示加载错误', async () => {
      getRateLimitConfig.mockRejectedValue(new Error('SSM 连接失败'));

      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('SSM 连接失败')).toBeInTheDocument();
      });
    });

    it('应该显示保存错误', async () => {
      updateRateLimitConfig.mockRejectedValue(new Error('权限不足'));

      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });

      // 修改配置以启用保存按钮
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });

      // 点击保存
      const saveButton = screen.getByRole('button', { name: /保存配置/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('权限不足')).toBeInTheDocument();
      });
    });
  });

  describe('交互功能', () => {
    it('保存按钮在无更改时应该禁用', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /保存配置/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('修改配置后保存按钮应该启用', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });
      
      const saveButton = screen.getByRole('button', { name: /保存配置/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('点击重置应该恢复原始值', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });

      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toHaveValue(24);
      
      // 修改值
      fireEvent.change(inputs[0], { target: { value: '48' } });
      expect(inputs[0]).toHaveValue(48);

      // 点击重置
      const resetButton = screen.getByRole('button', { name: /重置/i });
      await userEvent.click(resetButton);
      
      expect(inputs[0]).toHaveValue(24);
    });

    it('保存成功后应该显示成功提示', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });

      // 修改配置
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });

      // 点击保存
      const saveButton = screen.getByRole('button', { name: /保存配置/i });
      await userEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('✓ 配置已保存')).toBeInTheDocument();
      });
    });

    it('保存时应该显示保存中状态', async () => {
      // 让保存操作延迟
      updateRateLimitConfig.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        expect(screen.getByText('速率限制配置')).toBeInTheDocument();
      });

      // 修改配置
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });

      // 点击保存
      const saveButton = screen.getByRole('button', { name: /保存配置/i });
      await userEvent.click(saveButton);
      
      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });
  });
});
