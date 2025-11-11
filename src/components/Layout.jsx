import React from 'react';
import ProfileCompletionBanner from './ProfileCompletionBanner';
import { useAuth } from '../contexts/AuthContext';
import ICPBadge from './ICPBadge.jsx';
import Header from './Header.jsx';

const Layout = ({ children, AuthComponent, onProfileSetupClick }) => {
    const { isAuthenticated, needsProfileSetup } = useAuth();

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
                    </div>
                </div>
                <ICPBadge />
            </footer>
        </div>
    );
};

export default Layout;
