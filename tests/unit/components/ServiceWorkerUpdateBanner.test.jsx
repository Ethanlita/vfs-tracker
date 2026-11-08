/**
 * @file 新版本提示横幅测试。
 * @description 横幅只渲染更新控制器的状态；这里用一个最小 store 替身驱动各状态。
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceWorkerUpdateBanner from '../../../src/components/ServiceWorkerUpdateBanner.jsx';

const store = vi.hoisted(() => {
  const initial = { status: 'idle', silent: false, notice: '' };
  let snapshot = initial;
  const listeners = new Set();
  return {
    /** 更新状态并通知订阅者。 */
    set(next) {
      snapshot = { ...snapshot, ...next };
      listeners.forEach(listener => listener());
    },
    reset() {
      snapshot = initial;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => snapshot,
    apply: vi.fn(),
    dismiss: vi.fn(),
  };
});

vi.mock('../../../src/pwa/updateController.js', () => ({
  VISIBLE_UPDATE_STATUSES: ['available', 'applying', 'reloadPending'],
  subscribePwaUpdate: store.subscribe,
  getPwaUpdateSnapshot: store.get,
  applyPwaUpdate: store.apply,
  dismissPwaUpdate: store.dismiss,
}));

describe('ServiceWorkerUpdateBanner', () => {
  beforeEach(() => {
    store.reset();
    store.apply.mockClear();
    store.dismiss.mockClear();
  });

  it('没有新版本时不渲染', () => {
    const { container } = render(<ServiceWorkerUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('横幅晚于更新挂载时仍能显示（状态不会丢）', () => {
    store.set({ status: 'available' });
    render(<ServiceWorkerUpdateBanner />);
    expect(screen.getByText('检测到应用有新版本可用。')).toBeInTheDocument();
  });

  it('出现新版本后显示，点击按钮分别触发更新与延后', async () => {
    const user = userEvent.setup();
    render(<ServiceWorkerUpdateBanner />);

    act(() => store.set({ status: 'available' }));
    await user.click(screen.getByRole('button', { name: '立即刷新' }));
    await user.click(screen.getByRole('button', { name: '下次打开时更新' }));

    expect(store.apply).toHaveBeenCalledTimes(1);
    expect(store.dismiss).toHaveBeenCalledTimes(1);
  });

  it('更新进行中禁用按钮并显示"正在更新…"', () => {
    store.set({ status: 'applying' });
    render(<ServiceWorkerUpdateBanner />);

    expect(screen.getByRole('button', { name: '正在更新…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下次打开时更新' })).toBeDisabled();
  });

  it('显示阻塞或失败原因', () => {
    store.set({ status: 'available', notice: '新增事件表单尚未完成。' });
    render(<ServiceWorkerUpdateBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('新增事件表单尚未完成。');
    expect(screen.getByRole('button', { name: '立即刷新' })).toBeEnabled();
  });

  it('静默更新时不显示横幅', () => {
    store.set({ status: 'applying', silent: true });
    const { container } = render(<ServiceWorkerUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('选择延后后隐藏', () => {
    store.set({ status: 'available' });
    render(<ServiceWorkerUpdateBanner />);

    act(() => store.set({ status: 'dismissed' }));
    expect(screen.queryByText('检测到应用有新版本可用。')).not.toBeInTheDocument();
  });

  it('其他标签页已更新、本页有未完成工作时只提示等待，不提供按钮', () => {
    store.set({ status: 'reloadPending' });
    render(<ServiceWorkerUpdateBanner />);

    expect(screen.getByText(/新版本已在其他标签页启用/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
