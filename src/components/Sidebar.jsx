import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { SIDEBAR_ROUTES } from '../routes/nav';
import { getUserDisplayName } from '../utils/avatar.js';

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

const Sidebar = ({ open, onClose, user, avatarUrl, docLink, AuthComponent }) => {
  const location = useLocation();

  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const isAuthenticated = authStatus === 'authenticated';
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const navItems = useMemo(() => {
    return SIDEBAR_ROUTES.filter(item => {
      if (item.showInSidebar === false) {
        return false;
      }

      // 离线模式：只显示离线可用的功能
      if (!isOnline) {
        return item.offlineSafe !== false;
      }

      // 在线模式：显示所有功能（包括需要登录的）
      // 未登录用户点击时会自动跳转到登录页
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
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[1000] transition ${open ? '' : 'pointer-events-none'}`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-xl transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="text-base font-semibold text-gray-900">菜单</div>
          <button
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

        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <img
            src={avatarUrl}
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

        <nav className="px-3 py-4 space-y-2 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} onClick={onClose} />
            ))}
          </div>

          {docLink ? (
            <div className="pt-3 border-t border-gray-100 mt-3">
              <NavItem to={docLink.to} label={docLink.label} onClick={onClose} />
            </div>
          ) : null}

          {!isStandalone && installPromptEvent ? (
            <div className="pt-3 border-t border-gray-100 mt-3 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  handleInstallClick();
                  onClose?.();
                }}
                className="w-full rounded-lg bg-pink-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
              >
                📲 安装到手机
              </button>
              <p className="mt-2 text-xs text-gray-500">
                安装后即可在主屏幕快速打开 VFS Tracker。
              </p>
            </div>
          ) : null}
        </nav>

        {AuthComponent && (
          <div className="mt-auto border-t border-gray-100 px-4 py-4 lg:hidden">
            <AuthComponent />
          </div>
        )}
      </aside>
    </div>
  );
};

export default Sidebar;
