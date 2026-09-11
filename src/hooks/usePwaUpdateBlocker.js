/** @file React 组件登记 PWA 更新阻塞状态的统一 Hook。 */
import { useEffect, useId } from 'react';
import { setPwaUpdateBlocker } from '../utils/pwaUpdateCoordinator.js';

/**
 * 在组件存在未提交或不可中断工作时阻止跨标签页 PWA 更新。
 * @param {boolean} active - 当前工作是否需要保护。
 * @param {string} label - 可向用户展示的静态工作类型。
 * @returns {void}
 */
export const usePwaUpdateBlocker = (active, label) => {
  const reactId = useId();
  const blockerId = `${label}:${reactId}`;

  useEffect(() => {
    setPwaUpdateBlocker(blockerId, label, active);
    return () => setPwaUpdateBlocker(blockerId, label, false);
  }, [active, blockerId, label]);
};
