/** @file 统一路由守卫的认证、资料引导与离线行为测试。 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RouteAccessGuard from '../../../src/routes/RouteAccessGuard.jsx';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('../../../src/contexts/AuthContext.jsx', () => ({
  useAuth: mocks.useAuth,
}));

/** 显示测试路由的完整站内地址，验证查询与片段没有丢失。 */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search + location.hash}</output>;
};

const completeSession = {
  authStatus: 'authenticated',
  isAuthenticated: true,
  needsProfileSetup: false,
  profileLoading: false,
  authInitialized: true,
  pendingProfileSetup: null,
};

/** 用真实 React Router 嵌套路由渲染守卫。 */
const renderGuard = (initialEntry, guardProps = {}, auth = completeSession) => {
  mocks.useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<RouteAccessGuard {...guardProps} />}>
          <Route path="/event-manager" element={<p>目标页面</p>} />
        </Route>
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/profile-setup-wizard" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('RouteAccessGuard', () => {
  const originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline);
    else delete navigator.onLine;
  });

  it('认证初始化期间显示状态且不渲染业务页面', () => {
    renderGuard('/event-manager', { requiresAuth: true }, {
      ...completeSession,
      authInitialized: false,
    });

    expect(screen.getByRole('status')).toHaveTextContent('正在验证身份认证状态');
    expect(screen.queryByText('目标页面')).not.toBeInTheDocument();
  });

  it('Amplify 会话已确认但账号仍在恢复时不误跳登录', () => {
    renderGuard('/event-manager', { requiresAuth: true }, {
      ...completeSession,
      isAuthenticated: false,
    });

    expect(screen.getByRole('status')).toHaveTextContent('正在验证身份认证状态');
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });

  it('未登录访问受保护页面时保留完整返回地址', async () => {
    renderGuard('/event-manager?range=recent#today', { requiresAuth: true }, {
      ...completeSession,
      authStatus: 'unauthenticated',
      isAuthenticated: false,
    });

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/login?returnUrl=%2Fevent-manager%3Frange%3Drecent%23today',
    );
  });

  it('资料完整的已登录用户直接进入受保护页面', () => {
    renderGuard('/event-manager', { requiresAuth: true });
    expect(screen.getByText('目标页面')).toBeInTheDocument();
  });

  it('在线且资料不完整时保留原目标并进入资料向导', async () => {
    renderGuard('/event-manager?range=recent#today', { requiresAuth: true }, {
      ...completeSession,
      needsProfileSetup: true,
    });

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/profile-setup-wizard?returnUrl=%2Fevent-manager%3Frange%3Drecent%23today',
    );
  });

  it('声明允许资料不完整的页面时不启动向导', () => {
    renderGuard('/event-manager', { requiresAuth: true, allowIncompleteProfile: true }, {
      ...completeSession,
      needsProfileSetup: true,
    });

    expect(screen.getByText('目标页面')).toBeInTheDocument();
  });

  it('有待同步资料草稿时保留当前页面', () => {
    renderGuard('/event-manager', { requiresAuth: true }, {
      ...completeSession,
      needsProfileSetup: true,
      pendingProfileSetup: { draftId: 'draft-1' },
    });

    expect(screen.getByText('目标页面')).toBeInTheDocument();
  });

  it('离线时不启动向导，恢复联网后用同一规则跳转', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    renderGuard('/event-manager', { requiresAuth: true }, {
      ...completeSession,
      needsProfileSetup: true,
    });
    expect(screen.getByText('目标页面')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profile-setup-wizard?returnUrl=%2Fevent-manager',
      );
    });
  });
});
