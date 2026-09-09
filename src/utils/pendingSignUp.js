/**
 * @file 待验证注册账号记录（Pending Sign-Up）工具
 * @description
 * [CN] 用户在新版登录页注册后，如果没有立刻完成邮箱验证就离开，之后回访时往往
 * 只记得邮箱、不记得注册用户名。而 Cognito 的邮箱别名只在邮箱验证通过后才生效，
 * 未验证账号只能用注册用户名定位：用邮箱去验证会失败，"重新发送验证码"也不会
 * 真正发出邮件（Issue #89）。
 *
 * 本模块把"注册成功但尚未验证"的账号写入 localStorage，供登录页在用户回访时
 * 提示"继续验证"并预填用户名。记录在验证完成后清除，超过保留期自动失效。
 */

/** localStorage 键名（带版本号，便于将来调整结构） */
export const PENDING_SIGNUP_STORAGE_KEY = 'vfsTracker:pendingSignUp:v1';

/** 记录保留时长：7 天。Cognito 未验证账号默认 7 天后会被自动清理，之后记录已无意义 */
export const PENDING_SIGNUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 安全获取 localStorage（隐私模式或非浏览器环境下可能不可用）
 * @returns {Storage|null} 可用的 Storage 实例，不可用时返回 null
 */
const getStorage = () => {
  try {
    // 与项目其余代码一致，直接使用全局 localStorage（浏览器与 jsdom 测试环境均可用）
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
};

/**
 * 判断用户填写的标识是否像邮箱
 * [CN] 用户池开启邮箱别名后，Cognito 不允许用户名本身是邮箱格式，因此只要含有 @ 就按邮箱处理。
 * @param {string} identifier - 用户输入的用户名或邮箱
 * @returns {boolean} 含有 @ 时返回 true
 */
export const looksLikeEmail = (identifier) => String(identifier ?? '').includes('@');

/**
 * 读取待验证账号记录
 * @param {number} [now=Date.now()] - 当前时间戳，便于测试注入
 * @returns {{username: string, email: string, createdAt: number}|null} 记录；不存在、已损坏或已过期时返回 null
 */
export const loadPendingSignUp = (now = Date.now()) => {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(PENDING_SIGNUP_STORAGE_KEY);
  if (!raw) return null;

  let record = null;
  try {
    record = JSON.parse(raw);
  } catch (error) {
    console.warn('[pendingSignUp] 待验证账号记录已损坏，已清除:', error);
  }

  const isValid = !!record
    && typeof record.username === 'string'
    && record.username.length > 0
    && typeof record.createdAt === 'number';
  const isExpired = isValid && now - record.createdAt > PENDING_SIGNUP_TTL_MS;

  if (!isValid || isExpired) {
    storage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
    return null;
  }

  return {
    username: record.username,
    email: typeof record.email === 'string' ? record.email : '',
    createdAt: record.createdAt
  };
};

/**
 * 保存待验证账号记录
 * [CN] 若已有同一用户名的记录且这次没有提供邮箱（例如从登录路径进入），则沿用已记录的邮箱。
 * @param {{username: string, email?: string}} params - 注册用户名与邮箱
 * @param {number} [now=Date.now()] - 当前时间戳，便于测试注入
 * @returns {{username: string, email: string, createdAt: number}|null} 写入的记录；用户名为空或存储不可用时返回 null
 */
export const savePendingSignUp = ({ username, email = '' }, now = Date.now()) => {
  const storage = getStorage();
  const normalizedUsername = String(username ?? '').trim();
  if (!storage || !normalizedUsername) return null;

  const existing = loadPendingSignUp(now);
  const record = {
    username: normalizedUsername,
    email: String(email ?? '').trim() || (existing?.username === normalizedUsername ? existing.email : ''),
    createdAt: now
  };

  try {
    storage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('[pendingSignUp] 写入待验证账号记录失败，已忽略:', error);
    return null;
  }
  return record;
};

/**
 * 清除待验证账号记录（验证完成、账号已失效或用户选择不再提示时调用）
 * @returns {void}
 */
export const clearPendingSignUp = () => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
};
