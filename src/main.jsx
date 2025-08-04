import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter } from 'react-router-dom';

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

import { Authenticator } from '@aws-amplify/ui-react';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Authenticator.Provider>
        <App />
      </Authenticator.Provider>
    </BrowserRouter>
  </StrictMode>,
)
