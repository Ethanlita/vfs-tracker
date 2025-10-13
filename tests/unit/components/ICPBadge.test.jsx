/**
 * 单元测试: src/components/ICPBadge.jsx
 * 
 * 测试ICP备案徽章组件的显示逻辑
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ICPBadge from '../../../src/components/ICPBadge.jsx';

describe('ICPBadge 组件测试', () => {

  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('在.cn域名下应该渲染ICP备案信息', () => {
      // 模拟.cn域名
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.cn' },
        writable: true
      });

      render(<ICPBadge />);
      
      expect(screen.getByText(/桂ICP备2025072780号-1/)).toBeInTheDocument();
      expect(screen.getByText(/桂公网安备45010002451122号/)).toBeInTheDocument();
    });

    it('在非.cn域名下不应该渲染', () => {
      // 模拟.com域名
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true
      });

      const { container } = render(<ICPBadge />);
      
      expect(container.firstChild).toBeNull();
    });

    it('在localhost下不应该渲染', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true
      });

      const { container } = render(<ICPBadge />);
      
      expect(container.firstChild).toBeNull();
    });

    it('域名检查不区分大小写', () => {
      // 模拟大写.CN域名
      Object.defineProperty(window, 'location', {
        value: { hostname: 'EXAMPLE.CN' },
        writable: true
      });

      render(<ICPBadge />);
      
      expect(screen.getByText(/桂ICP备/)).toBeInTheDocument();
    });

    it('子域名也应该显示ICP备案', () => {
      // 模拟二级域名
      Object.defineProperty(window, 'location', {
        value: { hostname: 'www.example.cn' },
        writable: true
      });

      render(<ICPBadge />);
      
      expect(screen.getByText(/桂ICP备/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 链接属性测试
  // ============================================
  
  describe('链接属性', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.cn' },
        writable: true
      });
    });

    it('应该包含正确的备案查询链接', () => {
      render(<ICPBadge />);
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://beian.miit.gov.cn/');
    });

    it('链接应该在新标签页打开', () => {
      render(<ICPBadge />);
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('链接应该有安全属性', () => {
      render(<ICPBadge />);
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // ============================================
  // 样式测试
  // ============================================
  
  describe('样式', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.cn' },
        writable: true
      });
    });

    it('容器应该有正确的布局类', () => {
      const { container } = render(<ICPBadge />);
      
      const wrapper = container.querySelector('div');
      expect(wrapper.className).toContain('w-full');
      expect(wrapper.className).toContain('flex');
      expect(wrapper.className).toContain('justify-center');
      expect(wrapper.className).toContain('items-center');
    });

    it('应该有顶部边框', () => {
      const { container } = render(<ICPBadge />);
      
      const wrapper = container.querySelector('div');
      expect(wrapper.className).toContain('border-t');
      expect(wrapper.className).toContain('border-gray-200');
    });

    it('链接应该有正确的文字样式', () => {
      render(<ICPBadge />);
      
      const link = screen.getByRole('link');
      expect(link.className).toContain('text-xs');
      expect(link.className).toContain('text-gray-600');
      expect(link.className).toContain('hover:text-gray-800');
    });
  });

  // ============================================
  // 边界情况测试
  // ============================================
  
  describe('边界情况', () => {
    it('处理空域名', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: '' },
        writable: true
      });

      const { container } = render(<ICPBadge />);
      
      expect(container.firstChild).toBeNull();
    });

    it('处理只有.cn的域名', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: '.cn' },
        writable: true
      });

      render(<ICPBadge />);
      
      // .cn结尾应该显示
      expect(screen.getByText(/桂ICP备/)).toBeInTheDocument();
    });

    it('处理包含.cn但不以.cn结尾的域名', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.cn.com' },
        writable: true
      });

      const { container } = render(<ICPBadge />);
      
      // 不是以.cn结尾,不应该显示
      expect(container.firstChild).toBeNull();
    });
  });
});
