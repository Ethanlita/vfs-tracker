/** @file Service Worker 更新提示与安全激活流程。 */
import { useEffect, useState } from 'react';
import { activatePwaUpdateSafely } from '../utils/pwaUpdateCoordinator.js';

/** 在新版本就绪时提示，并在所有活动草稿允许后激活更新。 */
export default function ServiceWorkerUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updateSW, setUpdateSW] = useState(null);
  const [checking, setChecking] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');

  useEffect(() => {
    const handleUpdateAvailable = event => {
      setVisible(true);
      setBlockedMessage('');
      if (event.detail?.updateSW) setUpdateSW(() => event.detail.updateSW);
    };
    window.addEventListener('sw:update-available', handleUpdateAvailable);
    return () => window.removeEventListener('sw:update-available', handleUpdateAvailable);
  }, []);

  if (!visible) return null;

  const handleReload = async () => {
    if (checking) return;
    setChecking(true);
    setBlockedMessage('');
    try {
      const result = await activatePwaUpdateSafely(
        () => updateSW ? updateSW(true) : window.location.reload()
      );
      if (!result.activated) {
        setBlockedMessage(result.reason === 'unsupported'
          ? '当前浏览器无法确认其他标签页是否安全。请关闭本站的其他标签页，再重新打开应用完成更新。'
          : `${result.labels.join('、')}尚未完成。请先在相关标签页保存、完成或放弃这些内容，再重试更新。`);
        setChecking(false);
      }
    } catch {
      setBlockedMessage('更新暂时无法启动，请检查网络后重试。');
      setChecking(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex justify-center">
      <div className="pointer-events-auto mx-4 flex flex-col gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg sm:mx-0 sm:flex-row sm:items-center">
        <div><span>检测到应用有新版本可用。</span>{blockedMessage && <p role="alert" className="mt-1 max-w-xl text-sm text-amber-200">{blockedMessage}</p>}</div>
        <div className="flex justify-end gap-2 sm:justify-start">
          <button type="button" disabled={checking} className="rounded-md bg-white px-3 py-1.5 font-medium text-gray-900 transition hover:bg-gray-100" onClick={handleReload}>{checking ? '正在检查…' : '立即刷新'}</button>
          <button type="button" disabled={checking} className="rounded-md border border-white/40 px-3 py-1.5 text-white transition hover:bg-white/10" onClick={() => setVisible(false)}>稍后提醒</button>
        </div>
      </div>
    </div>
  );
}
