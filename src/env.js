// 统一环境就绪判断与导出，供全局复用
// 判定是否具备最小 AWS 后端能力（仅依赖 Cognito 与区域变量）
// 如果未来需要同时验证 API 端点 / S3 bucket，可在此集中扩展
export const isProductionReady = () => {
  const hasUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const hasClientId = import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID;
  const hasRegion = import.meta.env.VITE_AWS_REGION;
  const hasApiEndpoint = import.meta.env.VITE_API_ENDPOINT; // 新增
  const hasS3Bucket = import.meta.env.VITE_S3_BUCKET;       // 新增
  return !!(hasUserPoolId && hasClientId && hasRegion && hasApiEndpoint && hasS3Bucket);
};

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

// 提供一个调试日志函数（可按需替换为更完善的 logger）
export const logEnvReadiness = (context = 'global') => {
  // 仅在开发模式输出
  if (import.meta.env.DEV) {
    console.log(`[env] readiness check @${context}`, {
      hasUserPoolId: !!import.meta.env.VITE_COGNITO_USER_POOL_ID,
      hasClientId: !!import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
      hasRegion: !!import.meta.env.VITE_AWS_REGION,
      hasApiEndpoint: !!import.meta.env.VITE_API_ENDPOINT,
      hasS3Bucket: !!import.meta.env.VITE_S3_BUCKET,
      apiResolved: getFullApiEndpoint(),
      bucket: import.meta.env.VITE_S3_BUCKET || null,
      ready: isProductionReady(),
      mode: import.meta.env.MODE
    });
  }
};
