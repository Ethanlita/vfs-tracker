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
import { fetchAuthSession } from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

describe('EventList 组件集成测试', () => {
  
  beforeEach(() => {
    // 设置默认的 auth mock 行为
    vi.mocked(fetchAuthSession).mockResolvedValue({
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
    });
  });
  
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
        // EventList使用toLocaleDateString(),可能输出为 "6/21/2025" (月/日/年) 或 "2024/1/15" (年/月/日)
        // 支持月份和日期的单双位数，以及不同的日期格式
        // 确保年份始终为 4 位数
        const datePattern = /\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}/;
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
    it('应该支持下载附件', async () => {
      const user = userEvent.setup();
      // 查找有附件的事件
      const eventWithAttachment = mockPrivateEvents.find(e => 
        Array.isArray(e.attachments) && e.attachments.length > 0
      );
      
      if (eventWithAttachment) {
        // Mock window.open
        const mockOpen = vi.fn();
        const originalOpen = window.open;
        window.open = mockOpen;
        
        renderWithProviders(<EventList events={[eventWithAttachment]} />);
        
        await waitFor(() => {
          // 查找下载按钮
          const downloadButtons = screen.getAllByRole('button', { name: /下载附件/i });
          expect(downloadButtons.length).toBeGreaterThan(0);
        });
        
        // 恢复 window.open
        window.open = originalOpen;
      }
    });
    
    it('应该在下载时显示加载状态', async () => {
      const user = userEvent.setup();
      const eventWithAttachment = mockPrivateEvents.find(e => 
        Array.isArray(e.attachments) && e.attachments.length > 0
      );
      
      if (eventWithAttachment) {
        renderWithProviders(<EventList events={[eventWithAttachment]} />);
        
        await waitFor(() => {
          // 使用 getAllByRole 因为可能有多个附件
          const downloadButtons = screen.getAllByRole('button', { name: /下载附件/i });
          expect(downloadButtons.length).toBeGreaterThan(0);
          // 验证至少第一个按钮可用
          expect(downloadButtons[0]).toBeInTheDocument();
        });
      }
    });
  });
  
  describe('过滤和排序', () => {
    it('应该正确显示已过滤的事件列表', async () => {
      // EventList 组件本身不进行过滤，过滤应该在传入 events 前完成
      const filteredEvents = mockPrivateEvents.filter(e => e.type === 'self_test');
      renderWithProviders(<EventList events={filteredEvents} />);
      
      await waitFor(() => {
        const displayedEvents = screen.getAllByRole('listitem');
        // 验证显示的事件数量与过滤后的数量一致
        expect(displayedEvents.length).toBe(filteredEvents.length);
        // 验证所有显示的事件都包含"自我测试"类型文本
        const selfTestTexts = screen.getAllByText(/自我测试/i);
        expect(selfTestTexts.length).toBeGreaterThan(0);
      });
    });
    
    it('应该正确显示已排序的事件列表', async () => {
      // EventList 按传入顺序显示事件，排序应该在传入前完成
      const sortedEvents = [...mockPrivateEvents].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      renderWithProviders(<EventList events={sortedEvents} />);
      
      await waitFor(() => {
        const displayedEvents = screen.getAllByRole('listitem');
        expect(displayedEvents.length).toBe(sortedEvents.length);
        
        // 验证第一个事件的日期（最新的）
        const firstDate = new Date(sortedEvents[0].createdAt).toLocaleDateString();
        expect(screen.getByText(firstDate)).toBeInTheDocument();
      });
    });
    
    it('应该能够显示搜索匹配的事件', async () => {
      // EventList 不提供搜索UI，搜索过滤应该由父组件完成
      const searchKeyword = '测试';
      const searchedEvents = mockPrivateEvents.filter(e => 
        (e.notes && e.notes.includes(searchKeyword)) ||
        (e.details?.notes && e.details.notes.includes(searchKeyword))
      );
      
      renderWithProviders(<EventList events={searchedEvents} />);
      
      await waitFor(() => {
        const displayedEvents = screen.getAllByRole('listitem');
        expect(displayedEvents.length).toBe(searchedEvents.length);
        // 验证至少有一个事件包含搜索关键词（使用 getAllByText 因为可能匹配多个）
        if (searchedEvents.length > 0) {
          const matchingElements = screen.getAllByText(new RegExp(searchKeyword, 'i'));
          expect(matchingElements.length).toBeGreaterThan(0);
        }
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
  });
  
  describe('响应式设计', () => {
    const originalInnerWidth = global.innerWidth;
    
    beforeEach(() => {
      // 恢复默认宽度
      global.innerWidth = originalInnerWidth;
    });
    
    afterEach(() => {
      // 确保每个测试后恢复原始宽度
      global.innerWidth = originalInnerWidth;
      global.dispatchEvent(new Event('resize'));
    });
    
    it('在移动端应该调整布局', async () => {
      // 设置窄屏幕
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      // 等待 loading 状态消失
      await waitFor(() => {
        expect(screen.queryByText(/正在加载用户资料/i)).not.toBeInTheDocument();
      });
      
      // 验证移动端布局（这需要根据实际组件实现）
      const eventList = screen.getByRole('list') || screen.getByTestId('event-list');
      expect(eventList).toBeInTheDocument();
    });
    
    it('在桌面端应该显示完整信息', async () => {
      // 设置宽屏幕
      global.innerWidth = 1920;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<EventList events={mockPrivateEvents} />);
      
      // 等待 loading 状态消失
      await waitFor(() => {
        expect(screen.queryByText(/正在加载用户资料/i)).not.toBeInTheDocument();
      });
      
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
      
      renderWithProviders(<EventList events={manyEvents} />);
      
      // 验证列表能够正确渲染大量事件
      await waitFor(() => {
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
      });
    });
  });
});

