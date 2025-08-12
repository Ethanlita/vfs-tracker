import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PostsDropdown from './PostsDropdown';

/**
 * @en The layout component that wraps all pages with a header and footer.
 * @zh 包含页头和页脚的全局布局组件。
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The main content.
 * @param {React.ReactNode} props.auth - The auth area content (login / user info).
 * @returns {JSX.Element} The rendered layout component.
 */
const Layout = ({ children, auth }) => {
  const navigate = useNavigate();
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);

  const handleLogoClick = () => {
    navigate('/');
  };
  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col">
      {/*
        @en TODO: The original design uses Google Fonts (Inter). This is not accessible in mainland China.
        Replace with a local font or a different font provider. The font can be added in index.html.
        @zh TODO: 最初的设计使用了谷歌字体（Inter）。这在中国大陆无法访问。
        需要替换为本地字体或不同的字体提供商。可以在 index.html 中添加字体。
      */}
      <header className="bg-white shadow-lg sticky top-0 z-10 w-full">
        <nav 
          className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif" }}
        >
          <div className="flex items-center justify-between w-full">
            {/* @en Site title and link to the homepage. @zh 网站标题及主页链接。 */}
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
              {/* @en Wrapper to enforce spacing. @zh 用于强制设置间距的包装器。 */}
              <div className="ml-6 mr-3">
                <PostsDropdown />
              </div>
            </div>
            {/* @en Container for the authentication component. @zh 用于身份验证组件的容器。 */}
            <div id="auth-container" className="mx-3">
              {auth}
            </div>
          </div>
        </nav>
      </header>

      {/* @en Main content area where page-specific components are rendered. @zh 渲染特定页面组件的主要内容区域。 */}
      <main id="main-content" className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        {children}
      </main>

      {/* @en Application footer. @zh 应用程序页脚。 */}
      <footer className="bg-white shadow-lg mt-12">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 vfs-footer-text">
          <p>&copy; 2025 VFS Tracker. 一个开源项目。</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
