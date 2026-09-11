/**
 * @file 速率限制配置页面
 * 管理员可以在此页面配置 Gemini API 的速率限制参数
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAWSClients } from '../contexts/AWSClientContext';
import { RATE_LIMIT_FIELDS, getRateLimitConfig, updateRateLimitConfig, validateRateLimitConfig } from '../services/ssm';

/**
 * 输入框组件
 */
function NumberInput({ name, label, description, value, onChange, error, disabled = false, min = 1, max = 1000 }) {
  const inputId = `rate-limit-${name}`;
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step="1"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                   text-white focus:outline-none focus:border-purple-500
                   transition-colors"
      />
      {error && <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm text-red-300">{error}</p>}
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [reconciliation, setReconciliation] = useState(null);

  // 配置值
  const [config, setConfig] = useState(null);

  // 原始配置（用于检测更改）
  const [originalConfig, setOriginalConfig] = useState(null);
  const loadingRef = useRef(false);
  const savingRef = useRef(false);

  // 成功提示计时器属于当前页面，卸载后不再更新旧页面状态。
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  /**
   * 加载配置
   */
  const loadConfig = useCallback(async () => {
    if (!clients?.ssm || loadingRef.current) return;

    loadingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const data = await getRateLimitConfig(clients.ssm);
      setConfig(data);
      setOriginalConfig(data);
    } catch (err) {

      setError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [clients?.ssm]);

  // 初始加载
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /** 部分写入后重新读取服务端，只把失败字段的本地编辑合并回可信基线。 */
  const reconcilePartialSave = async (recovery) => {
    try {
      const confirmed = await getRateLimitConfig(clients.ssm);
      const preserved = Object.fromEntries(recovery.failedFields.map(key => [key, recovery.draft[key]]));
      setOriginalConfig(confirmed);
      setConfig({ ...confirmed, ...preserved });
      setFieldErrors(Object.fromEntries(recovery.failedFields.map(key => [key, '此项保存失败，请重试'])));
      setReconciliation(null);
      setError(`${recovery.summary}。已重新读取服务端状态，未保存的编辑仍保留。`);
    } catch {
      setError(`${recovery.summary}，且无法重新核对服务端状态。请先重新核对，当前表单已锁定。`);
    }
  };

  /** 状态未知时只允许重新读取，成功核对前不允许再次保存或重置。 */
  const handleReconcile = async () => {
    if (!reconciliation || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    await reconcilePartialSave(reconciliation);
    savingRef.current = false;
    setSaving(false);
  };

  /**
   * 保存配置
   */
  const handleSave = async () => {
    if (!clients?.ssm || savingRef.current || reconciliation) return;

    const errors = validateRateLimitConfig(config);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('请修正配置中的错误后再保存。');
      document.getElementById(`rate-limit-${Object.keys(errors)[0]}`)?.focus();
      return;
    }

    savingRef.current = true;
    const draft = { ...config };
    const changes = Object.fromEntries(Object.keys(RATE_LIMIT_FIELDS)
      .filter(key => Number(config[key]) !== Number(originalConfig[key]))
      .map(key => [key, config[key]]));
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      setFieldErrors({});
      await updateRateLimitConfig(clients.ssm, changes);
      const confirmed = Object.fromEntries(Object.keys(RATE_LIMIT_FIELDS).map(key => [key, Number(config[key])]));
      setConfig(confirmed);
      setOriginalConfig(confirmed);
      setSuccess(true);
    } catch (err) {
      if (err.name === 'RateLimitUpdateError') {
        const failedFields = Object.keys(err.results).filter(key => err.results[key].status === 'rejected');
        const succeededFields = Object.keys(err.results).filter(key => err.results[key].status === 'fulfilled');
        const summary = [
          succeededFields.length ? `已保存：${succeededFields.map(key => RATE_LIMIT_FIELDS[key].label).join('、')}` : '',
          failedFields.length ? `保存失败：${failedFields.map(key => RATE_LIMIT_FIELDS[key].label).join('、')}` : '',
        ].filter(Boolean).join('；');
        const recovery = { draft, failedFields, summary };
        setReconciliation(recovery);
        await reconcilePartialSave(recovery);
      } else {

        setError(err.message);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /**
   * 重置配置
   */
  const handleReset = () => {
    if (originalConfig) {
      setConfig(originalConfig);
      setFieldErrors({});
      setError(null);
    }
  };

  /** 保留用户正在输入的空值或小数文本，并即时清除当前字段的旧错误。 */
  const updateField = (field, value) => {
    setConfig(previous => ({ ...previous, [field]: value }));
    setFieldErrors(previous => ({ ...previous, [field]: undefined }));
    setSuccess(false);
  };

  /**
   * 检查是否有更改
   */
  const hasChanges = originalConfig && Object.keys(RATE_LIMIT_FIELDS).some(field => (
    config[field] === '' || Number(config[field]) !== Number(originalConfig[field])
  ));

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

  // 首次读取失败时没有可信基线，不能把占位数字伪装成可编辑配置。
  if (!config || !originalConfig) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">速率限制配置</h2>
          <p className="text-gray-400 mt-1">尚未取得有效配置，恢复连接后可在此重试。</p>
        </div>
        <div role="alert" className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-300">{error || '配置读取失败。'}</p>
          <button
            type="button"
            onClick={loadConfig}
            className="mt-3 px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            重试读取配置
          </button>
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
        <div role="alert" className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-300">{error}</p>
          {reconciliation && (
            <button type="button" onClick={handleReconcile} disabled={saving} className="mt-3 px-4 py-2 bg-red-700 text-white rounded-lg disabled:opacity-50">
              {saving ? '正在核对...' : '重新核对服务端状态'}
            </button>
          )}
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
            name="adviceWindowHours"
            label="时间窗口（小时）"
            description="限制周期，例如 24 表示每天"
            value={config.adviceWindowHours}
            onChange={(v) => updateField('adviceWindowHours', v)}
            error={fieldErrors.adviceWindowHours}
            disabled={saving || Boolean(reconciliation)}
            min={RATE_LIMIT_FIELDS.adviceWindowHours.min}
            max={RATE_LIMIT_FIELDS.adviceWindowHours.max}
          />
          <NumberInput
            name="adviceMaxRequests"
            label="最大请求次数"
            description="在时间窗口内允许的最大请求次数"
            value={config.adviceMaxRequests}
            onChange={(v) => updateField('adviceMaxRequests', v)}
            error={fieldErrors.adviceMaxRequests}
            disabled={saving || Boolean(reconciliation)}
            min={RATE_LIMIT_FIELDS.adviceMaxRequests.min}
            max={RATE_LIMIT_FIELDS.adviceMaxRequests.max}
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
            name="songWindowHours"
            label="时间窗口（小时）"
            description="限制周期，例如 24 表示每天"
            value={config.songWindowHours}
            onChange={(v) => updateField('songWindowHours', v)}
            error={fieldErrors.songWindowHours}
            disabled={saving || Boolean(reconciliation)}
            min={RATE_LIMIT_FIELDS.songWindowHours.min}
            max={RATE_LIMIT_FIELDS.songWindowHours.max}
          />
          <NumberInput
            name="songMaxRequests"
            label="最大请求次数"
            description="在时间窗口内允许的最大请求次数"
            value={config.songMaxRequests}
            onChange={(v) => updateField('songMaxRequests', v)}
            error={fieldErrors.songMaxRequests}
            disabled={saving || Boolean(reconciliation)}
            min={RATE_LIMIT_FIELDS.songMaxRequests.min}
            max={RATE_LIMIT_FIELDS.songMaxRequests.max}
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
          disabled={!hasChanges || saving || Boolean(reconciliation)}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          重置
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || Boolean(reconciliation)}
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
