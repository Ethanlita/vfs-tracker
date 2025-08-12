import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const PostsDropdown = () => {
  const [posts, setPosts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const hoverStateRef = useRef(false);

  useEffect(() => {
    fetch('/posts.json')
      .then((response) => response.json())
      .then((data) => setPosts(data))
      .catch(error => console.error('Failed to load posts:', error));
  }, []);

  const renderMenuItems = (items, parentPath = '') => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const folderPath = parentPath ? `${parentPath}/${item.name}` : item.name;
        return (
          <DropdownMenu.Sub key={item.name}>
            <DropdownMenu.SubTrigger
              className="dropdown-menu-button dropdown-folder-button text-sm text-left text-gray-700 flex items-center justify-between w-full pr-4"
              onClick={() => navigate(`/posts?folder=${folderPath}`)} // 传递文件夹路径参数
            >
              <span className="dropdown-folder-text flex-1">{item.name}</span>
              <span className="dropdown-folder-arrow text-gray-400 text-lg font-bold ml-auto">›</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent 
                className="dropdown-submenu bg-white rounded-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] dropdown-menu-container z-50"
                sideOffset={12}
                alignOffset={-8}
              >
                <div className="py-1">
                  {item.children && item.children.length > 0 ? renderMenuItems(item.children, folderPath) : <DropdownMenu.Item disabled className="px-4 py-2 text-sm text-gray-500">No items</DropdownMenu.Item>}
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
            className="dropdown-menu-button text-sm text-gray-700"
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
    }, 150);
  };

  return (
    <div>
      <DropdownMenu.Root open={isOpen} modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center bg-transparent border-none text-base font-medium text-gray-600 hover:text-pink-600 focus:outline-none transition-colors duration-200"
            style={{ whiteSpace: 'nowrap' }}
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
            onClick={() => navigate('/posts')} // 添加点击处理，点击"文档"按钮也进入文章列表
          >
            文档
            <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="origin-top-left rounded-md bg-white focus:outline-none shadow-[0_8px_30px_rgb(0,0,0,0.12)] dropdown-menu-container z-50"
            sideOffset={8}
            align="start"
            alignOffset={0}
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="py-1">
              {renderMenuItems(posts)}
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};

export default PostsDropdown;
