/**
 * @file 分页状态管理 Hook
 * @description 提供分页逻辑，支持跳转、上一页、下一页等操作
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

/**
 * 分页 Hook - 管理分页状态和逻辑
 * 
 * @param {Object} options - 分页选项
 * @param {Array} options.items - 需要分页的数据数组
 * @param {number} [options.itemsPerPage=10] - 每页显示的数量
 * @param {number} [options.initialPage=1] - 初始页码
 * @returns {Object} 分页状态和方法
 */
export function usePagination({ items = [], itemsPerPage = 10, initialPage = 1 }) {
  // 当前页码（从1开始）
  const [currentPage, setCurrentPage] = useState(initialPage);

  // 计算总页数
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(items.length / itemsPerPage));
  }, [items.length, itemsPerPage]);

  // 当总页数变化时，确保当前页不超过总页数
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // 当前页的数据
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  // 跳转到指定页
  const goToPage = useCallback((page) => {
    const targetPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(targetPage);
  }, [totalPages]);

  // 上一页
  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  // 下一页
  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  // 跳转到第一页
  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // 跳转到最后一页
  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  // 重置到第一页（通常在筛选条件变化时调用）
  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // 是否有上一页
  const hasPrevPage = currentPage > 1;
  // 是否有下一页
  const hasNextPage = currentPage < totalPages;

  // 计算页码范围（用于显示页码按钮）
  const pageRange = useMemo(() => {
    const maxVisiblePages = 5; // 最多显示5个页码按钮
    const pages = [];

    if (totalPages <= maxVisiblePages) {
      // 如果总页数小于等于最大显示数，显示所有页码
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 计算起始和结束页码
      let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      let end = start + maxVisiblePages - 1;

      // 调整边界情况
      if (end > totalPages) {
        end = totalPages;
        start = Math.max(1, end - maxVisiblePages + 1);
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  return {
    // 状态
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems: items.length,
    paginatedItems,
    pageRange,

    // 布尔值
    hasPrevPage,
    hasNextPage,

    // 方法
    goToPage,
    prevPage,
    nextPage,
    firstPage,
    lastPage,
    reset,

    // 显示信息
    startIndex: items.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0,
    endIndex: Math.min(currentPage * itemsPerPage, items.length),
  };
}

export default usePagination;
