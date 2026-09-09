/** @file 公共明细交互回归：延迟加载、分页、失败重试和过期请求隔离。 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicDashboard from '../../../src/components/PublicDashboard.jsx';
import { dashboardFixture } from '../../../src/test-utils/fixtures/index.js';
import * as api from '../../../src/api.js';

vi.mock('../../../src/api.js', () => ({ getPublicDashboard: vi.fn(), getPublicEventDetails: vi.fn(), getUserPublicProfile: vi.fn() }));
vi.mock('react-chartjs-2', () => ({ Bar: () => null, Line: () => null }));
vi.mock('../../../src/components/EnhancedDataCharts.jsx', () => ({ default: () => null }));
const fixture = dashboardFixture(23);

describe('公共明细分页', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.getPublicDashboard.mockResolvedValue(fixture.light);
    api.getPublicEventDetails.mockImplementation(async (_id, ids) => ids.map(id => fixture.details.find(event => event.eventId === id)));
    api.getUserPublicProfile.mockResolvedValue({ profile: { bio: '公开简介' } });
  });

  it('用户列表先显示 50 行，展开后可访问其余用户', async () => {
    const many = dashboardFixture(51).light.map((event, index) => ({ ...event, userId: `user-${index}`, userName: `用户 ${index}` }));
    api.getPublicDashboard.mockResolvedValue(many);
    render(<PublicDashboard />);
    await screen.findByRole('button', { name: '显示更多用户' });
    expect(screen.getAllByRole('button', { name: '查看档案' })).toHaveLength(50);
    await userEvent.click(screen.getByRole('button', { name: '显示更多用户' }));
    expect(screen.getAllByRole('button', { name: '查看档案' })).toHaveLength(51);
    expect(screen.queryByRole('button', { name: '显示更多用户' })).not.toBeInTheDocument();
  });

  it('首屏不读取明细，打开后每页最多 20 条，翻页保持总计', async () => {
    const user = userEvent.setup();
    render(<PublicDashboard />);
    await screen.findByRole('button', { name: '查看档案' });
    expect(api.getPublicEventDetails).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '查看档案' }));
    await screen.findByText('明细 1');
    expect(api.getPublicEventDetails.mock.calls[0][1]).toHaveLength(20);
    expect(screen.queryByText('明细 21')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('明细 21');
    expect(screen.queryByText('明细 1')).not.toBeInTheDocument();
    expect(api.getPublicEventDetails.mock.calls[1][1]).toHaveLength(3);
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
    expect(within(screen.getByRole('dialog')).getByText('23')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭用户资料' }));
    await user.click(screen.getByRole('button', { name: '查看档案' }));
    await screen.findByText('明细 1');
  });

  it('明细失败可独立重试，不重新扫描首屏', async () => {
    const user = userEvent.setup();
    api.getPublicEventDetails.mockRejectedValueOnce(new Error('服务暂不可用'));
    render(<PublicDashboard />);
    await user.click(await screen.findByRole('button', { name: '查看档案' }));
    const retry = await screen.findByRole('button', { name: /重试/ });
    await user.click(retry);
    await screen.findByText('明细 1');
    expect(api.getPublicDashboard).toHaveBeenCalledTimes(1);
  });

  it('关掉用户甲后打开乙，迟到的明细和资料不能覆盖乙', async () => {
    const user = userEvent.setup();
    let resolveDetails;
    let resolveProfile;
    api.getPublicDashboard.mockResolvedValue([...fixture.light, { ...fixture.light[0], userId: 'user2', userName: '用户2' }]);
    api.getPublicEventDetails.mockImplementation(id => id === 'user1'
      ? new Promise(resolve => { resolveDetails = resolve; }) : Promise.resolve([]));
    api.getUserPublicProfile.mockImplementation(id => id === 'user1'
      ? new Promise(resolve => { resolveProfile = resolve; }) : Promise.resolve({ profile: { bio: '乙的简介' } }));
    render(<PublicDashboard />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: '查看档案' })).toHaveLength(2));
    await user.click(screen.getAllByRole('button', { name: '查看档案' })[0]);
    await user.click(screen.getByRole('button', { name: '关闭用户资料' }));
    await user.click(screen.getAllByRole('button', { name: '查看档案' })[1]);
    await screen.findByText('乙的简介');
    await act(async () => { resolveDetails(fixture.details); resolveProfile({ profile: { bio: '甲的简介' } }); });
    expect(screen.queryByText('甲的简介')).not.toBeInTheDocument();
    expect(screen.queryByText('明细 1')).not.toBeInTheDocument();
    expect(screen.getByText('乙的简介')).toBeInTheDocument();
  });

  it('空的明细页说明公开状态可能已变化', async () => {
    api.getPublicEventDetails.mockResolvedValue([]);
    render(<PublicDashboard />);
    await userEvent.click(await screen.findByRole('button', { name: '查看档案' }));
    expect(await screen.findByText(/部分记录可能已撤回公开/)).toBeInTheDocument();
  });
});
