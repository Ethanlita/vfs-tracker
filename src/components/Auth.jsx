import React from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';

const Auth = () => {
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();

    const ready = globalIsProductionReady();

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
            <div className="flex items-center gap-2 sm:gap-3">
                <img
                    src={user.attributes.picture}
                    alt={user.attributes.name}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                />
                <span className="font-semibold text-gray-700 hidden sm:block">
          {user.attributes.name}
        </span>
                {ready ? null : <span className="text-xs text-orange-600 hidden sm:block">(开发模式)</span>}
                <button
                    onClick={() => navigate('/mypage')}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    我的页面
                </button>
                <button
                    onClick={handleDevLogout}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    登出
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {!ready && (
              <>
                <button
                    onClick={handleDevLogin}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    开发登录
                </button>
                <span className="text-xs text-orange-600 mx-1.5">(开发模式)</span>
              </>
            )}
            {ready && (
              <span className="text-xs text-gray-500">已连接后端</span>
            )}
        </div>
    );
};

export default Auth;