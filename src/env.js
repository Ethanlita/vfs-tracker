// 统一环境配置管理模块
// 提供获取 API endpoint, AWS 配置等环境相关功能

// 统一获取规范化后的 API 基础地址（去掉末尾斜杠）
export const getNormalizedApiBase = () => {
  const pickByWindow = () => {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hn = window.location.hostname.toLowerCase();
      return hn.endsWith('.cn')
        ? 'https://api.vfs-tracker.cn'
        : 'https://api.vfs-tracker.app';
    }
    return 'https://api.vfs-tracker.app';
  };
  const configured = import.meta.env.VITE_API_ENDPOINT || 'auto';
  const base = (configured === 'auto') ? pickByWindow() : configured;
  return base.replace(/\/+$/, '');
};

// 统一获取 Stage（去掉前导斜杠）
export const getApiStagePath = () => {
  const stage = import.meta.env.VITE_API_STAGE || '';
  return stage ? `/${stage.replace(/^\//, '')}` : '';
};

// 统一获取实际 API Endpoint（基础 + stage）
export const getFullApiEndpoint = () => {
  return getNormalizedApiBase() + getApiStagePath();
};
