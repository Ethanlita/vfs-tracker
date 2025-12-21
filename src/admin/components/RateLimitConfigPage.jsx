/**
 * @file 速率限制配置页面
 * 管理员可以在此页面配置 Gemini API 的速率限制参数
 */

import { useState, useEffect, useCallback } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { getRateLimitConfig, updateRateLimitConfig } from '../services/ssm';

/**
 * 输入框组件
 */
function NumberInput({ label, description, value, onChange, min = 1, max = 1000 }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
        min={min}
        max={max}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                   text-white focus:outline-none focus:border-purple-500
                   transition-colors"
      />
      {description && (
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
}

/**
 * 配置卡片组件
 */
function ConfigCard({ title, description, children }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 mb-4">{description}</p>
      )}
      {children}
    </div>
  );
}

/**
 * 速率限制配置页面
 */
export default function RateLimitConfigPage() {
  const { clients } = useAWSClients();
  
  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // 配置值
  const [config, setConfig] = useState({
    adviceWindowHours: 24,
    adviceMaxRequests: 10,
    songWindowHours: 24,
    songMaxRequests: 10,
  });
  
  // 原始配置（用于检测更改）
  const [originalConfig, setOriginalConfig] = useState(null);

  /**
   * 加载配置
   */
  const loadConfig = useCallback(async () => {
    if (!clients?.ssm) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getRateLimitConfig(clients.ssm);
      setConfig(data);
      setOriginalConfig(data);
    } catch (err) {
      console.error('加载配置失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clients?.ssm]);

  // 初始加载
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * 保存配置
   */
  const handleSave = async () => {
    if (!clients?.ssm) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await updateRateLimitConfig(clients.ssm, config);
      setOriginalConfig(config);
      setSuccess(true);
      // 3 秒后清除成功提示
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('保存配置失败:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 重置配置
   */
  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
    }
  };

  /**
   * 检查是否有更改
   */
  const hasChanges = originalConfig && (
    config.adviceWindowHours !== originalConfig.adviceWindowHours ||
    config.adviceMaxRequests !== originalConfig.adviceMaxRequests ||
    config.songWindowHours !== originalConfig.songWindowHours ||
    config.songMaxRequests !== originalConfig.songMaxRequests
  );

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">加载配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">速率限制配置</h2>
        <p className="text-gray-400 mt-1">
          配置 Gemini AI API 的请求频率限制，防止滥用。
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* 成功提示 */}
      {success && (
        <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg">
          <p className="text-green-300">✓ 配置已保存</p>
        </div>
      )}

      {/* AI 建议配置 */}
      <ConfigCard 
        title="AI 建议分析"
        description="用户请求 AI 分析嗓音数据的频率限制（Dashboard 页面）"
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="时间窗口（小时）"
            description="限制周期，例如 24 表示每天"
            value={config.adviceWindowHours}
            onChange={(v) => setConfig(prev => ({ ...prev, adviceWindowHours: v }))}
            min={1}
            max={168}
          />
          <NumberInput
            label="最大请求次数"
            description="在时间窗口内允许的最大请求次数"
            value={config.adviceMaxRequests}
            onChange={(v) => setConfig(prev => ({ ...prev, adviceMaxRequests: v }))}
            min={1}
            max={100}
          />
        </div>
      </ConfigCard>

      {/* 歌曲推荐配置 */}
      <ConfigCard 
        title="歌曲推荐"
        description="用户请求 AI 推荐歌曲的频率限制（音阶练习页面）"
      >
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="时间窗口（小时）"
            description="限制周期，例如 24 表示每天"
            value={config.songWindowHours}
            onChange={(v) => setConfig(prev => ({ ...prev, songWindowHours: v }))}
            min={1}
            max={168}
          />
          <NumberInput
            label="最大请求次数"
            description="在时间窗口内允许的最大请求次数"
            value={config.songMaxRequests}
            onChange={(v) => setConfig(prev => ({ ...prev, songMaxRequests: v }))}
            min={1}
            max={100}
          />
        </div>
      </ConfigCard>

      {/* 说明信息 */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-2">💡 说明</h4>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• 管理员账户不受速率限制影响</li>
          <li>• 配置更改后约 5 分钟内生效（Lambda 有缓存）</li>
          <li>• 被限速的用户会看到友好提示，并可查看上次的结果</li>
        </ul>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleReset}
          disabled={!hasChanges || saving}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          重置
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg
                     hover:bg-purple-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          {saving && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          )}
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
}
