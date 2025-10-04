import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAsync } from '../utils/useAsync.js';
import { ApiError } from '../utils/apiError.js';
import { formatApiError } from '../utils/formatApiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

const DEFAULT_TRIGGER_BASE_CLASS = 'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition';
const DEFAULT_ACTIVE_CLASS = 'bg-pink-50 text-pink-600';
const DEFAULT_INACTIVE_CLASS = 'text-gray-700 hover:bg-gray-50';

/**
 * @en Render a dropdown menu that lists documentation posts.
 * @zh 渲染文档列表下拉菜单，支持悬停展开、子菜单联动与点击跳转。
 */
const PostsDropdown = ({
  triggerClassName = DEFAULT_TRIGGER_BASE_CLASS,
  activeClassName = DEFAULT_ACTIVE_CLASS,
  inactiveClassName = DEFAULT_INACTIVE_CLASS,
  label = '文档',
  isActive = false,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFolderPath, setActiveFolderPath] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const postsAsync = useAsync(async () => {
    const res = await fetch('/posts.json');
    if (!res.ok) {
      throw await ApiError.fromResponse(res, { requestMethod: 'GET', requestPath: '/posts.json' });
    }
    return await res.json();
  }, []);

  const posts = postsAsync.value || [];
  const loading = postsAsync.loading;
  const error = postsAsync.error;
  const formattedError = error ? formatApiError(error) : null;

  /**
   * @en Navigate to a document page and close the menu.
   * @zh 跳转到对应文档页面并关闭菜单，同时通知父级做后续处理。
   */
  const handleNavigate = (path) => {
    navigate(path);
    onNavigate?.(path);
    setIsOpen(false);
    setActiveFolderPath([]);
  };

  /**
   * @zh 控制根菜单的悬停展开与收起。
   * @en Control root menu open state on hover.
   */
  const handleRootHover = useCallback((open) => {
    window.clearTimeout(closeTimeoutRef.current);
    if (open) {
      setIsOpen(true);
      return;
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setActiveFolderPath([]);
    }, 500);
  }, []);

  /**
   * @zh 当鼠标悬停在文件夹项时，记录对应层级，用于展开子菜单。
   * @en Track hovered folder path per level to open nested submenus.
   */
  const handleFolderHover = useCallback((folderPath, level) => {
    setActiveFolderPath(prev => {
      const next = prev.slice(0, level);
      next[level] = folderPath;
      return next;
    });
  }, []);

  /**
   * @zh 当鼠标离开某一层级的文件夹区域时，收起更深层子菜单。
   * @en Collapse deeper submenus when cursor leaves a folder item.
   */
  const handleFolderLeave = useCallback((level) => {
    setActiveFolderPath(prev => prev.slice(0, level));
  }, []);

  /**
   * @en Render menu items recursively for folders and documents.
   * @zh 递归渲染目录与文档菜单项，保证层级结构正确显示。
   */
  const renderMenuItems = (items, level = 0, parentPath = '') => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        const isSubmenuOpen = activeFolderPath[level] === folderPath;
        return (
          <li
            key={item.name}
            className="relative"
            onMouseEnter={() => handleFolderHover(folderPath, level)}
            onMouseLeave={() => handleFolderLeave(level)}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 transition"
              onClick={() => handleNavigate(`/posts?folder=${folderPath}`)}
            >
              <span className="flex-1 truncate" title={item.name}>
                {item.name}
              </span>
              <svg
                className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {isSubmenuOpen ? (
              <div className="absolute top-0 left-full ml-2 min-w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-2">
                {item.children && item.children.length > 0 ? (
                  <ul>{renderMenuItems(item.children, level + 1, folderPath)}</ul>
                ) : (
                  <div className="px-4 py-2 text-sm text-gray-500">暂无内容</div>
                )}
              </div>
            ) : null}
          </li>
        );
      }

      return (
        <li key={item.name}>
          <button
            type="button"
            onClick={() => handleNavigate(`/docs?doc=${item.path}`)}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
          >
            {item.name.replace(/\.md$/, '')}
          </button>
        </li>
      );
    });
  };

  // #zh: 监听路由变化，自动关闭菜单避免样式残留。
  useEffect(() => {
    setIsOpen(false);
    setActiveFolderPath([]);
  }, [location.pathname]);

  useEffect(() => () => {
    window.clearTimeout(closeTimeoutRef.current);
  }, []);

  const combinedTriggerClass = useMemo(() => {
    const stateClass = isActive ? activeClassName : inactiveClassName;
    return `${triggerClassName} ${stateClass}`.trim();
  }, [triggerClassName, activeClassName, inactiveClassName, isActive]);

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={() => handleRootHover(true)}
      onMouseLeave={() => handleRootHover(false)}
    >
      <button
        type="button"
        className={combinedTriggerClass}
        style={{ whiteSpace: 'nowrap' }}
        onClick={(event) => {
          event.preventDefault();
          handleNavigate('/posts');
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label}
        {loading && <span className="ml-2 text-xs text-gray-400">加载中...</span>}
        {error && <span className="ml-2 text-xs text-red-500">{formattedError?.summary || '加载失败'}</span>}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {error && isOpen && (
        <ApiErrorNotice
          error={error}
          compact
          className="absolute top-full left-0 mt-2 z-50 w-72 whitespace-normal"
          onRetry={(event) => {
            event?.stopPropagation?.();
            event?.preventDefault?.();
            postsAsync.execute();
          }}
        />
      )}

      {isOpen && !error && (
        <div className="absolute left-0 mt-2 min-w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-2">
          <ul>
            {renderMenuItems(posts)}
            {!loading && posts.length === 0 && (
              <li className="px-4 py-2 text-sm text-gray-500">暂无内容</li>
            )}
            {loading && <li className="px-4 py-2 text-xs text-gray-400">加载中...</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PostsDropdown;
