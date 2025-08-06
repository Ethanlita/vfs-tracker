import React from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Auth = () => {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const isProductionReady = import.meta.env.VITE_COGNITO_USER_POOL_ID && 
                           import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID && 
                           import.meta.env.VITE_AWS_REGION;

  const handleDevLogin = () => {
    login({
      username: 'dev-user',
      attributes: {
        name: '开发用户',
        email: 'dev@example.com',
        picture: 'https://placehold.co/40x40/E9D5FF/3730A3?text=D'
      }
    });
  };

  const handleDevLogout = () => {
    logout();
    navigate('/');
  };

  if (user) {
    return (
      <div className="auth-container">
        <img
          src={user.attributes.picture}
          alt={user.attributes.name}
          className="avatar-responsive rounded-full border-2 border-pink-500 nav-spacing"
        />
        <span className="font-semibold text-gray-700 text-responsive-base hidden sm:block">
          {user.attributes.name}
        </span>
        <span className="text-responsive-sm text-orange-600 hidden sm:block">(开发模式)</span>
        <button
          onClick={() => navigate('/mypage')}
          className="btn-pink nav-spacing-narrow"
        >
          我的页面
        </button>
        <button
          onClick={handleDevLogout}
          className="btn-pink nav-spacing-narrow"
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <button
        onClick={handleDevLogin}
        className="btn-pink nav-spacing-narrow"
      >
        开发登录
      </button>
      <span className="text-responsive-sm text-orange-600 nav-spacing-narrow">(开发模式)</span>
    </div>
  );
};

export default Auth;
