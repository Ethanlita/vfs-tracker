/**
 * @file 跨标签页协调 PWA 更新，避免 Service Worker 接管时清空未提交工作。
 * @description 每个正在工作的页面只广播静态工作类型，不传递表单、录音或账号内容。
 * 激活新版本后由发起方广播 `update-activated`，所有标签页（包括不受 Service Worker 控制的页面）
 * 据此刷新到同一版本，避免旧页面继续请求已被删除的旧哈希资源。
 */

const CHANNEL_NAME = 'vfs-pwa-update-coordinator:v1';
const PROBE_WAIT_MS = 350;
const localBlockers = new Map();
const blockerListeners = new Set();
const activationHandlers = new Set();
let channel;

const tabId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 返回当前页面去重后的静态工作说明。 */
const localLabels = () => [...new Set(localBlockers.values())];

/**
 * 建立当前标签页唯一的协调通道，响应其他标签页的安全检查与激活通知。
 * @returns {BroadcastChannel|null} 可用通道；不支持时返回 null 并拒绝应用内更新。
 */
const getChannel = () => {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', event => {
    const message = event.data;
    if (!message || message.source === tabId) return;
    if (message.type === 'probe' && message.requestId) {
      channel.postMessage({
        type: 'state',
        source: tabId,
        requestId: message.requestId,
        labels: localLabels(),
      });
    } else if (message.type === 'update-activated') {
      // 其他标签页已激活新版本：交给更新控制器决定立即刷新还是等本页工作结束。
      for (const handler of activationHandlers) handler();
    }
  });
  return channel;
};

/**
 * 登记或解除当前页面的一项未完成工作。
 * @param {string} blockerId - 当前组件实例的稳定标识。
 * @param {string} label - 可向用户展示的静态工作类型。
 * @param {boolean} active - 是否正在阻止更新。
 * @returns {void}
 */
export const setPwaUpdateBlocker = (blockerId, label, active) => {
  if (active) localBlockers.set(blockerId, label);
  else localBlockers.delete(blockerId);

  const labels = localLabels();
  for (const listener of blockerListeners) listener(labels);

  const activeChannel = getChannel();
  activeChannel?.postMessage({
    type: 'state-change',
    source: tabId,
    labels,
  });
};

/**
 * 读取当前页面仍在进行的工作类型。
 * @returns {string[]} 去重后的静态工作说明；为空表示本页可以安全刷新。
 */
export const getPwaUpdateBlockers = () => localLabels();

/**
 * 订阅当前页面阻塞项的变化。
 * @param {(labels: string[]) => void} listener - 每次登记或解除后收到最新的工作说明。
 * @returns {() => void} 取消订阅函数。
 */
export const subscribePwaUpdateBlockers = listener => {
  blockerListeners.add(listener);
  return () => blockerListeners.delete(listener);
};

/**
 * 监听"其他标签页已激活新版本"的通知，并让本页立即加入协调通道以响应探测。
 * @param {() => void} handler - 收到通知时调用。
 * @returns {() => void} 取消监听函数。
 */
export const onPwaUpdateActivated = handler => {
  getChannel();
  activationHandlers.add(handler);
  return () => activationHandlers.delete(handler);
};

/**
 * 确认所有可通信标签页没有未完成工作后，在同一次协调窗口中激活更新，并通知其他标签页刷新。
 * @param {() => (void|Promise<void>)} activate - 让等待中的 Service Worker 完成激活的函数。
 * @param {{waitMs?: number, requireSoleTab?: boolean}} [options] - `waitMs` 为应答等待时间；
 *   `requireSoleTab` 为 true 时，只要还有其他标签页应答就不激活（用于打开页面时的静默更新）。
 * @returns {Promise<{activated:boolean,labels:string[],reason?:string}>} 激活结果及阻塞原因。
 */
export const activatePwaUpdateSafely = async (activate, { waitMs = PROBE_WAIT_MS, requireSoleTab = false } = {}) => {
  const ownLabels = localLabels();
  if (ownLabels.length) return { activated: false, labels: ownLabels, reason: 'blocked' };

  const activeChannel = getChannel();
  if (!activeChannel) return { activated: false, labels: [], reason: 'unsupported' };

  const requestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const remoteLabels = new Set();
  const peers = new Set();
  const onMessage = event => {
    const message = event.data;
    const isProbeReply = message?.type === 'state' && message.requestId === requestId;
    const isNewBlocker = message?.type === 'state-change';
    if ((!isProbeReply && !isNewBlocker) || message.source === tabId) return;
    // 应答或主动报告状态的都是仍打开着的本站标签页。
    peers.add(message.source);
    for (const label of message.labels || []) remoteLabels.add(label);
  };

  activeChannel.addEventListener('message', onMessage);
  activeChannel.postMessage({ type: 'probe', source: tabId, requestId });
  await new Promise(resolve => setTimeout(resolve, waitMs));

  try {
    // 等待期间本页也可能开始上传或编辑，激活前必须再核对一次。
    const finalLabels = [...new Set([...localLabels(), ...remoteLabels])];
    if (finalLabels.length) return { activated: false, labels: finalLabels, reason: 'blocked' };
    if (requireSoleTab && peers.size) return { activated: false, labels: [], reason: 'peers' };
    await activate();
    // 新版本已激活：通知所有标签页刷新到同一版本（发起方由调用者自行刷新）。
    activeChannel.postMessage({ type: 'update-activated', source: tabId });
    return { activated: true, labels: [] };
  } finally {
    activeChannel.removeEventListener('message', onMessage);
  }
};
