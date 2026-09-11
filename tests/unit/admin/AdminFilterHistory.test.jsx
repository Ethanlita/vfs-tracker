/**
 * @file 管理列表历史导航测试
 * @description 验证 URL、已应用筛选、搜索草稿和查询结果在前进/后退时保持一致。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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
  default: ({ events }) => <div>{events.map(event => <div key={event.eventId}>{event.eventId}</div>)}</div>,
}));
vi.mock('../../../src/admin/components/EventDetailModal', () => ({ default: () => null }));
vi.mock('../../../src/admin/components/TestTable', () => ({
  default: ({ tests }) => <div>{tests.map(test => <div key={test.sessionId}>{test.sessionId}</div>)}</div>,
}));
vi.mock('../../../src/admin/components/TestDetailModal', () => ({ default: () => null }));

/** 提供真实的内存历史前进、后退入口及当前地址。 */
function HistoryControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <output data-testid="location">{location.pathname}{location.search}</output>
      <button onClick={() => navigate(-1)}>后退</button>
      <button onClick={() => navigate(1)}>前进</button>
    </div>
  );
}

function renderWithHistory(component, path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <HistoryControls />
      {component}
    </MemoryRouter>,
  );
}

describe('管理列表筛选历史', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach(mock => mock.mockReset());
    serviceMocks.getUser.mockResolvedValue(null);
    serviceMocks.searchEvents.mockImplementation(async (_, options) => ({
      items: [{
        eventId: `event-${options.status}-${options.type}-${options.query || 'none'}`,
        status: options.status === 'all' ? 'pending' : options.status,
        type: options.type === 'all' ? 'self_test' : options.type,
        date: '2026-01-01',
      }],
      lastEvaluatedKey: null,
    }));
    serviceMocks.searchTests.mockImplementation(async (_, options) => ({
      items: [{
        sessionId: `test-${options.status}-${options.query || 'none'}`,
        status: options.status === 'all' ? 'pending' : options.status,
        createdAt: 1,
      }],
      lastEvaluatedKey: null,
    }));
  });

  it('事件状态、类型、搜索及复合条件随历史前进后退重新查询', async () => {
    renderWithHistory(<EventListPage />, '/admin/events');
    expect(await screen.findByText('event-all-all-none')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/搜索事件 ID/);
    await userEvent.type(input, 'draft');
    await userEvent.click(screen.getByRole('button', { name: '已通过' }));
    expect(await screen.findByText('event-approved-all-none')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜索事件 ID/)).toHaveValue('draft');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/events?status=approved');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'surgery');
    expect(await screen.findByText('event-approved-surgery-none')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText('event-approved-surgery-draft')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/events?status=approved&type=surgery&q=draft');

    await userEvent.click(screen.getByRole('button', { name: '后退' }));
    expect(await screen.findByText('event-approved-surgery-none')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText(/搜索事件 ID/)).toHaveValue(''));
    expect(screen.getByRole('combobox')).toHaveValue('surgery');

    await userEvent.click(screen.getByRole('button', { name: '后退' }));
    expect(await screen.findByText('event-approved-all-none')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^已通过/ }).className).toContain('bg-green');

    await userEvent.click(screen.getByRole('button', { name: '前进' }));
    expect(await screen.findByText('event-approved-surgery-none')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '前进' }));
    expect(await screen.findByText('event-approved-surgery-draft')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜索事件 ID/)).toHaveValue('draft');
  });

  it('测试状态和搜索随历史前进后退重新查询', async () => {
    renderWithHistory(<TestListPage />, '/admin/tests');
    expect(await screen.findByText('test-all-none')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '已完成' }));
    expect(await screen.findByText('test-done-none')).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/搜索 Session ID/);
    await userEvent.type(input, 'session-a');
    await userEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByText('test-done-session-a')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '后退' }));
    expect(await screen.findByText('test-done-none')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText(/搜索 Session ID/)).toHaveValue(''));
    await userEvent.click(screen.getByRole('button', { name: '后退' }));
    expect(await screen.findByText('test-all-none')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '前进' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/tests?status=done'));
    expect(await screen.findByText('test-done-none')).toBeInTheDocument();
  });
});
