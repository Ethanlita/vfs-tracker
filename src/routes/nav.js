/** 桌面和手机共用的功能入口，权限与离线可用性在导航中统一呈现。 */
export const SIDEBAR_ROUTES = [
  { to: '/', label: '🏠 首页', offlineSafe: true },
  { to: '/dashboard', label: '📊 公共仪表板', offlineSafe: false },
  { to: '/mypage', label: '👤 我的页面', requiresAuth: true, offlineSafe: false },
  { to: '/add-event', label: '➕ 添加事件', requiresAuth: true, offlineSafe: false },
  { to: '/event-manager', label: '📅 事件管理', requiresAuth: true, offlineSafe: false },
  { to: '/profile-manager', label: '📝 个人资料', requiresAuth: true, offlineSafe: false },
  { to: '/quick-f0-test', label: '⚡ 快速基频测试', offlineSafe: true },
  { to: '/voice-test', label: '🎤 启动嗓音测试', requiresAuth: true, offlineSafe: false },
  { to: '/scale-practice', label: '🎹 音阶练习', offlineSafe: true },
  { to: '/profile-setup-wizard', label: '完善资料', requiresAuth: true, showInSidebar: false, offlineSafe: true },
  { to: '/note-frequency-tool', label: '🎼 Hz-音符转换器', offlineSafe: true },
  { to: '/vfs-effect-preview', label: '🎵 VFS效果预览', offlineSafe: true },
];

/** 可直接进行本地计算的工具；资料引导不能打断这些工具的使用。 */
export const LOCAL_TOOL_PATHS = ['/quick-f0-test', '/scale-practice', '/note-frequency-tool', '/vfs-effect-preview'];
