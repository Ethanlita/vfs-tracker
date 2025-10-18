/**
 * NewTimeline 组件测试
 * 
 * 组件职责:
 * - 横向时间轴渲染 (上方事件卡片 + 中央轴线圆点 + 下方日期卡片)
 * - 事件类型图标和标签映射
 * - 事件摘要生成 (优先级: summary → details.content → details.notes)
 * - 点击事件卡片显示详情弹窗
 * - 数据源状态指示器 (实时/演示/加载中)
 * - 加载和空状态处理
 * 
 * 测试范围:
 * - 加载状态 (spinner + "正在加载事件...")
 * - 空状态 (无事件时显示提示)
 * - 基础渲染 (时间轴、事件卡片、日期卡片)
 * - 事件类型映射 (6种类型 + fallback)
 * - 日期格式化 (月份、日期、年份)
 * - 摘要生成逻辑 (优先级测试)
 * - 详情弹窗 (打开/关闭/内容显示)
 * - 数据源指示器 (生产/演示/加载)
 * - 边界情况 (无效数据、长文本)
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import NewTimeline from '../../../src/components/NewTimeline';

describe('NewTimeline 组件测试', () => {
  // 测试数据
  const mockEvents = [
    {
      eventId: 'event1',
      type: 'hospital_test',
      date: '2024-01-15T10:30:00Z',
      summary: '第一次医院检查',
      details: { notes: '基频测试正常' },
    },
    {
      eventId: 'event2',
      type: 'self_test',
      createdAt: '2024-02-20T14:00:00Z',
      details: { content: '在家进行嗓音测试，感觉良好' },
    },
    {
      eventId: 'event3',
      type: 'voice_training',
      date: '2024-03-10T09:15:00Z',
      details: { notes: '进行了30分钟的发声练习' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== 加载状态 =====
  describe('加载状态', () => {
    it('isLoading=true时应该显示加载动画', () => {
      render(<NewTimeline events={[]} isLoading={true} />);
      
      // 加载动画 (spinner)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      
      // 加载文本
      expect(screen.getByText('正在加载事件...')).toBeInTheDocument();
    });

    it('isLoading=true时不应该显示空状态或时间轴', () => {
      render(<NewTimeline events={[]} isLoading={true} />);
      
      // 不显示空状态文本
      expect(screen.queryByText('还没有事件记录')).not.toBeInTheDocument();
      
      // 不显示时间轴容器
      const timelineContainer = document.querySelector('.overflow-x-auto');
      expect(timelineContainer).not.toBeInTheDocument();
    });
  });

  // ===== 空状态 =====
  describe('空状态', () => {
    it('events为空数组时应该显示空状态', () => {
      render(<NewTimeline events={[]} isLoading={false} />);
      
      expect(screen.getByText('还没有事件记录')).toBeInTheDocument();
      expect(screen.getByText('使用上面的表单添加您的第一个嗓音事件！')).toBeInTheDocument();
    });

    it('events为null时应该显示空状态', () => {
      render(<NewTimeline events={null} isLoading={false} />);
      
      expect(screen.getByText('还没有事件记录')).toBeInTheDocument();
    });

    it('events为undefined时应该显示空状态', () => {
      render(<NewTimeline isLoading={false} />);
      
      expect(screen.getByText('还没有事件记录')).toBeInTheDocument();
    });

    it('空状态应该包含emoji图标', () => {
      render(<NewTimeline events={[]} isLoading={false} />);
      
      const emojiElement = screen.getByText('📝');
      expect(emojiElement).toBeInTheDocument();
      expect(emojiElement).toHaveClass('text-6xl');
    });
  });

  // ===== 基础渲染 =====
  describe('基础渲染', () => {
    it('应该渲染时间轴容器', () => {
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 时间轴根容器
      const container = document.querySelector('.isolate');
      expect(container).toBeInTheDocument();
      
      // 横向轴线
      const axis = document.querySelector('.bg-gray-300\\/70');
      expect(axis).toBeInTheDocument();
      
      // 滚动容器
      const scrollContainer = document.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('应该渲染所有事件卡片', () => {
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 事件卡片 (检查点击触发器数量)
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      expect(eventCards.length).toBe(mockEvents.length);
    });

    it('每个事件应该有圆点标记', () => {
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 粉色圆点
      const dots = document.querySelectorAll('.bg-pink-500.rounded-full');
      expect(dots.length).toBe(mockEvents.length);
    });

    it('每个事件应该有日期卡片', () => {
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 包含年份的日期卡片 (例如: "2024 1月15日")
      const dateCards = screen.getAllByText(/\d{4} \d+月\d+日/);
      expect(dateCards.length).toBe(mockEvents.length);
    });
  });

  // ===== 事件类型映射 =====
  describe('事件类型映射', () => {
    const typeTests = [
      { type: 'hospital_test', label: '医院检测', icon: '🏥' },
      { type: 'self_test', label: '自我测试', icon: '📱' },
      { type: 'voice_training', label: '嗓音训练', icon: '🎯' },
      { type: 'self_practice', label: '自我练习', icon: '✍️' },
      { type: 'surgery', label: '手术', icon: '⚕️' },
      { type: 'feeling_log', label: '感受记录', icon: '😊' },
    ];

    typeTests.forEach(({ type, label, icon }) => {
      it(`应该正确映射 ${type} → ${label} (${icon})`, () => {
        const events = [{
          eventId: '1',
          type,
          date: '2024-01-15T10:00:00Z',
          summary: '测试摘要',
        }];
        
        render(<NewTimeline events={events} isLoading={false} />);
        
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });

    it('未知类型应该使用原始类型名称和默认图标', () => {
      const events = [{
        eventId: '1',
        type: 'unknown_type',
        date: '2024-01-15T10:00:00Z',
        summary: '测试摘要',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('unknown_type')).toBeInTheDocument();
      expect(screen.getByText('📌')).toBeInTheDocument();
    });
  });

  // ===== 日期格式化 =====
  describe('日期格式化', () => {
    it('应该正确格式化date字段', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-03-15T10:30:00Z',
        summary: '测试',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 检查月份 (中文短格式,会出现两次:月份标签和完整日期)
      const monthTexts = screen.getAllByText(/3月/);
      expect(monthTexts.length).toBeGreaterThanOrEqual(1);
      
      // 检查日期和年份格式 (例如: "2024 3月15日")
      expect(screen.getByText(/2024 3月15日/)).toBeInTheDocument();
    });

    it('应该正确格式化createdAt字段', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        createdAt: '2024-06-20T14:00:00Z',
        summary: '测试',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 月份会出现两次
      const monthTexts = screen.getAllByText(/6月/);
      expect(monthTexts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2024 6月20日/)).toBeInTheDocument();
    });

    it('应该显示正确的日期数字', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-05T10:00:00Z',
        summary: '测试',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 大号日期数字 (text-2xl)
      const dayNumber = screen.getByText('5');
      expect(dayNumber).toHaveClass('text-2xl', 'font-bold');
    });
  });

  // ===== 摘要生成逻辑 =====
  describe('摘要生成逻辑', () => {
    it('应该优先使用summary字段', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        summary: '直接摘要',
        details: {
          content: '详细内容',
          notes: '备注信息',
        },
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('直接摘要')).toBeInTheDocument();
    });

    it('无summary时应该使用details.content', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        details: {
          content: '这是详细内容',
          notes: '这是备注',
        },
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('这是详细内容')).toBeInTheDocument();
    });

    it('无content时应该使用details.notes', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        details: {
          notes: '这是备注信息',
        },
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('这是备注信息')).toBeInTheDocument();
    });

    it('无任何摘要信息时应该显示"无摘要"', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('无摘要')).toBeInTheDocument();
    });

    it('长摘要应该截断并添加省略号', () => {
      const longText = 'a'.repeat(60);
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        details: {
          content: longText,
        },
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 应该截断为50字符 + "…"
      const truncatedText = longText.slice(0, 50) + '…';
      expect(screen.getByText(truncatedText)).toBeInTheDocument();
    });

    it('50字符以内的摘要不应该截断', () => {
      const shortText = 'a'.repeat(50);
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        details: {
          content: shortText,
        },
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 不添加省略号
      expect(screen.getByText(shortText)).toBeInTheDocument();
      expect(screen.queryByText(/…$/)).not.toBeInTheDocument();
    });
  });

  // ===== 详情弹窗 =====
  describe('详情弹窗', () => {
    it('初始状态不应该显示弹窗', () => {
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 弹窗背景遮罩
      const modal = document.querySelector('.fixed.inset-0.z-50');
      expect(modal).not.toBeInTheDocument();
    });

    it('点击事件卡片应该打开详情弹窗', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 点击第一个事件卡片
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      // 弹窗应该出现
      const modal = document.querySelector('.fixed.inset-0.z-50');
      expect(modal).toBeInTheDocument();
    });

    it('弹窗应该显示事件类型和图标', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]); // hospital_test
      
      // 在弹窗内查找
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const modalContent = within(modal);
      
      expect(modalContent.getByText('医院检测')).toBeInTheDocument();
      expect(modalContent.getByText('🏥')).toBeInTheDocument();
    });

    it('弹窗应该显示完整的日期时间', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      // 弹窗显示完整时间格式 (例如: "2024年1月15日 10:30")
      expect(screen.getByText(/2024年1月15日/)).toBeInTheDocument();
    });

    it('弹窗应该显示事件详情JSON', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      // 详情显示在<pre>标签中
      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
      
      // JSON格式化显示
      const detailsText = JSON.stringify(mockEvents[0].details, null, 2);
      expect(pre.textContent).toBe(detailsText);
    });

    it('无details的事件应该显示提示文本', async () => {
      const user = userEvent.setup();
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        summary: '测试',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      expect(screen.getByText('没有详细信息可用。')).toBeInTheDocument();
    });

    it('点击关闭按钮应该关闭弹窗', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 打开弹窗
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      // 点击关闭按钮 (×)
      const closeButton = screen.getByText('×');
      await user.click(closeButton);
      
      // 弹窗应该消失
      const modal = document.querySelector('.fixed.inset-0.z-50');
      expect(modal).not.toBeInTheDocument();
    });

    it('点击背景遮罩应该关闭弹窗', async () => {
      const user = userEvent.setup();
      render(<NewTimeline events={mockEvents} isLoading={false} />);
      
      // 打开弹窗
      const eventCards = document.querySelectorAll('[class*="cursor-pointer"]');
      await user.click(eventCards[0]);
      
      // 点击背景遮罩
      const backdrop = document.querySelector('.bg-black\\/50');
      await user.click(backdrop);
      
      // 弹窗应该消失
      const modal = document.querySelector('.fixed.inset-0.z-50');
      expect(modal).not.toBeInTheDocument();
    });
  });

  // ===== 数据源指示器 =====
  describe('数据源指示器', () => {
    it('isLoading=true时指示器应该显示"加载中..."状态', () => {
      render(<NewTimeline events={[]} isLoading={true} />);
      
      // 实际文本是"正在加载事件..."
      expect(screen.getByText('正在加载事件...')).toBeInTheDocument();
      
      // 粉色spinner动画
      const spinner = document.querySelector('.animate-spin.border-pink-500');
      expect(spinner).toBeInTheDocument();
    });
  });

  // ===== 边界情况 =====
  describe('边界情况', () => {
    it('无效日期不应该导致崩溃', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: 'invalid-date',
        summary: '测试',
      }];
      
      expect(() => {
        render(<NewTimeline events={events} isLoading={false} />);
      }).not.toThrow();
    });

    it('空details对象应该显示"无摘要"', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        details: {},
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      expect(screen.getByText('无摘要')).toBeInTheDocument();
    });

    it('同时有date和createdAt时应该优先使用date', () => {
      const events = [{
        eventId: '1',
        type: 'self_test',
        date: '2024-03-15T10:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        summary: '测试',
      }];
      
      render(<NewTimeline events={events} isLoading={false} />);
      
      // 应该显示3月而不是1月
      const marchTexts = screen.getAllByText(/3月/);
      expect(marchTexts.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/1月/)).not.toBeInTheDocument();
    });

    it('大量事件(100个)应该正常渲染', () => {
      const manyEvents = Array.from({ length: 100 }, (_, i) => ({
        eventId: `event${i}`,
        type: 'self_test',
        date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}T10:00:00Z`,
        summary: `事件 ${i}`,
      }));
      
      expect(() => {
        render(<NewTimeline events={manyEvents} isLoading={false} />);
      }).not.toThrow();
      
      // 所有圆点都应该渲染
      const dots = document.querySelectorAll('.bg-pink-500.rounded-full');
      expect(dots.length).toBe(100);
    });

    it('缺失eventId的事件应该正常渲染', () => {
      const events = [{
        type: 'self_test',
        date: '2024-01-15T10:00:00Z',
        summary: '测试',
      }];
      
      expect(() => {
        render(<NewTimeline events={events} isLoading={false} />);
      }).not.toThrow();
    });
  });
});
