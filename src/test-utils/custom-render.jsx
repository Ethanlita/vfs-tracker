/**
 * @file 自定义 React Testing Library render 函数
 * @description 提供预配置的 render 函数，自动包装必要的 Providers
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { AuthProvider } from '../contexts/AuthContext';

/**
 * 自定义 render 函数，自动包装 Router 和 Auth Providers
 * @param {React.ReactElement} ui - 要渲染的组件
 * @param {Object} options - 渲染选项
 * @param {string} options.route - 初始路由路径
 * @param {string} options.authStatus - 认证状态 ('authenticated' | 'unauthenticated' | 'configuring')
 * @param {Object} options.user - 模拟的用户对象
 * @returns {RenderResult} React Testing Library 的 render 结果
 */
export function renderWithProviders(ui, options = {}) {
  const {
    route = '/',
    authStatus = 'authenticated',
    user = null,
    ...renderOptions
  } = options;

  // 设置初始路由
  if (route !== '/') {
    window.history.pushState({}, 'Test page', route);
  }

  /**
   * 包装所有必要的 Provider
   */
  const AllProviders = ({ children }) => (
    <BrowserRouter>
      <Authenticator.Provider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </Authenticator.Provider>
    </BrowserRouter>
  );

  return {
    ...render(ui, { wrapper: AllProviders, ...renderOptions }),
  };
}

/**
 * 简化版 render，用于不需要 Auth 的组件
 */
export function renderWithRouter(ui, options = {}) {
  const { route = '/', ...renderOptions } = options;

  if (route !== '/') {
    window.history.pushState({}, 'Test page', route);
  }

  const Wrapper = ({ children }) => (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// 重新导出所有 React Testing Library 工具
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

// 导出自定义 render 为默认的 render
export { renderWithProviders as render };
