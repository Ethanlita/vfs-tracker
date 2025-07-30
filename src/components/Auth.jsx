import React from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

/**
 * Authentication component displayed in the header.
 * It shows the user's name and a sign-out button if logged in.
 * If the user is not logged in, it renders nothing, as the main
 * Authenticator component will take over the screen.
 * @returns {JSX.Element|null} The rendered authentication component or null.
 */
const Auth = () => {
  const { user, signOut } = useAuthenticator((context) => [context.user]);

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span className="font-semibold text-gray-700 hidden sm:block">
          Welcome, {user.username}
        </span>
        <button
          onClick={signOut}
          className="bg-gray-200 text-gray-800 hover:bg-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return null;
};

export default Auth;
