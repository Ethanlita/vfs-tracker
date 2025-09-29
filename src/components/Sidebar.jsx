import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getUserDisplayName } from '../utils/avatar.js';

const defaultDocsItems = [
  { label: '使用指南', to: '/posts' },
  { label: 'FAQ', to: '/docs?doc=faq.md' },
];

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

const Sidebar = ({
  open,
  onClose,
  user,
  avatarUrl,
  navItems = [],
  docsItems,
  AuthComponent,
}) => {
  const location = useLocation();
  const [docsOpen, setDocsOpen] = useState(true);

  const docLinks = useMemo(() => {
    if (docsItems && docsItems.length > 0) {
      return docsItems;
    }
    return defaultDocsItems;
  }, [docsItems]);

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

  useEffect(() => {
    if (!open) return;
    onClose?.();
  }, [location.pathname, open, onClose]);

  const displayName = user ? getUserDisplayName(user) : '未登录用户';
  const userEmail = user?.attributes?.email || '';

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

        <nav className="px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.to || item.label} to={item.to} label={item.label} onClick={onClose} />
          ))}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDocsOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span>文档</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`${docsOpen ? 'rotate-180' : ''} transition-transform`}
                aria-hidden="true"
              >
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            {docsOpen && (
              <div className="mt-2 ml-2 space-y-1">
                {docLinks.map((doc) => (
                  <NavItem key={doc.to || doc.label} to={doc.to} label={doc.label} onClick={onClose} />
                ))}
              </div>
            )}
          </div>
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
