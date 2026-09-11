/**
 * @file 管理后台布局组件
 * 提供侧边栏导航和顶部栏
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAWSClients } from '../contexts/AWSClientContext';

/**
 * 导航菜单项
 */
const NAV_ITEMS = [
  {
    path: '/admin',
    label: '概览',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    end: true,
  },
  {
    path: '/admin/users',
    label: '用户管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    path: '/admin/events',
    label: '事件管理',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    path: '/admin/tests',
    label: '嗓音测试',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    path: '/admin/reading-passages',
    label: '朗读稿件',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm4 2h8M8 11h8m-8 4h5" />
      </svg>
    ),
  },
  {
    path: '/admin/settings/rate-limit',
    label: '速率限制',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const DESKTOP_SIDEBAR_QUERY = '(min-width: 1024px)';

/**
 * 监听管理后台桌面断点，使常驻侧栏和移动抽屉使用各自正确的交互语义。
 * @returns {boolean} 当前是否为桌面侧栏布局。
 */
function useDesktopSidebar() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    const handleChange = event => setIsDesktop(event.matches);
    media.addEventListener('change', handleChange);
    setIsDesktop(media.matches);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
}

/**
 * 管理后台布局
 */
export default function AdminLayout({ children }) {
  const { adminInfo, logout } = useAWSClients();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const isDesktop = useDesktopSidebar();
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const openerRef = useRef(null);
  const mainShellRef = useRef(null);

  /** 打开移动抽屉，并记录关闭后需要恢复的键盘入口。 */
  const openSidebar = () => {
    openerRef.current = document.activeElement;
    setSidebarOpen(true);
  };

  /** 关闭移动抽屉；焦点恢复由抽屉生命周期统一完成。 */
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    if (!sidebarOpen || isDesktop) return undefined;

    const previousOverflow = document.body.style.overflow;
    const mainShell = mainShellRef.current;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    if (mainShell) mainShell.inert = true;
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (mainShell) mainShell.inert = false;
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus();
      else menuButton?.focus();
    };
  }, [isDesktop, sidebarOpen]);

  useEffect(() => {
    if (isDesktop && sidebarOpen) setSidebarOpen(false);
  }, [isDesktop, sidebarOpen]);

  /** 在移动抽屉内处理 Escape，并让 Tab 在首尾控件之间循环。 */
  const handleSidebarKeyDown = event => {
    if (isDesktop || !sidebarOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSidebar();
      return;
    }
    if (event.key !== 'Tab') return;

    const controls = [...sidebarRef.current.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),a[href]:not([tabindex="-1"])')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      sidebarRef.current.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const navigationEnabled = isDesktop || sidebarOpen;

  /**
   * 处理登出
   */
  const handleLogout = (clearSaved) => {
    logout(clearSaved);
    setShowLogoutMenu(false);
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* 侧边栏 */}
      <aside
        id="admin-sidebar"
        ref={sidebarRef}
        role={isDesktop ? undefined : 'dialog'}
        aria-modal={!isDesktop && sidebarOpen ? 'true' : undefined}
        aria-hidden={!isDesktop && !sidebarOpen ? 'true' : undefined}
        aria-labelledby="admin-sidebar-title"
        inert={!isDesktop && !sidebarOpen ? true : undefined}
        tabIndex={-1}
        onKeyDown={handleSidebarKeyDown}
        className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 max-w-full bg-gray-800 border-r border-gray-700 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span id="admin-sidebar-title" className="font-semibold text-white truncate">VFS Admin</span>
          </div>
          {/* 移动端关闭按钮 */}
          <button 
            ref={closeButtonRef}
            type="button"
            aria-label="关闭管理菜单"
            tabIndex={navigationEnabled ? undefined : -1}
            className="lg:hidden min-w-11 min-h-11 shrink-0 -mr-2 text-gray-400 hover:text-white flex items-center justify-center"
            onClick={closeSidebar}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 导航菜单 */}
        <nav aria-label="管理后台导航" className="p-4 space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }
              `}
              tabIndex={navigationEnabled ? undefined : -1}
              onClick={closeSidebar}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 底部信息 */}
        <div className="shrink-0 p-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">
            当前身份
          </div>
          <div className="text-sm text-gray-300 truncate" title={adminInfo?.arn}>
            {adminInfo?.arn?.split('/').pop() || 'Unknown'}
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div
        ref={mainShellRef}
        aria-hidden={!isDesktop && sidebarOpen ? 'true' : undefined}
        inert={!isDesktop && sidebarOpen ? true : undefined}
        className="flex-1 flex flex-col min-w-0"
      >
        {/* 顶部栏 */}
        <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-2 sm:px-4">
          {/* 移动端菜单按钮 */}
          <button 
            ref={menuButtonRef}
            type="button"
            aria-label="打开管理菜单"
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
            className="lg:hidden min-w-11 min-h-11 -ml-2 text-gray-400 hover:text-white flex items-center justify-center"
            onClick={openSidebar}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 标题（桌面端显示） */}
          <div className="hidden lg:block text-white font-medium">
            管理后台
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* 返回主站 */}
            <a 
              href="/"
              aria-label="返回主站"
              className="min-w-11 min-h-11 text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h14V10M9 20v-6h6v6" />
              </svg>
              <span className="sr-only lg:not-sr-only">返回主站</span>
            </a>

            {/* 登出按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                aria-label="登出选项"
                aria-expanded={showLogoutMenu}
                aria-haspopup="menu"
                className="min-w-11 min-h-11 flex items-center justify-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg bg-gray-700
                         text-gray-300 hover:text-white hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline text-sm">登出</span>
                <svg aria-hidden="true" className="hidden lg:block w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 登出选项菜单 */}
              {showLogoutMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setShowLogoutMenu(false)}
                  />
                  <div role="menu" className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1rem)] bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-20">
                    <div className="py-1">
                      <button
                        role="menuitem"
                        onClick={() => handleLogout(false)}
                        className="w-full px-4 py-2 text-left text-sm whitespace-normal text-gray-300 hover:bg-gray-600 hover:text-white"
                      >
                        退出登录（保留凭证）
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => handleLogout(true)}
                        className="w-full px-4 py-2 text-left text-sm whitespace-normal text-gray-300 hover:bg-gray-600 hover:text-white"
                      >
                        退出并清除凭证
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
