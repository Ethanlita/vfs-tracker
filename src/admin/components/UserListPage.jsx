/**
 * @file 用户列表页面
 * 管理员用户列表页面，支持搜索和分页
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAWSClients } from '../contexts/AWSClientContext';
import { searchUsers } from '../services/dynamodb';
import UserTable from './UserTable';
import UserDetailDrawer from './UserDetailDrawer';

/**
 * 搜索栏组件
 */
function SearchBar({ value, onChange, onSearch, placeholder }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
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
        type="button"
        onClick={onSearch}
        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors"
      >
        搜索
      </button>
    </div>
  );
}

/**
 * 用户列表页面
 */
export default function UserListPage() {
  const { clients } = useAWSClients();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('q') || '';

  // 状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(activeQuery);
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const requestGenerationRef = React.useRef(0);

  // 抽屉状态
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 使用 ref 存储 lastKey，避免将其作为 useCallback 依赖导致不必要的重渲染
  const lastKeyRef = React.useRef(null);
  lastKeyRef.current = lastKey;

  /**
   * 加载用户列表
   */
  const loadUsers = useCallback(async (append = false) => {
    if (!clients) return;
    const requestGeneration = append
      ? requestGenerationRef.current
      : ++requestGenerationRef.current;

    try {
      if (append) {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setLoading(true);
        setError(null);
        setLoadingMore(false);
        setLoadMoreError(null);
        setUsers([]);
        setLastKey(null);
      }

      const result = await searchUsers(clients.dynamoDB, {
        query: activeQuery || undefined,
        limit: 20,
        lastEvaluatedKey: append ? lastKeyRef.current : null,
      });

      // 搜索或清除搜索后，旧请求不能写入新列表和游标。
      if (requestGeneration !== requestGenerationRef.current) return;

      if (append) {
        setUsers(prev => [...prev, ...result.items]);
      } else {
        setUsers(result.items);
      }

      setLastKey(result.lastEvaluatedKey);
      setHasMore(!!result.lastEvaluatedKey);
    } catch (err) {
      if (requestGeneration !== requestGenerationRef.current) return;

      if (append) setLoadMoreError(err.message);
      else setError(err.message);
    } finally {
      if (requestGeneration === requestGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [clients, activeQuery]);

  /** 在提交新查询时立即使旧的列表或分页请求失效。 */
  const invalidateListRequests = () => {
    requestGenerationRef.current += 1;
    setLoadingMore(false);
    setLoadMoreError(null);
  };

  /** 将已应用搜索写入 URL，使刷新和历史导航保持一致。 */
  const applySearchQuery = (query) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    setSearchParams(params);
  };

  // 初始加载
  useEffect(() => {
    loadUsers(false);
  }, [clients, activeQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // 历史导航改变已应用搜索时，同步输入草稿。
  useEffect(() => {
    setSearchQuery(activeQuery);
  }, [activeQuery]);

  /** 提交搜索；重复提交当前词时执行显式刷新。 */
  const handleSearch = () => {
    const query = searchQuery.trim();
    invalidateListRequests();
    if (query === activeQuery) loadUsers(false);
    else applySearchQuery(query);
  };

  /**
   * 处理用户点击
   */
  const handleUserClick = (user) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  /**
   * 加载更多
   */
  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadUsers(true);
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">加载用户列表...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && users.length === 0) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
        <h3 className="text-red-400 font-medium mb-2">加载失败</h3>
        <p className="text-red-300/80 text-sm">{error}</p>
        <button
          onClick={() => loadUsers(false)}
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <p className="text-gray-400 mt-1">
            {activeQuery
              ? (hasMore ? `已加载 ${users.length} 个匹配用户` : `共找到 ${users.length} 个用户`)
              : (hasMore ? `已加载 ${users.length} 个用户` : `共 ${users.length} 个用户`)}
          </p>
        </div>

        {/* 搜索栏 */}
        <div className="w-full md:w-auto md:min-w-80 flex flex-col sm:flex-row gap-2">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            placeholder="搜索用户名、ID 或邮箱..."
          />
          {activeQuery && (
            <button
              type="button"
              onClick={() => {
                invalidateListRequests();
                setSearchQuery('');
                applySearchQuery('');
              }}
              className="px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900 transition-colors whitespace-nowrap"
            >
              清除搜索
            </button>
          )}
        </div>
      </div>

      {/* 用户表格 */}
      <UserTable
        users={users}
        onUserClick={handleUserClick}
      />

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="text-center py-4">
          {loadMoreError && (
            <div role="alert" className="mb-3 text-sm text-red-300">
              加载更多失败：{loadMoreError}
            </div>
          )}
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
              loadMoreError ? '重试加载更多' : '加载更多'
            )}
          </button>
        </div>
      )}

      {/* 用户详情抽屉 */}
      <UserDetailDrawer
        user={selectedUser}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedUser(null);
        }}
        onUserUpdate={(updatedUser) => {
          // 更新用户列表中的用户
          setUsers(prev => prev.map(u =>
            u.userId === updatedUser.userId ? { ...u, ...updatedUser } : u
          ));
          // 旧用户保存只更新对应列表项，不能抢走当前选择。
          setSelectedUser(current => current?.userId === updatedUser.userId ? { ...current, ...updatedUser } : current);
        }}
      />
    </div>
  );
}
