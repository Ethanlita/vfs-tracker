/**
 * @file 管理员凭证本地存储工具
 * 用于在 localStorage 中安全存储 IAM 凭证
 * 
 * 安全说明：
 * - 凭证仅保存在用户本地浏览器中，不会发送到任何服务器
 * - 使用基本混淆（Base64 + 反转）防止明文暴露
 * - 这不是真正的加密，只是基本防护
 */

const STORAGE_KEY = 'vfs-admin-credentials';

/**
 * 简单的混淆编码（不是真正的加密，只是防止明文显示）
 * @param {string} str - 要混淆的字符串
 * @returns {string} 混淆后的字符串
 */
function obfuscate(str) {
  return btoa(encodeURIComponent(str).split('').reverse().join(''));
}

/**
 * 反混淆解码
 * @param {string} str - 混淆的字符串
 * @returns {string|null} 解码后的字符串，失败返回 null
 */
function deobfuscate(str) {
  try {
    return decodeURIComponent(atob(str).split('').reverse().join(''));
  } catch {
    return null;
  }
}

/**
 * 保存凭证到 localStorage
 * @param {string} accessKeyId - AWS Access Key ID
 * @param {string} secretAccessKey - AWS Secret Access Key
 */
export function saveCredentials(accessKeyId, secretAccessKey) {
  const data = {
    accessKeyId: obfuscate(accessKeyId),
    secretAccessKey: obfuscate(secretAccessKey),
    savedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * 从 localStorage 读取凭证
 * @returns {{ accessKeyId: string, secretAccessKey: string, savedAt: number } | null}
 */
export function loadCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    const accessKeyId = deobfuscate(data.accessKeyId);
    const secretAccessKey = deobfuscate(data.secretAccessKey);
    
    if (!accessKeyId || !secretAccessKey) return null;
    
    return { accessKeyId, secretAccessKey, savedAt: data.savedAt };
  } catch {
    return null;
  }
}

/**
 * 清除保存的凭证
 */
export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 检查是否有保存的凭证
 * @returns {boolean}
 */
export function hasStoredCredentials() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * 获取凭证保存时间
 * @returns {Date|null} 保存时间，没有保存则返回 null
 */
export function getCredentialsSavedTime() {
  const creds = loadCredentials();
  return creds?.savedAt ? new Date(creds.savedAt) : null;
}
