import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PostsDropdown = () => {
  const [posts, setPosts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/posts.json')
      .then((response) => response.json())
      .then((data) => setPosts(data))
      .catch(error => console.error('Failed to load posts:', error));
  }, []);

  const renderMenuItems = (items) => {
    return items.map((item) => {
      if (item.type === 'folder') {
        return (
          <div
            key={item.name}
            className="dropdown-submenu-trigger"
            onMouseEnter={() => {
              console.log('Mouse enter folder:', item.name);
              setHoveredFolder(item.name);
            }}
            onMouseLeave={() => {
              console.log('Mouse leave folder:', item.name);
              // 延迟清除，给用户时间移动到子菜单
              setTimeout(() => {
                setHoveredFolder(null);
              }, 100);
            }}
          >
            <button
              onClick={() => {
                navigate('/posts');
                setIsOpen(false);
              }}
              className="dropdown-menu-button dropdown-folder-button text-sm text-left text-gray-700"
            >
              <span className="dropdown-folder-text">
                {item.name}
              </span>
              <span className="dropdown-folder-arrow text-gray-400">›</span>
            </button>
            {hoveredFolder === item.name && (
              <div
                className="dropdown-submenu bg-white rounded-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] dropdown-menu-container"
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: '0',
                  marginLeft: '0.25rem',
                  zIndex: 1000,
                  display: 'block'
                }}
                onMouseEnter={() => {
                  console.log('Mouse enter submenu:', item.name);
                  setHoveredFolder(item.name);
                }}
                onMouseLeave={() => {
                  console.log('Mouse leave submenu:', item.name);
                  setHoveredFolder(null);
                }}
              >
                <div className="py-1">
                  {item.children && item.children.length > 0 ? renderMenuItems(item.children) : <div className="px-4 py-2 text-sm text-gray-500">No items</div>}
                </div>
              </div>
            )}
            {/* 调试信息 */}
            {hoveredFolder === item.name && (
              <div style={{ position: 'absolute', top: '-20px', left: '0', background: 'yellow', fontSize: '10px', zIndex: 100 }}>
                DEBUG: {item.name} hovered, submenu should show
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div key={item.name}>
            <button
              onClick={() => {
                navigate(`/posts/${item.path.replace(/\.md$/, '')}`);
                setIsOpen(false);
              }}
              className="dropdown-menu-button text-sm text-gray-700"
            >
              {item.name.replace(/\.md$/, '')}
            </button>
          </div>
        );
      }
    });
  };

  return (
    <div className="relative inline-block text-left" onMouseLeave={() => setIsOpen(false)}>
      <div>
        <button
          type="button"
          onMouseEnter={() => setIsOpen(true)}
          onClick={() => {
            navigate('/posts');
            setIsOpen(false);
          }}
          className="inline-flex items-center bg-transparent border-none text-base font-medium text-gray-600 hover:text-pink-600 focus:outline-none transition-colors duration-200"
          style={{ whiteSpace: 'nowrap' }}
        >
          文档
          <svg className="ml-1 h-4 w-4 transform transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div 
          className="origin-top-right absolute right-0 mt-2 rounded-md bg-white focus:outline-none shadow-[0_8px_30px_rgb(0,0,0,0.12)] dropdown-menu-container"
        >
          <div className="py-1">
            {renderMenuItems(posts)}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsDropdown;
