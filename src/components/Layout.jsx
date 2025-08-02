import React from 'react';

/**
 * @en The main layout component for the application. It provides a consistent
 * header, footer, and content area for all pages.
 * @zh 应用程序的主要布局组件。它为所有页面提供一致的页眉、页脚和内容区域。
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The main content to be rendered inside the layout.
 * @param {React.ReactNode} props.auth - The authentication component to be rendered in the header.
 * @returns {JSX.Element} The rendered layout component.
 */
const Layout = ({ children, auth }) => {
  return (
    <div className="bg-gray-50 text-gray-800 font-sans">
      {/*
        @en TODO: The original design uses Google Fonts (Inter). This is not accessible in mainland China.
        Replace with a local font or a different font provider. The font can be added in index.html.
        @zh TODO: 最初的设计使用了谷歌字体（Inter）。这在中国大陆无法访问。
        需要替换为本地字体或不同的字体提供商。可以在 index.html 中添加字体。
      */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* @en Site title and link to the homepage. @zh 网站标题及主页链接。 */}
            <div className="flex items-center">
              <a href="/#/" className="text-xl font-bold text-pink-600">
                VoiceFem Tracker
              </a>
            </div>
            {/* @en Container for the authentication component. @zh 用于身份验证组件的容器。 */}
            <div id="auth-container">
              {auth}
            </div>
          </div>
        </nav>
      </header>

      {/* @en Main content area where page-specific components are rendered. @zh 渲染特定页面组件的主要内容区域。 */}
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        {children}
      </main>

      {/* @en Application footer. @zh 应用程序页脚。 */}
      <footer className="bg-white mt-12">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>&copy; 2024 VoiceFem Tracker. An open source project.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
