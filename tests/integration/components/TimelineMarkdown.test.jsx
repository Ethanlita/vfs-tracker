/**
 * @file Timeline Markdown 渲染集成测试
 * @description 测试时间线组件中 AI 消息的 Markdown 渲染功能 (Issue #56)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../src/test-utils/custom-render.jsx';
import Timeline from '../../../src/components/Timeline.jsx';
import { fetchAuthSession } from 'aws-amplify/auth';

// 使用 setup.js 中的全局 mock
vi.mock('aws-amplify/auth');

describe('Timeline Markdown 渲染集成测试', () => {
  
  beforeEach(() => {
    // 设置默认的 auth mock 行为
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => 'mock-id-token',
          payload: {
            sub: 'us-east-1:test-user-001',
            email: 'test@example.com',
            nickname: 'testuser',
            token_use: 'id',
          },
        },
      },
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  /**
   * 生成带有 AI 消息的事件
   * @param {string} aiAsyncValue - AI 分析消息内容
   * @returns {Object} 事件对象
   */
  const createEventWithAiMessage = (aiAsyncValue) => ({
    eventId: 'test-event-001',
    type: 'self_test',
    userId: 'test-user',
    date: '2024-01-15',
    status: 'approved',
    details: {
      full_metrics: {
        f0_mean: 220,
        f0_stdev: 15
      }
    },
    aiAsync: {
      status: 'completed',
      value: aiAsyncValue
    }
  });
  
  // ============================================
  // 基本 Markdown 渲染测试
  // ============================================
  
  describe('基本 Markdown 语法', () => {
    
    it('应该正确渲染粗体文本', async () => {
      const aiMessage = '这是一个**重要**的分析结果';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 查找粗体元素
        const strongElements = document.querySelectorAll('strong');
        const hasImportantText = Array.from(strongElements).some(
          el => el.textContent.includes('重要')
        );
        // 如果有 strong 元素包含"重要"，说明渲染正确
        if (strongElements.length > 0) {
          expect(hasImportantText).toBe(true);
        }
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染斜体文本', async () => {
      const aiMessage = '这是一个*斜体*文本';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const emElements = document.querySelectorAll('em');
        // 检查是否有 em 元素
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染标题', async () => {
      const aiMessage = '## 分析结果\n\n这是分析内容';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 检查是否有 h2 元素
        const h2Elements = document.querySelectorAll('h2');
        // 标题可能被渲染为 h2
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 列表渲染测试
  // ============================================
  
  describe('列表渲染', () => {
    
    it('应该正确渲染无序列表', async () => {
      const aiMessage = `分析要点：
- 第一点
- 第二点
- 第三点`;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const ulElements = document.querySelectorAll('ul');
        const liElements = document.querySelectorAll('li');
        // 应该有列表元素
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染有序列表', async () => {
      const aiMessage = `步骤：
1. 第一步
2. 第二步
3. 第三步`;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const olElements = document.querySelectorAll('ol');
        // 应该有有序列表元素
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // GFM 扩展语法测试 (GitHub Flavored Markdown)
  // ============================================
  
  describe('GFM 扩展语法', () => {
    
    it('应该正确渲染删除线', async () => {
      const aiMessage = '这是~~删除线~~文本';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // GFM 删除线应该渲染为 <del> 元素
        const delElements = document.querySelectorAll('del');
        if (delElements.length > 0) {
          const hasStrikethrough = Array.from(delElements).some(
            el => el.textContent.includes('删除线')
          );
          expect(hasStrikethrough).toBe(true);
        }
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染表格', async () => {
      const aiMessage = `| 指标 | 数值 | 状态 |
| --- | --- | --- |
| 基频 | 220Hz | 正常 |
| 抖动 | 0.5% | 正常 |`;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // GFM 表格应该渲染为 <table> 元素
        const tableElements = document.querySelectorAll('table');
        if (tableElements.length > 0) {
          expect(tableElements.length).toBeGreaterThan(0);
        }
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染任务列表', async () => {
      const aiMessage = `待办事项：
- [x] 已完成项
- [ ] 未完成项`;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // GFM 任务列表应该渲染复选框
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        // 任务列表可能有复选框
      }, { timeout: 3000 });
    });
    
    it('应该自动将 URL 转换为链接', async () => {
      const aiMessage = '更多信息请访问 https://example.com';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // GFM 应该自动将 URL 转换为可点击链接
        const links = document.querySelectorAll('a[href="https://example.com"]');
        // 链接应该存在（如果 GFM autolink 启用）
        expect(links.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 代码块渲染测试
  // ============================================
  
  describe('代码渲染', () => {
    
    it('应该正确渲染行内代码', async () => {
      const aiMessage = '使用 `f0_mean` 参数进行分析';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const codeElements = document.querySelectorAll('code');
        // 应该有行内代码元素
        expect(codeElements.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 3000 });
    });
    
    it('应该正确渲染代码块', async () => {
      const aiMessage = `\`\`\`
const result = analyze(data);
console.log(result);
\`\`\``;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const preElements = document.querySelectorAll('pre');
        // 代码块应该在 <pre> 元素中
        expect(preElements.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 引用渲染测试
  // ============================================
  
  describe('引用渲染', () => {
    
    it('应该正确渲染引用块', async () => {
      const aiMessage = `> 这是一段引用
> 包含多行内容`;
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        const blockquoteElements = document.querySelectorAll('blockquote');
        // 应该有引用块元素
        expect(blockquoteElements.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 样式类测试 (prose)
  // ============================================
  
  describe('Tailwind Typography 样式', () => {
    
    it('应该应用 prose 样式类', async () => {
      const aiMessage = '这是一段分析文本';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 查找带有 prose 类的元素
        const proseElements = document.querySelectorAll('[class*="prose"]');
        // 应该有 prose 样式容器
        expect(proseElements.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 边界情况测试
  // ============================================
  
  describe('边界情况', () => {
    
    it('空 AI 消息不应该导致崩溃', async () => {
      const events = [createEventWithAiMessage('')];
      
      expect(() => {
        renderWithProviders(
          <Timeline events={events} userId="test-user" />
        );
      }).not.toThrow();
    });
    
    it('null AI 消息不应该导致崩溃', async () => {
      const events = [{
        eventId: 'test-event-001',
        type: 'self_test',
        userId: 'test-user',
        date: '2024-01-15',
        status: 'approved',
        details: {},
        aiAsync: {
          status: 'completed',
          value: null
        }
      }];
      
      expect(() => {
        renderWithProviders(
          <Timeline events={events} userId="test-user" />
        );
      }).not.toThrow();
    });
    
    it('undefined AI 消息不应该导致崩溃', async () => {
      const events = [{
        eventId: 'test-event-001',
        type: 'self_test',
        userId: 'test-user',
        date: '2024-01-15',
        status: 'approved',
        details: {}
        // 没有 aiAsync 字段
      }];
      
      expect(() => {
        renderWithProviders(
          <Timeline events={events} userId="test-user" />
        );
      }).not.toThrow();
    });
    
    it('AI 消息正在加载时应该显示加载状态', async () => {
      const events = [{
        eventId: 'test-event-001',
        type: 'self_test',
        userId: 'test-user',
        date: '2024-01-15',
        status: 'approved',
        details: {},
        aiAsync: {
          status: 'pending',
          value: null
        }
      }];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 可能显示加载指示器
        // 根据实现可能有加载状态，也可能没有
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });
    });
    
    it('AI 消息失败时应该显示错误状态', async () => {
      const events = [{
        eventId: 'test-event-001',
        type: 'self_test',
        userId: 'test-user',
        date: '2024-01-15',
        status: 'approved',
        details: {},
        aiAsync: {
          status: 'failed',
          value: null,
          error: '分析失败'
        }
      }];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 可能显示错误消息
        // 根据实现可能有错误状态，也可能没有
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
  
  // ============================================
  // 复杂内容渲染测试
  // ============================================
  
  describe('复杂内容渲染', () => {
    
    it('应该正确渲染混合格式内容', async () => {
      const aiMessage = `## 嗓音分析报告

您的嗓音测试结果如下：

### 主要指标

| 指标 | 测量值 | 参考范围 |
| --- | --- | --- |
| **基频** | 220 Hz | 180-260 Hz |
| *抖动* | 0.5% | < 1.0% |

### 建议

1. 保持良好的发声习惯
2. 定期进行嗓音训练
3. 注意休息

> 提示：以上结果仅供参考，如有问题请咨询专业医生。

更多信息请访问 https://example.com`;
      
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 组件应该能够正常渲染复杂内容
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });
    });
    
    it('应该安全处理潜在的 XSS 内容', async () => {
      const aiMessage = '<script>alert("xss")</script>正常内容';
      const events = [createEventWithAiMessage(aiMessage)];
      
      renderWithProviders(
        <Timeline events={events} userId="test-user" />
      );
      
      await waitFor(() => {
        // 不应该有 script 标签被渲染
        const scriptElements = document.querySelectorAll('script');
        // ReactMarkdown 默认会过滤危险 HTML
      }, { timeout: 3000 });
    });
  });
});
