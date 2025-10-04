import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAsync } from '../utils/useAsync.js';
import { ApiError } from '../utils/apiError.js';
import { formatApiError } from '../utils/formatApiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';

const DEFAULT_TRIGGER_BASE_CLASS = 'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition';
const DEFAULT_ACTIVE_CLASS = 'bg-pink-50 text-pink-600';
const DEFAULT_INACTIVE_CLASS = 'text-gray-700 hover:bg-gray-50';

/**
 * @en Render a dropdown menu that lists documentation posts.
 * @zh 渲染文档列表下拉菜单，支持自定义触发按钮样式并在点击时打开。
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
  const navigate = useNavigate();
  const location = useLocation();

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
  };

  /**
   * @en Render menu items recursively for folders and documents.
   * @zh 递归渲染目录与文档菜单项，保证层级结构正确显示。
   */
  const renderMenuItems = (items, parentPath = '') => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        return (
          <DropdownMenu.Sub key={item.name}>
            <DropdownMenu.SubTrigger
              className="flex items-center justify-between w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 cursor-pointer focus:outline-none focus:bg-gray-100 transition-colors duration-150"
              onClick={() => handleNavigate(`/posts?folder=${folderPath}`)}
            >
              <span className="flex-1">{item.name}</span>
              <svg
                className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="min-w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                sideOffset={4}
                alignOffset={-4}
                avoidCollisions={true}
                collisionPadding={8}
              >
                <div className="py-1">
                  {item.children && item.children.length > 0 ? (
                    renderMenuItems(item.children, folderPath)
                  ) : (
                    <DropdownMenu.Item disabled className="px-4 py-2 text-sm text-gray-500 cursor-not-allowed">
                      暂无内容
                    </DropdownMenu.Item>
                  )}
                </div>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        );
      }

      return (
        <DropdownMenu.Item
          key={item.name}
          onSelect={() => handleNavigate(`/docs?doc=${item.path}`)}
          className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer focus:outline-none focus:bg-gray-100 transition-colors duration-150"
        >
          {item.name.replace(/\.md$/, '')}
        </DropdownMenu.Item>
      );
    });
  };

  // #zh: 监听路由变化，自动关闭菜单避免样式残留。
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const combinedTriggerClass = useMemo(() => {
    const stateClass = isActive ? activeClassName : inactiveClassName;
    return `${triggerClassName} ${stateClass}`.trim();
  }, [triggerClassName, activeClassName, inactiveClassName, isActive]);

  return (
    <div className="relative">
      <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={combinedTriggerClass}
            style={{ whiteSpace: 'nowrap' }}
            onClick={(event) => {
              event.preventDefault();
              if (!isOpen) {
                setIsOpen(true);
                return;
              }
              // #zh: 再次点击时跳转到文档总览页面，方便用户快速进入目录。
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
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        {/* #zh: 错误提示保持悬浮，便于快速重试 */}
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
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-48 origin-top-left bg-white rounded-md shadow-lg border border-gray-200 z-50"
            sideOffset={4}
            align="start"
            alignOffset={0}
            avoidCollisions={true}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="py-1">
              {renderMenuItems(posts)}
              {!loading && !error && posts.length === 0 && (
                <div className="px-4 py-2 text-sm text-gray-500">暂无内容</div>
              )}
              {loading && (
                <div className="px-4 py-2 text-xs text-gray-400">加载中...</div>
              )}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};

export default PostsDropdown;
