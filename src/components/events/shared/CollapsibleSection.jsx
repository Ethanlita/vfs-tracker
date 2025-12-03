/**
 * 可折叠区域组件
 * 用于展示可展开/收起的详细信息
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';

/**
 * 可折叠区域组件
 * @param {Object} props - 组件属性
 * @param {string} props.title - 区域标题
 * @param {boolean} props.defaultOpen - 默认是否展开
 * @param {React.ReactNode} props.children - 子内容
 * @param {string} props.className - 额外的 CSS 类名
 * @param {string} props.icon - 标题图标（emoji）
 * @param {number} props.itemCount - 项目数量（可选，显示在标题旁边）
 */
const CollapsibleSection = ({
  title,
  defaultOpen = false,
  children,
  className = '',
  icon = '',
  itemCount,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* 标题栏（可点击） */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          w-full flex items-center justify-between 
          px-4 py-3 
          bg-gray-50 dark:bg-gray-800 
          hover:bg-gray-100 dark:hover:bg-gray-750 
          transition-colors
          text-left
        "
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {title}
          </span>
          {itemCount !== undefined && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {itemCount}
            </span>
          )}
        </div>
        
        {/* 展开/收起图标 */}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </motion.span>
      </button>

      {/* 内容区域 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

CollapsibleSection.propTypes = {
  title: PropTypes.string.isRequired,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  icon: PropTypes.string,
  itemCount: PropTypes.number,
};

export default CollapsibleSection;
