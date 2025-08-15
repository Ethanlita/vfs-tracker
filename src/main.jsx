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
      // v6 Change: Auth configuration is now nested under a `Cognito` object
      Cognito: {
        region: import.meta.env.VITE_AWS_REGION,
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
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
      // v6 Change: Storage configuration is now nested under an `S3` object
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

// 在 Amplify 配置完成后再导入 App 和相关组件
import App from './App.jsx'
import { Authenticator } from '@aws-amplify/ui-react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {isProductionReady ? (
        <Authenticator.Provider>
          <App />
        </Authenticator.Provider>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </StrictMode>,
)
