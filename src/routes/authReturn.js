import { SIDEBAR_ROUTES } from './nav.js';

const RETURN_PATHS = new Set([
  ...SIDEBAR_ROUTES.map(route => route.to).filter(path => path !== '/profile-setup-wizard'),
  '/posts', '/docs', '/api-test'
]);

/** 校验认证流程的站内返回地址，保留查询与锚点，拒绝外站和认证循环。 */
export function safeReturnUrl(value) {
  const hasUnsafeCharacter = typeof value === 'string'
    && [...value].some(character => character === '\\' || character.charCodeAt(0) <= 32);
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacter) return '/mypage';
  const path = value.split(/[?#]/)[0];
  return RETURN_PATHS.has(path) ? value : '/mypage';
}

/** 在向导地址中携带本次流程的目标，不使用跨账户的持久存储。 */
export function profileSetupUrl(target) {
  return '/profile-setup-wizard?returnUrl=' + encodeURIComponent(safeReturnUrl(target));
}
