/**
 * @file 管理用户搜索页面测试
 * @description 验证搜索提交、匹配结果分页、准确数量文案和清除恢复。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserListPage from '../../../src/admin/components/UserListPage.jsx';

const serviceMocks = vi.hoisted(() => ({ searchUsers: vi.fn() }));
const clients = { dynamoDB: { synthetic: true } };

vi.mock('../../../src/admin/contexts/AWSClientContext', () => ({
  useAWSClients: () => ({ clients }),
}));
vi.mock('../../../src/admin/services/dynamodb', () => ({
  searchUsers: serviceMocks.searchUsers,
}));
vi.mock('../../../src/admin/components/UserTable', () => ({
  default: ({ users }) => <div data-testid="user-table">{users.length ? users.map(user => user.userId).join(',') : '暂无用户数据'}</div>,
}));
vi.mock('../../../src/admin/components/UserDetailDrawer', () => ({ default: () => null }));

describe('管理用户搜索页面', () => {
  beforeEach(() => {
    serviceMocks.searchUsers.mockReset();
  });

  it('提交搜索后跨页返回匹配项，并继续分页直到结果结束', async () => {
    serviceMocks.searchUsers.mockImplementation(async (_client, options) => {
      if (!options.query) return { items: [{ userId: 'first-page-user' }], lastEvaluatedKey: { userId: 'plain-next' } };
      if (!options.lastEvaluatedKey) return { items: [{ userId: 'target-user-a' }], lastEvaluatedKey: { userId: 'search-next' } };
      return { items: [{ userId: 'target-user-b' }], lastEvaluatedKey: null };
    });
    render(<MemoryRouter initialEntries={['/admin/users']}><UserListPage /></MemoryRouter>);

    expect(await screen.findByTestId('user-table')).toHaveTextContent('first-page-user');
    expect(screen.getByText('已加载 1 个用户')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('搜索用户名、ID 或邮箱...');
    await userEvent.type(input, 'target-user');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => expect(screen.getByTestId('user-table')).toHaveTextContent('target-user-a'));
    expect(screen.getByText('已加载 1 个匹配用户')).toBeInTheDocument();
    expect(serviceMocks.searchUsers).toHaveBeenLastCalledWith(clients.dynamoDB, expect.objectContaining({ query: 'target-user', lastEvaluatedKey: null }));

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(screen.getByTestId('user-table')).toHaveTextContent('target-user-a,target-user-b'));
    expect(screen.getByText('共找到 2 个用户')).toBeInTheDocument();
    expect(serviceMocks.searchUsers).toHaveBeenLastCalledWith(clients.dynamoDB, expect.objectContaining({ query: 'target-user', lastEvaluatedKey: { userId: 'search-next' } }));
  });

  it('零匹配准确显示完整结果，清除后恢复普通分页', async () => {
    serviceMocks.searchUsers.mockImplementation(async (_client, options) => options.query
      ? { items: [], lastEvaluatedKey: null }
      : { items: [{ userId: 'plain-user' }], lastEvaluatedKey: { userId: 'plain-next' } });
    render(<MemoryRouter initialEntries={['/admin/users']}><UserListPage /></MemoryRouter>);
    await screen.findByText('已加载 1 个用户');

    const input = screen.getByPlaceholderText('搜索用户名、ID 或邮箱...');
    await userEvent.type(input, 'missing');
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByText('共找到 0 个用户')).toBeInTheDocument();
    expect(screen.getByText('暂无用户数据')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(await screen.findByText('已加载 1 个用户')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索用户名、ID 或邮箱...')).toHaveValue('');
    expect(screen.getByTestId('user-table')).toHaveTextContent('plain-user');
    expect(screen.getByRole('button', { name: '加载更多' })).toBeInTheDocument();
  });
});
