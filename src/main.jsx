import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';

// 检查是否在开发环境且缺少必要的环境变量
const isProductionReady = import.meta.env.VITE_COGNITO_USER_POOL_ID && 
                         import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID && 
                         import.meta.env.VITE_AWS_REGION;

// 只有在有完整配置时才配置Amplify
if (isProductionReady) {
  Amplify.configure({
    Auth: {
      // v6 Change: Auth configuration is now nested under a `Cognito` object
      Cognito: {
        region: import.meta.env.VITE_AWS_REGION,
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID,
      }
    },
    API: {
      endpoints: [
        {
          name: "api",
          endpoint: "https://2rzxc2x5l8.execute-api.us-east-1.amazonaws.com/dev",
          region: import.meta.env.VITE_AWS_REGION
        }
      ]
    },
    Storage: {
      // v6 Change: Storage configuration is now nested under an `S3` object
      S3: {
        bucket: 'vfs-tracker-objstor',
        region: import.meta.env.VITE_AWS_REGION,
      }
    }
  });
} else {
  console.warn('🔧 开发模式：AWS Amplify配置不完整，将使用模拟认证');
}

import { Authenticator } from '@aws-amplify/ui-react';

// 一个小组件，用于处理从 404.html 过来的重定向逻辑
const RedirectHandler = () => {
  const navigate = useNavigate();
  const redirectPath = sessionStorage.getItem('redirect');
  
  if (redirectPath) {
    sessionStorage.removeItem('redirect'); // 用完后立即清除
    navigate(redirectPath, { replace: true });
  }
  
  return null; // 这个组件不渲染任何东西
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RedirectHandler />
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
