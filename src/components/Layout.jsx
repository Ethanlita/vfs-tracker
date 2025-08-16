import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PostsDropdown from './PostsDropdown';
import { isProductionReady as globalIsProductionReady } from '../env.js';

const Layout = ({ children, auth }) => {
    const navigate = useNavigate();
    const [isHoveringLogo, setIsHoveringLogo] = useState(false);
    const ready = globalIsProductionReady();

    const handleLogoClick = () => {
        navigate('/');
    };

    return (
        <div className="relative min-h-screen text-gray-800 flex flex-col">
            {/* 全屏背景（唯一背景来源） */}
            <div aria-hidden className="app-bg" />

            <header className="bg-white shadow-lg sticky top-0 z-30 w-full">
                <nav
                    className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center"
                    style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif" }}
                >
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                            <button
                                onClick={handleLogoClick}
                                onMouseEnter={() => setIsHoveringLogo(true)}
                                onMouseLeave={() => setIsHoveringLogo(false)}
                                className="vfs-title-button"
                                style={{
                                    color: isHoveringLogo ? '#be185d' : '#db2777',
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '0',
                                    margin: '0',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    fontWeight: '700',
                                    fontSize: '1.5rem',
                                    lineHeight: '2rem',
                                    cursor: 'pointer',
                                    transition: 'color 0.3s ease'
                                }}
                            >
                                VFS Tracker
                            </button>
                            <div className="ml-6 mr-3">
                                <PostsDropdown />
                            </div>
                        </div>
                        <div id="auth-container" className="mx-3 flex items-center gap-2 sm:gap-3 whitespace-nowrap overflow-hidden">
                            {auth}
                        </div>
                    </div>
                </nav>
            </header>

            {/* 增加顶部留白：原 pt-8 sm:pt-12 lg:pt-16 -> 现在 pt-12 sm:pt-16 lg:pt-20 */}
            <main id="main-content" className="container mx-auto px-4 sm:px-6 lg:px-8 flex-grow pt-12 sm:pt-16 lg:pt-20">
                {children}
            </main>

            <footer className="bg-white shadow-lg mt-12">
                <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 vfs-footer-text">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <p>&copy; 2025 VFS Tracker. 一个开源项目。</p>
                            <p className="text-sm text-gray-600">我们建议您暂时使用电脑访问以获得更好体验</p>
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
            </footer>
        </div>
    );
};

export default Layout;