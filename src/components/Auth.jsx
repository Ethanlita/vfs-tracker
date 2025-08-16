import React, { useState, useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';

const Auth = () => {
    const navigate = useNavigate();
    const { user, login, logout, handleAuthSuccess } = useAuth();
    const [showAuthenticator, setShowAuthenticator] = useState(false);
    const [amplifyReady, setAmplifyReady] = useState(false);
    const ready = globalIsProductionReady();

    // 检查Amplify配置状态
    useEffect(() => {
        if (ready) {
            // 在生产模式下检查Amplify配置
            try {
                const config = Amplify.getConfig();
                const hasAuth = config?.Auth?.Cognito?.userPoolId;
                console.log('[Auth] Amplify配置检查:', { hasAuth, config: config?.Auth });
                setAmplifyReady(!!hasAuth);
            } catch (error) {
                console.error('[Auth] Amplify配置检查失败:', error);
                setAmplifyReady(false);
            }
        } else {
            setAmplifyReady(true); // 开发模式不需要真实配置
        }
    }, [ready]);

    const handleDevLogin = () => {
        login({
            username: 'dev-user',
            userId: 'demo-user-123',
            attributes: {
                name: '开发用户',
                email: 'dev@example.com',
                sub: 'demo-user-123',
                picture: 'https://placehold.co/40x40/E9D5FF/3730A3?text=D'
            }
        });
    };

    const handleDevLogout = () => {
        logout();
        navigate('/');
    };

    // 开发模式的认证组件
    if (!ready) {
        if (user) {
            // 开发模式 - 已认证用户
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
        } else {
            // 开发模式 - 未认证状态
            return (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDevLogin}
                        className="btn-pink text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                    >
                        模拟登录
                    </button>
                </div>
            );
        }
    }

    // 生产模式：条件显示登录界面
    if (showAuthenticator) {
        // 确保只在Amplify配置就绪时显示认证界面
        if (!amplifyReady) {
            return (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                            <p className="text-gray-600">正在初始化认证服务...</p>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">用户认证</h2>
                        <button
                            onClick={() => setShowAuthenticator(false)}
                            className="text-gray-500 hover:text-gray-700 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                    <AuthenticatorWrapper onAuthSuccess={() => setShowAuthenticator(false)} />
                </div>
            </div>
        );
    }

    // 生产模式的认证状态检查组件
    return (
        <ProductionAuthStatus
            onShowLogin={() => setShowAuthenticator(true)}
            navigate={navigate}
        />
    );
};

// 生产模式下的认证状态组件
const ProductionAuthStatus = ({ onShowLogin, navigate }) => {
    // 使用 useAuthenticator 检查认证状态
    const { authStatus, user, signOut } = useAuthenticator((context) => [
        context.authStatus,
        context.user,
        context.signOut
    ]);

    if (authStatus === 'authenticated' && user) {
        // 生产模式 - 已认证用户
        return (
            <div className="flex items-center gap-2 sm:gap-3">
                <img
                    src={user?.attributes?.picture || 'https://placehold.co/40x40/E9D5FF/3730A3?text=U'}
                    alt={user?.attributes?.name || user?.attributes?.email || '用户'}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                />
                <span className="font-semibold text-gray-700 hidden sm:block">
                    {user?.attributes?.name || user?.attributes?.email || '用户'}
                </span>
                <button
                    onClick={() => navigate('/mypage')}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    我的页面
                </button>
                <button
                    onClick={() => {
                        signOut();
                        navigate('/');
                    }}
                    className="btn-pink mx-1.5 text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    登出
                </button>
            </div>
        );
    } else {
        // 生产模式 - 未认证状态
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={onShowLogin}
                    className="btn-pink text-sm px-3 py-2 sm:text-base sm:px-6 sm:py-3"
                >
                    登录 / 注册
                </button>
            </div>
        );
    }
};

// 包装 Authenticator 的组件，用于隔离认证逻辑
const AuthenticatorWrapper = ({ onAuthSuccess }) => {
    const [configReady, setConfigReady] = useState(false);
    const { handleAuthSuccess } = useAuth();

    useEffect(() => {
        // 在渲染 Authenticator 前再次确认配置
        const checkConfig = async () => {
            try {
                // 强制等待一小段时间确保配置完全加载
                await new Promise(resolve => setTimeout(resolve, 100));

                const config = Amplify.getConfig();
                console.log('[AuthenticatorWrapper] 检查配置:', config?.Auth);

                if (config?.Auth?.Cognito?.userPoolId) {
                    setConfigReady(true);
                } else {
                    console.error('[AuthenticatorWrapper] Cognito配置缺失');
                    // 尝试重新配置
                    const amplifyConfig = {
                        Auth: {
                            Cognito: {
                                userPoolId: 'us-east-1_Bz6JC9ko9',
                                userPoolClientId: '1nkup2vppbuk3n2d4575vbcoa0',
                                region: 'us-east-1',
                                loginWith: {
                                    username: true,
                                    email: true,
                                    phone: false
                                },
                                signUpAttributes: ['email', 'nickname'],
                                userAttributes: {
                                    nickname: {
                                        required: true
                                    },
                                    email: {
                                        required: true
                                    }
                                }
                            }
                        }
                    };
                    Amplify.configure(amplifyConfig);
                    console.log('[AuthenticatorWrapper] 重新配置完成');
                    setConfigReady(true);
                }
            } catch (error) {
                console.error('[AuthenticatorWrapper] 配置检查失败:', error);
                setConfigReady(false);
            }
        };

        checkConfig();
    }, []);

    if (!configReady) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-600">正在加载认证配置...</p>
            </div>
        );
    }

    return (
        <Authenticator
            hideSignUp={false}
        >
            {({ signOut, user }) => {
                // 当用户认证成功时，调用AuthContext的处理方法
                if (user) {
                    handleAuthSuccess(user);
                    onAuthSuccess();
                }
                return null;
            }}
        </Authenticator>
    );
};

export default Auth;