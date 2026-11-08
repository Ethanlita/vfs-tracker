/** @file 跨标签页 PWA 更新协调协议测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeBroadcastChannel {
  static responder = null;
  /** 最近创建的通道，用于模拟其他标签页发来的消息。 */
  static last = null;
  /** 本页发出的全部消息。 */
  static sent = [];

  constructor() {
    this.listeners = new Set();
    FakeBroadcastChannel.last = this;
  }

  /** 模拟其他标签页广播一条消息。 */
  deliver(data) {
    for (const listener of this.listeners) listener({ data });
  }

  addEventListener(type, listener) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === 'message') this.listeners.delete(listener);
  }

  postMessage(message) {
    FakeBroadcastChannel.sent.push(message);
    FakeBroadcastChannel.responder?.(message, data => {
      for (const listener of this.listeners) listener({ data });
    });
  }
}

describe('PWA 更新协调器', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeBroadcastChannel.responder = null;
    FakeBroadcastChannel.last = null;
    FakeBroadcastChannel.sent = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  });

  it('激活成功后广播 update-activated，让其他标签页刷新到同一版本', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const activate = vi.fn().mockResolvedValue(undefined);

    await coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 });

    const types = FakeBroadcastChannel.sent.map(message => message.type);
    expect(types).toEqual(['probe', 'update-activated']);
  });

  it('激活失败时不广播 update-activated', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const activate = vi.fn().mockRejectedValue(new Error('timeout'));

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 })).rejects.toThrow('timeout');
    expect(FakeBroadcastChannel.sent.map(message => message.type)).toEqual(['probe']);
  });

  it('静默更新要求唯一标签页：有其他标签页应答时不激活', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    FakeBroadcastChannel.responder = (message, respond) => {
      if (message.type === 'probe') respond({ type: 'state', source: 'other-tab', requestId: message.requestId, labels: [] });
    };
    const activate = vi.fn();

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0, requireSoleTab: true })).resolves.toEqual({
      activated: false,
      labels: [],
      reason: 'peers',
    });
    expect(activate).not.toHaveBeenCalled();
  });

  it('静默更新时没有其他标签页应答则激活', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const activate = vi.fn().mockResolvedValue(undefined);

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0, requireSoleTab: true }))
      .resolves.toEqual({ activated: true, labels: [] });
  });

  it('收到其他标签页的 update-activated 时通知监听者，并在建立监听时就响应探测', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const handler = vi.fn();

    coordinator.onPwaUpdateActivated(handler);
    expect(FakeBroadcastChannel.last).not.toBeNull();

    FakeBroadcastChannel.last.deliver({ type: 'probe', source: 'other-tab', requestId: 'r1' });
    expect(FakeBroadcastChannel.sent).toContainEqual(expect.objectContaining({ type: 'state', requestId: 'r1', labels: [] }));

    FakeBroadcastChannel.last.deliver({ type: 'update-activated', source: 'other-tab' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('阻塞项变化时通知订阅者并可读取当前值', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const listener = vi.fn();
    coordinator.subscribePwaUpdateBlockers(listener);

    coordinator.setPwaUpdateBlocker('rec-1', '录音任务', true);
    expect(listener).toHaveBeenLastCalledWith(['录音任务']);
    expect(coordinator.getPwaUpdateBlockers()).toEqual(['录音任务']);

    coordinator.setPwaUpdateBlocker('rec-1', '录音任务', false);
    expect(listener).toHaveBeenLastCalledWith([]);
    expect(coordinator.getPwaUpdateBlockers()).toEqual([]);
  });

  it('当前标签页有未提交工作时不广播也不激活', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const activate = vi.fn();
    coordinator.setPwaUpdateBlocker('form-one', '新增事件表单', true);

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 })).resolves.toEqual({
      activated: false,
      labels: ['新增事件表单'],
      reason: 'blocked',
    });
    expect(activate).not.toHaveBeenCalled();
  });

  it('另一个标签页报告草稿时阻止激活且只返回静态类型', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    FakeBroadcastChannel.responder = (message, respond) => {
      if (message.type === 'probe') respond({
        type: 'state',
        source: 'other-tab',
        requestId: message.requestId,
        labels: ['个人资料编辑'],
      });
    };
    const activate = vi.fn();

    const result = await coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 });
    expect(result).toEqual({ activated: false, labels: ['个人资料编辑'], reason: 'blocked' });
    expect(activate).not.toHaveBeenCalled();
  });

  it('检查期间新开始的远端上传也会阻止激活', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    FakeBroadcastChannel.responder = (message, respond) => {
      if (message.type === 'probe') respond({
        type: 'state-change',
        source: 'new-tab',
        labels: ['文件上传'],
      });
    };

    const result = await coordinator.activatePwaUpdateSafely(vi.fn(), { waitMs: 0 });
    expect(result).toMatchObject({ activated: false, labels: ['文件上传'] });
  });

  it('所有标签页无阻塞时只激活一次', async () => {
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    FakeBroadcastChannel.responder = (message, respond) => {
      if (message.type === 'probe') respond({
        type: 'state', source: 'idle-tab', requestId: message.requestId, labels: [],
      });
    };
    const activate = vi.fn().mockResolvedValue(undefined);

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 })).resolves.toEqual({
      activated: true,
      labels: [],
    });
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('浏览器不能协调标签页时拒绝应用内激活', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const coordinator = await import('../../../src/utils/pwaUpdateCoordinator.js');
    const activate = vi.fn();

    await expect(coordinator.activatePwaUpdateSafely(activate, { waitMs: 0 })).resolves.toEqual({
      activated: false,
      labels: [],
      reason: 'unsupported',
    });
    expect(activate).not.toHaveBeenCalled();
  });
});
