import React from 'react';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useAuth } from '../contexts/AuthContext';
import { isProductionReady as globalIsProductionReady } from '../env.js';
import ICPBadge from './ICPBadge.jsx';
import Header from './Header.jsx';

const Layout = ({ children, AuthComponent, onProfileSetupClick }) => {
    const { isAuthenticated, needsProfileSetup } = useAuth();
    const ready = globalIsProductionReady();

    return (
        <div className="relative min-h-screen text-gray-800 flex flex-col">
            {/* 全屏背景（唯一背景来源） */}
            <div aria-hidden className="app-bg" />

            {/* 用户资料完善提醒横幅 */}
            {isAuthenticated && needsProfileSetup && (
                <ProfileCompletionBanner onSetupClick={onProfileSetupClick} />
            )}

            <Header AuthComponent={AuthComponent} />

            {/* 主内容区域 */}
            <main className="flex-1">
                {children}
            </main>

            <footer className="bg-white shadow-lg mt-12">
                <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 vfs-footer-text">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <p>&copy; 2025 VFS Tracker. 一个开源项目。</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {ready ? (
                                <span className="text-xs text-gray-500 px-2 py-1 bg-green-50 rounded-full border border-green-200">
                                    🟢 生产模式
                                </span>
                            ) : (
                                <span className="text-xs text-orange-600 px-2 py-1 bg-orange-50 rounded-full border border-orange-200">
                                    🟡 开发模式
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <ICPBadge />
            </footer>
        </div>
    );
};

export default Layout;
