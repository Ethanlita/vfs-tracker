/**
 * @file audioContextManager.js
 * @zh AudioContext 管理器
 * 
 * 提供全局共享的 AudioContext 实例，避免创建过多的 AudioContext 导致资源泄漏。
 * 浏览器通常限制同时活动的 AudioContext 数量（通常为 6 个），超过限制会导致错误。
 */

/**
 * @zh 共享的 AudioContext 实例
 * @type {AudioContext|null}
 */
let sharedAudioContext = null;

/**
 * @zh 获取共享的 AudioContext 实例
 * 
 * 如果不存在则创建新实例，否则返回现有实例。
 * 使用单例模式确保整个应用只有一个 AudioContext。
 * 
 * @returns {AudioContext} 共享的 AudioContext 实例
 */
export function getSharedAudioContext() {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('浏览器不支持 AudioContext');
    }
    sharedAudioContext = new AudioContextClass();
    
    // 监听状态变化，用于调试
    sharedAudioContext.addEventListener('statechange', () => {
      console.log('[AudioContext] 状态变化:', sharedAudioContext.state);
    });
  }
  
  // 如果 context 被关闭，重新创建
  if (sharedAudioContext.state === 'closed') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    sharedAudioContext = new AudioContextClass();
  }
  
  return sharedAudioContext;
}

/**
 * @zh 创建临时 AudioContext
 * 
 * 用于一次性操作（如解码音频），使用完毕后应该立即关闭。
 * 返回一个包含 context 和 close 函数的对象。
 * 
 * @returns {{context: AudioContext, close: () => Promise<void>}} 
 *          临时 AudioContext 和关闭函数
 */
export function createTemporaryAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('浏览器不支持 AudioContext');
  }
  
  const context = new AudioContextClass();
  
  return {
    context,
    close: async () => {
      if (context.state !== 'closed') {
        await context.close();
      }
    }
  };
}

/**
 * @zh 关闭共享的 AudioContext
 * 
 * 通常在应用卸载时调用。
 * 注意：关闭后下次调用 getSharedAudioContext() 会创建新实例。
 * 
 * @returns {Promise<void>}
 */
export async function closeSharedAudioContext() {
  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    await sharedAudioContext.close();
    sharedAudioContext = null;
  }
}

/**
 * @zh 获取当前 AudioContext 的状态
 * 
 * @returns {string|null} 'suspended' | 'running' | 'closed' | null
 */
export function getAudioContextState() {
  return sharedAudioContext ? sharedAudioContext.state : null;
}

/**
 * @zh 恢复 AudioContext（从 suspended 状态）
 * 
 * 某些浏览器要求用户交互后才能启动 AudioContext。
 * 
 * @returns {Promise<void>}
 */
export async function resumeAudioContext() {
  const context = getSharedAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
}
