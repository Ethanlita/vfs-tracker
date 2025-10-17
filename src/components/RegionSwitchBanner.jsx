import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const DISMISS_KEY = 'cnBannerDismissed';

const isLikelyChinaLocale = () => {
  // 检查时区
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz === 'Asia/Shanghai' || tz === 'Asia/Urumqi') {
      return true;
    }
  } catch {
    // ignore
  }

  // 检查语言设置
  try {
    const langs = navigator.languages || [navigator.language];
    if (langs && langs.length > 0) {
      const hasChinaLocale = langs.some((lang) => {
        const lower = (lang || '').toLowerCase();
        return lower.startsWith('zh-cn') || lower.startsWith('zh-hans');
      });
      // 明确返回检查结果
      return hasChinaLocale;
    }
  } catch {
    // ignore
  }

  // 如果所有检查都失败，返回 false
  return false;
};

const RegionSwitchBanner = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname.toLowerCase();
    const isAppDomain = host.endsWith('.app');
    if (!isAppDomain) {
      setOpen(false);
      return;
    }

    const onHome = location.pathname === '/';
    if (!onHome) {
      setOpen(false);
      return;
    }

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }

    if (dismissed) {
      setOpen(false);
      return;
    }

    setOpen(isLikelyChinaLocale());
  }, [location.pathname]);

  const handleClose = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#111827',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 12,
        boxShadow: '0 12px 30px rgba(17, 24, 39, 0.3)',
        zIndex: 1000,
        maxWidth: '90vw',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>
        如果您在中国大陆地区访问遇到困难，可以切换至中国大陆版：
        <a
          href="https://vfs-tracker.cn"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#60a5fa', marginLeft: 6 }}
        >
          vfs-tracker.cn
        </a>
      </span>
      <button
        type="button"
        onClick={handleClose}
        style={{
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: '#e5e7eb',
          padding: '6px 10px',
          borderRadius: 9999,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        关闭
      </button>
    </div>
  );
};

export default RegionSwitchBanner;
