/**
 * @file 跨标签页协调 PWA 更新，避免 Service Worker 接管时清空未提交工作。
 * @description 每个正在工作的页面只广播静态工作类型，不传递表单、录音或账号内容。
 */

const CHANNEL_NAME = 'vfs-pwa-update-coordinator:v1';
const PROBE_WAIT_MS = 350;
const localBlockers = new Map();
let channel;

const tabId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 返回当前页面去重后的静态工作说明。 */
const localLabels = () => [...new Set(localBlockers.values())];

/**
 * 建立当前标签页唯一的协调通道并响应其他标签页的安全检查。
 * @returns {BroadcastChannel|null} 可用通道；不支持时返回 null 并拒绝应用内更新。
 */
const getChannel = () => {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener('message', event => {
    const message = event.data;
    if (message?.type !== 'probe' || message.source === tabId || !message.requestId) return;
    channel.postMessage({
      type: 'state',
      source: tabId,
      requestId: message.requestId,
      labels: localLabels(),
    });
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

  const activeChannel = getChannel();
  activeChannel?.postMessage({
    type: 'state-change',
    source: tabId,
    labels: localLabels(),
  });
};

/**
 * 确认所有可通信标签页没有未完成工作后，在同一次协调窗口中激活更新。
 * @param {() => (void|Promise<void>)} activate - 发送 SKIP_WAITING 或执行页面更新的函数。
 * @param {{waitMs?: number}} [options] - 测试或运行时的应答等待配置。
 * @returns {Promise<{activated:boolean,labels:string[],reason?:string}>} 激活结果及阻塞原因。
 */
export const activatePwaUpdateSafely = async (activate, { waitMs = PROBE_WAIT_MS } = {}) => {
  const ownLabels = localLabels();
  if (ownLabels.length) return { activated: false, labels: ownLabels, reason: 'blocked' };

  const activeChannel = getChannel();
  if (!activeChannel) return { activated: false, labels: [], reason: 'unsupported' };

  const requestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const remoteLabels = new Set();
  const onMessage = event => {
    const message = event.data;
    const isProbeReply = message?.type === 'state' && message.requestId === requestId;
    const isNewBlocker = message?.type === 'state-change';
    if ((!isProbeReply && !isNewBlocker) || message.source === tabId) return;
    for (const label of message.labels || []) remoteLabels.add(label);
  };

  activeChannel.addEventListener('message', onMessage);
  activeChannel.postMessage({ type: 'probe', source: tabId, requestId });
  await new Promise(resolve => setTimeout(resolve, waitMs));

  try {
    // 等待期间本页也可能开始上传或编辑，激活前必须再核对一次。
    const finalLabels = [...new Set([...localLabels(), ...remoteLabels])];
    if (finalLabels.length) return { activated: false, labels: finalLabels, reason: 'blocked' };
    await activate();
    return { activated: true, labels: [] };
  } finally {
    activeChannel.removeEventListener('message', onMessage);
  }
};
