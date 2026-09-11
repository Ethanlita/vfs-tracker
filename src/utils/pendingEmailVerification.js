/** @file 按 Cognito 用户隔离保存待完成的邮箱属性验证流程。 */

const STORAGE_PREFIX = 'vfs-pending-email-verification:v1:';

/**
 * 生成当前账号独立的存储键，避免同一浏览器切换账号时混用邮箱。
 * @param {string} ownerUserId - Cognito 用户唯一 ID。
 * @returns {string} localStorage 键。
 */
export const pendingEmailVerificationKey = (ownerUserId) =>
  `${STORAGE_PREFIX}${encodeURIComponent(ownerUserId)}`;

/**
 * 读取并校验待验证邮箱；损坏或不属于当前账号的数据不会进入界面。
 * @param {string} ownerUserId - 当前 Cognito 用户唯一 ID。
 * @returns {object|null} 有效的待验证记录。
 */
export const readPendingEmailVerification = (ownerUserId) => {
  if (!ownerUserId || typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(pendingEmailVerificationKey(ownerUserId)) || 'null');
    if (
      !value ||
      value.ownerUserId !== ownerUserId ||
      typeof value.email !== 'string' ||
      !value.email.trim() ||
      typeof value.createdAt !== 'string'
    ) return null;
    return value;
  } catch {
    return null;
  }
};

/**
 * 保存待验证邮箱，不保存验证码本身。
 * @param {string} ownerUserId - 当前 Cognito 用户唯一 ID。
 * @param {object} verification - Amplify 返回的投递信息和邮箱变更上下文。
 * @returns {object} 规范化后的待验证记录。
 */
export const writePendingEmailVerification = (ownerUserId, verification) => {
  const value = {
    ownerUserId,
    email: verification.email.trim(),
    previousEmail: verification.previousEmail || '',
    destination: verification.destination || '',
    deliveryMedium: verification.deliveryMedium || 'EMAIL',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(pendingEmailVerificationKey(ownerUserId), JSON.stringify(value));
  return value;
};

/**
 * 仅清除当前账号的待验证记录。
 * @param {string} ownerUserId - 当前 Cognito 用户唯一 ID。
 * @returns {void}
 */
export const removePendingEmailVerification = (ownerUserId) => {
  if (!ownerUserId || typeof localStorage === 'undefined') return;
  localStorage.removeItem(pendingEmailVerificationKey(ownerUserId));
};
