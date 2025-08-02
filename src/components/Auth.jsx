import React from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

/**
 * @en Authentication component displayed in the header.
 * It shows a "My Page" link and a "Sign Out" button if the user is logged in.
 * If the user is not logged in, it renders a "Sign In" button.
 * @zh 显示在头部的身份验证组件。
 * 如果用户已登录，则显示“我的页面”链接和“登出”按钮。
 * 如果用户未登录，则呈现“登录”按钮。
 * @returns {JSX.Element} The rendered authentication component.
 */
const Auth = () => {
  // --- HOOKS ---
  // @en Get user, signOut, and toSignIn from the authenticator context.
  // @zh 从 authenticator 上下文获取 user、signOut 和 toSignIn。
  const { user, signOut, toSignIn } = useAuthenticator((context) => [
    context.user,
    context.signOut,
    context.toSignIn,
  ]);

  // --- HANDLERS ---
  /**
   * @en Handles the sign-out process. It calls the signOut method and then
   * redirects the user to the homepage.
   * @zh 处理登出流程。它调用 signOut 方法，然后将用户重定向到主页。
   */
  const handleSignOut = () => {
    signOut();
    // @en Redirect to home page after sign out to ensure a clean state.
    // @zh 登出后重定向到主页以确保状态干净。
    window.location.hash = '#/';
  };

  // --- RENDER ---
  // @en If a user object exists, the user is authenticated.
  // @zh 如果 user 对象存在，则用户已通过身份验证。
  if (user) {
    return (
      <div className="flex items-center gap-4">
        {/* @en Link to the user's personal dashboard. */}
        {/* @zh 指向用户个人仪表板的链接。 */}
        <a href="#/mypage" className="text-sm font-semibold text-gray-700 hover:text-pink-600">
          My Page
        </a>
        {/* @en Button to sign the user out. */}
        {/* @zh 用于用户登出的按钮。 */}
        <button
          onClick={handleSignOut}
          className="bg-gray-200 text-gray-800 hover:bg-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // @en If no user, show the sign-in button.
  // @zh 如果没有用户，则显示登录按钮。
  return (
    <button
      onClick={() => toSignIn()}
      className="bg-pink-500 text-white hover:bg-pink-600 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
    >
      Sign In
    </button>
  );
};

export default Auth;
