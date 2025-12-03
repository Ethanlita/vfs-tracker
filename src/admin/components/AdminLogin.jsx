/**
 * @file 管理员登录组件
 * IAM 凭证输入界面，支持 PIN 加密保存凭证
 * 
 * 两种登录模式：
 * 1. 新登录：输入 Access Key + Secret Key，可选设置 PIN 保存
 * 2. PIN 解锁：如果有保存的凭证，输入 PIN 解锁
 */

import { useState } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { validatePIN, clearEncryptedCredentials } from '../utils/secureCredentialStorage';

/**
 * 管理员登录页面
 * 提供 IAM 凭证输入表单，支持 PIN 加密本地保存凭证
 */
export default function AdminLogin() {
  const { login, unlockWithPIN, isLoading, hasSavedCredentials } = useAWSClients();
  
  // 登录模式：'unlock' (PIN 解锁) 或 'login' (输入凭证)
  const [mode, setMode] = useState(hasSavedCredentials ? 'unlock' : 'login');
  
  // 凭证表单状态
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  // PIN 解锁表单状态
  const [unlockPin, setUnlockPin] = useState('');
  
  // 通用状态
  const [error, setError] = useState(null);

  /**
   * 处理 PIN 解锁
   */
  const handleUnlock = async (e) => {
    e.preventDefault();
    setError(null);

    if (!unlockPin) {
      setError('请输入 PIN 码');
      return;
    }

    const result = await unlockWithPIN(unlockPin);
    if (!result.success) {
      setError(result.error);
      setUnlockPin('');
    }
  };

  /**
   * 处理新凭证登录
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    // 基本格式验证
    const trimmedAccessKeyId = accessKeyId.trim();
    const trimmedSecretKey = secretAccessKey.trim();

    if (!trimmedAccessKeyId.startsWith('AKIA') || trimmedAccessKeyId.length !== 20) {
      setError('Access Key ID 格式无效（应以 AKIA 开头，长度 20 位）');
      return;
    }

    if (trimmedSecretKey.length < 30) {
      setError('Secret Access Key 格式无效（长度应至少 30 位）');
      return;
    }

    // 如果选择记住，验证 PIN
    if (rememberMe) {
      const pinValidation = validatePIN(pin);
      if (!pinValidation.valid) {
        setError(pinValidation.error);
        return;
      }
      
      if (pin !== confirmPin) {
        setError('两次输入的 PIN 码不一致');
        return;
      }
    }

    // 尝试登录
    const result = await login(trimmedAccessKeyId, trimmedSecretKey, rememberMe, pin);
    
    if (!result.success) {
      setError(`凭证验证失败: ${result.error}`);
    }
  };

  /**
   * 切换到输入凭证模式（清除已保存的凭证）
   */
  const handleSwitchToLogin = () => {
    clearEncryptedCredentials();
    setMode('login');
    setUnlockPin('');
    setError(null);
  };

  // ========== PIN 解锁界面 ==========
  if (mode === 'unlock') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
        <div className="max-w-md w-full">
          {/* Logo 和标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">VFS Tracker 管理后台</h1>
            <p className="text-gray-400 mt-2">检测到已保存的凭证，请输入 PIN 解锁</p>
          </div>

          {/* PIN 解锁表单 */}
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
            <form onSubmit={handleUnlock} className="space-y-6">
              <div>
                <label htmlFor="unlockPin" className="block text-sm font-medium text-gray-300 mb-2">
                  PIN 码
                </label>
                <input
                  id="unlockPin"
                  type="password"
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  placeholder="输入你的 PIN 码"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg 
                           text-white placeholder-gray-400 text-center text-2xl tracking-widest
                           focus:ring-2 focus:ring-purple-500 focus:border-transparent
                           transition-colors"
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* 解锁按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium
                         hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/50
                         disabled:opacity-50 disabled:cursor-not-allowed 
                         transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    验证中...
                  </span>
                ) : (
                  '🔓 解锁'
                )}
              </button>
            </form>

            {/* 使用其他凭证 */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={handleSwitchToLogin}
                className="w-full text-gray-400 hover:text-gray-300 text-sm transition-colors"
              >
                使用其他凭证登录 →
              </button>
            </div>
          </div>

          {/* 返回主站链接 */}
          <div className="mt-4 text-center">
            <a 
              href="/" 
              className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
            >
              ← 返回主站
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ========== 凭证登录界面 ==========
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-md w-full">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">VFS Tracker 管理后台</h1>
          <p className="text-gray-400 mt-2">请输入 IAM 凭证以继续</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Access Key ID */}
            <div>
              <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-300 mb-2">
                Access Key ID
              </label>
              <input
                id="accessKeyId"
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIA..."
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg 
                         text-white placeholder-gray-400
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         transition-colors"
                required
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Secret Access Key */}
            <div>
              <label htmlFor="secretAccessKey" className="block text-sm font-medium text-gray-300 mb-2">
                Secret Access Key
              </label>
              <input
                id="secretAccessKey"
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg 
                         text-white placeholder-gray-400
                         focus:ring-2 focus:ring-purple-500 focus:border-transparent
                         transition-colors"
                required
                autoComplete="off"
              />
            </div>

            {/* 记住凭证选项 */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded 
                         focus:ring-purple-500 focus:ring-offset-gray-800"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-300">
                记住凭证（使用 PIN 加密保存）
              </label>
            </div>

            {/* PIN 设置（仅当选择记住时显示） */}
            {rememberMe && (
              <div className="space-y-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                <p className="text-sm text-gray-400">
                  设置一个 PIN 码来保护你的凭证（4-16 位）
                </p>
                <div>
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-300 mb-2">
                    设置 PIN
                  </label>
                  <input
                    id="pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="至少 4 位"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                             text-white placeholder-gray-400
                             focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             transition-colors"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-300 mb-2">
                    确认 PIN
                  </label>
                  <input
                    id="confirmPin"
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="再次输入 PIN"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                             text-white placeholder-gray-400
                             focus:ring-2 focus:ring-purple-500 focus:border-transparent
                             transition-colors"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium
                       hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/50
                       disabled:opacity-50 disabled:cursor-not-allowed 
                       transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  验证中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>
        </div>

        {/* 安全提示 */}
        <div className="mt-6 p-4 bg-blue-900/30 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">安全说明</p>
              <p className="text-blue-400">
                凭证使用 AES-256-GCM 加密后保存在本地浏览器，
                PIN 码通过 PBKDF2 派生密钥，不会上传到任何服务器。
              </p>
            </div>
          </div>
        </div>

        {/* 返回主站链接 */}
        <div className="mt-4 text-center">
          <a 
            href="/" 
            className="text-gray-400 hover:text-gray-300 text-sm transition-colors"
          >
            ← 返回主站
          </a>
        </div>
      </div>
    </div>
  );
}
