/**
 * @file 安全凭证存储工具
 * 使用 Web Crypto API + 用户 PIN 对 IAM 凭证进行 AES-GCM 加密存储
 * 
 * 安全特性：
 * - 使用 PBKDF2 从用户 PIN 派生 256 位 AES 密钥
 * - 使用 AES-GCM 进行认证加密（同时提供机密性和完整性）
 * - 每次保存使用随机 salt 和 IV
 * - PIN 错误时无法解密（会抛出错误）
 */

// localStorage 存储键
const STORAGE_KEY = 'vfs-admin-credentials-secure';

// PBKDF2 迭代次数（越高越安全，但越慢）
const PBKDF2_ITERATIONS = 100000;

/**
 * 从用户 PIN 派生 AES-256 加密密钥
 * @param {string} pin - 用户输入的 PIN 码
 * @param {Uint8Array} salt - 随机盐值
 * @returns {Promise<CryptoKey>} AES-GCM 密钥
 */
async function deriveKeyFromPIN(pin, salt) {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);
  
  // 导入 PIN 作为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // 使用 PBKDF2 派生 AES-256 密钥
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,  // 不可导出
    ['encrypt', 'decrypt']
  );
}

/**
 * 使用 PIN 加密并保存凭证到 localStorage
 * @param {string} accessKeyId - AWS Access Key ID
 * @param {string} secretAccessKey - AWS Secret Access Key
 * @param {string} pin - 用户设置的 PIN 码（建议 4-8 位数字或字母）
 * @returns {Promise<void>}
 */
export async function saveCredentialsSecure(accessKeyId, secretAccessKey, pin) {
  // 生成随机 salt (16 字节) 和 IV (12 字节，AES-GCM 推荐)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 从 PIN 派生密钥
  const key = await deriveKeyFromPIN(pin, salt);
  
  // 准备要加密的数据
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify({ 
    accessKeyId, 
    secretAccessKey,
    savedAt: Date.now()
  }));
  
  // AES-GCM 加密
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  
  // 将加密数据和元信息存储到 localStorage
  // 注意：salt 和 iv 不需要保密，可以明文存储
  const stored = {
    version: 1,  // 版本号，方便将来升级加密方案
    ciphertext: arrayToBase64(new Uint8Array(ciphertext)),
    iv: arrayToBase64(iv),
    salt: arrayToBase64(salt),
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  console.log('🔐 凭证已加密保存');
}

/**
 * 使用 PIN 解密并读取凭证
 * @param {string} pin - 用户输入的 PIN 码
 * @returns {Promise<{ accessKeyId: string, secretAccessKey: string, savedAt: number } | null>}
 * @throws {Error} 如果 PIN 错误或数据损坏
 */
export async function loadCredentialsSecure(pin) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  
  try {
    const stored = JSON.parse(raw);
    
    // 检查版本
    if (stored.version !== 1) {
      console.warn('⚠️ 凭证存储版本不匹配');
      return null;
    }
    
    // 解码 Base64 数据
    const salt = base64ToArray(stored.salt);
    const iv = base64ToArray(stored.iv);
    const ciphertext = base64ToArray(stored.ciphertext);
    
    // 从 PIN 派生密钥
    const key = await deriveKeyFromPIN(pin, salt);
    
    // AES-GCM 解密
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    // 解析 JSON
    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(plaintext));
    
    console.log('🔓 凭证解密成功');
    return {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
      savedAt: data.savedAt
    };
  } catch (error) {
    // AES-GCM 解密失败通常意味着 PIN 错误
    // crypto.subtle.decrypt 会抛出 OperationError
    if (error.name === 'OperationError') {
      throw new Error('PIN 码错误');
    }
    console.error('❌ 凭证解密失败:', error);
    throw error;
  }
}

/**
 * 检查是否有已保存的加密凭证
 * @returns {boolean}
 */
export function hasEncryptedCredentials() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  
  try {
    const stored = JSON.parse(raw);
    return stored.version === 1 && stored.ciphertext && stored.salt && stored.iv;
  } catch {
    return false;
  }
}

/**
 * 清除保存的加密凭证
 */
export function clearEncryptedCredentials() {
  localStorage.removeItem(STORAGE_KEY);
  console.log('🗑️ 已清除保存的加密凭证');
}

/**
 * 获取凭证保存时间（不需要 PIN，从元数据读取）
 * 注意：实际的 savedAt 在加密数据内，这里只能返回文件修改时间的近似值
 * @returns {boolean} 是否有保存的凭证
 */
export function getCredentialInfo() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  
  try {
    const stored = JSON.parse(raw);
    return {
      version: stored.version,
      hasCredentials: true,
    };
  } catch {
    return null;
  }
}

// ========== 辅助函数 ==========

/**
 * Uint8Array 转 Base64 字符串
 * @param {Uint8Array} array
 * @returns {string}
 */
function arrayToBase64(array) {
  return btoa(String.fromCharCode.apply(null, array));
}

/**
 * Base64 字符串转 Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToArray(base64) {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

// ========== 兼容性导出（保持与旧 API 一致） ==========

/**
 * 验证 PIN 格式
 * @param {string} pin
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePIN(pin) {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, error: 'PIN 不能为空' };
  }
  
  if (pin.length < 4) {
    return { valid: false, error: 'PIN 至少需要 4 位' };
  }
  
  if (pin.length > 16) {
    return { valid: false, error: 'PIN 不能超过 16 位' };
  }
  
  return { valid: true };
}
