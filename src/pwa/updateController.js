/**
 * @file PWA 版本更新控制器。
 * @description 统一负责 Service Worker 注册、新版本检测、定时检查、静默或手动激活，以及激活后的刷新。
 *
 * 判断"有新版本"只看一个条件：`registration.waiting && registration.active`。
 * 激活后由本控制器自己刷新页面，不依赖 `controllerchange`，因此首访标签页、强制刷新后的页面
 * 等不受 Service Worker 控制的页面也能完成更新。更新状态保存在可订阅的 store 中，
 * 横幅晚挂载也不会错过提示。
 */
import {
  activatePwaUpdateSafely,
  getPwaUpdateBlockers,
  onPwaUpdateActivated,
  subscribePwaUpdateBlockers,
} from '../utils/pwaUpdateCoordinator.js';

/** 页面打开后多长时间内、且用户尚未操作时，发现新版本直接静默更新。 */
export const PRISTINE_WINDOW_MS = 15_000;
/** 页面可见时定时检查新版本的间隔。 */
export const CHECK_INTERVAL_MS = 30 * 60_000;
/** 切回前台时，距上次检查超过该时长才再次检查。 */
export const FOREGROUND_RECHECK_MS = 5 * 60_000;
/** 等待新 Service Worker 激活的最长时间。 */
export const ACTIVATION_TIMEOUT_MS = 10_000;
/** 旧哈希资源加载失败后自动刷新的最小间隔，防止资源确实缺失时循环刷新。 */
export const STALE_CHUNK_RELOAD_GUARD_MS = 60_000;

const STALE_CHUNK_RELOAD_KEY = 'vfs-pwa-stale-chunk-reload-at';
/** 视为"用户已开始使用页面"的交互事件；之后发现的新版本改为横幅提示。 */
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
/** 需要渲染横幅的状态。 */
export const VISIBLE_UPDATE_STATUSES = ['available', 'applying', 'reloadPending'];

/** 面向用户的更新提示文案。 */
export const UPDATE_MESSAGES = {
  unsupported: '当前浏览器无法确认其他标签页是否安全。请关闭本站的其他标签页，再重新打开应用完成更新。',
  failed: '更新未能完成。请检查网络后重试；若仍失败，请关闭本站所有标签页后重新打开。',
  /**
   * @param {string[]} labels - 阻止更新的工作类型。
   * @returns {string} 提示文案。
   */
  blocked: labels => `${labels.join('、')}尚未完成。请先在相关标签页保存、完成或放弃这些内容，再重试更新。`,
};

/**
 * @typedef {Object} PwaUpdateSnapshot
 * @property {'idle'|'available'|'applying'|'dismissed'|'reloadPending'} status - 当前更新状态。
 * @property {boolean} silent - 是否为打开页面时的静默更新（横幅不显示）。
 * @property {string} notice - 需要提示用户的阻塞或失败原因。
 */

/** @type {PwaUpdateSnapshot} */
const INITIAL_SNAPSHOT = Object.freeze({ status: 'idle', silent: false, notice: '' });

/**
 * 创建一个更新控制器；浏览器中使用模块底部的单例，测试中注入替身。
 * @param {Object} deps - 运行环境依赖。
 * @param {ServiceWorkerContainer|undefined} deps.serviceWorker - `navigator.serviceWorker`；不支持时为 undefined。
 * @param {Window} deps.win - 页面 window（事件、定时器、刷新）。
 * @param {Document} deps.doc - 页面 document（加载状态、可见性）。
 * @param {Storage|undefined} deps.storage - 会话存储，用于旧资源刷新防循环。
 * @param {() => number} deps.elapsedSinceLoad - 页面加载后经过的毫秒数。
 * @param {() => number} deps.clock - 当前时间戳（毫秒）。
 * @param {Object} [deps.coordinator] - 跨标签页协调器。
 * @param {string} [deps.swUrl] - Service Worker 脚本地址。
 * @param {string} [deps.scope] - Service Worker 作用域。
 * @returns {{start: () => void, subscribe: (listener: () => void) => () => void, getSnapshot: () => PwaUpdateSnapshot,
 *   applyUpdate: (options?: {silent?: boolean}) => Promise<void>, dismissUpdate: () => void, checkForUpdate: () => Promise<void>}}
 */
export function createPwaUpdateController({
  serviceWorker,
  win,
  doc,
  storage,
  elapsedSinceLoad,
  clock,
  coordinator = { activatePwaUpdateSafely, getPwaUpdateBlockers, onPwaUpdateActivated, subscribePwaUpdateBlockers },
  swUrl = '/sw.js',
  scope = '/',
}) {
  /** @type {PwaUpdateSnapshot} */
  let snapshot = INITIAL_SNAPSHOT;
  const listeners = new Set();
  /** @type {ServiceWorkerRegistration|null} */
  let registration = null;
  let started = false;
  let interacted = false;
  let lastCheckAt = 0;

  /** 合并状态并通知订阅者（横幅）。 */
  const setSnapshot = next => {
    snapshot = Object.freeze({ ...snapshot, ...next });
    for (const listener of listeners) listener();
  };

  /** 刷新当前页面；此时最新的 Service Worker 已激活，导航会由它提供新版本。 */
  const reloadPage = () => win.location.reload();

  /** 页面仍处于"刚打开、用户还没开始操作"的阶段。 */
  const isPristine = () => !interacted && elapsedSinceLoad() <= PRISTINE_WINDOW_MS;

  /**
   * 等待指定 Service Worker 进入 activated。
   * @param {ServiceWorker} worker - 正在激活的 worker。
   * @returns {Promise<void>} 激活后兑现；超时或 worker 失效时拒绝。
   */
  const waitForActivation = worker => new Promise((resolve, reject) => {
    let timer;
    const finish = error => {
      win.clearTimeout(timer);
      worker.removeEventListener('statechange', onStateChange);
      if (error) reject(error);
      else resolve();
    };
    function onStateChange() {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('等待中的 Service Worker 已失效'));
    }
    timer = win.setTimeout(() => finish(new Error('等待 Service Worker 激活超时')), ACTIVATION_TIMEOUT_MS);
    worker.addEventListener('statechange', onStateChange);
    onStateChange();
  });

  /**
   * 确保最新的 Service Worker 已激活：有 waiting 时请求它跳过等待并等到激活；
   * 没有 waiting 说明新版本已由其他标签页激活，无需再做任何事。
   * @returns {Promise<void>}
   */
  const activateNewestWorker = async () => {
    const waiting = registration?.waiting;
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    await waitForActivation(waiting);
  };

  /**
   * 激活新版本并刷新。
   * @param {{silent?: boolean}} [options] - `silent` 为打开页面时的静默更新：只在本页是唯一标签页时进行，
   *   否则退回横幅提示，且不显示阻塞原因。
   * @returns {Promise<void>}
   */
  const applyUpdate = async ({ silent = false } = {}) => {
    if (snapshot.status === 'applying') return;
    setSnapshot({ status: 'applying', silent, notice: '' });
    try {
      const result = await coordinator.activatePwaUpdateSafely(activateNewestWorker, { requireSoleTab: silent });
      if (result.activated) {
        reloadPage();
        return;
      }
      const notice = silent ? '' : result.reason === 'unsupported' ? UPDATE_MESSAGES.unsupported : UPDATE_MESSAGES.blocked(result.labels);
      setSnapshot({ status: 'available', silent: false, notice });
    } catch {
      // 激活超时或 Service Worker 通信失败：恢复按钮并说明原因，允许重试。
      setSnapshot({ status: 'available', silent: false, notice: UPDATE_MESSAGES.failed });
    }
  };

  /** 用户选择"下次打开时更新"：本页不再提示，下次打开时会在无操作阶段静默完成。 */
  const dismissUpdate = () => setSnapshot({ status: 'dismissed', silent: false, notice: '' });

  /** 新版本已安装完毕、正在等待激活。 */
  const handleUpdateReady = () => {
    // 只从空闲状态进入：已在提示、更新中、已延后或等待刷新时，重复的"就绪"不应覆盖当前状态与提示原因。
    if (snapshot.status !== 'idle') return;
    if (isPristine()) {
      void applyUpdate({ silent: true });
      return;
    }
    setSnapshot({ status: 'available', silent: false, notice: '' });
  };

  /** @param {ServiceWorkerRegistration} reg @returns {boolean} 是否存在等待激活的新版本（而非首次安装）。 */
  const isUpdateReady = reg => Boolean(reg.waiting && reg.active);

  /**
   * 监听注册对象上的新版本：注册时已在等待的、注册时正在安装的，以及之后发现并安装完成的。
   * @param {ServiceWorkerRegistration} reg - 当前注册。
   */
  const watchRegistration = reg => {
    /** @param {ServiceWorker} worker - 正在安装的 worker；装完且已有 active 时即为新版本。 */
    const observeInstalling = worker => {
      worker.addEventListener('statechange', () => {
        // 首次安装时没有 active，worker 会直接激活，不需要提示。
        if (worker.state === 'installed' && isUpdateReady(reg)) handleUpdateReady();
      });
    };

    if (isUpdateReady(reg)) handleUpdateReady();
    // 按规范 register() 会排在进行中的安装之后才兑现，但不能依赖所有实现都如此；
    // 注册时已在安装的 worker 不会再触发 updatefound，所以同样需要观察。
    if (reg.installing) observeInstalling(reg.installing);
    reg.addEventListener('updatefound', () => {
      if (reg.installing) observeInstalling(reg.installing);
    });
  };

  /**
   * 请求浏览器检查 sw.js 是否变化；SPA 内跳转不会触发浏览器自己的检查，所以需要主动调用。
   * @returns {Promise<void>}
   */
  const checkForUpdate = async () => {
    if (!registration || registration.installing || win.navigator.onLine === false) return;
    lastCheckAt = clock();
    try {
      await registration.update();
    } catch {
      // 离线或源站暂时不可达：保持当前版本，下一次定时、切回前台或恢复联网时会再检查。
    }
  };

  /** 其他标签页已激活新版本：本页没有未完成工作就立即刷新，否则等工作结束。 */
  const handleUpdateActivatedElsewhere = () => {
    if (coordinator.getPwaUpdateBlockers().length) {
      setSnapshot({ status: 'reloadPending', silent: false, notice: '' });
      return;
    }
    reloadPage();
  };

  /** @param {string[]} labels - 本页最新的未完成工作。 */
  const handleBlockersChange = labels => {
    if (snapshot.status === 'reloadPending' && labels.length === 0) reloadPage();
  };

  /**
   * 部署会删除旧的哈希资源；仍在运行旧代码的页面加载懒加载路由会失败，此时刷新一次取得当前版本。
   * 60 秒内已经刷新过仍失败，说明资源确实缺失，交回原错误路径，避免循环刷新。
   * @param {Event} event - Vite 派发的 `vite:preloadError` 事件。
   */
  const handlePreloadError = event => {
    let lastReloadAt;
    try {
      lastReloadAt = Number(storage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
    } catch {
      return;
    }
    if (clock() - lastReloadAt < STALE_CHUNK_RELOAD_GUARD_MS) return;
    try {
      storage.setItem(STALE_CHUNK_RELOAD_KEY, String(clock()));
    } catch {
      return;
    }
    event.preventDefault();
    reloadPage();
  };

  /** 注册 Service Worker 并启动所有检查触发器。 */
  const register = async () => {
    try {
      registration = await serviceWorker.register(swUrl, { scope });
    } catch {
      // 注册失败（例如浏览器禁用了 Service Worker）：本次会话没有离线与更新能力，页面照常运行。
      return;
    }
    lastCheckAt = clock();
    watchRegistration(registration);
    win.setInterval(() => {
      if (doc.visibilityState === 'visible') void checkForUpdate();
    }, CHECK_INTERVAL_MS);
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible' && clock() - lastCheckAt >= FOREGROUND_RECHECK_MS) void checkForUpdate();
    });
    win.addEventListener('online', () => void checkForUpdate());
  };

  /** 启动控制器；重复调用无效。 */
  const start = () => {
    if (started) return;
    started = true;
    win.addEventListener('vite:preloadError', handlePreloadError);
    if (!serviceWorker) return;

    const markInteracted = () => {
      interacted = true;
      for (const type of INTERACTION_EVENTS) win.removeEventListener(type, markInteracted, true);
    };
    for (const type of INTERACTION_EVENTS) win.addEventListener(type, markInteracted, { capture: true, passive: true });

    coordinator.onPwaUpdateActivated(handleUpdateActivatedElsewhere);
    coordinator.subscribePwaUpdateBlockers(handleBlockersChange);

    // 与 Workbox 的建议一致：首次安装要下载整个预缓存，等页面加载完再注册，不与首屏抢带宽。
    if (doc.readyState === 'complete') void register();
    else win.addEventListener('load', () => void register(), { once: true });
  };

  return {
    start,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    applyUpdate,
    dismissUpdate,
    checkForUpdate,
  };
}

/** 浏览器单例：在模块加载时只保存环境引用，调用 start() 后才开始工作。 */
const browserController = createPwaUpdateController({
  serviceWorker: typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  win: typeof window !== 'undefined' ? window : undefined,
  doc: typeof document !== 'undefined' ? document : undefined,
  storage: (() => {
    try {
      return window.sessionStorage;
    } catch {
      return undefined;
    }
  })(),
  elapsedSinceLoad: () => performance.now(),
  clock: () => Date.now(),
});

/** 启动生产环境的版本更新（只应在 main.jsx 中调用一次）。 */
export const startPwaUpdates = () => browserController.start();
/** 供 useSyncExternalStore 订阅更新状态。 */
export const subscribePwaUpdate = listener => browserController.subscribe(listener);
/** @returns {PwaUpdateSnapshot} 当前更新状态。 */
export const getPwaUpdateSnapshot = () => browserController.getSnapshot();
/** 用户点击"立即刷新"。 */
export const applyPwaUpdate = () => browserController.applyUpdate();
/** 用户点击"下次打开时更新"。 */
export const dismissPwaUpdate = () => browserController.dismissUpdate();
