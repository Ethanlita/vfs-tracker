import React, { useState } from 'react';
import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';

const Auth = () => {
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();
    const { authStatus, user: amplifyUser, signOut } = useAuthenticator((context) => [
        context.authStatus,
        context.user,
        context.signOut
    ]);
    const [showCognitoAuth, setShowCognitoAuth] = useState(false);

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

    const handleProductionLogin = () => {
        // 直接显示Cognito登录界面
        setShowCognitoAuth(true);
    };

    const handleProductionLogout = () => {
        signOut();
        navigate('/');
    };

    // 生产模式 - 已认证用户
    if (ready && authStatus === 'authenticated' && amplifyUser) {
        return (
            <div className="flex items-center gap-2 sm:gap-3">
                <img
                    src={amplifyUser.attributes?.picture || 'https://placehold.co/40x40/E9D5FF/3730A3?text=U'}
                    alt={amplifyUser.attributes?.name || amplifyUser.attributes?.email || '用户'}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                />
                <span className="font-semibold text-gray-700 hidden sm:block">
                    {amplifyUser.attributes?.name || amplifyUser.attributes?.email || '用户'}
                </span>
                <button
                    onClick={() => navigate('/mypage')}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    我的页面
                </button>
                <button
                    onClick={handleProductionLogout}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    登出
                </button>
            </div>
        );
    }

    // 开发模式 - 已认证用户
    if (!ready && user) {
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

    // 未认证状态
    return (
        <div className="flex items-center gap-2">
            {!ready && (
                <button
                    onClick={handleDevLogin}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    开发登录
                </button>
            )}
            {ready && (
                <button
                    onClick={handleProductionLogin}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    登录
                </button>
            )}

            {/* Cognito 登录界面模态窗口 */}
            {showCognitoAuth && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">用户登录</h2>
                            <button
                                onClick={() => setShowCognitoAuth(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6">
                            <Authenticator
                                socialProviders={[]}
                                signUpAttributes={['email']}
                                components={{
                                    Header() {
                                        return null; // 隐藏默认头部，我们有自己的
                                    },
                                }}
                            >
                                {({ user }) => {
                                    // 登录成功后关闭模态窗口
                                    if (user) {
                                        setShowCognitoAuth(false);
                                    }
                                    return null;
                                }}
                            </Authenticator>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Auth;