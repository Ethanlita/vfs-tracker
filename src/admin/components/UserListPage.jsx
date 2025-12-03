/**
 * @file 用户列表页面
 * 管理员用户列表页面，支持搜索和分页
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { scanTable, TABLES } from '../services/dynamodb';
import UserTable from './UserTable';
import UserDetailDrawer from './UserDetailDrawer';

/**
 * 搜索栏组件
 */
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-lg 
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
    </div>
  );
}

/**
 * 用户列表页面
 */
export default function UserListPage() {
  const { clients } = useAWSClients();
  
  // 状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
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

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setUsers([]);
        setLastKey(null);
      }

      const result = await scanTable(clients.dynamoDB, TABLES.USERS, {
        limit: 20,
        lastEvaluatedKey: append ? lastKeyRef.current : null,
      });

      if (append) {
        setUsers(prev => [...prev, ...result.items]);
      } else {
        setUsers(result.items);
      }

      setLastKey(result.lastEvaluatedKey);
      setHasMore(!!result.lastEvaluatedKey);
    } catch (err) {
      console.error('加载用户列表失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [clients]);

  // 初始加载
  useEffect(() => {
    loadUsers(false);
  }, [clients]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 过滤用户（本地搜索）
   */
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    // 搜索 profile.name
    const name = user.profile?.name?.toLowerCase() || '';
    // 搜索 profile.nickname
    const nickname = user.profile?.nickname?.toLowerCase() || '';
    // 搜索 userId
    const userId = user.userId?.toLowerCase() || '';
    // 搜索 email
    const email = user.email?.toLowerCase() || '';
    return name.includes(query) || nickname.includes(query) || userId.includes(query) || email.includes(query);
  });

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
  if (error) {
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
          <p className="text-gray-400 mt-1">共 {users.length} 个用户</p>
        </div>
        
        {/* 搜索栏 */}
        <div className="w-full md:w-80">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索用户名、ID 或邮箱..."
          />
        </div>
      </div>

      {/* 用户表格 */}
      <UserTable 
        users={filteredUsers} 
        onUserClick={handleUserClick}
      />

      {/* 加载更多按钮 */}
      {hasMore && !searchQuery && (
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

      {/* 用户详情抽屉 */}
      <UserDetailDrawer
        user={selectedUser}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedUser(null);
        }}
      />
    </div>
  );
}
