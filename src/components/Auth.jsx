import React, { useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useNavigate } from 'react-router-dom';

const Auth = () => {
  const navigate = useNavigate();
  const [mockUser, setMockUser] = useState(null);
  
  const isProductionReady = import.meta.env.VITE_COGNITO_USER_POOL_ID && 
                           import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID && 
                           import.meta.env.VITE_AWS_REGION;

  const handleDevLogin = () => {
    setMockUser({
      username: 'dev-user',
      attributes: {
        name: '开发用户',
        email: 'dev@example.com',
        picture: 'https://placehold.co/40x40/E9D5FF/3730A3?text=D'
      }
    });
  };

  const handleDevLogout = () => {
    setMockUser(null);
    navigate('/');
  };

  if (mockUser) {
    return (
      <div className="flex items-center gap-4">
        <img 
          src={mockUser.attributes.picture} 
          alt={mockUser.attributes.name} 
          className="w-10 h-10 rounded-full border-2 border-pink-500"
        />
        <span className="font-semibold text-gray-700 hidden sm:block">
          {mockUser.attributes.name}
        </span>
        <span className="text-xs text-orange-600 hidden sm:block">(开发模式)</span>
        <button
          onClick={() => navigate('/mypage')}
          className="text-sm font-semibold text-gray-700 hover:text-pink-600"
        >
          我的页面
        </button>
        <button
          onClick={handleDevLogout}
          className="bg-gray-200 text-gray-800 hover:bg-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-300"
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDevLogin}
        className="btn-pink"
      >
        开发登录
      </button>
      <span className="text-xs text-orange-600">(开发模式)</span>
    </div>
  );
};

export default Auth;
