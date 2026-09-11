/**
 * @file 管理后台布局交互测试
 * @description 验证移动抽屉的键盘、焦点和背景隔离，以及桌面常驻导航。
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminLayout from '../../../src/admin/components/AdminLayout';

const logout = vi.fn();

vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({
    adminInfo: { arn: 'arn:aws:iam::123456789012:user/test-admin' },
    logout,
  }),
}));

/** 按指定断点渲染布局，避免单元测试依赖真实 CSS 媒体查询。 */
function renderLayout({ desktop = false } = {}) {
  window.matchMedia.mockImplementation(query => ({
    matches: desktop && query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminLayout><button type="button">页面操作</button></AdminLayout>
    </MemoryRouter>
  );
}

describe('AdminLayout 管理侧栏', () => {
  beforeEach(() => {
    logout.mockReset();
  });

  it('移动侧栏关闭时从键盘顺序移除导航，打开后隔离背景并聚焦关闭按钮', async () => {
    renderLayout();
    const opener = screen.getByRole('button', { name: '打开管理菜单' });
    const sidebar = document.querySelector('#admin-sidebar');
    const navigationLinks = [...sidebar.querySelectorAll('a[href]')];

    expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    expect(sidebar).toHaveAttribute('inert');
    expect(navigationLinks.every(link => link.tabIndex === -1)).toBe(true);

    opener.focus();
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'VFS Admin' });
    const closeButton = screen.getByRole('button', { name: '关闭管理菜单' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByText('页面操作').closest('[inert]')).not.toBeNull();
  });

  it('Escape 关闭侧栏并将焦点返回菜单入口', async () => {
    renderLayout();
    const opener = screen.getByRole('button', { name: '打开管理菜单' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'VFS Admin' });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab 在抽屉首尾循环，选择导航后关闭并恢复入口焦点', async () => {
    renderLayout();
    const opener = screen.getByRole('button', { name: '打开管理菜单' });
    await userEvent.click(opener);
    const closeButton = screen.getByRole('button', { name: '关闭管理菜单' });
    const lastLink = screen.getByRole('link', { name: '速率限制' });

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(lastLink).toHaveFocus();
    fireEvent.keyDown(lastLink, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    await userEvent.click(screen.getByRole('link', { name: '用户管理' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('桌面侧栏保持常驻导航语义且不隔离主内容', () => {
    renderLayout({ desktop: true });
    const sidebar = document.querySelector('#admin-sidebar');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sidebar).not.toHaveAttribute('aria-hidden');
    expect(sidebar).not.toHaveAttribute('inert');
    expect(screen.getByRole('link', { name: '用户管理' })).toHaveProperty('tabIndex', 0);
    expect(screen.getByText('页面操作').closest('[inert]')).toBeNull();
  });
});
