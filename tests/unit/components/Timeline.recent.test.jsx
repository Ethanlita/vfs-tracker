/** @file 最近活动只展示最近30天，不用旧记录或未来记录填补空态。 */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, it, expect, beforeEach, afterEach } from 'vitest';
import { recentRangeEvents } from '../../../src/test-utils/fixtures/recent-range';
vi.mock('../../../src/api', () => ({ getEventsByUserId: vi.fn(), getEncouragingMessage: vi.fn() }));
vi.mock('../../../src/contexts/AuthContext.jsx', () => ({ useAuth: () => ({ user: { userId: 'range-user' } }) }));
vi.mock('react-chartjs-2', () => ({ Line: () => null }));
vi.mock('../../../src/components/VFSReminderBanner.jsx', () => ({ default: () => null }));
import { getEventsByUserId } from '../../../src/api';
import Timeline from '../../../src/components/Timeline';
let events;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = new Date(2026, 8, 10, 12);
  vi.setSystemTime(now);
  events = recentRangeEvents(now);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });
it('只显示最近30天的两条活动', async () => {
  getEventsByUserId.mockResolvedValue(events);
  render(<Timeline />);
  expect(await screen.findAllByText('进行了自我测试')).toHaveLength(2);
});
it('没有最近活动时不展示旧记录或未来记录', async () => {
  getEventsByUserId.mockResolvedValue([...events.slice(0, 3), ...events.slice(-2)]);
  render(<Timeline />);
  expect(await screen.findByText('暂无最近活动')).toBeInTheDocument();
  expect(screen.queryByText('进行了自我测试')).not.toBeInTheDocument();
});
