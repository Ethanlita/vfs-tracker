/**
 * @file RateLimitConfigPage 组件测试
 * 测试管理员速率限制配置页面的渲染和交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RateLimitConfigPage from '../../../src/admin/components/RateLimitConfigPage.jsx';

// Mock SSM 服务
vi.mock('../../../src/admin/services/ssm', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRateLimitConfig: vi.fn(),
    updateRateLimitConfig: vi.fn(),
  };
});

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
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /保存配置/i })).not.toBeInTheDocument();
      expect(updateRateLimitConfig).not.toHaveBeenCalled();
    });

    it('读取失败后原地重试成功，显示真实配置且保留管理员会话', async () => {
      getRateLimitConfig
        .mockRejectedValueOnce(new Error('AccessDeniedException'))
        .mockResolvedValueOnce({
          adviceWindowHours: 48,
          adviceMaxRequests: 3,
          songWindowHours: 72,
          songMaxRequests: 5,
        });

      render(<RateLimitConfigPage />);
      await screen.findByText('AccessDeniedException');
      await userEvent.click(screen.getByRole('button', { name: '重试读取配置' }));

      await waitFor(() => {
        expect(screen.getAllByRole('spinbutton').map(input => input.value)).toEqual(['48', '3', '72', '5']);
      });
      expect(screen.queryByText('AccessDeniedException')).not.toBeInTheDocument();
      expect(getRateLimitConfig).toHaveBeenCalledTimes(2);
      expect(updateRateLimitConfig).not.toHaveBeenCalled();
    });

    it('重试加载中同步锁定重复点击，再次失败仍可恢复', async () => {
      let rejectRetry;
      getRateLimitConfig
        .mockRejectedValueOnce(new Error('首次网络失败'))
        .mockImplementationOnce(() => new Promise((_, reject) => { rejectRetry = reject; }))
        .mockResolvedValueOnce(defaultConfig);

      render(<RateLimitConfigPage />);
      await screen.findByText('首次网络失败');
      const retry = screen.getByRole('button', { name: '重试读取配置' });
      fireEvent.click(retry);
      fireEvent.click(retry);
      expect(getRateLimitConfig).toHaveBeenCalledTimes(2);
      expect(screen.getByText('加载配置...')).toBeInTheDocument();

      await act(async () => rejectRetry(new Error('再次失败')));
      expect(await screen.findByText('再次失败')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '重试读取配置' }));
      await screen.findAllByRole('spinbutton');
      expect(getRateLimitConfig).toHaveBeenCalledTimes(3);
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
    const partialError = () => Object.assign(new Error('部分保存失败'), {
      name: 'RateLimitUpdateError',
      results: {
        adviceWindowHours: { status: 'fulfilled', value: 48 },
        adviceMaxRequests: { status: 'rejected', value: 20, reason: new Error('拒绝') },
      },
    });

    it('只写变化字段，部分失败后核对实际值并保留失败编辑供重试', async () => {
      getRateLimitConfig
        .mockResolvedValueOnce(defaultConfig)
        .mockResolvedValueOnce({ ...defaultConfig, adviceWindowHours: 48 });
      updateRateLimitConfig.mockRejectedValueOnce(partialError()).mockResolvedValueOnce({ results: {} });
      render(<RateLimitConfigPage />);
      const inputs = await screen.findAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });
      fireEvent.change(inputs[1], { target: { value: '20' } });
      await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

      await screen.findByText('已保存：AI 建议时间窗口；保存失败：AI 建议最大请求次数。已重新读取服务端状态，未保存的编辑仍保留。');
      expect(inputs[0]).toHaveValue(48);
      expect(inputs[1]).toHaveValue(20);
      expect(screen.getByText('此项保存失败，请重试')).toBeInTheDocument();
      expect(updateRateLimitConfig).toHaveBeenNthCalledWith(1, mockSSMClient, { adviceWindowHours: '48', adviceMaxRequests: '20' });

      await userEvent.click(screen.getByRole('button', { name: '保存配置' }));
      expect(updateRateLimitConfig).toHaveBeenNthCalledWith(2, mockSSMClient, { adviceMaxRequests: '20' });
      expect(await screen.findByText('✓ 配置已保存')).toBeInTheDocument();
    });

    it('部分失败且核对失败时锁定表单，核对成功后恢复失败编辑', async () => {
      getRateLimitConfig
        .mockResolvedValueOnce(defaultConfig)
        .mockRejectedValueOnce(new Error('核对失败'))
        .mockResolvedValueOnce({ ...defaultConfig, adviceWindowHours: 48 });
      updateRateLimitConfig.mockRejectedValueOnce(partialError());
      render(<RateLimitConfigPage />);
      const inputs = await screen.findAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '48' } });
      fireEvent.change(inputs[1], { target: { value: '20' } });
      await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

      await screen.findByText('无法重新核对服务端状态', { exact: false });
      expect(inputs.every(input => input.disabled)).toBe(true);
      expect(screen.getByRole('button', { name: '保存配置' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '重置' })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: '重新核对服务端状态' }));

      await waitFor(() => expect(inputs.every(input => !input.disabled)).toBe(true));
      expect(inputs[0]).toHaveValue(48);
      expect(inputs[1]).toHaveValue(20);
      expect(updateRateLimitConfig).toHaveBeenCalledTimes(1);
      await userEvent.click(screen.getByRole('button', { name: '重置' }));
      expect(inputs[1]).toHaveValue(10);
    });

    it.each([
      ['', '请填写AI 建议最大请求次数'],
      ['-5', '必须在 1 到 100 之间'],
      ['0', '必须在 1 到 100 之间'],
      ['1.5', '必须是整数'],
      ['101', '必须在 1 到 100 之间'],
    ])('非法最大次数 %s 显示字段错误且不写配置', async (value, message) => {
      render(<RateLimitConfigPage />);
      const inputs = await screen.findAllByRole('spinbutton');
      fireEvent.change(inputs[1], { target: { value } });
      await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

      expect(screen.getByText(message, { exact: false })).toBeInTheDocument();
      expect(inputs[1]).toHaveAttribute('aria-invalid', 'true');
      expect(inputs[1]).toHaveFocus();
      expect(inputs[1]).toHaveValue(value === '' ? null : Number(value));
      expect(updateRateLimitConfig).not.toHaveBeenCalled();
    });

    it.each([
      [0, '1'], [0, '168'], [1, '1'], [1, '100'], [2, '1'], [2, '168'], [3, '1'], [3, '100'],
    ])('字段 %i 接受边界值 %s', async (index, value) => {
      render(<RateLimitConfigPage />);
      const inputs = await screen.findAllByRole('spinbutton');
      fireEvent.change(inputs[index], { target: { value } });
      await userEvent.click(screen.getByRole('button', { name: '保存配置' }));

      await waitFor(() => expect(updateRateLimitConfig).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('请修正配置中的错误后再保存。')).not.toBeInTheDocument();
    });

    it('保存按钮在无更改时应该禁用', async () => {
      render(<RateLimitConfigPage />);
      
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /保存配置/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('重新输入相同数值时不应该产生空保存', async () => {
      render(<RateLimitConfigPage />);

      const inputs = await screen.findAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '24' } });

      expect(screen.getByRole('button', { name: /保存配置/i })).toBeDisabled();
      expect(updateRateLimitConfig).not.toHaveBeenCalled();
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
      // 显式控制在途保存，并在测试结束前收尾，避免定时回调越过环境销毁。
      let finishSave;
      updateRateLimitConfig.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));

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
      await act(async () => finishSave());
      expect(screen.queryByText('保存中...')).not.toBeInTheDocument();
    });
  });
});
