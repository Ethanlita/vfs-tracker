/**
 * @file 测试表格组件
 * 显示嗓音测试列表的表格，支持用户信息显示
 */

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    // 处理 Unix 时间戳（秒）
    let date;
    if (typeof dateStr === 'number') {
      date = new Date(dateStr * 1000);
    } else {
      date = new Date(dateStr);
    }
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * 获取用户显示名称
 * @param {object} user - 用户对象
 * @returns {string} 显示名称
 */
function getUserDisplayName(user) {
  if (!user) return null;
  return user.profile?.name || user.profile?.nickname || null;
}

/**
 * 状态徽章组件
 */
function StatusBadge({ status }) {
  const statusConfig = {
    created: { 
      bg: 'bg-gray-900/50', 
      text: 'text-gray-400', 
      border: 'border-gray-700/50', 
      label: '已创建',
      dot: 'bg-gray-400',
    },
    pending: { 
      bg: 'bg-yellow-900/50', 
      text: 'text-yellow-400', 
      border: 'border-yellow-700/50', 
      label: '等待中',
      dot: 'bg-yellow-400',
    },
    processing: { 
      bg: 'bg-blue-900/50', 
      text: 'text-blue-400', 
      border: 'border-blue-700/50', 
      label: '处理中',
      dot: 'bg-blue-400 animate-pulse',
    },
    done: { 
      bg: 'bg-green-900/50', 
      text: 'text-green-400', 
      border: 'border-green-700/50', 
      label: '已完成',
      dot: 'bg-green-400',
    },
    failed: { 
      bg: 'bg-red-900/50', 
      text: 'text-red-400', 
      border: 'border-red-700/50', 
      label: '失败',
      dot: 'bg-red-400',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

/**
 * 测试表格组件
 * @param {object} props
 * @param {Array} props.tests - 测试列表
 * @param {object} props.users - userId -> user 映射
 * @param {Function} props.onTestClick - 点击测试回调
 */
export default function TestTable({ tests, users = {}, onTestClick }) {
  if (tests.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <p className="text-gray-400">暂无测试数据</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 text-left text-sm text-gray-400">
              <th className="px-6 py-3 font-medium">Session ID</th>
              <th className="px-6 py-3 font-medium">用户</th>
              <th className="px-6 py-3 font-medium">状态</th>
              <th className="px-6 py-3 font-medium">平均基频</th>
              <th className="px-6 py-3 font-medium">创建时间</th>
              <th className="px-6 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {tests.map((test) => {
              const user = users[test.userId];
              const displayName = getUserDisplayName(user);
              
              return (
                <tr 
                  key={test.sessionId}
                  className="hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => onTestClick?.(test)}
                >
                  {/* Session ID */}
                  <td className="px-6 py-4">
                    <code className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-300">
                      {test.sessionId?.length > 20 
                        ? `${test.sessionId.slice(0, 10)}...${test.sessionId.slice(-6)}`
                        : test.sessionId}
                    </code>
                  </td>

                  {/* 用户 */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      {displayName && (
                        <span className="text-white text-sm">{displayName}</span>
                      )}
                      <code className="text-xs bg-gray-700/50 px-2 py-1 rounded text-gray-400 w-fit">
                        {test.userId?.length > 16 
                          ? `${test.userId.slice(0, 8)}...`
                          : test.userId || '-'}
                      </code>
                    </div>
                  </td>

                  {/* 状态 */}
                  <td className="px-6 py-4">
                    <StatusBadge status={test.status} />
                  </td>

                  {/* 平均基频 */}
                  <td className="px-6 py-4 text-white">
                    {test.metrics?.reading?.f0_mean 
                      ? `${Number(test.metrics.reading.f0_mean).toFixed(1)} Hz`
                      : test.metrics?.sustained?.f0_mean
                        ? `${Number(test.metrics.sustained.f0_mean).toFixed(1)} Hz`
                        : test.result?.meanF0 
                          ? `${test.result.meanF0.toFixed(1)} Hz`
                          : test.status === 'done' 
                            ? '-'
                            : <span className="text-gray-500">-</span>
                    }
                  </td>

                  {/* 创建时间 */}
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {formatDateTime(test.createdAt)}
                  </td>

                  {/* 操作 */}
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTestClick?.(test);
                      }}
                      className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
