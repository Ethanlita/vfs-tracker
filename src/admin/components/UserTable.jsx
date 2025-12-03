/**
 * @file 用户表格组件
 * 显示用户列表的表格，支持头像和双昵称显示
 */

import { useMemo, useState, useEffect } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { getAvatarUrl } from '../services/s3';

/**
 * 格式化日期
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 获取用户的显示名称（优先显示 profile.name，其次 profile.nickname）
 * @param {object} user - 用户对象
 * @returns {string} 显示名称
 */
function getDisplayName(user) {
  return user.profile?.name || user.profile?.nickname || user.displayName || '未设置昵称';
}

/**
 * 获取用户的昵称（profile.nickname，用于辅助显示）
 * @param {object} user - 用户对象
 * @returns {string|null} 昵称
 */
function getNickname(user) {
  // 如果 name 和 nickname 相同，不重复显示
  const name = user.profile?.name;
  const nickname = user.profile?.nickname;
  if (name && nickname && name !== nickname) {
    return nickname;
  }
  return null;
}

/**
 * 用户头像组件 - 支持 S3 预签名 URL
 */
function UserAvatar({ user }) {
  const { clients } = useAWSClients();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // 获取用户的 avatarKey
  const avatarKey = user.profile?.avatarKey;

  // 异步加载头像 URL
  useEffect(() => {
    async function loadAvatar() {
      if (!avatarKey || !clients?.s3) {
        setAvatarUrl(null);
        return;
      }

      try {
        const url = await getAvatarUrl(clients.s3, avatarKey);
        setAvatarUrl(url);
        setLoadError(false);
      } catch (err) {
        console.error('加载头像失败:', err);
        setAvatarUrl(null);
        setLoadError(true);
      }
    }

    loadAvatar();
  }, [avatarKey, clients?.s3]);

  // 计算默认头像的首字母和颜色
  const initials = useMemo(() => {
    const name = getDisplayName(user);
    return name.charAt(0).toUpperCase();
  }, [user]);

  const bgColor = useMemo(() => {
    const colors = [
      'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 
      'bg-green-600', 'bg-teal-600', 'bg-blue-600', 
      'bg-indigo-600', 'bg-purple-600', 'bg-pink-600'
    ];
    const hash = (user.userId || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [user.userId]);

  // 如果有有效的头像 URL 且未加载失败
  if (avatarUrl && !loadError) {
    return (
      <img 
        src={avatarUrl} 
        alt={getDisplayName(user)}
        className="w-10 h-10 rounded-full object-cover border border-gray-600"
        onError={() => setLoadError(true)}
      />
    );
  }

  // 默认头像
  return (
    <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white font-medium border border-gray-600`}>
      {initials}
    </div>
  );
}

/**
 * 隐私标签
 */
function PrivacyBadge({ isPublic }) {
  if (isPublic) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-400 border border-green-700/50">
        公开
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600/50">
      私密
    </span>
  );
}

/**
 * 用户表格组件
 */
export default function UserTable({ users, onUserClick }) {
  if (users.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-gray-400">暂无用户数据</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-left text-sm text-gray-400">
              <th className="px-6 py-3 font-medium">用户</th>
              <th className="px-6 py-3 font-medium">User ID</th>
              <th className="px-6 py-3 font-medium">隐私</th>
              <th className="px-6 py-3 font-medium">创建时间</th>
              <th className="px-6 py-3 font-medium">更新时间</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {users.map((user) => (
              <tr 
                key={user.userId} 
                className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                onClick={() => onUserClick?.(user)}
              >
                {/* 用户信息 */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} />
                    <div>
                      <div className="text-white font-medium">
                        {getDisplayName(user)}
                      </div>
                      {/* 如果 nickname 与 name 不同，显示昵称 */}
                      {getNickname(user) && (
                        <div className="text-purple-400 text-xs">@{getNickname(user)}</div>
                      )}
                      {user.email && (
                        <div className="text-gray-500 text-sm">{user.email}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* User ID */}
                <td className="px-6 py-4">
                  <code className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-300">
                    {user.userId?.length > 20 
                      ? `${user.userId.slice(0, 8)}...${user.userId.slice(-8)}`
                      : user.userId}
                  </code>
                </td>

                {/* 隐私状态 */}
                <td className="px-6 py-4">
                  <PrivacyBadge isPublic={user.isPublic} />
                </td>

                {/* 创建时间 */}
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {formatDate(user.createdAt)}
                </td>

                {/* 更新时间 */}
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {formatDate(user.updatedAt)}
                </td>

                {/* 操作 */}
                <td className="px-6 py-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUserClick?.(user);
                    }}
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                  >
                    查看详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
