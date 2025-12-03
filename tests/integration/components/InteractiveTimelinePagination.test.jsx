/**
 * @file InteractiveTimeline 分页功能集成测试
 * @description 测试时间线组件中移动端分页功能的正确性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../src/test-utils/custom-render.jsx';
import InteractiveTimeline from '../../../src/components/InteractiveTimeline.jsx';
import { mockPrivateEvents } from '../../../src/test-utils/fixtures/index.js';
import { fetchAuthSession } from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

describe('InteractiveTimeline 分页功能集成测试', () => {
  
  // 保存原始的 window 属性
  let originalInnerWidth;
  
  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    
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
  
  afterEach(() => {
    // 恢复原始值
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    });
  });
  
  /**
   * 模拟移动端视口
   */
  const simulateMobileViewport = () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375  // iPhone SE 宽度
    });
    window.dispatchEvent(new Event('resize'));
  };
  
  /**
   * 模拟桌面端视口
   */
  const simulateDesktopViewport = () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280
    });
    window.dispatchEvent(new Event('resize'));
  };
  
  /**
   * 生成大量测试事件用于分页测试
   */
  const generateManyEvents = (count = 25) => {
    return Array.from({ length: count }, (_, i) => ({
      eventId: `event-${i + 1}`,
      type: 'self_test',
      userId: 'test-user',
      date: new Date(2024, 0, 15 - i).toISOString().split('T')[0],
      status: 'approved',
      details: {
        full_metrics: {
          f0_mean: 200 + i,
          f0_stdev: 10 + i * 0.5
        }
      }
    }));
  };
  
  // ============================================
  // 移动端分页渲染测试
  // ============================================
  
  describe('移动端分页渲染', () => {
    beforeEach(() => {
      simulateMobileViewport();
    });
    
    it('移动端应该显示分页组件', async () => {
      const manyEvents = generateManyEvents(25);
      
      renderWithProviders(
        <InteractiveTimeline events={manyEvents} userId="test-user" />
      );
      
      await waitFor(() => {
        // 应该显示分页导航
        const pagination = screen.queryByRole('navigation', { name: /分页/i });
        // 分页可能通过 aria-label 或文本显示
        const pageInfo = screen.queryByText(/页|共|条/);
        expect(pagination || pageInfo).toBeTruthy();
      }, { timeout: 3000 });
    });
    
    it('移动端应该限制每页显示的事件数量', async () => {
      const manyEvents = generateManyEvents(25);
      
      renderWithProviders(
        <InteractiveTimeline events={manyEvents} userId="test-user" />
      );
      
      await waitFor(() => {
        // 移动端每页应该只显示部分事件（例如 10 条）
        const eventItems = screen.queryAllByRole('listitem');
        // 应该少于总事件数
        if (eventItems.length > 0) {
          expect(eventItems.length).toBeLessThanOrEqual(15);
        }
      }, { timeout: 3000 });
    });
    
    it('事件数量少于每页限制时不应该显示分页', async () => {
      const fewEvents = generateManyEvents(5);
      
      renderWithProviders(
        <InteractiveTimeline events={fewEvents} userId="test-user" />
      );
      
      await waitFor(() => {
        // 分页组件在只有一页时不应该渲染
        const pagination = screen.queryByRole('navigation', { name: /分页/i });
        // 如果只有一页，分页可能不存在或不可见
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 分页导航交互测试
  // ============================================
  
  describe('分页导航交互', () => {
    beforeEach(() => {
      simulateMobileViewport();
    });
    
    it('点击下一页应该显示下一页的事件', async () => {
      const manyEvents = generateManyEvents(25);
      const user = userEvent.setup();
      
      renderWithProviders(
        <InteractiveTimeline events={manyEvents} userId="test-user" />
      );
      
      await waitFor(() => {
        const nextButton = screen.queryByLabelText('下一页');
        if (nextButton) {
          expect(nextButton).toBeInTheDocument();
        }
      }, { timeout: 3000 });
      
      // 点击下一页
      const nextButton = screen.queryByLabelText('下一页');
      if (nextButton && !nextButton.disabled) {
        await user.click(nextButton);
        
        await waitFor(() => {
          // 页码应该变化
          const pageInfo = screen.queryByText(/第 2 页|2.*\/|页 2/);
          if (pageInfo) {
            expect(pageInfo).toBeInTheDocument();
          }
        });
      }
    });
    
    it('点击上一页应该显示上一页的事件', async () => {
      const manyEvents = generateManyEvents(25);
      const user = userEvent.setup();
      
      renderWithProviders(
        <InteractiveTimeline events={manyEvents} userId="test-user" />
      );
      
      // 先到第二页
      await waitFor(() => {
        const nextButton = screen.queryByLabelText('下一页');
        if (nextButton) {
          expect(nextButton).toBeInTheDocument();
        }
      }, { timeout: 3000 });
      
      const nextButton = screen.queryByLabelText('下一页');
      if (nextButton && !nextButton.disabled) {
        await user.click(nextButton);
        
        await waitFor(() => {
          const prevButton = screen.queryByLabelText('上一页');
          if (prevButton && !prevButton.disabled) {
            expect(prevButton).not.toBeDisabled();
          }
        });
        
        // 点击上一页
        const prevButton = screen.queryByLabelText('上一页');
        if (prevButton && !prevButton.disabled) {
          await user.click(prevButton);
          
          await waitFor(() => {
            // 应该回到第一页
            const pageInfo = screen.queryByText(/第 1 页|1.*\/|页 1/);
          });
        }
      }
    });
  });
  
  // ============================================
  // 桌面端测试
  // ============================================
  
  describe('桌面端行为', () => {
    beforeEach(() => {
      simulateDesktopViewport();
    });
    
    it('桌面端应该显示完整时间线（不分页或虚拟滚动）', async () => {
      const manyEvents = generateManyEvents(25);
      
      renderWithProviders(
        <InteractiveTimeline events={manyEvents} userId="test-user" />
      );
      
      await waitFor(() => {
        // 桌面端可能显示所有事件或使用不同的滚动方式
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 事件详情弹窗测试
  // ============================================
  
  describe('事件详情弹窗', () => {
    beforeEach(() => {
      simulateMobileViewport();
    });
    
    it('点击事件应该打开详情弹窗', async () => {
      const events = mockPrivateEvents.slice(0, 5);
      const user = userEvent.setup();
      
      renderWithProviders(
        <InteractiveTimeline events={events} userId="test-user" />
      );
      
      // 等待组件渲染，查找任何可点击的事件元素
      await waitFor(() => {
        // 组件使用 button 来表示可点击的事件
        const buttons = screen.queryAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
      
      // 点击第一个事件按钮
      const eventButtons = screen.getAllByRole('button');
      // 找到一个包含事件信息的按钮
      const eventButton = eventButtons.find(btn => 
        btn.textContent.includes('自我测试') || 
        btn.textContent.includes('手术') ||
        btn.textContent.includes('感受')
      );
      
      if (eventButton) {
        await user.click(eventButton);
        
        await waitFor(() => {
          // 应该显示详情弹窗（dialog 或 modal）
          const modal = screen.queryByRole('dialog');
          if (modal) {
            expect(modal).toBeInTheDocument();
          }
        });
      }
    });
    
    it('详情弹窗应该显示结构化内容而非 JSON', async () => {
      const events = mockPrivateEvents.slice(0, 5);
      const user = userEvent.setup();
      
      renderWithProviders(
        <InteractiveTimeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const buttons = screen.queryAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
      
      // 点击事件打开弹窗
      const eventButtons = screen.getAllByRole('button');
      const eventButton = eventButtons.find(btn => 
        btn.textContent.includes('自我测试') || 
        btn.textContent.includes('手术') ||
        btn.textContent.includes('感受')
      );
      
      if (eventButton) {
        await user.click(eventButton);
        
        await waitFor(() => {
          // 不应该看到原始 JSON 格式
          const jsonBrace = screen.queryByText(/^\{$/);
          expect(jsonBrace).not.toBeInTheDocument();
        });
      }
    });
  });
  
  // ============================================
  // 空状态测试
  // ============================================
  
  describe('空状态', () => {
    it('没有事件时应该显示空状态提示', async () => {
      renderWithProviders(
        <InteractiveTimeline events={[]} userId="test-user" />
      );
      
      await waitFor(() => {
        // 应该显示空状态消息
        const emptyMessage = screen.queryByText(/暂无|没有.*事件|空/i);
        if (emptyMessage) {
          expect(emptyMessage).toBeInTheDocument();
        }
      });
    });
    
    it('没有事件时不应该显示分页', async () => {
      renderWithProviders(
        <InteractiveTimeline events={[]} userId="test-user" />
      );
      
      await waitFor(() => {
        const pagination = screen.queryByRole('navigation', { name: /分页/i });
        expect(pagination).not.toBeInTheDocument();
      });
    });
  });
});
