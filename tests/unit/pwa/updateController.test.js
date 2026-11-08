/**
 * @file PWA 版本更新控制器测试。
 * @description 用 Service Worker、window、document 与跨标签页协调器的替身，验证检测、静默/手动激活、
 * 激活后刷新、定时检查与旧哈希资源恢复。真实浏览器中的 A→B 更新见 tests/e2e-production/pwa-update.spec.js。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVATION_TIMEOUT_MS,
  CHECK_INTERVAL_MS,
  FOREGROUND_RECHECK_MS,
  PRISTINE_WINDOW_MS,
  UPDATE_MESSAGES,
  createPwaUpdateController,
} from '../../../src/pwa/updateController.js';

/** 可切换状态的 Service Worker 替身。 */
class FakeWorker extends EventTarget {
  constructor(state = 'installed') {
    super();
    this.state = state;
    this.postMessage = vi.fn();
  }

  /** 切换状态并派发 statechange。 */
  setState(state) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

/** ServiceWorkerRegistration 替身。 */
class FakeRegistration extends EventTarget {
  constructor({ active = null, waiting = null } = {}) {
    super();
    this.active = active;
    this.waiting = waiting;
    this.installing = null;
    this.update = vi.fn().mockResolvedValue(undefined);
  }
}

/** 让挂起的 Promise 回调全部执行。 */
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

/**
 * 组装一个控制器及其全部替身。
 * @param {Object} [options] - 注册对象、已加载时长与协调器覆盖。
 */
function setup({ registration = new FakeRegistration({ active: new FakeWorker('activated') }), elapsed = 1000, coordinator = {} } = {}) {
  const win = new EventTarget();
  win.location = { reload: vi.fn() };
  win.navigator = { onLine: true };
  win.setTimeout = (...args) => setTimeout(...args);
  win.clearTimeout = id => clearTimeout(id);
  win.setInterval = (...args) => setInterval(...args);

  const doc = new EventTarget();
  doc.readyState = 'complete';
  doc.visibilityState = 'visible';

  const serviceWorker = { register: vi.fn().mockResolvedValue(registration) };
  const activationHandlers = [];
  const blockerListeners = [];
  let blockers = [];
  const fakeCoordinator = {
    activatePwaUpdateSafely: vi.fn(async activate => {
      await activate();
      return { activated: true, labels: [] };
    }),
    getPwaUpdateBlockers: () => blockers,
    onPwaUpdateActivated: handler => activationHandlers.push(handler),
    subscribePwaUpdateBlockers: listener => blockerListeners.push(listener),
    ...coordinator,
  };
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };

  let elapsedMs = elapsed;
  let now = 1_000_000;
  const controller = createPwaUpdateController({
    serviceWorker,
    win,
    doc,
    storage,
    elapsedSinceLoad: () => elapsedMs,
    clock: () => now,
    coordinator: fakeCoordinator,
  });

  return {
    controller,
    win,
    doc,
    registration,
    serviceWorker,
    coordinator: fakeCoordinator,
    setElapsed: value => { elapsedMs = value; },
    advanceClock: ms => { now += ms; },
    emitActivatedElsewhere: () => activationHandlers.forEach(handler => handler()),
    setBlockers: labels => {
      blockers = labels;
      blockerListeners.forEach(listener => listener(labels));
    },
  };
}

/** 构造"已有 active、另有 waiting"的注册对象。 */
const registrationWithWaiting = () => new FakeRegistration({ active: new FakeWorker('activated'), waiting: new FakeWorker('installed') });

/** 模拟运行中发现并安装完成一个新版本。 */
function installUpdate(registration) {
  const worker = new FakeWorker('installing');
  registration.installing = worker;
  registration.dispatchEvent(new Event('updatefound'));
  registration.installing = null;
  registration.waiting = worker;
  worker.setState('installed');
  return worker;
}

describe('PWA 版本更新控制器', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('检测与静默更新', () => {
    it('打开页面后无操作时发现等待中的新版本：静默激活并刷新，不显示横幅', async () => {
      const ctx = setup({ registration: registrationWithWaiting() });
      const waiting = ctx.registration.waiting;

      ctx.controller.start();
      await settle();

      expect(ctx.coordinator.activatePwaUpdateSafely).toHaveBeenCalledWith(expect.any(Function), { requireSoleTab: true });
      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(ctx.controller.getSnapshot()).toMatchObject({ status: 'applying', silent: true });
      expect(ctx.win.location.reload).not.toHaveBeenCalled();

      waiting.setState('activated');
      await settle();
      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });

    it('用户已经操作过页面后发现新版本：显示横幅，不自动激活', async () => {
      const ctx = setup({ registration: registrationWithWaiting() });

      ctx.controller.start();
      ctx.win.dispatchEvent(new Event('pointerdown'));
      await settle();

      expect(ctx.controller.getSnapshot()).toEqual({ status: 'available', silent: false, notice: '' });
      expect(ctx.coordinator.activatePwaUpdateSafely).not.toHaveBeenCalled();
    });

    it('页面打开超过静默窗口后发现新版本：显示横幅', async () => {
      const ctx = setup({ elapsed: PRISTINE_WINDOW_MS + 1 });
      ctx.controller.start();
      await settle();

      installUpdate(ctx.registration);

      expect(ctx.controller.getSnapshot().status).toBe('available');
      expect(ctx.coordinator.activatePwaUpdateSafely).not.toHaveBeenCalled();
    });

    it('首次安装（还没有 active）不提示更新', async () => {
      const ctx = setup({ registration: new FakeRegistration() });
      ctx.controller.start();
      await settle();

      installUpdate(ctx.registration);

      expect(ctx.controller.getSnapshot().status).toBe('idle');
    });

    it('静默更新时还有其他标签页：退回横幅，不显示阻塞原因', async () => {
      const ctx = setup({
        registration: registrationWithWaiting(),
        coordinator: { activatePwaUpdateSafely: vi.fn().mockResolvedValue({ activated: false, labels: [], reason: 'peers' }) },
      });

      ctx.controller.start();
      await settle();

      expect(ctx.controller.getSnapshot()).toEqual({ status: 'available', silent: false, notice: '' });
      expect(ctx.win.location.reload).not.toHaveBeenCalled();
    });

    it('注册失败时保持空闲且不抛错', async () => {
      const ctx = setup();
      ctx.serviceWorker.register.mockRejectedValueOnce(new Error('denied'));

      ctx.controller.start();
      await settle();

      expect(ctx.controller.getSnapshot().status).toBe('idle');
    });

    it('重复调用 start 只注册一次', async () => {
      const ctx = setup();
      ctx.controller.start();
      ctx.controller.start();
      await settle();

      expect(ctx.serviceWorker.register).toHaveBeenCalledTimes(1);
      expect(ctx.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    });
  });

  describe('手动更新', () => {
    /** 启动一个已经显示横幅的控制器。 */
    async function withBanner(coordinator) {
      const ctx = setup({ registration: registrationWithWaiting(), elapsed: PRISTINE_WINDOW_MS + 1, coordinator });
      ctx.controller.start();
      await settle();
      expect(ctx.controller.getSnapshot().status).toBe('available');
      return ctx;
    }

    it('点击后等新版本激活再刷新', async () => {
      const ctx = await withBanner();
      const waiting = ctx.registration.waiting;

      const pending = ctx.controller.applyUpdate();
      await settle();
      expect(ctx.coordinator.activatePwaUpdateSafely).toHaveBeenCalledWith(expect.any(Function), { requireSoleTab: false });
      expect(ctx.controller.getSnapshot()).toMatchObject({ status: 'applying', silent: false });

      waiting.setState('activated');
      await pending;
      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });

    it('新版本已由其他标签页激活（没有 waiting）时直接刷新', async () => {
      const ctx = await withBanner();
      ctx.registration.waiting = null;

      await ctx.controller.applyUpdate();

      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });

    it('其他标签页有未完成工作时保留新版本并说明原因', async () => {
      const ctx = await withBanner({
        activatePwaUpdateSafely: vi.fn().mockResolvedValue({ activated: false, labels: ['新增事件表单'], reason: 'blocked' }),
      });

      await ctx.controller.applyUpdate();

      expect(ctx.controller.getSnapshot()).toEqual({
        status: 'available',
        silent: false,
        notice: UPDATE_MESSAGES.blocked(['新增事件表单']),
      });
      expect(ctx.win.location.reload).not.toHaveBeenCalled();
    });

    it('浏览器不支持标签页协调时提示关闭其他标签页', async () => {
      const ctx = await withBanner({
        activatePwaUpdateSafely: vi.fn().mockResolvedValue({ activated: false, labels: [], reason: 'unsupported' }),
      });

      await ctx.controller.applyUpdate();

      expect(ctx.controller.getSnapshot().notice).toBe(UPDATE_MESSAGES.unsupported);
    });

    it('新版本迟迟未激活时超时报错并恢复按钮，不会一直停在更新中', async () => {
      const ctx = await withBanner();

      const pending = ctx.controller.applyUpdate();
      await settle();
      await vi.advanceTimersByTimeAsync(ACTIVATION_TIMEOUT_MS);
      await pending;

      expect(ctx.controller.getSnapshot()).toEqual({ status: 'available', silent: false, notice: UPDATE_MESSAGES.failed });
      expect(ctx.win.location.reload).not.toHaveBeenCalled();
    });

    it('等待中的版本失效时报错并允许重试', async () => {
      const ctx = await withBanner();
      const waiting = ctx.registration.waiting;

      const pending = ctx.controller.applyUpdate();
      await settle();
      waiting.setState('redundant');
      await pending;

      expect(ctx.controller.getSnapshot().notice).toBe(UPDATE_MESSAGES.failed);
    });

    it('选择"下次打开时更新"后，本页不再因新版本弹出横幅', async () => {
      const ctx = await withBanner();

      ctx.controller.dismissUpdate();
      installUpdate(ctx.registration);

      expect(ctx.controller.getSnapshot().status).toBe('dismissed');
    });

    it('更新进行中重复点击不会再次激活', async () => {
      const ctx = await withBanner();

      void ctx.controller.applyUpdate();
      void ctx.controller.applyUpdate();
      await settle();

      expect(ctx.coordinator.activatePwaUpdateSafely).toHaveBeenCalledTimes(1);
    });
  });

  describe('其他标签页激活新版本后', () => {
    it('本页没有未完成工作时立即刷新', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();

      ctx.emitActivatedElsewhere();

      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });

    it('本页有未完成工作时等待，工作结束后自动刷新', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();
      ctx.setBlockers(['录音任务']);

      ctx.emitActivatedElsewhere();
      expect(ctx.controller.getSnapshot().status).toBe('reloadPending');
      expect(ctx.win.location.reload).not.toHaveBeenCalled();

      ctx.setBlockers([]);
      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('主动检查新版本', () => {
    it('页面可见时每 30 分钟检查一次，隐藏时跳过', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();

      await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
      expect(ctx.registration.update).toHaveBeenCalledTimes(1);

      ctx.doc.visibilityState = 'hidden';
      await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
      expect(ctx.registration.update).toHaveBeenCalledTimes(1);
    });

    it('切回前台时距上次检查超过 5 分钟才检查', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();

      ctx.advanceClock(60_000);
      ctx.doc.dispatchEvent(new Event('visibilitychange'));
      expect(ctx.registration.update).not.toHaveBeenCalled();

      ctx.advanceClock(FOREGROUND_RECHECK_MS);
      ctx.doc.dispatchEvent(new Event('visibilitychange'));
      expect(ctx.registration.update).toHaveBeenCalledTimes(1);
    });

    it('恢复联网时检查；正在安装或离线时不重复检查', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();

      ctx.win.dispatchEvent(new Event('online'));
      expect(ctx.registration.update).toHaveBeenCalledTimes(1);

      ctx.registration.installing = new FakeWorker('installing');
      await ctx.controller.checkForUpdate();
      ctx.registration.installing = null;
      ctx.win.navigator.onLine = false;
      await ctx.controller.checkForUpdate();
      expect(ctx.registration.update).toHaveBeenCalledTimes(1);
    });

    it('检查失败（如离线）时不抛错，状态不变', async () => {
      const ctx = setup();
      ctx.controller.start();
      await settle();
      ctx.registration.update.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(ctx.controller.checkForUpdate()).resolves.toBeUndefined();
      expect(ctx.controller.getSnapshot().status).toBe('idle');
    });
  });

  describe('旧哈希资源加载失败', () => {
    /** 派发一次可取消的 vite:preloadError。 */
    const firePreloadError = win => {
      const event = new Event('vite:preloadError', { cancelable: true });
      win.dispatchEvent(event);
      return event;
    };

    it('首次失败时刷新并阻止原错误；60 秒内再次失败不再刷新', async () => {
      const ctx = setup();
      ctx.controller.start();

      const first = firePreloadError(ctx.win);
      expect(first.defaultPrevented).toBe(true);
      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);

      ctx.advanceClock(10_000);
      const second = firePreloadError(ctx.win);
      expect(second.defaultPrevented).toBe(false);
      expect(ctx.win.location.reload).toHaveBeenCalledTimes(1);
    });
  });
});
