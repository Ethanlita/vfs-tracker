import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 暂时不导入 App，等 Amplify 配置完成后再导入
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter } from 'react-router-dom';
import { isProductionReady as globalIsProductionReady, logEnvReadiness, getFullApiEndpoint } from './env.js';

// 替换局部 isProductionReady 逻辑
const isProductionReady = globalIsProductionReady();
logEnvReadiness('main');

// 只有在有完整配置时才配置Amplify
const debugEnv = {
  VITE_COGNITO_USER_POOL_ID: !!import.meta.env.VITE_COGNITO_USER_POOL_ID,
  VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: !!import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
  VITE_AWS_REGION: !!import.meta.env.VITE_AWS_REGION,
  VITE_API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT || '(missing)',
  VITE_API_STAGE: import.meta.env.VITE_API_STAGE || '(missing)',
  VITE_S3_BUCKET: import.meta.env.VITE_S3_BUCKET || '(missing)',
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
  isProductionReady
};
console.info('[startup] env summary', debugEnv);

if (isProductionReady) {
  const apiEndpoint = getFullApiEndpoint();
  const bucket = import.meta.env.VITE_S3_BUCKET;
  console.log('[amplify] configuring REST api (API.REST)', {
    apiEndpoint,
    bucket,
    name: 'api',
    region: import.meta.env.VITE_AWS_REGION,
    rawApiEndpoint: import.meta.env.VITE_API_ENDPOINT,
    rawStage: import.meta.env.VITE_API_STAGE
  });

  const amplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
        region: import.meta.env.VITE_AWS_REGION,
        loginWith: {
          username: true,
          email: true,
          phone: false
        },
        signUpAttributes: ['email', 'nickname'], // 恢复nickname要求
        userAttributes: {
          nickname: {
            required: true
          },
          email: {
            required: true
          }
        }
        // 注意：如果您的客户端配置了密钥，需要在AWS控制台中将其改为公共客户端
        // 前端应用不应该使用客户端密钥
      }
    },
    API: {
      REST: {
        api: {
          endpoint: apiEndpoint,
          region: import.meta.env.VITE_AWS_REGION
        }
      }
    },
    Storage: {
      S3: {
        bucket,
        region: import.meta.env.VITE_AWS_REGION,
      }
    }
  };

  console.log('[amplify] full config being applied:', JSON.stringify(amplifyConfig, null, 2));
  Amplify.configure(amplifyConfig);
  const cfg = Amplify.getConfig?.();
  // v6 format: Check the actual REST configuration
  const restConfig = cfg?.API?.REST;
  console.log('[amplify] REST config after configure', restConfig);
  if (!restConfig || !restConfig.api) {
    console.warn('[amplify] 警告：REST API 配置缺失');
  } else {
    console.log('[amplify] ✅ REST API 配置成功:', restConfig.api);
  }
} else {
  console.warn('[startup] isProductionReady = false，未调用 Amplify.configure');
}

// 导入App组件（在Amplify配置完成后）
import App from './App.jsx'

// 注册 Service Worker 并在检测到新版本后提示用户刷新
if ('serviceWorker' in navigator) {
  const promptUserToRefresh = () => {
    try {
      const shouldReload = window.confirm('检测到有新的版本可用，是否立即刷新以加载最新内容？');
      if (shouldReload) {
        window.location.reload();
      }
    } catch (error) {
      console.warn('无法显示更新提示，默认刷新页面', error);
      window.location.reload();
    }
  };

  navigator.serviceWorker.register('/sw.js').then((registration) => {
    console.log('Service Worker registered: ', registration);

    if (registration.waiting && navigator.serviceWorker.controller) {
      promptUserToRefresh();
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          promptUserToRefresh();
        }
      });
    });
  }).catch((registrationError) => {
    console.log('Service Worker registration failed: ', registrationError);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
