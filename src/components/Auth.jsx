import React, { useState, useEffect, useMemo } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';
import { getUserAvatarUrl, getUserDisplayName } from '../utils/avatar.js';

const Auth = () => {
    const navigate = useNavigate();
    const { user, login, logout } = useAuth();
    const [showAuthenticator, setShowAuthenticator] = useState(false);
    const [amplifyReady, setAmplifyReady] = useState(false);
    const ready = globalIsProductionReady();
    const [avatarUrl, setAvatarUrl] = useState('');

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
                nickname: '开发用户', // 确保开发模式也有nickname
                email: 'dev@example.com',
                sub: 'demo-user-123'
            }
        });
    };

    const handleDevLogout = () => {
        logout();
        navigate('/');
    };

    useEffect(() => {
        const fetchAvatar = async () => {
            if (user) {
                const url = await getUserAvatarUrl(user, 40);
                setAvatarUrl(url);
            }
        };
        fetchAvatar();
    }, [user]);

    // 开发模式的认证组件
    if (!ready) {
        if (user) {
            // 开发模式 - 已认证用户
            return (
                <div className="flex items-center gap-2 sm:gap-3">
                    <img
                        src={avatarUrl}
                        alt={getUserDisplayName(user)}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                    />
                    <span className="font-semibold text-gray-700 hidden sm:block">
                        {getUserDisplayName(user)}
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
    // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
    // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
    const { user, cognitoUserInfo, refreshCognitoUserInfo } = useAuth();
    const { signOut } = useAuthenticator((context) => [context.signOut]);

    console.log('📍 [验证点20] Auth组件用户信息来源验证:', {
        source: 'AuthContext (使用Amplify v6标准API)',
        authContextUser: !!user,
        cognitoUserInfo: !!cognitoUserInfo,
        userIdFromContext: user?.userId,
        emailFromCognito: cognitoUserInfo?.email,
        nicknameFromCognito: cognitoUserInfo?.nickname,
        混合来源检查: '仅signOut函数来自useAuthenticator，其余均来自AuthContext'
    });

    useEffect(() => {
        if (user && !cognitoUserInfo) {
            refreshCognitoUserInfo();
        }
    }, [user, cognitoUserInfo, refreshCognitoUserInfo]);

    const completeUser = useMemo(() => {
        return user ? {
            ...user,
            attributes: {
                ...user.attributes,
                nickname: cognitoUserInfo?.nickname || user.attributes?.nickname,
                email: cognitoUserInfo?.email || user.attributes?.email,
                avatarKey: cognitoUserInfo?.avatarKey || user.attributes?.avatarKey
            }
        } : null;
    }, [user, cognitoUserInfo]);

    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        const fetchAvatar = async () => {
            if (completeUser) {
                const url = await getUserAvatarUrl(completeUser, 40);
                setAvatarUrl(url);
            }
        };
        fetchAvatar();
    }, [completeUser]);

    if (completeUser) {
        return (
            <div className="flex items-center gap-2 sm:gap-3">
                <img
                    src={avatarUrl}
                    alt={getUserDisplayName(completeUser)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                />
                <span className="font-semibold text-gray-700 hidden sm:block">
                    {getUserDisplayName(completeUser)}
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
                                signUpAttributes: ['email', 'nickname'], // 恢复nickname要求
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
            {({ user }) => {
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