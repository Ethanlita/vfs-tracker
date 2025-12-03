/**
 * @file usePagination Hook 单元测试
 * @description 测试分页逻辑的正确性
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../../../src/hooks/usePagination.js';

describe('usePagination Hook 单元测试', () => {
  
  // ============================================
  // 基础功能测试
  // ============================================
  
  describe('基础功能', () => {
    it('应该返回正确的初始状态', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 3 }));
      
      expect(result.current.currentPage).toBe(1);
      expect(result.current.totalPages).toBe(4);
      expect(result.current.itemsPerPage).toBe(3);
      expect(result.current.totalItems).toBe(10);
      expect(result.current.paginatedItems).toEqual([1, 2, 3]);
    });
    
    it('应该使用默认的每页数量 (10)', () => {
      const items = Array.from({ length: 25 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items }));
      
      expect(result.current.itemsPerPage).toBe(10);
      expect(result.current.totalPages).toBe(3);
      expect(result.current.paginatedItems.length).toBe(10);
    });
    
    it('空数组时应该返回正确状态', () => {
      const { result } = renderHook(() => usePagination({ items: [], itemsPerPage: 5 }));
      
      expect(result.current.currentPage).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.totalItems).toBe(0);
      expect(result.current.paginatedItems).toEqual([]);
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(0);
    });
    
    it('应该支持初始页码参数', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 2 })
      );
      
      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedItems).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    });
  });
  
  // ============================================
  // 导航功能测试
  // ============================================
  
  describe('导航功能', () => {
    it('nextPage 应该前进到下一页', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      expect(result.current.currentPage).toBe(1);
      
      act(() => {
        result.current.nextPage();
      });
      
      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedItems[0]).toBe(11);
    });
    
    it('prevPage 应该返回上一页', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 3 })
      );
      
      expect(result.current.currentPage).toBe(3);
      
      act(() => {
        result.current.prevPage();
      });
      
      expect(result.current.currentPage).toBe(2);
    });
    
    it('goToPage 应该跳转到指定页', () => {
      const items = Array.from({ length: 50 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      act(() => {
        result.current.goToPage(4);
      });
      
      expect(result.current.currentPage).toBe(4);
      expect(result.current.paginatedItems[0]).toBe(31);
    });
    
    it('firstPage 应该跳转到第一页', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 3 })
      );
      
      act(() => {
        result.current.firstPage();
      });
      
      expect(result.current.currentPage).toBe(1);
    });
    
    it('lastPage 应该跳转到最后一页', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      act(() => {
        result.current.lastPage();
      });
      
      expect(result.current.currentPage).toBe(3);
    });
    
    it('reset 应该重置到第一页', () => {
      const items = Array.from({ length: 30 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 3 })
      );
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.currentPage).toBe(1);
    });
  });
  
  // ============================================
  // 边界条件测试
  // ============================================
  
  describe('边界条件', () => {
    it('在第一页时 prevPage 不应该改变页码', () => {
      const items = [1, 2, 3, 4, 5];
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 2 }));
      
      expect(result.current.currentPage).toBe(1);
      expect(result.current.hasPrevPage).toBe(false);
      
      act(() => {
        result.current.prevPage();
      });
      
      expect(result.current.currentPage).toBe(1);
    });
    
    it('在最后一页时 nextPage 不应该改变页码', () => {
      const items = [1, 2, 3, 4, 5];
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 2, initialPage: 3 })
      );
      
      expect(result.current.currentPage).toBe(3);
      expect(result.current.hasNextPage).toBe(false);
      
      act(() => {
        result.current.nextPage();
      });
      
      expect(result.current.currentPage).toBe(3);
    });
    
    it('goToPage 超出范围时应该限制在有效范围内', () => {
      const items = [1, 2, 3, 4, 5];
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 2 }));
      
      // 尝试跳转到超过最大页码
      act(() => {
        result.current.goToPage(100);
      });
      expect(result.current.currentPage).toBe(3); // 最大页码
      
      // 尝试跳转到负数
      act(() => {
        result.current.goToPage(-5);
      });
      expect(result.current.currentPage).toBe(1); // 最小页码
      
      // 尝试跳转到 0
      act(() => {
        result.current.goToPage(0);
      });
      expect(result.current.currentPage).toBe(1);
    });
    
    it('只有一页时 hasPrevPage 和 hasNextPage 都应该为 false', () => {
      const items = [1, 2, 3];
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      expect(result.current.totalPages).toBe(1);
      expect(result.current.hasPrevPage).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
    });
    
    it('最后一页数据不足时应该正确显示', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 3 }));
      
      act(() => {
        result.current.lastPage();
      });
      
      expect(result.current.currentPage).toBe(3);
      expect(result.current.paginatedItems).toEqual([7]);
      expect(result.current.startIndex).toBe(7);
      expect(result.current.endIndex).toBe(7);
    });
  });
  
  // ============================================
  // 页码范围计算测试
  // ============================================
  
  describe('页码范围计算', () => {
    it('总页数小于等于 5 时应该显示所有页码', () => {
      const items = Array.from({ length: 15 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 5 }));
      
      expect(result.current.totalPages).toBe(3);
      expect(result.current.pageRange).toEqual([1, 2, 3]);
    });
    
    it('当前页在开头时应该显示前 5 页', () => {
      const items = Array.from({ length: 100 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      expect(result.current.pageRange).toEqual([1, 2, 3, 4, 5]);
    });
    
    it('当前页在中间时应该居中显示', () => {
      const items = Array.from({ length: 100 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 5 })
      );
      
      expect(result.current.pageRange).toEqual([3, 4, 5, 6, 7]);
    });
    
    it('当前页在末尾时应该显示后 5 页', () => {
      const items = Array.from({ length: 100 }, (_, i) => i + 1);
      const { result } = renderHook(() => 
        usePagination({ items, itemsPerPage: 10, initialPage: 10 })
      );
      
      expect(result.current.pageRange).toEqual([6, 7, 8, 9, 10]);
    });
  });
  
  // ============================================
  // 显示信息测试
  // ============================================
  
  describe('显示信息', () => {
    it('应该正确计算 startIndex 和 endIndex', () => {
      const items = Array.from({ length: 25 }, (_, i) => i + 1);
      const { result } = renderHook(() => usePagination({ items, itemsPerPage: 10 }));
      
      // 第一页
      expect(result.current.startIndex).toBe(1);
      expect(result.current.endIndex).toBe(10);
      
      // 第二页
      act(() => {
        result.current.nextPage();
      });
      expect(result.current.startIndex).toBe(11);
      expect(result.current.endIndex).toBe(20);
      
      // 第三页（最后一页，只有 5 条）
      act(() => {
        result.current.nextPage();
      });
      expect(result.current.startIndex).toBe(21);
      expect(result.current.endIndex).toBe(25);
    });
  });
  
  // ============================================
  // 数据变化响应测试
  // ============================================
  
  describe('数据变化响应', () => {
    it('当数据减少导致当前页超出时应该自动调整', () => {
      const { result, rerender } = renderHook(
        ({ items }) => usePagination({ items, itemsPerPage: 5 }),
        { initialProps: { items: Array.from({ length: 20 }, (_, i) => i + 1) } }
      );
      
      // 跳转到第 4 页
      act(() => {
        result.current.goToPage(4);
      });
      expect(result.current.currentPage).toBe(4);
      
      // 减少数据到只有 10 条（2 页）
      rerender({ items: Array.from({ length: 10 }, (_, i) => i + 1) });
      
      // 当前页应该自动调整到最后一页
      expect(result.current.currentPage).toBe(2);
      expect(result.current.totalPages).toBe(2);
    });
  });
});
