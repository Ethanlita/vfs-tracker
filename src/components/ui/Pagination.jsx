/**
 * @file 分页组件
 * @description 提供分页导航 UI，支持移动端和桌面端的不同样式
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 分页按钮基础样式
 * @param {boolean} isActive - 是否为当前页
 * @param {boolean} isDisabled - 是否禁用
 */
const getButtonClass = (isActive = false, isDisabled = false) => {
  const base = 'flex items-center justify-center transition-all duration-200';
  
  if (isDisabled) {
    return `${base} text-gray-300 cursor-not-allowed`;
  }
  
  if (isActive) {
    return `${base} bg-pink-500 text-white font-semibold shadow-md`;
  }
  
  return `${base} text-gray-600 hover:bg-pink-50 hover:text-pink-600 active:bg-pink-100`;
};

/**
 * 分页组件
 * 
 * @param {Object} props - 组件属性
 * @param {number} props.currentPage - 当前页码
 * @param {number} props.totalPages - 总页数
 * @param {number[]} props.pageRange - 要显示的页码数组
 * @param {boolean} props.hasPrevPage - 是否有上一页
 * @param {boolean} props.hasNextPage - 是否有下一页
 * @param {Function} props.goToPage - 跳转到指定页
 * @param {Function} props.prevPage - 上一页
 * @param {Function} props.nextPage - 下一页
 * @param {number} props.startIndex - 当前页第一条数据索引
 * @param {number} props.endIndex - 当前页最后一条数据索引
 * @param {number} props.totalItems - 总数据条数
 * @param {string} [props.variant='default'] - 组件变体：'default' | 'compact' | 'simple'
 */
const Pagination = ({
  currentPage,
  totalPages,
  pageRange,
  hasPrevPage,
  hasNextPage,
  goToPage,
  prevPage,
  nextPage,
  startIndex = 0,
  endIndex = 0,
  totalItems = 0,
  variant = 'default',
}) => {
  // 如果只有一页，不显示分页
  if (totalPages <= 1) {
    return null;
  }

  // 简单模式：只显示上一页/下一页和页码信息
  if (variant === 'simple') {
    return (
      <div className="flex items-center justify-center gap-4 py-3">
        <button
          onClick={prevPage}
          disabled={!hasPrevPage}
          className={`${getButtonClass(false, !hasPrevPage)} px-3 py-2 rounded-lg`}
          aria-label="上一页"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <span className="text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>
        
        <button
          onClick={nextPage}
          disabled={!hasNextPage}
          className={`${getButtonClass(false, !hasNextPage)} px-3 py-2 rounded-lg`}
          aria-label="下一页"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // 紧凑模式：适合移动端
  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {/* 页码信息 */}
        <span className="text-sm text-gray-500">
          第 {currentPage} 页，共 {totalPages} 页（{totalItems} 条记录）
        </span>
        
        {/* 导航按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={!hasPrevPage}
            className={`${getButtonClass(false, !hasPrevPage)} w-10 h-10 rounded-full border ${!hasPrevPage ? 'border-gray-200' : 'border-gray-300'}`}
            aria-label="上一页"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* 显示有限的页码 */}
          <div className="flex gap-1">
            {pageRange.map((page) => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`${getButtonClass(page === currentPage)} w-9 h-9 rounded-lg text-sm`}
                aria-label={`第 ${page} 页`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={nextPage}
            disabled={!hasNextPage}
            className={`${getButtonClass(false, !hasNextPage)} w-10 h-10 rounded-full border ${!hasNextPage ? 'border-gray-200' : 'border-gray-300'}`}
            aria-label="下一页"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // 默认模式：完整的分页导航
  return (
    <nav
      className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2"
      aria-label="分页导航"
    >
      {/* 数据信息 */}
      <div className="text-sm text-gray-600">
        显示 <span className="font-medium text-gray-900">{startIndex}</span> 至{' '}
        <span className="font-medium text-gray-900">{endIndex}</span>，共{' '}
        <span className="font-medium text-gray-900">{totalItems}</span> 条
      </div>

      {/* 分页按钮 */}
      <div className="flex items-center gap-1">
        {/* 上一页 */}
        <button
          onClick={prevPage}
          disabled={!hasPrevPage}
          className={`${getButtonClass(false, !hasPrevPage)} px-3 py-2 rounded-lg text-sm border ${!hasPrevPage ? 'border-gray-200' : 'border-gray-300'}`}
          aria-label="上一页"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一页
        </button>

        {/* 页码按钮 */}
        <div className="hidden sm:flex items-center gap-1 mx-2">
          {/* 第一页（如果不在 pageRange 中） */}
          {pageRange[0] > 1 && (
            <>
              <button
                onClick={() => goToPage(1)}
                className={`${getButtonClass(currentPage === 1)} w-9 h-9 rounded-lg text-sm`}
                aria-label="第 1 页"
              >
                1
              </button>
              {pageRange[0] > 2 && (
                <span className="px-2 text-gray-400">...</span>
              )}
            </>
          )}

          {/* 页码范围 */}
          {pageRange.map((page) => (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={`${getButtonClass(page === currentPage)} w-9 h-9 rounded-lg text-sm`}
              aria-label={`第 ${page} 页`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          {/* 最后一页（如果不在 pageRange 中） */}
          {pageRange[pageRange.length - 1] < totalPages && (
            <>
              {pageRange[pageRange.length - 1] < totalPages - 1 && (
                <span className="px-2 text-gray-400">...</span>
              )}
              <button
                onClick={() => goToPage(totalPages)}
                className={`${getButtonClass(currentPage === totalPages)} w-9 h-9 rounded-lg text-sm`}
                aria-label={`第 ${totalPages} 页`}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {/* 移动端当前页显示 */}
        <span className="sm:hidden px-3 py-2 text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>

        {/* 下一页 */}
        <button
          onClick={nextPage}
          disabled={!hasNextPage}
          className={`${getButtonClass(false, !hasNextPage)} px-3 py-2 rounded-lg text-sm border ${!hasNextPage ? 'border-gray-200' : 'border-gray-300'}`}
          aria-label="下一页"
        >
          下一页
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageRange: PropTypes.arrayOf(PropTypes.number).isRequired,
  hasPrevPage: PropTypes.bool.isRequired,
  hasNextPage: PropTypes.bool.isRequired,
  goToPage: PropTypes.func.isRequired,
  prevPage: PropTypes.func.isRequired,
  nextPage: PropTypes.func.isRequired,
  startIndex: PropTypes.number,
  endIndex: PropTypes.number,
  totalItems: PropTypes.number,
  variant: PropTypes.oneOf(['default', 'compact', 'simple']),
};

export default Pagination;
