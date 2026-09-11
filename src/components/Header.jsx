import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import PostsDropdown from './PostsDropdown.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { generateAvatarFromName, getUserAvatarUrl, getUserDisplayName } from '../utils/avatar.js';

/** 顶栏在桌面和触屏共用同一个功能导航入口。 */
const Header = ({ AuthComponent }) => {
  const { user, userProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const shouldRestoreMenuFocusRef = useRef(false);
  // 首次渲染即提供有效图片，避免异步头像加载前出现 src="" 和整页误请求。
  const [avatarUrl, setAvatarUrl] = useState(() => generateAvatarFromName('Guest', 64));

  const displayName = useMemo(() => (user ? getUserDisplayName(user) : '访客'), [user]);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const loadAvatar = async () => {
      const avatarKey = userProfile?.profile?.avatarKey;
      if (user && avatarKey) {
        try {
          const url = await getUserAvatarUrl(user, 64, avatarKey);
          if (active) {
            setAvatarUrl(url);
          }
          return;
        } catch {
      // 错误已由页面状态或恢复路径处理，不向控制台输出用户数据。

        }
      }

      if (active) {
        const name = user ? displayName : 'Guest';
        setAvatarUrl(generateAvatarFromName(name, 64));
      }
    };

    loadAvatar();
    return () => {
      active = false;
    };
  }, [user, displayName, userProfile?.profile?.avatarKey]);

  const docLink = useMemo(() => ({ label: '文档', to: '/posts' }), []);

  const isDocsActive = useMemo(
    () => location.pathname.startsWith('/posts') || location.pathname.startsWith('/docs'),
    [location.pathname],
  );

  /** 关闭原生对话框后显式回到入口，补齐 WebKit 不自动回焦点的行为差异。 */
  const closeSidebar = () => {
    shouldRestoreMenuFocusRef.current = true;
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (sidebarOpen || !shouldRestoreMenuFocusRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      menuButtonRef.current?.focus();
      shouldRestoreMenuFocusRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sidebarOpen]);

  // #zh: 顶栏保留文档入口，全部功能统一由共享侧栏提供。
  const navButtonBaseClass = 'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition';
  const navButtonActiveClass = 'bg-pink-50 text-pink-600';
  const navButtonInactiveClass = 'text-gray-700 hover:bg-gray-50';


  return (
    <>
      <header className="bg-white shadow-lg sticky top-0 z-40 w-full">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                ref={menuButtonRef}
                type="button"
                aria-label="打开菜单"
                aria-haspopup="dialog"
                aria-controls="site-navigation"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100 text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-500"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="hidden lg:inline text-sm font-medium">全部功能</span>
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
              </div>

            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center">
                {AuthComponent ? <AuthComponent /> : null}
              </div>
              <NavLink
                to={user ? '/mypage' : `/login?returnUrl=${encodeURIComponent(location.pathname + location.search + location.hash)}`}
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
        onClose={closeSidebar}
        user={user}
        avatarUrl={avatarUrl}
        docLink={docLink}
        AuthComponent={AuthComponent}
      />
    </>
  );
};

export default Header;
