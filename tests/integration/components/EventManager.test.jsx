/**
 * @file EventManager 组件集成测试 (精简版)
 * @description 测试事件管理组件的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventManager from '../../../src/components/EventManager';
import * as api from '../../../src/api';

// Mock API 模块
vi.mock('../../../src/api');

/**
 * 测试数据：模拟多种类型的事件
 */
const mockEvents = [
  {
    eventId: 'event-1',
    type: 'self_test',
    date: '2025-10-10T10:00:00.000Z',
    createdAt: '2025-10-10T10:00:00.000Z',
    details: {
      fundamentalFrequency: 180,
      notes: '今天状态不错'
    },
    attachments: []
  },
  {
    eventId: 'event-2',
    type: 'hospital_test',
    date: '2025-10-08T08:00:00.000Z',
    createdAt: '2025-10-08T08:00:00.000Z',
    details: {
      fundamentalFrequency: 175,
      hospital: '北京协和医院'
    },
    attachments: []
  },
  {
    eventId: 'event-3',
    type: 'voice_training',
    date: '2025-10-05T14:00:00.000Z',
    createdAt: '2025-10-05T14:00:00.000Z',
    details: {
      trainer: '张老师',
      duration: 60
    },
    attachments: []
  },
  {
    eventId: 'event-4',
    type: 'surgery',
    date: '2025-09-01T09:00:00.000Z',
    createdAt: '2025-09-01T09:00:00.000Z',
    details: {
      surgeryType: 'vocal_cord_surgery',
      doctor: '李医生',
      location: '上海第九人民医院'
    },
    attachments: []
  },
  {
    eventId: 'event-5',
    type: 'feeling_log',
    date: '2025-10-12T20:00:00.000Z',
    createdAt: '2025-10-12T20:00:00.000Z',
    details: {
      mood: 'good',
      notes: '感觉声音越来越好了'
    },
    attachments: []
  }
];

describe('EventManager 组件集成测试', () => {
  // 保存原始的全局函数
  const originalConfirm = global.window.confirm;
  const originalAlert = global.window.alert;
  
  // Mock 函数
  const mockConfirm = vi.fn();
  const mockAlert = vi.fn();
  
  let user;
  const mockOnEventDeleted = vi.fn();
  
  beforeAll(() => {
    // 设置 mock
    global.window.confirm = mockConfirm;
    global.window.alert = mockAlert;
  });
  
  afterAll(() => {
    // 恢复原始值
    global.window.confirm = originalConfirm;
    global.window.alert = originalAlert;
  });

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    // 清理 mock 调用记录
    mockConfirm.mockClear();
    mockAlert.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('基础渲染', () => {
    it('应该渲染筛选控件和事件列表', () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 检查筛选区域
      expect(screen.getByText('筛选条件')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜索事件...')).toBeInTheDocument();
      
      // 检查事件列表标题
      expect(screen.getByText('事件列表')).toBeInTheDocument();
      
      // 检查事件已渲染
      expect(screen.getByText('感受记录')).toBeInTheDocument();
    });

    it('应该正确显示事件数量统计', () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 检查总数显示
      expect(screen.getByText(/显示.*5.*\/.*5.*个事件/)).toBeInTheDocument();
      
      // 检查各类型统计
      expect(screen.getByText(/自我测试.*:.*1/)).toBeInTheDocument();
      expect(screen.getByText(/医院检测.*:.*1/)).toBeInTheDocument();
      expect(screen.getByText(/嗓音训练.*:.*1/)).toBeInTheDocument();
      expect(screen.getByText(/嗓音手术.*:.*1/)).toBeInTheDocument();
      expect(screen.getByText(/感受记录.*:.*1/)).toBeInTheDocument();
    });

    it('当没有事件时应该显示空状态', () => {
      render(<EventManager events={[]} onEventDeleted={mockOnEventDeleted} />);
      
      // 检查空状态
      expect(screen.getByText(/没有找到匹配的事件/)).toBeInTheDocument();
      expect(screen.getByText(/显示.*0.*\/.*0.*个事件/)).toBeInTheDocument();
    });
  });

  describe('搜索功能', () => {
    it('应该能够通过搜索框筛选事件', async () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      const searchInput = screen.getByPlaceholderText('搜索事件...');
      await user.type(searchInput, '今天状态');
      
      // 应该只显示包含搜索词的事件
      await waitFor(() => {
        expect(screen.getByText(/显示.*1.*\/.*5.*个事件/)).toBeInTheDocument();
      });
      
      expect(screen.getByText('自我测试')).toBeInTheDocument();
    });

    it('应该能够搜索医院名称', async () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      const searchInput = screen.getByPlaceholderText('搜索事件...');
      await user.clear(searchInput);
      await user.type(searchInput, '北京协和医院');

      await waitFor(() => {
        expect(screen.getByText(/显示.*1.*\/.*5.*个事件/)).toBeInTheDocument();
        expect(screen.getByText('医院检测')).toBeInTheDocument();
      });
    });
  });

  describe('类型筛选功能', () => {
    it('应该能够筛选和显示事件', () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 找到所有 select
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBe(3); // 事件类型、时间范围、排序方式
      
      // 验证事件类型下拉框存在且有选项
      const typeSelect = selects[0];
      expect(typeSelect).toBeInTheDocument();
      expect(within(typeSelect).getByText('全部类型')).toBeInTheDocument();
      // 验证有事件类型选项（包含 emoji）
      expect(within(typeSelect).getByText(/自我测试/)).toBeInTheDocument();
    });
  });

  describe('删除功能', () => {
    it('点击删除按钮应该弹出确认对话框', async () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 点击第一个删除按钮
      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[0]);
      
      // 检查 confirm 是否被调用
      expect(mockConfirm).toHaveBeenCalledWith('确定要删除这个事件吗？此操作无法撤销。');
    });

    it('确认删除应该调用 API 并触发回调', async () => {
      mockConfirm.mockReturnValue(true);
      api.deleteEvent.mockResolvedValue({ success: true });
      
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 点击删除
      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[0]);
      
      // 检查 API 调用和回调
      await waitFor(() => {
        expect(api.deleteEvent).toHaveBeenCalled();
        expect(mockOnEventDeleted).toHaveBeenCalled();
      });
    });

    it('取消删除应该不调用 API', async () => {
      mockConfirm.mockReturnValue(false);
      
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 点击删除但取消
      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[0]);
      
      // API 不应该被调用
      expect(api.deleteEvent).not.toHaveBeenCalled();
    });

    it('删除失败应该显示错误消息', async () => {
      mockConfirm.mockReturnValue(true);
      api.deleteEvent.mockRejectedValue(new Error('网络错误'));
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 点击删除
      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[0]);
      
      // 检查错误消息（实际错误消息包含详细信息）
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('删除事件失败'));
      });
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('事件详情弹窗', () => {
    it('点击"查看详情"按钮应该打开详情弹窗', async () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 点击第一个事件的"查看详情"按钮
      const detailButtons = screen.getAllByText('查看详情');
      await user.click(detailButtons[0]);
      
      // 检查弹窗是否打开（通过检查"关闭"按钮）
      await waitFor(() => {
        expect(screen.getByText('关闭')).toBeInTheDocument();
      });
    });

    it('点击"关闭"按钮应该关闭详情弹窗', async () => {
      render(<EventManager events={mockEvents} onEventDeleted={mockOnEventDeleted} />);
      
      // 打开弹窗
      const detailButtons = screen.getAllByText('查看详情');
      await user.click(detailButtons[0]);
      
      // 关闭弹窗
      await waitFor(() => {
        expect(screen.getByText('关闭')).toBeInTheDocument();
      });
      
      const closeButton = screen.getByText('关闭');
      await user.click(closeButton);
      
      // 检查弹窗是否关闭
      await waitFor(() => {
        expect(screen.queryByText('关闭')).not.toBeInTheDocument();
      });
    });
  });
});
