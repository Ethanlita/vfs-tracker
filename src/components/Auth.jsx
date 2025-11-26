import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { useNavigate, useLocation } from 'react-router-dom';
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

    // 认证状态检查组件
    return (
        <ProductionAuthStatus
            navigate={navigate}
        />
    );
};

// 生产模式下的认证状态组件
const ProductionAuthStatus = ({ navigate }) => {
    // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
    // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
    const { user, cognitoUserInfo, refreshCognitoUserInfo, userProfile } = useAuth();
    const { signOut } = useAuthenticator((context) => [context.signOut]);
    const location = useLocation();

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
        // 跳转到独立的登录页面，并传递当前页面作为 returnUrl
        const handleLogin = () => {
            const currentPath = location.pathname + location.search;
            navigate(`/login?returnUrl=${encodeURIComponent(currentPath)}`);
        };

        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={handleLogin}
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
        <Authenticator 
            hideSignUp={false}
            loginMechanisms={['email', 'username']}
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
