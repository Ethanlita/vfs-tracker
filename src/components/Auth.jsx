import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserAvatarUrl, getUserDisplayName, generateAvatar } from '../utils/avatar.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { ensureAppError } from '../utils/apiError.js';

/**
 * Auth 组件
 * 
 * 提供用户认证相关的UI和交互逻辑，包括登录、注册、登出等功能。
 * 使用 AWS Amplify 进行身份验证。
 * 
 * @returns {JSX.Element} 认证组件
 */
const Auth = () => {
    const navigate = useNavigate();
    const [showAuthenticator, setShowAuthenticator] = useState(false);
    const [amplifyReady, setAmplifyReady] = useState(false);

    // 检查Amplify配置状态
    useEffect(() => {
        try {
            const config = Amplify.getConfig();
            const hasAuth = config?.Auth?.Cognito?.userPoolId;
            console.log('[Auth] Amplify配置检查:', { hasAuth, config: config?.Auth });
            setAmplifyReady(!!hasAuth);
        } catch (error) {
            console.error('[Auth] Amplify配置检查失败:', error);
            setAmplifyReady(false);
        }
    }, []);

    // 条件显示登录界面
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

    // 认证状态检查组件
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
    const { user, cognitoUserInfo, refreshCognitoUserInfo, userProfile } = useAuth();
    const { signOut } = useAuthenticator((context) => [context.signOut]);

    console.debug('📍 [验证点20] Auth组件用户信息来源验证:', {
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
            }
        } : null;
    }, [user, cognitoUserInfo]);

    const [avatarUrl, setAvatarUrl] = useState('');

    useEffect(() => {
        const fetchAvatar = async () => {
            const avatarKey = userProfile?.profile?.avatarKey;
            if (completeUser && avatarKey) {
                const url = await getUserAvatarUrl(completeUser, 40, avatarKey);
                setAvatarUrl(url);
            } else if (completeUser) {
                setAvatarUrl(generateAvatar(getUserDisplayName(completeUser), 40));
            } else {
                setAvatarUrl(generateAvatar('Guest', 40));
            }
        };
        fetchAvatar();
    }, [completeUser, userProfile?.profile?.avatarKey]);

    if (completeUser) {
        return (
            <div
                className="flex items-center gap-2 sm:gap-3 user-menu"
                data-testid="user-menu"
                role="group"
                aria-label="User menu"
            >
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
                    data-testid="logout-button"
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
    const [error, setError] = useState(null);
    const { handleAuthSuccess } = useAuth();

    const checkConfig = useCallback(async () => {
        setError(null);
        setConfigReady(false);
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const config = Amplify.getConfig();
            console.log('[AuthenticatorWrapper] 检查配置:', config?.Auth);

            if (config?.Auth?.Cognito?.userPoolId) {
                setConfigReady(true);
            } else {
                throw new Error("Cognito user pool is not configured.");
            }
        } catch (err) {
            console.error('[AuthenticatorWrapper] 配置检查失败:', err);
            setError(ensureAppError(err, {
                message: '认证服务配置加载失败，请刷新页面或联系管理员。'
            }));
        }
    }, []);

    useEffect(() => {
        checkConfig();
    }, [checkConfig]);

    if (error) {
        return (
            <div className="py-4">
                <ApiErrorNotice error={error} onRetry={checkConfig} />
            </div>
        );
    }

    if (!configReady) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-600">正在加载认证配置...</p>
            </div>
        );
    }

    return (
        <Authenticator hideSignUp={false}>
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
