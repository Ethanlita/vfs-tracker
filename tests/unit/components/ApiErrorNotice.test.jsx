/**
 * 单元测试: src/components/ApiErrorNotice.jsx
 * 
 * 测试API错误提示组件的显示和交互
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiErrorNotice } from '../../../src/components/ApiErrorNotice.jsx';
import { ApiError } from '../../../src/utils/apiError.js';

describe('ApiErrorNotice 组件测试', () => {

  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('error为null时不应该渲染任何内容', () => {
      const { container } = render(<ApiErrorNotice error={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('error为undefined时不应该渲染任何内容', () => {
      const { container } = render(<ApiErrorNotice error={undefined} />);
      expect(container.firstChild).toBeNull();
    });

    it('应该渲染简单错误消息', () => {
      const error = new Error('测试错误');
      render(<ApiErrorNotice error={error} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('测试错误')).toBeInTheDocument();
    });

    it('应该渲染ApiError的详细信息', () => {
      const error = new ApiError('API请求失败', {
        statusCode: 404,
        requestMethod: 'GET',
        requestPath: '/api/test'
      });
      
      render(<ApiErrorNotice error={error} />);
      
      expect(screen.getByText('API请求失败')).toBeInTheDocument();
    });

    it('应该有正确的ARIA属性', () => {
      const error = new Error('测试');
      render(<ApiErrorNotice error={error} />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });
  });

  // ============================================
  // 详情展开/收起测试
  // ============================================
  
  describe('详情展开/收起', () => {
    it('有详情时应该显示"显示全部"按钮', () => {
      const error = new ApiError('API错误', {
        statusCode: 500,
        requestMethod: 'POST'
      });
      
      render(<ApiErrorNotice error={error} />);
      
      expect(screen.getByText('显示全部')).toBeInTheDocument();
    });

    it('点击"显示全部"应该展开详细信息', async () => {
      const user = userEvent.setup();
      const error = new ApiError('API错误', {
        statusCode: 404,
        requestMethod: 'GET',
        requestPath: '/api/test'
      });
      
      render(<ApiErrorNotice error={error} />);
      
      const button = screen.getByText('显示全部');
      await user.click(button);
      
      // 应该显示详情
      expect(screen.getByText(/状态码/)).toBeInTheDocument();
      expect(screen.getByText('404')).toBeInTheDocument();
    });

    it('展开后按钮文字应该变为"收起详情"', async () => {
      const user = userEvent.setup();
      const error = new ApiError('API错误', { statusCode: 500 });
      
      render(<ApiErrorNotice error={error} />);
      
      const button = screen.getByText('显示全部');
      await user.click(button);
      
      expect(screen.getByText('收起详情')).toBeInTheDocument();
    });

    it('再次点击应该收起详情', async () => {
      const user = userEvent.setup();
      const error = new ApiError('API错误', {
        statusCode: 500,
        requestPath: '/test'
      });
      
      render(<ApiErrorNotice error={error} />);
      
      // 展开
      const expandButton = screen.getByText('显示全部');
      await user.click(expandButton);
      expect(screen.getByText('/test')).toBeInTheDocument();
      
      // 收起
      const collapseButton = screen.getByText('收起详情');
      await user.click(collapseButton);
      expect(screen.queryByText('/test')).not.toBeInTheDocument();
    });

    it('没有详情时不应该显示展开按钮', () => {
      const error = new Error('简单错误');
      render(<ApiErrorNotice error={error} />);
      
      expect(screen.queryByText('显示全部')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 重试功能测试
  // ============================================
  
  describe('重试功能', () => {
    it('有onRetry时应该显示重试按钮', () => {
      const error = new Error('测试错误');
      const onRetry = vi.fn();
      
      render(<ApiErrorNotice error={error} onRetry={onRetry} />);
      
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    });

    it('没有onRetry时不应该显示重试按钮', () => {
      const error = new Error('测试错误');
      render(<ApiErrorNotice error={error} />);
      
      expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    });

    it('点击重试按钮应该调用onRetry', async () => {
      const user = userEvent.setup();
      const error = new Error('测试错误');
      const onRetry = vi.fn();
      
      render(<ApiErrorNotice error={error} onRetry={onRetry} />);
      
      const retryButton = screen.getByRole('button', { name: '重试' });
      await user.click(retryButton);
      
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('应该支持自定义重试按钮文字', () => {
      const error = new Error('测试错误');
      const onRetry = vi.fn();
      
      render(<ApiErrorNotice error={error} onRetry={onRetry} retryLabel="再试一次" />);
      
      expect(screen.getByRole('button', { name: '再试一次' })).toBeInTheDocument();
    });
  });

  // ============================================
  // compact模式测试
  // ============================================
  
  describe('compact模式', () => {
    it('compact=true时应该使用紧凑样式', () => {
      const error = new Error('测试错误');
      const { container } = render(<ApiErrorNotice error={error} compact={true} />);
      
      const alert = container.querySelector('[role="alert"]');
      expect(alert.className).toContain('px-3');
      expect(alert.className).toContain('py-2');
      expect(alert.className).toContain('text-xs');
    });

    it('compact=false时应该使用正常样式', () => {
      const error = new Error('测试错误');
      const { container } = render(<ApiErrorNotice error={error} compact={false} />);
      
      const alert = container.querySelector('[role="alert"]');
      expect(alert.className).toContain('px-4');
      expect(alert.className).toContain('py-3');
      expect(alert.className).toContain('text-sm');
    });
  });

  // ============================================
  // includeResponseBody选项测试
  // ============================================
  
  describe('includeResponseBody选项', () => {
    it('includeResponseBody=true时应该显示响应体', async () => {
      const user = userEvent.setup();
      const error = new ApiError('API错误', {
        statusCode: 500,
        responseBody: { error: 'Internal Server Error' }
      });
      
      render(<ApiErrorNotice error={error} includeResponseBody={true} />);
      
      // 需要展开详情才能看到
      const button = screen.getByText('显示全部');
      await user.click(button);
      
      // 响应体应该被包含在详情中
      expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument();
    });

    it('includeResponseBody=false时不应该显示响应体', async () => {
      const user = userEvent.setup();
      const error = new ApiError('API错误', {
        statusCode: 500,
        responseBody: { error: 'Internal Server Error', message: 'Something went wrong' }
      });
      
      render(<ApiErrorNotice error={error} includeResponseBody={false} />);
      
      const button = screen.getByText('显示全部');
      await user.click(button);
      
      // 响应体不应该出现
      expect(screen.queryByText(/Internal Server Error/)).not.toBeInTheDocument();
    });
  });

  // ============================================
  // className自定义测试
  // ============================================
  
  describe('className自定义', () => {
    it('应该支持自定义className', () => {
      const error = new Error('测试错误');
      const { container } = render(
        <ApiErrorNotice error={error} className="custom-error-class" />
      );
      
      const alert = container.querySelector('[role="alert"]');
      expect(alert.className).toContain('custom-error-class');
    });

    it('自定义className不应该覆盖基础样式', () => {
      const error = new Error('测试错误');
      const { container } = render(
        <ApiErrorNotice error={error} className="custom-class" />
      );
      
      const alert = container.querySelector('[role="alert"]');
      // 基础样式应该仍然存在
      expect(alert.className).toContain('rounded-md');
      expect(alert.className).toContain('border-red-200');
      expect(alert.className).toContain('bg-red-50');
      expect(alert.className).toContain('custom-class');
    });
  });

  // ============================================
  // 错误变化时的行为测试
  // ============================================
  
  describe('错误变化时的行为', () => {
    it('错误变化时应该收起详情', async () => {
      const user = userEvent.setup();
      const error1 = new ApiError('错误1', { statusCode: 404 });
      const error2 = new ApiError('错误2', { statusCode: 500 });
      
      const { rerender } = render(<ApiErrorNotice error={error1} />);
      
      // 展开第一个错误的详情
      const button = screen.getByText('显示全部');
      await user.click(button);
      expect(screen.getByText(/404/)).toBeInTheDocument();
      
      // 切换到第二个错误
      rerender(<ApiErrorNotice error={error2} />);
      
      // 详情应该被收起
      expect(screen.queryByText(/500/)).not.toBeInTheDocument();
      expect(screen.getByText('显示全部')).toBeInTheDocument();
    });
  });

  // ============================================
  // 复杂错误对象测试
  // ============================================
  
  describe('复杂错误对象', () => {
    it('应该显示所有可用的错误详情字段', async () => {
      const user = userEvent.setup();
      const error = new ApiError('复杂错误', {
        statusCode: 400,
        requestMethod: 'POST',
        requestPath: '/api/events',
        requestId: 'req-12345',
        errorCode: 'VALIDATION_ERROR',
        details: {
          field: 'email',
          reason: '格式不正确'
        }
      });
      
      render(<ApiErrorNotice error={error} />);
      
      const button = screen.getByText('显示全部');
      await user.click(button);
      
      // 所有字段都应该显示
      expect(screen.getByText(/400/)).toBeInTheDocument();
      expect(screen.getByText(/POST/)).toBeInTheDocument();
      expect(screen.getByText(/\/api\/events/)).toBeInTheDocument();
      expect(screen.getByText(/req-12345/)).toBeInTheDocument();
      expect(screen.getByText(/VALIDATION_ERROR/)).toBeInTheDocument();
    });
  });
});
