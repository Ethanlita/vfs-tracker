/**
 * @file 嗓音测试列表页面
 * 管理员嗓音测试列表页面，支持状态过滤、搜索和音频播放
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAWSClients } from '../contexts/AWSClientContext';
import { searchTests, getUser } from '../services/dynamodb';
import TestTable from './TestTable';
import TestDetailModal from './TestDetailModal';

/**
 * 测试状态选项
 */
const STATUS_OPTIONS = [
  { value: 'all', label: '全部', color: 'gray' },
  { value: 'pending', label: '等待中', color: 'yellow' },
  { value: 'processing', label: '处理中', color: 'blue' },
  { value: 'done', label: '已完成', color: 'green' },
  { value: 'failed', label: '失败', color: 'red' },
];

/**
 * 搜索栏组件（支持回车搜索）
 */
function SearchBar({ value, onChange, onSearch, placeholder }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch?.();
    }
  };

  return (
    <div className="relative flex-1 min-w-[200px]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-2 pl-10 pr-20 bg-gray-800 border border-gray-700 rounded-lg 
                   text-white placeholder-gray-500 focus:outline-none focus:border-purple-500
                   transition-colors"
      />
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <button
        onClick={onSearch}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs
                   bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
      >
        搜索
      </button>
    </div>
  );
}

/**
 * 过滤器按钮组件
 */
function FilterButton({ active, onClick, children, color = 'gray' }) {
  const colorClasses = {
    gray: active 
      ? 'bg-gray-600 text-white border-gray-500' 
      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600',
    yellow: active 
      ? 'bg-yellow-600/30 text-yellow-400 border-yellow-500' 
      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-yellow-600/50',
    blue: active 
      ? 'bg-blue-600/30 text-blue-400 border-blue-500' 
      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-blue-600/50',
    green: active 
      ? 'bg-green-600/30 text-green-400 border-green-500' 
      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-green-600/50',
    red: active 
      ? 'bg-red-600/30 text-red-400 border-red-500' 
      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-red-600/50',
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${colorClasses[color]}`}
    >
      {children}
    </button>
  );
}

/**
 * 嗓音测试列表页面
 */
export default function TestListPage() {
  const { clients } = useAWSClients();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 从 URL 获取初始过滤器状态
  const initialStatus = searchParams.get('status') || 'all';
  const initialQuery = searchParams.get('q') || '';
  
  // 状态
  const [tests, setTests] = useState([]);
  const [userCache, setUserCache] = useState({}); // userId -> user 映射（缓存）
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery); // 实际用于搜索的查询
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // 模态框状态
  const [selectedTest, setSelectedTest] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * 更新 URL 参数
   */
  const updateSearchParams = useCallback((status, query) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (query) params.set('q', query);
    setSearchParams(params);
  }, [setSearchParams]);

  /**
   * 获取用户信息（带缓存）
   */
  const fetchUserInfo = useCallback(async (userId) => {
    if (!clients || !userId) return null;
    if (userCache[userId]) return userCache[userId];
    
    try {
      const user = await getUser(clients.dynamoDB, userId);
      if (user) {
        setUserCache(prev => ({ ...prev, [userId]: user }));
      }
      return user;
    } catch (err) {
      console.error('获取用户信息失败:', err);
      return null;
    }
  }, [clients, userCache]);

  /**
   * 批量加载用户信息
   */
  const loadUsersForTests = useCallback(async (testList) => {
    if (!clients) return;
    
    const userIds = [...new Set(testList.map(t => t.userId).filter(Boolean))];
    const uncachedIds = userIds.filter(id => !userCache[id]);
    
    if (uncachedIds.length === 0) return;
    
    // 并行获取用户信息
    await Promise.all(uncachedIds.map(fetchUserInfo));
  }, [clients, userCache, fetchUserInfo]);

  // 使用 ref 存储 lastKey，避免将其作为 useCallback 依赖导致不必要的重渲染
  const lastKeyRef = React.useRef(null);
  lastKeyRef.current = lastKey;

  /**
   * 加载测试列表（服务端搜索）
   */
  const loadTests = useCallback(async (append = false) => {
    if (!clients) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setTests([]);
        setLastKey(null);
      }

      // 使用服务端搜索
      const result = await searchTests(clients.dynamoDB, {
        status: statusFilter,
        query: activeQuery || undefined,
        limit: 50,
        lastEvaluatedKey: append ? lastKeyRef.current : null,
      });

      // 按创建时间排序（最新在前）
      const sortedItems = result.items.sort((a, b) => {
        const dateA = a.createdAt || 0;
        const dateB = b.createdAt || 0;
        return dateB - dateA;
      });

      if (append) {
        setTests(prev => [...prev, ...sortedItems]);
      } else {
        setTests(sortedItems);
      }

      // 加载用户信息
      await loadUsersForTests(sortedItems);

      setLastKey(result.lastEvaluatedKey);
      setHasMore(!!result.lastEvaluatedKey);
    } catch (err) {
      console.error('加载测试列表失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [clients, statusFilter, activeQuery, loadUsersForTests]);

  // 当过滤器变化时重新加载
  useEffect(() => {
    loadTests(false);
  }, [statusFilter, activeQuery, clients]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 处理状态过滤器变化
   */
  const handleStatusChange = (status) => {
    setStatusFilter(status);
    updateSearchParams(status, activeQuery);
  };

  /**
   * 执行搜索
   */
  const handleSearch = () => {
    setActiveQuery(searchQuery);
    updateSearchParams(statusFilter, searchQuery);
  };

  /**
   * 处理测试点击
   */
  const handleTestClick = (test) => {
    setSelectedTest(test);
    setModalOpen(true);
  };

  /**
   * 加载更多
   */
  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadTests(true);
    }
  };

  // 统计各状态数量
  const statusCounts = tests.reduce((acc, test) => {
    const status = test.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // 加载中状态
  if (loading && tests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">加载测试列表...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
        <h3 className="text-red-400 font-medium mb-2">加载失败</h3>
        <p className="text-red-300/80 text-sm">{error}</p>
        <button 
          onClick={() => loadTests(false)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-white">嗓音测试</h1>
        <p className="text-gray-400 mt-1">
          共 {tests.length} 个测试
          {activeQuery && ` (搜索: "${activeQuery}")`}
          {statusCounts.processing > 0 && (
            <span className="text-blue-400 ml-2">
              ({statusCounts.processing} 处理中)
            </span>
          )}
          {statusCounts.failed > 0 && (
            <span className="text-red-400 ml-2">
              ({statusCounts.failed} 失败)
            </span>
          )}
        </p>
      </div>

      {/* 搜索和过滤器 */}
      <div className="flex flex-wrap gap-4">
        {/* 搜索框 */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          placeholder="搜索 Session ID、用户 ID（按回车搜索）"
        />

        {/* 刷新按钮 */}
        <button
          onClick={() => loadTests(false)}
          disabled={loading}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 
                     transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg 
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>

        {/* 清除搜索 */}
        {activeQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveQuery('');
              updateSearchParams(statusFilter, '');
            }}
            className="px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900 
                       transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            清除搜索
          </button>
        )}
      </div>

      {/* 状态过滤器 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <FilterButton
            key={option.value}
            active={statusFilter === option.value}
            onClick={() => handleStatusChange(option.value)}
            color={option.color}
          >
            {option.label}
            {option.value !== 'all' && statusCounts[option.value] > 0 && (
              <span className="ml-1 opacity-70">({statusCounts[option.value]})</span>
            )}
          </FilterButton>
        ))}
      </div>

      {/* 测试表格 */}
      <TestTable 
        tests={tests}
        users={userCache}
        onTestClick={handleTestClick}
      />

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="text-center py-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                加载中...
              </span>
            ) : (
              '加载更多'
            )}
          </button>
        </div>
      )}

      {/* 测试详情模态框 */}
      <TestDetailModal
        test={selectedTest}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTest(null);
        }}
      />
    </div>
  );
}
