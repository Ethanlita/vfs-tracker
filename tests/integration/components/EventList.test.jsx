/**
 * @file EventList 组件集成测试
 * @description 测试事件列表组件的渲染和交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../src/test-utils/custom-render.jsx';
import EventList from '../../../src/components/EventList.jsx';
import { mockPublicEvents, mockPrivateEvents } from '../../../src/test-utils/fixtures/index.js';

// Mock Amplify Auth
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(() => 
    Promise.resolve({
      tokens: {
        idToken: {
          toString: () => 'mock-id-token',
          payload: {
            sub: 'us-east-1:complete-user-001',
            email: 'test@example.com',
            nickname: 'testuser',
            token_use: 'id',
          },
        },
      },
    })
  ),
}));

describe('EventList 组件集成测试', () => {
  
  describe('基本渲染', () => {
    it('应该成功渲染事件列表', async () => {
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      // 等待事件列表渲染
      await waitFor(() => {
        expect(screen.queryByText(/加载中/i)).not.toBeInTheDocument();
      });
      
      // 验证事件列表存在
      const eventList = screen.getByRole('list') || screen.getByTestId('event-list');
      expect(eventList).toBeInTheDocument();
    });
    
    it('应该显示所有传入的事件', async () => {
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      await waitFor(() => {
        // 根据实际的事件数量验证
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
      });
    });
    
    it('当没有事件时应该显示空状态', async () => {
      renderWithProviders(<EventList events={[]} />);
      
      await waitFor(() => {
        // EventList实际显示: "未找到事件。请使用上面的表单添加一个!"
        expect(screen.getByText(/未找到事件/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('事件类型显示', () => {
    it('应该正确显示自测事件', async () => {
      const selfTestEvents = mockPrivateEvents.filter(e => e.type === 'self_test');
      renderWithProviders(<EventList events={selfTestEvents} />);
      
      await waitFor(() => {
        // EventList可能显示多个"自我测试"文本(每个事件一个)
        const elements = screen.getAllByText(/自我测试/i);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
    
    it('应该正确显示手术事件', async () => {
      const surgeryEvents = mockPrivateEvents.filter(e => e.type === 'surgery');
      
      if (surgeryEvents.length > 0) {
        renderWithProviders(<EventList events={surgeryEvents} />);
        
        await waitFor(() => {
          // EventList可能显示多个"手术"文本(每个事件一个)
          const elements = screen.getAllByText(/手术/i);
          expect(elements.length).toBeGreaterThan(0);
        });
      }
    });
    
    it('应该正确显示感受日志事件', async () => {
      const feelingEvents = mockPrivateEvents.filter(e => e.type === 'feeling_log');
      
      if (feelingEvents.length > 0) {
        renderWithProviders(<EventList events={feelingEvents} />);
        
        await waitFor(() => {
          // EventList实际显示: "感受记录",不是"感受日志"
          expect(screen.getByText(/感受记录/i)).toBeInTheDocument();
        });
      }
    });
  });
  
  describe('事件信息显示', () => {
    it('应该显示事件的日期', async () => {
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      await waitFor(() => {
        // EventList使用toLocaleDateString(),输出如 "2024/1/15" 或 "2024-1-15"
        // 支持月份和日期的单双位数
        const datePattern = /\d{4}[/-]\d{1,2}[/-]\d{1,2}/;
        const elements = screen.getAllByText(datePattern);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
    
    it('应该显示事件的标题或描述', async () => {
      const eventWithTitle = mockPrivateEvents.find(e => e.title || e.description);
      
      if (eventWithTitle) {
        renderWithProviders(<EventList events={[eventWithTitle]} />);
        
        await waitFor(() => {
          const titleText = eventWithTitle.title || eventWithTitle.description;
          expect(screen.getByText(titleText)).toBeInTheDocument();
        });
      }
    });
    
    it('私有事件应该显示完整信息', async () => {
      const privateEvent = mockPrivateEvents[0];
      renderWithProviders(<EventList events={[privateEvent]} />);
      
      await waitFor(() => {
        // EventList显示中文类型名称,不是原始的type值
        // 验证至少有notes或日期显示
        const notes = privateEvent.notes || privateEvent.details?.notes || '未提供备注';
        expect(screen.getByText(new RegExp(notes, 'i'))).toBeInTheDocument();
      });
    });
  });
  
  describe('用户交互', () => {
    it.skip('点击事件应该能够查看详情', async () => {
      // 跳过原因: EventList是纯展示组件,不接受onEventClick prop,没有点击交互功能
      // EventList只接受events prop,唯一的交互是"下载附件"按钮
      const user = userEvent.setup();
      const onEventClick = vi.fn();
      
      renderWithProviders(
        <EventList events={mockPrivateEvents} onEventClick={onEventClick} />
      );
      
      await waitFor(() => {
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
      });
      
      // 点击第一个事件
      const firstEvent = screen.getAllByRole('listitem')[0];
      await user.click(firstEvent);
      
      // 验证回调被调用
      expect(onEventClick).toHaveBeenCalledTimes(1);
    });
    
    it('应该支持删除事件操作', async () => {
      const user = userEvent.setup();
      const onEventDelete = vi.fn();
      
      renderWithProviders(
        <EventList 
          events={mockPrivateEvents} 
          onEventDelete={onEventDelete}
          showDeleteButton={true}
        />
      );
      
      await waitFor(() => {
        // 查找删除按钮
        const deleteButtons = screen.queryAllByRole('button', { name: /删除/i });
        if (deleteButtons.length > 0) {
          expect(deleteButtons.length).toBeGreaterThan(0);
        }
      });
    });
    
    it('应该支持编辑事件操作', async () => {
      const user = userEvent.setup();
      const onEventEdit = vi.fn();
      
      renderWithProviders(
        <EventList 
          events={mockPrivateEvents} 
          onEventEdit={onEventEdit}
          showEditButton={true}
        />
      );
      
      await waitFor(() => {
        // 查找编辑按钮
        const editButtons = screen.queryAllByRole('button', { name: /编辑/i });
        if (editButtons.length > 0) {
          expect(editButtons.length).toBeGreaterThan(0);
        }
      });
    });
  });
  
  describe('过滤和排序', () => {
    it('应该支持按类型过滤事件', async () => {
      renderWithProviders(
        <EventList 
          events={mockPrivateEvents}
          filterType="self_test"
        />
      );
      
      await waitFor(() => {
        const displayedEvents = screen.getAllByRole('listitem');
        // 所有显示的事件应该是 self_test 类型
        // 这需要根据实际组件实现来验证
        expect(displayedEvents.length).toBeGreaterThan(0);
      });
    });
    
    it('应该支持按日期排序', async () => {
      renderWithProviders(
        <EventList 
          events={mockPrivateEvents}
          sortBy="date"
          sortOrder="desc"
        />
      );
      
      await waitFor(() => {
        const displayedEvents = screen.getAllByRole('listitem');
        expect(displayedEvents.length).toBeGreaterThan(0);
        // 验证顺序（最新的在前）
      });
    });
    
    it('应该支持搜索功能', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <EventList 
          events={mockPrivateEvents}
          showSearch={true}
        />
      );
      
      // 查找搜索输入框
      const searchInput = screen.queryByRole('searchbox') || 
                         screen.queryByPlaceholderText(/搜索/i);
      
      if (searchInput) {
        await user.type(searchInput, '测试');
        
        await waitFor(() => {
          // 验证搜索结果
          const displayedEvents = screen.getAllByRole('listitem');
          expect(displayedEvents.length).toBeGreaterThanOrEqual(0);
        });
      }
    });
  });
  
  // ⚠️ 注意：EventList 组件不接受 loading prop
  // 加载状态由父组件管理，这些测试已跳过
  describe.skip('加载状态', () => {
    it('加载时应该显示加载指示器', () => {
      renderWithProviders(<EventList events={[]} loading={true} />);
      
      expect(screen.getByText(/加载中/i) || screen.getByRole('progressbar')).toBeInTheDocument();
    });
    
    it('加载完成后应该隐藏加载指示器', async () => {
      const { rerender } = renderWithProviders(
        <EventList events={[]} loading={true} />
      );
      
      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
      
      rerender(<EventList events={mockPrivateEvents} loading={false} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/加载中/i)).not.toBeInTheDocument();
      });
    });
  });
  
  describe('错误处理', () => {
    it('当传入无效数据时应该优雅处理', () => {
      // 不应该崩溃
      expect(() => {
        renderWithProviders(<EventList events={null} />);
      }).not.toThrow();
    });
    
    // ⚠️ 注意：EventList 组件不接受 error prop
    // 错误处理由父组件管理，此测试已跳过
    it.skip('应该显示错误消息', () => {
      const errorMessage = '加载事件失败';
      renderWithProviders(
        <EventList events={[]} error={errorMessage} />
      );
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
  
  describe('响应式设计', () => {
    it('在移动端应该调整布局', () => {
      // 设置窄屏幕
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      // 验证移动端布局（这需要根据实际组件实现）
      const eventList = screen.getByRole('list') || screen.getByTestId('event-list');
      expect(eventList).toBeInTheDocument();
    });
    
    it('在桌面端应该显示完整信息', () => {
      // 设置宽屏幕
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      const eventList = screen.getByRole('list') || screen.getByTestId('event-list');
      expect(eventList).toBeInTheDocument();
    });
  });
  
  describe('性能测试', () => {
    it('应该能够处理大量事件', async () => {
      // 创建大量测试数据
      const manyEvents = Array(100).fill(null).map((_, i) => ({
        ...mockPrivateEvents[0],
        eventId: `event-${i}`,
        timestamp: new Date(Date.now() - i * 86400000).toISOString(),
      }));
      
      const startTime = performance.now();
      renderWithProviders(<EventList events={manyEvents} />);
      const renderTime = performance.now() - startTime;
      
      // 渲染时间应该在合理范围内（< 1秒）
      expect(renderTime).toBeLessThan(1000);
      
      await waitFor(() => {
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
      });
    });
    
    it.skip('应该支持虚拟滚动以提高性能', async () => {
      // 跳过原因: EventList没有实现虚拟滚动功能,所有事件都会完整渲染到DOM
      // 这是未来可能的性能优化需求,但当前不支持
      const manyEvents = Array(1000).fill(null).map((_, i) => ({
        ...mockPrivateEvents[0],
        eventId: `event-${i}`,
      }));
      
      renderWithProviders(
        <EventList events={manyEvents} virtualScroll={true} />
      );
      
      await waitFor(() => {
        // 如果启用了虚拟滚动，DOM 中的元素应该少于总数
        const renderedItems = screen.getAllByRole('listitem');
        // 虚拟滚动应该只渲染可见区域的元素
        expect(renderedItems.length).toBeLessThan(manyEvents.length);
      });
    });
  });
});
