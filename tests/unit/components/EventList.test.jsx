/**
 * 单元测试: src/components/EventList.jsx
 * 测试事件列表组件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventList from '../../../src/components/EventList.jsx';

// Mock resolveAttachmentUrl
vi.mock('../../../src/utils/attachments.js', () => ({
  resolveAttachmentUrl: vi.fn(),
}));

import { resolveAttachmentUrl } from '../../../src/utils/attachments.js';

describe('EventList 组件测试', () => {
  // 备份原始的 window.open
  let originalOpen;

  beforeAll(() => {
    originalOpen = window.open;
  });

  afterAll(() => {
    // 恢复原始的 window.open
    window.open = originalOpen;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.open
    global.window.open = vi.fn();
  });

  describe('空状态', () => {
    it('events为null时显示空状态消息', () => {
      render(<EventList events={null} />);

      expect(screen.getByText(/未找到事件/)).toBeInTheDocument();
    });

    it('events为空数组时显示空状态消息', () => {
      render(<EventList events={[]} />);

      expect(screen.getByText(/未找到事件/)).toBeInTheDocument();
      expect(screen.getByText(/请使用上面的表单添加一个/)).toBeInTheDocument();
    });

    it('events为undefined时显示空状态消息', () => {
      render(<EventList events={undefined} />);

      expect(screen.getByText(/未找到事件/)).toBeInTheDocument();
    });
  });

  describe('基础渲染', () => {
    it('应该渲染事件列表', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试备注',
        },
      ];

      render(<EventList events={events} />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('应该渲染所有事件', () => {
      const events = [
        { eventId: '1', type: 'self_test', createdAt: '2025-01-15T10:00:00.000Z', notes: 'Event 1' },
        { eventId: '2', type: 'surgery', createdAt: '2025-01-16T10:00:00.000Z', notes: 'Event 2' },
        { eventId: '3', type: 'feeling_log', createdAt: '2025-01-17T10:00:00.000Z', notes: 'Event 3' },
      ];

      render(<EventList events={events} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('应该显示事件备注', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '这是一个测试备注',
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText('这是一个测试备注')).toBeInTheDocument();
    });

    it('当notes为空时应该从details.notes读取', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          details: {
            notes: '从details读取的备注',
          },
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText('从details读取的备注')).toBeInTheDocument();
    });

    it('当notes和details.notes都为空时显示默认消息', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText('未提供备注。')).toBeInTheDocument();
    });

    it('应该显示格式化的日期', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
        },
      ];

      render(<EventList events={events} />);

      const timeElement = screen.getByText(/2025/);
      expect(timeElement).toBeInTheDocument();
      expect(timeElement.tagName).toBe('TIME');
    });
  });

  describe('事件类型映射', () => {
    const typeTests = [
      { type: 'hospital_test', expected: '医院检测' },
      { type: 'self_test', expected: '自我测试' },
      { type: 'voice_training', expected: '嗓音训练' },
      { type: 'self_practice', expected: '自我练习' },
      { type: 'surgery', expected: '手术' },
      { type: 'feeling_log', expected: '感受记录' },
    ];

    typeTests.forEach(({ type, expected }) => {
      it(`应该将${type}映射为${expected}`, () => {
        const events = [
          {
            eventId: '1',
            type,
            createdAt: '2025-01-15T10:00:00.000Z',
            notes: '测试',
          },
        ];

        render(<EventList events={events} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });

    it('未知类型应该显示大写格式', () => {
      const events = [
        {
          eventId: '1',
          type: 'unknown_type',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText('UNKNOWN TYPE')).toBeInTheDocument();
    });
  });

  describe('时间线样式', () => {
    it('应该为非最后一个事件显示连接线', () => {
      const events = [
        { eventId: '1', type: 'self_test', createdAt: '2025-01-15T10:00:00.000Z', notes: 'Event 1' },
        { eventId: '2', type: 'surgery', createdAt: '2025-01-16T10:00:00.000Z', notes: 'Event 2' },
      ];

      const { container } = render(<EventList events={events} />);

      const lines = container.querySelectorAll('.bg-gray-200');
      expect(lines).toHaveLength(1); // 只有第一个事件有连接线
    });

    it('最后一个事件不应该显示连接线', () => {
      const events = [
        { eventId: '1', type: 'self_test', createdAt: '2025-01-15T10:00:00.000Z', notes: 'Event 1' },
        { eventId: '2', type: 'surgery', createdAt: '2025-01-16T10:00:00.000Z', notes: 'Event 2' },
      ];

      const { container } = render(<EventList events={events} />);

      const listItems = screen.getAllByRole('listitem');
      const lastItem = listItems[listItems.length - 1];
      
      const lineInLastItem = within(lastItem).queryByRole('presentation', { hidden: true });
      expect(lineInLastItem).not.toBeInTheDocument();
    });

    it('每个事件应该有粉色圆形图标', () => {
      const events = [
        { eventId: '1', type: 'self_test', createdAt: '2025-01-15T10:00:00.000Z', notes: 'Event 1' },
      ];

      const { container } = render(<EventList events={events} />);

      const icons = container.querySelectorAll('.bg-pink-500.rounded-full');
      expect(icons).toHaveLength(1);
    });
  });

  describe('附件处理', () => {
    it('没有附件时不显示下载按钮', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
        },
      ];

      render(<EventList events={events} />);

      expect(screen.queryByText(/下载附件/)).not.toBeInTheDocument();
    });

    it('attachments为空数组时不显示下载按钮', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [],
        },
      ];

      render(<EventList events={events} />);

      expect(screen.queryByText(/下载附件/)).not.toBeInTheDocument();
    });

    it('应该显示附件下载按钮', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText(/下载附件1 - report.pdf/)).toBeInTheDocument();
    });

    it('应该显示多个附件', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report1.pdf' },
            { fileUrl: 's3://bucket/file2.pdf', fileName: 'report2.pdf' },
            { fileUrl: 's3://bucket/file3.pdf', fileName: 'report3.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText(/下载附件1 - report1.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/下载附件2 - report2.pdf/)).toBeInTheDocument();
      expect(screen.getByText(/下载附件3 - report3.pdf/)).toBeInTheDocument();
    });

    it('附件没有fileName时应该只显示编号', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText('下载附件1')).toBeInTheDocument();
      expect(screen.queryByText(/-/)).not.toBeInTheDocument();
    });
  });

  describe('附件下载功能', () => {
    it('点击附件应该调用resolveAttachmentUrl', async () => {
      const user = userEvent.setup();
      resolveAttachmentUrl.mockResolvedValue('https://signed-url.example.com');

      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      const button = screen.getByText(/下载附件1/);
      await user.click(button);

      expect(resolveAttachmentUrl).toHaveBeenCalledTimes(1);
      expect(resolveAttachmentUrl).toHaveBeenCalledWith('s3://bucket/file1.pdf', { download: true });
    });

    it('成功获取URL后应该打开新标签页', async () => {
      const user = userEvent.setup();
      const signedUrl = 'https://signed-url.example.com';
      resolveAttachmentUrl.mockResolvedValue(signedUrl);

      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      const button = screen.getByText(/下载附件1/);
      await user.click(button);

      // 等待Promise解析
      await vi.waitFor(() => {
        expect(window.open).toHaveBeenCalledWith(signedUrl, '_blank');
      });
    });

    it('下载中应该显示加载状态', async () => {
      const user = userEvent.setup();
      let resolvePromise;
      resolveAttachmentUrl.mockImplementation(() => new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      const button = screen.getByText(/下载附件1 - report.pdf/);
      await user.click(button);

      // 应该显示加载状态
      expect(screen.getByText(/附件1 获取链接中/)).toBeInTheDocument();

      // 按钮应该被禁用
      expect(button).toBeDisabled();

      // 完成加载
      resolvePromise('https://signed-url.example.com');
    });

    it('下载失败应该显示alert', async () => {
      const user = userEvent.setup();
      global.alert = vi.fn();
      resolveAttachmentUrl.mockRejectedValue(new Error('S3 Error'));

      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      const button = screen.getByText(/下载附件1/);
      await user.click(button);

      await vi.waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('无法获取文件的下载链接。');
      });
    });

    it('多次点击应该触发多次下载', async () => {
      const user = userEvent.setup();
      resolveAttachmentUrl.mockResolvedValue('https://signed-url.example.com');

      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: [
            { fileUrl: 's3://bucket/file1.pdf', fileName: 'report.pdf' },
          ],
        },
      ];

      render(<EventList events={events} />);

      const button = screen.getByText(/下载附件1/);
      
      await user.click(button);
      await vi.waitFor(() => expect(resolveAttachmentUrl).toHaveBeenCalledTimes(1));

      await user.click(button);
      await vi.waitFor(() => expect(resolveAttachmentUrl).toHaveBeenCalledTimes(2));
    });
  });

  describe('边界情况', () => {
    it('处理非常长的备注', () => {
      const longNote = 'a'.repeat(500);
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: longNote,
        },
      ];

      render(<EventList events={events} />);

      expect(screen.getByText(longNote)).toBeInTheDocument();
    });

    it('处理无效的日期格式', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: 'invalid-date',
          notes: '测试',
        },
      ];

      expect(() => {
        render(<EventList events={events} />);
      }).not.toThrow();
    });

    it('处理大量事件', () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        eventId: `event-${i}`,
        type: 'self_test',
        createdAt: '2025-01-15T10:00:00.000Z',
        notes: `Event ${i}`,
      }));

      render(<EventList events={events} />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(100);
    });

    it('attachments不是数组时不崩溃', () => {
      const events = [
        {
          eventId: '1',
          type: 'self_test',
          createdAt: '2025-01-15T10:00:00.000Z',
          notes: '测试',
          attachments: null,
        },
      ];

      expect(() => {
        render(<EventList events={events} />);
      }).not.toThrow();
    });
  });
});
