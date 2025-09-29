import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import PostsDropdown from './PostsDropdown.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { generateAvatarFromName, getUserAvatarUrl, getUserDisplayName } from '../utils/avatar.js';

const navItems = [
  { label: '首页', to: '/' },
  { label: '公开数据面板', to: '/dashboard' },
  { label: '快速基频测试', to: '/quick-f0-test' },
  { label: '音阶练习', to: '/scale-practice' },
  { label: '嗓音测试', to: '/voice-test' },
  { label: '我的页面', to: '/mypage' },
  { label: '资料设置向导', to: '/profile-setup-wizard' },
];

const Header = ({ ready, AuthComponent }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const displayName = useMemo(() => (user ? getUserDisplayName(user) : '访客'), [user]);

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

  const docsItems = useMemo(
    () => [
      { label: '文档首页', to: '/posts' },
      { label: '使用指南', to: '/docs?doc=getting-started.md' },
      { label: '常见问题', to: '/docs?doc=faq.md' },
    ],
    []
  );

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
                <TopNavLink to="/">首页</TopNavLink>
                <TopNavLink to="/dashboard">公开数据面板</TopNavLink>
                <TopNavLink to="/quick-f0-test">快速基频测试</TopNavLink>
                <TopNavLink to="/scale-practice">音阶练习</TopNavLink>
                <TopNavLink to="/voice-test">嗓音测试</TopNavLink>
                <TopNavLink to="/mypage">我的页面</TopNavLink>
                <PostsDropdown />
                {!ready && (
                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">开发模式</span>
                )}
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
        navItems={navItems}
        docsItems={docsItems}
        AuthComponent={AuthComponent}
      />
    </>
  );
};

const TopNavLink = ({ to, children }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
        }`
      }
      end
    >
      {children}
    </NavLink>
  );
};

export default Header;
