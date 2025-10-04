import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import PostsDropdown from './PostsDropdown.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { generateAvatarFromName, getUserAvatarUrl, getUserDisplayName } from '../utils/avatar.js';

const Header = ({ AuthComponent }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuTimeoutRef = useRef(null);

  const displayName = useMemo(() => (user ? getUserDisplayName(user) : '访客'), [user]);
  const location = useLocation();
  const toolsMenuRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadAvatar = async () => {
      if (user) {
        try {
          const url = await getUserAvatarUrl(user, 64);
          if (active) {
            setAvatarUrl(url);
          }
        } catch (error) {
          console.error('加载头像失败:', error);
          if (active) {
            setAvatarUrl(generateAvatarFromName(displayName, 64));
          }
        }
      } else {
        if (active) {
          setAvatarUrl(generateAvatarFromName('Guest', 64));
        }
      }
    };

    loadAvatar();
    return () => {
      active = false;
    };
  }, [user, displayName]);

  const docLink = useMemo(() => ({ label: '文档', to: '/posts' }), []);
  const toolLinks = useMemo(
    () => [
      { label: '公共仪表板', to: '/dashboard' },
      { label: 'Hz-音符转换器', to: '/note-frequency-tool' },
    ],
    [],
  );

  const isToolsActive = useMemo(
    () => toolLinks.some(link => location.pathname.startsWith(link.to)),
    [toolLinks, location.pathname],
  );

  const isDocsActive = useMemo(
    () => location.pathname.startsWith('/posts') || location.pathname.startsWith('/docs'),
    [location.pathname],
  );

  // #zh: 统一顶栏按钮的基础样式，确保“文档”和“工具”视觉保持一致。
  const navButtonBaseClass = 'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition';
  const navButtonActiveClass = 'bg-pink-50 text-pink-600';
  const navButtonInactiveClass = 'text-gray-700 hover:bg-gray-50';

  useEffect(() => {
    setToolsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => () => {
    window.clearTimeout(toolsMenuTimeoutRef.current);
  }, []);

  /**
   * @zh 悬停打开工具菜单，离开后延迟关闭避免抖动。
   * @en Open the tools menu on hover and delay closing to avoid flickers.
   */
  const handleToolsHover = (open) => {
    window.clearTimeout(toolsMenuTimeoutRef.current);
    if (open) {
      setToolsMenuOpen(true);
      return;
    }
    toolsMenuTimeoutRef.current = window.setTimeout(() => {
      setToolsMenuOpen(false);
    }, 240);
  };

  return (
    <>
      <header className="bg-white shadow-lg sticky top-0 z-40 w-full">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="打开菜单"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded p-2 hover:bg-gray-100 text-gray-600"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <NavLink
                to="/"
                className="text-xl sm:text-2xl font-semibold tracking-tight text-pink-600 hover:text-pink-700 transition-colors"
              >
                VFS Tracker
              </NavLink>

              <div className="hidden lg:flex items-center gap-3 ml-6">
                <PostsDropdown
                  triggerClassName={navButtonBaseClass}
                  activeClassName={navButtonActiveClass}
                  inactiveClassName={navButtonInactiveClass}
                  isActive={isDocsActive}
                />
                <div
                  className="relative"
                  ref={toolsMenuRef}
                  onMouseEnter={() => handleToolsHover(true)}
                  onMouseLeave={() => handleToolsHover(false)}
                >
                  <button
                    type="button"
                    className={`${navButtonBaseClass} ${
                      isToolsActive ? navButtonActiveClass : navButtonInactiveClass
                    }`}
                    onClick={(event) => {
                      event.preventDefault();
                    }}
                    aria-haspopup="true"
                    aria-expanded={toolsMenuOpen}
                  >
                    工具
                    <svg
                      className={`h-4 w-4 transition-transform ${toolsMenuOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                    </svg>
                  </button>
                  {toolsMenuOpen ? (
                    <div className="absolute left-0 mt-2 w-48 rounded-xl border border-gray-100 bg-white shadow-lg py-2">
                      {toolLinks.map(link => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          className={({ isActive }) =>
                            `block px-4 py-2 text-sm transition ${
                              isActive ? 'text-pink-600 bg-pink-50' : 'text-gray-700 hover:bg-gray-50'
                            }`
                          }
                          onClick={() => setToolsMenuOpen(false)}
                          end
                        >
                          {link.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center">
                {AuthComponent ? <AuthComponent /> : null}
              </div>
              <NavLink
                to={user ? '/mypage' : '#'}
                className="lg:hidden block"
                aria-label={user ? `${displayName}的个人页面` : '登录账户'}
              >
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-10 w-10 rounded-full border-2 border-pink-500 object-cover"
                />
              </NavLink>
            </div>
          </div>
        </nav>
      </header>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        avatarUrl={avatarUrl}
        docLink={docLink}
        AuthComponent={AuthComponent}
      />
    </>
  );
};

export default Header;
