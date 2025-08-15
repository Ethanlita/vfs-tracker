import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAsync } from '../utils/useAsync.js';

const PostsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const hoverStateRef = useRef(false);

  const postsAsync = useAsync(async () => {
    const res = await fetch('/posts.json');
    if (!res.ok) throw new Error('无法加载 posts.json');
    return await res.json();
  }, []);

  const posts = postsAsync.value || [];
  const loading = postsAsync.loading;
  const error = postsAsync.error;

  const renderMenuItems = (items, parentPath = '') => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        return (
          <DropdownMenu.Sub key={item.name}>
            <DropdownMenu.SubTrigger
              className="flex items-center justify-between w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 cursor-pointer focus:outline-none focus:bg-gray-100 transition-colors duration-150"
              onClick={() => navigate(`/posts?folder=${folderPath}`)}
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
                  {item.children && item.children.length > 0 ?
                    renderMenuItems(item.children, folderPath) :
                    <DropdownMenu.Item disabled className="px-4 py-2 text-sm text-gray-500 cursor-not-allowed">
                      暂无内容
                    </DropdownMenu.Item>
                  }
                </div>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        );
      } else {
        return (
          <DropdownMenu.Item 
            key={item.name}
            onSelect={() => navigate(`/docs?doc=${item.path}`)}
            className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer focus:outline-none focus:bg-gray-100 transition-colors duration-150"
          >
            {item.name.replace(/\.md$/, '')}
          </DropdownMenu.Item>
        );
      }
    });
  };

  // 统一的打开菜单函数
  const openMenu = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hoverStateRef.current = true;
    setIsOpen(true);
  };

  // 统一的关闭菜单函数
  const closeMenu = () => {
    hoverStateRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (!hoverStateRef.current) {
        setIsOpen(false);
      }
    }, 200); // 增加延迟时间以减少抖动
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <DropdownMenu.Root open={isOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center bg-transparent border-none text-base font-medium text-gray-600 hover:text-pink-600 focus:outline-none transition-colors duration-200"
            style={{ whiteSpace: 'nowrap' }}
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
            onClick={() => navigate('/posts')}
          >
            文档
            {loading && <span className="ml-2 text-xs text-gray-400">加载中...</span>}
            {error && <span className="ml-2 text-xs text-red-500">错误</span>}
            <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a 1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </DropdownMenu.Trigger>
        {/* 错误提示 */}
        {error && isOpen && (
          <div className="absolute top-full mt-2 left-0 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md border border-red-200 shadow z-50 whitespace-nowrap">
            加载失败 <button className="underline ml-1" onClick={(e)=>{e.stopPropagation();postsAsync.execute();}}>重试</button>
          </div>
        )}
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-48 origin-top-left bg-white rounded-md shadow-lg border border-gray-200 z-50"
            sideOffset={4}
            align="start"
            alignOffset={0}
            avoidCollisions={true}
            collisionPadding={8}
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="py-1">
              {renderMenuItems(posts)}
              {(!loading && !error && posts.length===0) && (
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
