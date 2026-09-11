/**
 * @file 管理列表查询代次测试
 * @description 验证旧分页响应不能污染新的筛选、类型或搜索结果。
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EventListPage from '../../../src/admin/components/EventListPage';
import TestListPage from '../../../src/admin/components/TestListPage';

const serviceMocks = vi.hoisted(() => ({
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
  EVENT_TYPES: { self_test: '自测', surgery: 'VFS手术' },
}));
vi.mock('../../../src/admin/components/EventTable', () => ({
  default: ({ events }) => <div>{events.map(event => <div data-testid="event-row" key={event.eventId}>{event.eventId}:{event.status}:{event.type}</div>)}</div>,
}));
vi.mock('../../../src/admin/components/EventDetailModal', () => ({ default: () => null }));
vi.mock('../../../src/admin/components/TestTable', () => ({
  default: ({ tests }) => <div>{tests.map(test => <div data-testid="test-row" key={test.sessionId}>{test.sessionId}:{test.status}</div>)}</div>,
}));
vi.mock('../../../src/admin/components/TestDetailModal', () => ({ default: () => null }));

/** 创建可由测试精确释放的异步响应。 */
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function renderRoute(component, path) {
  return render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);
}

describe('管理列表旧分页响应隔离', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach(mock => mock.mockReset());
    serviceMocks.getUser.mockResolvedValue(null);
  });

  it('事件状态筛选完成后忽略旧的加载更多响应及游标', async () => {
    const oldPage = deferred();
    serviceMocks.searchEvents
      .mockResolvedValueOnce({ items: [{ eventId: 'pending-a', status: 'pending', type: 'self_test', date: '2026-01-01' }], lastEvaluatedKey: { eventId: 'pending-a' } })
      .mockImplementationOnce(() => oldPage.promise)
      .mockResolvedValueOnce({ items: [{ eventId: 'approved-a', status: 'approved', type: 'self_test', date: '2026-01-02' }], lastEvaluatedKey: null });
    renderRoute(<EventListPage />, '/admin/events');
    expect(await screen.findByText(/pending-a/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await userEvent.click(screen.getByRole('button', { name: '已通过' }));
    expect(await screen.findByText(/approved-a/)).toBeInTheDocument();
    await act(async () => oldPage.resolve({ items: [{ eventId: 'pending-old', status: 'pending', type: 'self_test', date: '2025-01-01' }], lastEvaluatedKey: { eventId: 'pending-old' } }));

    expect(screen.queryByText(/pending-old/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
  });

  it('事件类型切换完成后忽略旧分页结果', async () => {
    const oldPage = deferred();
    serviceMocks.searchEvents
      .mockResolvedValueOnce({ items: [{ eventId: 'base-a', status: 'pending', type: 'self_test', date: '2026-01-01' }], lastEvaluatedKey: { eventId: 'base-a' } })
      .mockImplementationOnce(() => oldPage.promise)
      .mockResolvedValueOnce({ items: [{ eventId: 'surgery-a', status: 'approved', type: 'surgery', date: '2026-01-02' }], lastEvaluatedKey: null });
    renderRoute(<EventListPage />, '/admin/events');
    await screen.findByText(/base-a/);

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await userEvent.selectOptions(screen.getByRole('combobox'), 'surgery');
    expect(await screen.findByText(/surgery-a/)).toBeInTheDocument();
    await act(async () => oldPage.resolve({ items: [{ eventId: 'old-type', status: 'pending', type: 'self_test', date: '2025-01-01' }], lastEvaluatedKey: null }));
    expect(screen.queryByText(/old-type/)).not.toBeInTheDocument();
  });

  it('事件搜索完成后忽略旧分页结果', async () => {
    const oldPage = deferred();
    serviceMocks.searchEvents
      .mockResolvedValueOnce({ items: [{ eventId: 'base-a', status: 'pending', type: 'self_test', date: '2026-01-01' }], lastEvaluatedKey: { eventId: 'base-a' } })
      .mockImplementationOnce(() => oldPage.promise)
      .mockResolvedValueOnce({ items: [{ eventId: 'searched-a', status: 'pending', type: 'self_test', date: '2026-01-02' }], lastEvaluatedKey: null });
    renderRoute(<EventListPage />, '/admin/events');
    await screen.findByText(/base-a/);

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await userEvent.type(screen.getByPlaceholderText(/搜索事件 ID/), 'searched');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText(/searched-a/)).toBeInTheDocument();
    await act(async () => oldPage.resolve({ items: [{ eventId: 'old-search', status: 'pending', type: 'self_test', date: '2025-01-01' }], lastEvaluatedKey: null }));
    expect(screen.queryByText(/old-search/)).not.toBeInTheDocument();
  });

  it('测试状态筛选完成后忽略旧的加载更多响应及游标', async () => {
    const oldPage = deferred();
    serviceMocks.searchTests
      .mockResolvedValueOnce({ items: [{ sessionId: 'processing-a', status: 'processing', createdAt: 1 }], lastEvaluatedKey: { sessionId: 'processing-a' } })
      .mockImplementationOnce(() => oldPage.promise)
      .mockResolvedValueOnce({ items: [{ sessionId: 'done-a', status: 'done', createdAt: 2 }], lastEvaluatedKey: null });
    renderRoute(<TestListPage />, '/admin/tests');
    await screen.findByText(/processing-a/);

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await userEvent.click(screen.getByRole('button', { name: '已完成' }));
    expect(await screen.findByText(/done-a/)).toBeInTheDocument();
    await act(async () => oldPage.resolve({ items: [{ sessionId: 'processing-old', status: 'processing', createdAt: 0 }], lastEvaluatedKey: { sessionId: 'processing-old' } }));

    expect(screen.queryByText(/processing-old/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
  });

  it('测试搜索完成后忽略旧分页结果', async () => {
    const oldPage = deferred();
    serviceMocks.searchTests
      .mockResolvedValueOnce({ items: [{ sessionId: 'base-a', status: 'processing', createdAt: 1 }], lastEvaluatedKey: { sessionId: 'base-a' } })
      .mockImplementationOnce(() => oldPage.promise)
      .mockResolvedValueOnce({ items: [{ sessionId: 'searched-a', status: 'done', createdAt: 2 }], lastEvaluatedKey: null });
    renderRoute(<TestListPage />, '/admin/tests');
    await screen.findByText(/base-a/);

    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await userEvent.type(screen.getByPlaceholderText(/搜索 Session ID/), 'searched');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText(/searched-a/)).toBeInTheDocument();
    await act(async () => oldPage.resolve({ items: [{ sessionId: 'old-search', status: 'processing', createdAt: 0 }], lastEvaluatedKey: null }));
    await waitFor(() => expect(screen.queryByText(/old-search/)).not.toBeInTheDocument());
  });
});
