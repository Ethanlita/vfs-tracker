/**
 * @file 管理后台读取重试测试
 * @description 验证概览与三类列表在失败后原地恢复，并保留加载更多前已有数据。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../../../src/admin/components/AdminDashboard';
import UserListPage from '../../../src/admin/components/UserListPage';
import EventListPage from '../../../src/admin/components/EventListPage';
import TestListPage from '../../../src/admin/components/TestListPage';

const serviceMocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  searchUsers: vi.fn(),
  searchEvents: vi.fn(),
  searchTests: vi.fn(),
  getUser: vi.fn(),
}));
const clients = { dynamoDB: { synthetic: true } };

vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({ clients }),
}));

vi.mock('../../../src/admin/services/dynamodb', () => ({
  ...serviceMocks,
  EVENT_TYPES: { self_test: '自我测试' },
}));

vi.mock('../../../src/admin/components/UserTable', () => ({
  default: ({ users }) => <div data-testid="user-table">{users.map(user => user.userId).join(',')}</div>,
}));
vi.mock('../../../src/admin/components/UserDetailDrawer', () => ({ default: () => null }));
vi.mock('../../../src/admin/components/EventTable', () => ({
  default: ({ events }) => <div data-testid="event-table">{events.map(event => event.eventId).join(',')}</div>,
}));
vi.mock('../../../src/admin/components/EventDetailModal', () => ({ default: () => null }));
vi.mock('../../../src/admin/components/TestTable', () => ({
  default: ({ tests }) => <div data-testid="test-table">{tests.map(test => test.testId).join(',')}</div>,
}));
vi.mock('../../../src/admin/components/TestDetailModal', () => ({ default: () => null }));

/** 为依赖路由链接或查询参数的管理页面提供内存路由。 */
function renderRoute(component, path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);
}

describe('管理后台读取重试', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach(mock => mock.mockReset());
    serviceMocks.getUser.mockResolvedValue(null);
  });

  it('概览连续失败后可原地再次重试，成功时保留当前路由和内存会话', async () => {
    serviceMocks.getStats
      .mockRejectedValueOnce(new Error('统计暂时失败一'))
      .mockRejectedValueOnce(new Error('统计暂时失败二'))
      .mockResolvedValueOnce({
        users: { total: 7 },
        events: { total: 3, pending: 1, approved: 2, rejected: 0, byType: {} },
        tests: { total: 2, pending: 0, processing: 0, done: 2, failed: 0 },
      });
    renderRoute(<AdminDashboard />);

    expect(await screen.findByText('统计暂时失败一')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('统计暂时失败二')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(serviceMocks.getStats).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('用户总数')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('用户列表初次失败后重试成功会清除错误', async () => {
    serviceMocks.searchUsers
      .mockRejectedValueOnce(new Error('用户读取失败'))
      .mockResolvedValueOnce({ items: [{ userId: 'user-a' }], lastEvaluatedKey: null });
    renderRoute(<UserListPage />, '/admin/users');

    expect(await screen.findByText('用户读取失败')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByTestId('user-table')).toHaveTextContent('user-a');
    expect(screen.queryByText('用户读取失败')).not.toBeInTheDocument();
  });

  it('用户列表加载更多失败保留已有数据，并可只重试下一页', async () => {
    serviceMocks.searchUsers
      .mockResolvedValueOnce({ items: [{ userId: 'user-a' }], lastEvaluatedKey: { userId: 'user-a' } })
      .mockRejectedValueOnce(new Error('下一页用户失败'))
      .mockResolvedValueOnce({ items: [{ userId: 'user-b' }], lastEvaluatedKey: null });
    renderRoute(<UserListPage />, '/admin/users');
    expect(await screen.findByTestId('user-table')).toHaveTextContent('user-a');

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('加载更多失败：下一页用户失败')).toBeInTheDocument();
    expect(screen.getByTestId('user-table')).toHaveTextContent('user-a');
    await userEvent.click(screen.getByRole('button', { name: '重试加载更多' }));

    await waitFor(() => expect(screen.getByTestId('user-table')).toHaveTextContent('user-a,user-b'));
    expect(screen.queryByText('下一页用户失败')).not.toBeInTheDocument();
  });

  it('事件列表失败后恢复，并在下一页失败时保留已有事件', async () => {
    serviceMocks.searchEvents
      .mockRejectedValueOnce(new Error('事件读取失败'))
      .mockResolvedValueOnce({ items: [{ eventId: 'event-a', date: '2026-01-01' }], lastEvaluatedKey: { eventId: 'event-a' } })
      .mockRejectedValueOnce(new Error('下一页事件失败'))
      .mockResolvedValueOnce({ items: [{ eventId: 'event-b', date: '2025-01-01' }], lastEvaluatedKey: null });
    renderRoute(<EventListPage />, '/admin/events');

    expect(await screen.findByText('事件读取失败')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByTestId('event-table')).toHaveTextContent('event-a');
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('加载更多失败：下一页事件失败')).toBeInTheDocument();
    expect(screen.getByTestId('event-table')).toHaveTextContent('event-a');
    await userEvent.click(screen.getByRole('button', { name: '重试加载更多' }));
    await waitFor(() => expect(screen.getByTestId('event-table')).toHaveTextContent('event-a,event-b'));
  });

  it('测试列表失败后恢复，并在下一页失败时保留已有测试', async () => {
    serviceMocks.searchTests
      .mockRejectedValueOnce(new Error('测试读取失败'))
      .mockResolvedValueOnce({ items: [{ testId: 'test-a', createdAt: 2 }], lastEvaluatedKey: { testId: 'test-a' } })
      .mockRejectedValueOnce(new Error('下一页测试失败'))
      .mockResolvedValueOnce({ items: [{ testId: 'test-b', createdAt: 1 }], lastEvaluatedKey: null });
    renderRoute(<TestListPage />, '/admin/tests');

    expect(await screen.findByText('测试读取失败')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByTestId('test-table')).toHaveTextContent('test-a');
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(await screen.findByText('加载更多失败：下一页测试失败')).toBeInTheDocument();
    expect(screen.getByTestId('test-table')).toHaveTextContent('test-a');
    await userEvent.click(screen.getByRole('button', { name: '重试加载更多' }));
    await waitFor(() => expect(screen.getByTestId('test-table')).toHaveTextContent('test-a,test-b'));
  });
});
