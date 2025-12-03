export const SIDEBAR_ROUTES = [
  { to: '/', label: '🏠 首页', offlineSafe: true },
  { to: '/dashboard', label: '📊 仪表板', offlineSafe: false },
  { to: '/mypage', label: '👤 我的页面', requiresAuth: true, offlineSafe: false },
  { to: '/event-manager', label: '📅 事件管理', requiresAuth: true, offlineSafe: false },
  { to: '/quick-f0-test', label: '⚡ 快速基频测试', requiresAuth: true, offlineSafe: true },
  { to: '/voice-test', label: '🎤 启动嗓音测试', requiresAuth: true, offlineSafe: false },
  { to: '/scale-practice', label: '🎹 音阶练习', requiresAuth: true, offlineSafe: true },
  { to: '/profile-setup-wizard', label: '完善资料', requiresAuth: true, showInSidebar: false, offlineSafe: true },
  { to: '/dashboard', label: '🧭 公共仪表板', offlineSafe: false },
  { to: '/note-frequency-tool', label: '🎼 Hz-音符转换器', offlineSafe: true },
  { to: '/vfs-effect-preview', label: '🎵 VFS效果预览', offlineSafe: true },
];
