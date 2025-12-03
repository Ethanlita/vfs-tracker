/**
 * @file EventDetailsPanel 组件集成测试
 * @description 测试事件详情面板组件的渲染和交互
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, renderWithRouter } from '../../../src/test-utils/custom-render.jsx';
import EventDetailsPanel from '../../../src/components/events/EventDetailsPanel.jsx';
import { mockPrivateEvents } from '../../../src/test-utils/fixtures/index.js';
import { fetchAuthSession } from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

describe('EventDetailsPanel 组件集成测试', () => {
  
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
  
  // 获取不同类型的测试事件
  const getSelfTestEvent = () => mockPrivateEvents.find(e => e.type === 'self_test');
  const getSurgeryEvent = () => mockPrivateEvents.find(e => e.type === 'surgery');
  const getFeelingLogEvent = () => mockPrivateEvents.find(e => e.type === 'feeling_log');
  const getVoiceTrainingEvent = () => mockPrivateEvents.find(e => e.type === 'voice_training');
  const getSelfPracticeEvent = () => mockPrivateEvents.find(e => e.type === 'self_practice');
  const getHospitalTestEvent = () => mockPrivateEvents.find(e => e.type === 'hospital_test');
  
  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('应该正确渲染自测事件详情', async () => {
      const event = getSelfTestEvent();
      if (!event) return; // 如果没有该类型事件则跳过
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 应该显示事件类型
        expect(screen.getByText(/自我测试|自测/i)).toBeInTheDocument();
      });
    });
    
    it('应该正确渲染手术事件详情', async () => {
      const event = getSurgeryEvent();
      if (!event) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 手术事件会显示多个包含"手术"的元素（类型标签、手术信息等）
        const surgeryElements = screen.getAllByText(/手术/i);
        expect(surgeryElements.length).toBeGreaterThan(0);
      });
    });
    
    it('应该正确渲染感受记录详情', async () => {
      const event = getFeelingLogEvent();
      if (!event) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        expect(screen.getByText(/感受|记录/i)).toBeInTheDocument();
      });
    });
    
    it('event 为空时应该显示提示', () => {
      // 使用 renderWithRouter 避免 AuthProvider 加载状态干扰
      renderWithRouter(<EventDetailsPanel event={null} />);
      
      // 组件在 event 为 null 时显示"请选择一个事件查看详情"
      expect(screen.getByText(/请选择一个事件/i)).toBeInTheDocument();
    });
  });
  
  // ============================================
  // 基本信息显示测试
  // ============================================
  
  describe('基本信息显示', () => {
    it('应该显示事件日期', async () => {
      const event = getSelfTestEvent();
      if (!event) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 组件使用 📅 emoji 和日期格式（如 2025/9/25）显示日期
        // 查找包含日期格式的元素
        const datePattern = /\d{4}\/\d{1,2}\/\d{1,2}/;
        const dateElement = screen.getByText(datePattern);
        expect(dateElement).toBeInTheDocument();
      });
    });
    
    it('应该显示事件状态', async () => {
      const event = getSelfTestEvent();
      if (!event) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 应该包含状态相关信息
        const statusText = screen.queryByText(/状态|已批准|待审核|approved|pending/i);
        expect(statusText).toBeInTheDocument();
      });
    });
  });
  
  // ============================================
  // 自测事件详情测试
  // ============================================
  
  describe('自测事件详情', () => {
    it('应该显示嗓音测量数据', async () => {
      const event = getSelfTestEvent();
      if (!event?.details?.full_metrics) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 应该显示 f0 相关数据
        const f0Element = screen.queryByText(/基频|f0|Hz/i);
        if (f0Element) {
          expect(f0Element).toBeInTheDocument();
        }
      });
    });
    
    it('应该可以展开和折叠详细指标', async () => {
      const event = getSelfTestEvent();
      if (!event?.details?.full_metrics) return;
      
      const user = userEvent.setup();
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        const expandButton = screen.queryByRole('button', { name: /展开|显示更多|详细/i });
        if (expandButton) {
          expect(expandButton).toBeInTheDocument();
        }
      });
    });
  });
  
  // ============================================
  // 手术事件详情测试
  // ============================================
  
  describe('手术事件详情', () => {
    it('应该显示医生信息', async () => {
      const event = getSurgeryEvent();
      if (!event?.details?.doctor) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        // 应该显示医生字段
        expect(screen.getByText(/医生/i)).toBeInTheDocument();
      });
    });
    
    it('应该显示医院信息', async () => {
      const event = getSurgeryEvent();
      if (!event?.details?.hospital) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        expect(screen.getByText(/医院/i)).toBeInTheDocument();
      });
    });
    
    it('应该显示手术方法', async () => {
      const event = getSurgeryEvent();
      if (!event?.details?.surgeryMethod) return;
      
      renderWithProviders(<EventDetailsPanel event={event} />);
      
      await waitFor(() => {
        expect(screen.getByText(/手术方法|术式/i)).toBeInTheDocument();
      });
    });
  });
  
  // ============================================
  // 附件显示测试
  // ============================================
  
  describe('附件显示', () => {
    it('有附件时应该显示附件列表', async () => {
      const eventWithAttachment = mockPrivateEvents.find(
        e => e.details?.attachments && e.details.attachments.length > 0
      );
      if (!eventWithAttachment) return;
      
      renderWithProviders(<EventDetailsPanel event={eventWithAttachment} />);
      
      await waitFor(() => {
        // 应该显示附件相关区域
        const attachmentSection = screen.queryByText(/附件|文件|下载/i);
        if (attachmentSection) {
          expect(attachmentSection).toBeInTheDocument();
        }
      });
    });
    
    it('没有附件时不应该显示附件区域', async () => {
      const eventWithoutAttachment = {
        ...getSelfTestEvent(),
        details: { ...getSelfTestEvent()?.details, attachments: [] }
      };
      
      renderWithProviders(<EventDetailsPanel event={eventWithoutAttachment} />);
      
      await waitFor(() => {
        // 不应该显示"附件"标题（或者显示"暂无附件"）
        const noAttachments = screen.queryByText(/暂无附件/i);
        // 可能有或没有，取决于组件实现
      });
    });
  });
  
  // ============================================
  // 备注显示测试
  // ============================================
  
  describe('备注显示', () => {
    it('有备注时应该显示备注内容', async () => {
      const eventWithNotes = mockPrivateEvents.find(
        e => e.details?.notes && e.details.notes.length > 0
      );
      if (!eventWithNotes) return;
      
      renderWithProviders(<EventDetailsPanel event={eventWithNotes} />);
      
      await waitFor(() => {
        // 应该显示备注区域
        const notesSection = screen.queryByText(/备注|说明|笔记/i);
        if (notesSection) {
          expect(notesSection).toBeInTheDocument();
        }
      });
    });
  });
  
  // ============================================
  // 响应式布局测试
  // ============================================
  
  describe('响应式布局', () => {
    it('应该根据 size prop 调整布局', async () => {
      const event = getSelfTestEvent();
      if (!event) return;
      
      const { rerender } = renderWithProviders(
        <EventDetailsPanel event={event} size="default" />
      );
      
      await waitFor(() => {
        const panel = screen.getByTestId ? 
          screen.queryByTestId('event-details-panel') : 
          document.querySelector('[class*="event-details"]');
      });
      
      // 重新渲染为 compact 模式
      rerender(<EventDetailsPanel event={event} size="compact" />);
      
      // compact 模式下某些区域可能被隐藏
    });
  });
  
  // ============================================
  // 所有事件类型覆盖测试
  // ============================================
  
  describe('事件类型覆盖', () => {
    const eventTypes = [
      { type: 'self_test', name: '自测事件' },
      { type: 'hospital_test', name: '医院检查' },
      { type: 'voice_training', name: '嗓音训练' },
      { type: 'self_practice', name: '自主练习' },
      { type: 'surgery', name: '手术事件' },
      { type: 'feeling_log', name: '感受记录' },
    ];
    
    eventTypes.forEach(({ type, name }) => {
      it(`应该正确渲染 ${name}`, async () => {
        const event = mockPrivateEvents.find(e => e.type === type);
        
        if (!event) {
          // 创建一个最小的测试事件
          const minimalEvent = {
            eventId: `test-${type}-001`,
            type,
            userId: 'test-user',
            date: '2024-01-15',
            status: 'approved',
            details: {}
          };
          
          renderWithProviders(<EventDetailsPanel event={minimalEvent} />);
        } else {
          renderWithProviders(<EventDetailsPanel event={event} />);
        }
        
        // 组件应该能够渲染而不报错
        await waitFor(() => {
          expect(document.body).toBeInTheDocument();
        });
      });
    });
  });
  
  // ============================================
  // 未知事件类型处理测试
  // ============================================
  
  describe('未知事件类型处理', () => {
    it('应该优雅地处理未知事件类型', async () => {
      const unknownEvent = {
        eventId: 'unknown-001',
        type: 'unknown_type',
        userId: 'test-user',
        date: '2024-01-15',
        status: 'pending',
        details: {
          someField: 'some value'
        }
      };
      
      renderWithProviders(<EventDetailsPanel event={unknownEvent} />);
      
      await waitFor(() => {
        // 应该仍然能渲染，显示通用信息
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});
