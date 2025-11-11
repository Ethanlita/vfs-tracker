import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 暂时不导入 App，等 Amplify 配置完成后再导入
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter } from 'react-router-dom';
import { logEnvReadiness, getFullApiEndpoint } from './env.js';

logEnvReadiness('main');

// ============================================
// 环境变量验证 (Environment Variable Validation)
// ============================================
const requiredEnvVars = {
  VITE_COGNITO_USER_POOL_ID: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
  VITE_AWS_REGION: import.meta.env.VITE_AWS_REGION,
  VITE_API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
  VITE_S3_BUCKET: import.meta.env.VITE_S3_BUCKET
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([name, value]) => !value)
  .map(([name]) => name);

if (missingVars.length > 0) {
  const errorMsg = `❌ 缺少必需的环境变量：

${missingVars.map(v => `  • ${v}`).join('\n')}

请按以下步骤配置：
1. 复制 .env.example 为 .env
2. 填写所有必需的 AWS 凭证
3. 重启开发服务器

参见 .env.example 了解所有必需变量的说明。`;

  console.error('[startup] 配置错误:', errorMsg);
  
  createRoot(document.getElementById('root')).render(
    <div style={{
      padding: '2rem',
      maxWidth: '800px',
      margin: '2rem auto',
      backgroundColor: '#fee',
      border: '2px solid #f00',
      borderRadius: '8px',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ color: '#c00', marginBottom: '1rem' }}>⚠️ 配置错误</h1>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{errorMsg}</pre>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        更多信息请查看 <code>README.md</code> 或 <code>docs/</code> 目录。
      </p>
    </div>
  );
  
  throw new Error('Missing required environment variables');
}

// 配置 Amplify（生产模式直接连接 AWS）
const debugEnv = {
  VITE_COGNITO_USER_POOL_ID: !!import.meta.env.VITE_COGNITO_USER_POOL_ID,
  VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: !!import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
  VITE_AWS_REGION: !!import.meta.env.VITE_AWS_REGION,
  VITE_API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT || '(missing)',
  VITE_API_STAGE: import.meta.env.VITE_API_STAGE || '(missing)',
  VITE_S3_BUCKET: import.meta.env.VITE_S3_BUCKET || '(missing)',
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV
};
console.info('[startup] env summary', debugEnv);

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

// 导入App组件（在Amplify配置完成后）
import App from './App.jsx'

// 注册 Service Worker 并在检测到新版本后提示用户刷新
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const notifyUpdateReady = () => {
    window.dispatchEvent(new CustomEvent('sw:update-available'));
  };

  navigator.serviceWorker.register('/sw.js').then((registration) => {
    console.log('Service Worker registered: ', registration);

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateReady();
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdateReady();
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
