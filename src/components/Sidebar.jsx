import React, { useEffect, useMemo, useState, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SIDEBAR_ROUTES } from '../routes/nav';
import { generateAvatarFromName, getUserDisplayName } from '../utils/avatar.js';

function NavItem({ to, label, onClick }) {
  if (!to) {
    return null;
  }

  const isExternal = /^https?:\/\//i.test(to);

  if (isExternal) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        {label}
      </a>
    );
  }

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
        }`
      }
      end
    >
      {label}
    </NavLink>
  );
}

/** 全尺寸功能导航：使用原生模态管理焦点，内容独立滚动。 */
const Sidebar = ({ open, onClose, user, avatarUrl, docLink, AuthComponent }) => {
  const location = useLocation();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const navItems = useMemo(() => {
    return SIDEBAR_ROUTES.filter(item => {
      if (item.showInSidebar === false) {
        return false;
      }

      // 离线模式：只显示离线可用的功能
      // 无论是否登录，离线时都不显示需要网络的功能
      if (!isOnline) {
        return item.offlineSafe !== false;
      }

      // 在线模式：显示所有功能（包括需要登录的）
      // 未登录用户点击需要认证的功能时，统一路由守卫会自动跳转到登录页
      return true;
    });
  }, [isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) { dialog.close(); return; }
    // 原生模态负责焦点约束与背景不可交互；Header 在关闭完成后统一恢复入口焦点。
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    closeButtonRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const lastPathRef = React.useRef(location.pathname);

  useEffect(() => {
    if (!open) {
      lastPathRef.current = location.pathname;
      return;
    }

    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      onClose?.();
    }
  }, [location.pathname, open, onClose]);

  const displayName = user ? getUserDisplayName(user) : '未登录用户';
  const resolvedAvatarUrl = avatarUrl || generateAvatarFromName(displayName, 64);
  const userEmail = user?.attributes?.email || '';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const checkStandalone = () => {
      const matchStandalone = window.matchMedia
        ? window.matchMedia('(display-mode: standalone)').matches
        : false;
      const navigatorStandalone = window.navigator?.standalone;
      setIsStandalone(Boolean(matchStandalone || navigatorStandalone));
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstallPromptEvent(null);
    };

    const mediaQuery = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const handleDisplayModeChange = (event) => {
      setIsStandalone(event.matches);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (mediaQuery) {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleDisplayModeChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleDisplayModeChange);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleDisplayModeChange);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(handleDisplayModeChange);
        }
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try {
      await installPromptEvent.userChoice;
    } finally {
      setInstallPromptEvent(null);
    }
  };

  /** 在首尾控件间循环Tab，避免浏览器将焦点移到地址栏或文档主体。 */
  const handleDialogKeyDown = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  };

  return (
    <dialog
      id="site-navigation"
      ref={dialogRef}
      aria-labelledby="site-navigation-title"
      onCancel={event => { event.preventDefault(); onClose?.(); }}
      onKeyDown={handleDialogKeyDown}
      onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}
      className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none border-0 p-0 bg-transparent text-gray-800 backdrop:bg-black/40"
    >
      <aside
        className="h-full w-[85%] max-w-[320px] bg-white shadow-xl flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div id="site-navigation-title" className="text-base font-semibold text-gray-900">全部功能</div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="关闭菜单"
            onClick={onClose}
            className="rounded p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 用户信息、功能和账户操作共用受限滚动区域，横屏也能到达底部。 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <img
            src={resolvedAvatarUrl}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover border border-pink-100"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">{displayName}</div>
            {userEmail ? (
              <div className="truncate text-xs text-gray-500">{userEmail}</div>
            ) : (
              <div className="truncate text-xs text-gray-400">欢迎来到 VFS Tracker</div>
            )}
          </div>
        </div>

        <nav aria-label="功能导航" className="px-3 py-4 space-y-2">
          {!isOnline && <p className="px-3 text-sm text-gray-500">当前离线，仅显示离线可用入口。</p>}
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.to} to={item.to} label={`${item.label}${item.requiresAuth && !user ? '（需登录）' : ''}`} onClick={onClose} />
            ))}
          </div>

          {docLink ? (
            <div className="pt-3 border-t border-gray-100 mt-3">
              <NavItem to={docLink.to} label={docLink.label} onClick={onClose} />
            </div>
          ) : null}

          {!isStandalone && installPromptEvent ? (
            <div className="pt-3 border-t border-gray-100 mt-3">
              <button
                type="button"
                onClick={() => {
                  handleInstallClick();
                  onClose?.();
                }}
                className="w-full rounded-lg bg-pink-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
              >
                📲 安装应用
              </button>
              <p className="mt-2 text-xs text-gray-500">
                安装后即可快速打开 VFS Tracker。
              </p>
            </div>
          ) : null}
        </nav>

        {AuthComponent && (
          <div className="border-t border-gray-100 px-4 py-4">
            <AuthComponent compact />
          </div>
        )}
        </div>
      </aside>
    </dialog>
  );
};

export default Sidebar;
