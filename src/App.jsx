import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import Layout from './components/Layout';
import Auth from './components/Auth';
import Profile from './components/Profile';
import PublicDashboard from './components/PublicDashboard';
import Home from './components/Home'; // We will create this next

// A simple router based on URL hash
const SimpleRouter = () => {
  const hash = window.location.hash;

  if (hash === '#/profile') {
    return <Profile />;
  }
  if (hash === '#/dashboard') {
    return <PublicDashboard />;
  }
  return <Home />;
};

const AppContent = () => {
  return (
    <Layout auth={<Auth />}>
      <SimpleRouter />
    </Layout>
  );
};

function App() {
  return (
    <Authenticator.Provider>
      {/* We can customize the login form to match the new style later */}
      <Authenticator hideSignUp={true} variation="modal">
        <AppContent />
      </Authenticator>
    </Authenticator.Provider>
  );
}

export default App;
