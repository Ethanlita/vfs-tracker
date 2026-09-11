import React, { useEffect, useMemo, useState } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserAvatarUrl, getUserDisplayName, generateAvatar } from '../utils/avatar.js';

/**
 * Auth 组件
 *
 * 提供用户认证相关的UI和交互逻辑，包括登录、注册、登出等功能。
 * 使用 AWS Amplify 进行身份验证。
 * @param {{compact?: boolean}} props - 侧栏中使用纵向账户操作，避免受桌面断点影响溢出。
 *
 * @returns {JSX.Element} 认证组件
 */
const Auth = ({ compact = false }) => {
    const navigate = useNavigate();

    // 认证状态检查组件
    return (
        <ProductionAuthStatus
            navigate={navigate}
            compact={compact}
        />
    );
};

// 生产模式下的认证状态组件
const ProductionAuthStatus = ({ navigate, compact }) => {
    // @en Use AuthContext exclusively - it already uses Amplify v6 standard APIs
    // @zh 专门使用 AuthContext - 它已经使用了 Amplify v6 标准 API
    const { user, cognitoUserInfo, refreshCognitoUserInfo, userProfile } = useAuth();
    const { signOut } = useAuthenticator((context) => [context.signOut]);
    const location = useLocation();



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

    // 真实头像返回前使用本地生成图，禁止把空字符串交给 img.src。
    const [avatarUrl, setAvatarUrl] = useState(() => generateAvatar('Guest', 40));

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
                className={`${compact ? 'flex flex-col items-stretch' : 'flex items-center'} gap-2 sm:gap-3 user-menu`}
                data-testid="user-menu"
                role="group"
                aria-label="User menu"
            >
                {!compact && <img
                    src={avatarUrl}
                    alt={getUserDisplayName(completeUser)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-pink-500"
                />}
                {!compact && <span className="font-semibold text-gray-700 hidden sm:block">
                    {getUserDisplayName(completeUser)}
                </span>}
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
            const currentPath = location.pathname + location.search + location.hash;
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

export default Auth;
