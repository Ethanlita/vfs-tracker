import React from 'react';

/**
 * The main layout component for the application.
 * It provides a consistent header, footer, and content area.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The main content to be rendered inside the layout.
 * @param {React.ReactNode} props.auth - The authentication component to be rendered in the header.
 * @returns {JSX.Element} The rendered layout component.
 */
const Layout = ({ children, auth }) => {
  return (
    <div className="bg-gray-50 text-gray-800 font-sans">
      {/*
        TODO: The original design uses Google Fonts (Inter).
        This is not accessible in mainland China.
        Replace with a local font or a different font provider.
        The font can be added in index.html.
      */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <a href="/#/" className="text-xl font-bold text-pink-600">
                VoiceFem Tracker
              </a>
            </div>
            <div id="auth-container">
              {auth}
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        {children}
      </main>

      <footer className="bg-white mt-12">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>&copy; 2024 VoiceFem Tracker. An open source project.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
