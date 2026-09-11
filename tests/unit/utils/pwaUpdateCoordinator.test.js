/** @file 跨标签页 PWA 更新协调协议测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeBroadcastChannel {
  static responder = null;

  constructor() {
    this.listeners = new Set();
  }

  addEventListener(type, listener) {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type, listener) {
    if (type === 'message') this.listeners.delete(listener);
  }

  postMessage(message) {
    FakeBroadcastChannel.responder?.(message, data => {
      for (const listener of this.listeners) listener({ data });
    });
  }
}

describe('PWA 更新协调器', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeBroadcastChannel.responder = null;
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
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
