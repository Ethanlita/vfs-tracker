/**
 * @file Pagination 组件单元测试
 * @description 测试分页组件的渲染和交互
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from "../../../../src/components/ui/Pagination.jsx";

describe('Pagination 组件单元测试', () => {
  
  // 默认的 props
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    pageRange: [1, 2, 3, 4, 5],
    hasPrevPage: false,
    hasNextPage: true,
    goToPage: vi.fn(),
    prevPage: vi.fn(),
    nextPage: vi.fn(),
    startIndex: 1,
    endIndex: 10,
    totalItems: 50,
  };
  
  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('应该正确渲染分页组件', () => {
      render(<Pagination {...defaultProps} />);
      
      // 应该显示上一页和下一页按钮
      expect(screen.getByLabelText('上一页')).toBeInTheDocument();
      expect(screen.getByLabelText('下一页')).toBeInTheDocument();
    });
    
    it('应该显示数据信息', () => {
      render(<Pagination {...defaultProps} />);
      
      // 默认模式下应该显示 "显示 X 至 Y，共 Z 条"
      // 信息文本被分成多个元素，使用容器查找
      const infoContainer = screen.getByText(/显示/).closest('div');
      expect(infoContainer).toBeInTheDocument();
      expect(infoContainer?.textContent).toContain('显示');
      expect(infoContainer?.textContent).toContain('至');
      expect(infoContainer?.textContent).toContain('共');
      expect(infoContainer?.textContent).toContain('条');
    });
    
    it('只有一页时不应该渲染', () => {
      const { container } = render(
        <Pagination {...defaultProps} totalPages={1} pageRange={[1]} />
      );
      
      expect(container.firstChild).toBeNull();
    });
  });
  
  // ============================================
  // 按钮状态测试
  // ============================================
  
  describe('按钮状态', () => {
    it('第一页时上一页按钮应该禁用', () => {
      render(<Pagination {...defaultProps} currentPage={1} hasPrevPage={false} />);
      
      const prevButton = screen.getByLabelText('上一页');
      expect(prevButton).toBeDisabled();
    });
    
    it('最后一页时下一页按钮应该禁用', () => {
      render(
        <Pagination 
          {...defaultProps} 
          currentPage={5} 
          hasPrevPage={true}
          hasNextPage={false} 
        />
      );
      
      const nextButton = screen.getByLabelText('下一页');
      expect(nextButton).toBeDisabled();
    });
    
    it('中间页时两个按钮都应该可用', () => {
      render(
        <Pagination 
          {...defaultProps} 
          currentPage={3} 
          hasPrevPage={true}
          hasNextPage={true} 
        />
      );
      
      expect(screen.getByLabelText('上一页')).not.toBeDisabled();
      expect(screen.getByLabelText('下一页')).not.toBeDisabled();
    });
  });
  
  // ============================================
  // 交互测试
  // ============================================
  
  describe('交互', () => {
    it('点击下一页应该调用 nextPage', async () => {
      const nextPage = vi.fn();
      const user = userEvent.setup();
      
      render(<Pagination {...defaultProps} nextPage={nextPage} />);
      
      await user.click(screen.getByLabelText('下一页'));
      
      expect(nextPage).toHaveBeenCalledTimes(1);
    });
    
    it('点击上一页应该调用 prevPage', async () => {
      const prevPage = vi.fn();
      const user = userEvent.setup();
      
      render(
        <Pagination 
          {...defaultProps} 
          currentPage={3}
          hasPrevPage={true}
          prevPage={prevPage} 
        />
      );
      
      await user.click(screen.getByLabelText('上一页'));
      
      expect(prevPage).toHaveBeenCalledTimes(1);
    });
    
    it('点击页码应该调用 goToPage', async () => {
      const goToPage = vi.fn();
      const user = userEvent.setup();
      
      render(<Pagination {...defaultProps} goToPage={goToPage} />);
      
      // 点击第 3 页
      await user.click(screen.getByLabelText('第 3 页'));
      
      expect(goToPage).toHaveBeenCalledWith(3);
    });
    
    it('禁用的按钮不应该触发回调', async () => {
      const prevPage = vi.fn();
      const user = userEvent.setup();
      
      render(<Pagination {...defaultProps} prevPage={prevPage} hasPrevPage={false} />);
      
      // 尝试点击禁用的上一页按钮
      const prevButton = screen.getByLabelText('上一页');
      await user.click(prevButton);
      
      expect(prevPage).not.toHaveBeenCalled();
    });
  });
  
  // ============================================
  // 变体测试
  // ============================================
  
  describe('变体', () => {
    it('simple 变体应该只显示简单导航', () => {
      render(<Pagination {...defaultProps} variant="simple" />);
      
      // 应该显示页码信息
      expect(screen.getByText(/1.*\/.*5/)).toBeInTheDocument();
      
      // 应该有导航按钮
      expect(screen.getByLabelText('上一页')).toBeInTheDocument();
      expect(screen.getByLabelText('下一页')).toBeInTheDocument();
    });
    
    it('compact 变体应该显示紧凑布局', () => {
      render(<Pagination {...defaultProps} variant="compact" />);
      
      // 应该显示页码信息
      expect(screen.getByText(/第 1 页/)).toBeInTheDocument();
      
      // 应该显示页码按钮
      expect(screen.getByLabelText('第 1 页')).toBeInTheDocument();
    });
  });
  
  // ============================================
  // 当前页高亮测试
  // ============================================
  
  describe('当前页高亮', () => {
    it('当前页按钮应该有特殊样式', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);
      
      const currentPageButton = screen.getByLabelText('第 3 页');
      expect(currentPageButton).toHaveAttribute('aria-current', 'page');
    });
    
    it('非当前页按钮不应该有 aria-current', () => {
      render(<Pagination {...defaultProps} currentPage={3} />);
      
      const otherPageButton = screen.getByLabelText('第 2 页');
      expect(otherPageButton).not.toHaveAttribute('aria-current');
    });
  });
  
  // ============================================
  // 可访问性测试
  // ============================================
  
  describe('可访问性', () => {
    it('应该有正确的 aria-label', () => {
      render(<Pagination {...defaultProps} />);
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', '分页导航');
    });
    
    it('页码按钮应该有正确的 aria-label', () => {
      render(<Pagination {...defaultProps} />);
      
      expect(screen.getByLabelText('第 1 页')).toBeInTheDocument();
      expect(screen.getByLabelText('第 2 页')).toBeInTheDocument();
    });
  });
});
