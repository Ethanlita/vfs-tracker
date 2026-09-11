import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// 常量定义在组件外部，避免不必要的重新渲染
const STORAGE_KEY_PREFIX = 'vfs-reminder-dismissed-';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒数

/**
 * VFSReminderBanner 组件
 * 
 * 用于提醒用户记录 VFS 前的数据和 VFS 事件本身的横幅组件。
 * - 当用户没有记录任何 VFS 相关事件时显示
 * - 可以被用户关闭
 * - 每周最多提醒一次（使用 localStorage 存储关闭时间）
 * 
 * @param {Object} props
 * @param {Array} props.events - 用户的所有事件列表
 * @param {string} props.userId - 用户的唯一标识符
 */
const VFSReminderBanner = ({ events, userId }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}${userId}`;

  useEffect(() => {
    // 检查用户是否有 VFS 相关事件
    const hasVFSEvent = events.some(event => 
      event.type === 'surgery' || 
      event.type === 'vfs' ||
      (event.details && (
        event.details.vfs === true ||
        event.details.surgeryType === 'vfs'
      ))
    );

    // 如果已经有 VFS 事件，不显示横幅
    if (hasVFSEvent) {
      setIsVisible(false);
      return;
    }

    // 检查上次关闭时间
    const dismissedTime = localStorage.getItem(STORAGE_KEY);
    if (dismissedTime) {
      const timeSinceDismissed = Date.now() - parseInt(dismissedTime, 10);
      // 如果距离上次关闭不到一周，不显示
      if (timeSinceDismissed < ONE_WEEK_MS) {
        setIsVisible(false);
        return;
      }
    }

    // 显示横幅
    setIsVisible(true);
  }, [events, STORAGE_KEY]); // 账号存储键变化时重新读取该账号的提醒状态

  const handleClose = () => {
    // 记录关闭时间
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4 mb-6 shadow-sm relative">
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 text-purple-400 hover:text-purple-600 transition-colors"
        aria-label="关闭提醒"
      >
        <X size={20} />
      </button>
      
      <div className="pr-8">
        <h3 className="text-purple-800 font-semibold text-lg mb-2">
          💜 温馨提示
        </h3>
        <div className="text-purple-700 space-y-2">
          <p>
            我们注意到您可能还没有记录 VFS（嗓音女性化手术）相关的数据。为了更好地追踪您的嗓音变化，我们建议您：
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>记录 VFS <strong>手术前</strong>的嗓音测试数据</li>
            <li>记录 VFS <strong>手术事件</strong>本身（包括日期和详情）</li>
            <li>定期记录手术后的嗓音测试数据</li>
          </ul>
          <p className="text-sm mt-3">
            这将帮助您和我们更好地了解 VFS 对嗓音的影响。感谢您的参与！🙏
          </p>
          <div className="mt-4">
            <button
              onClick={() => navigate('/add-event')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus size={18} />
              立即记录事件
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VFSReminderBanner;
