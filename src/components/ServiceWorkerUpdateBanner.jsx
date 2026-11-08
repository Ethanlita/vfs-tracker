/** @file 新版本提示横幅：只渲染更新控制器的状态，更新逻辑全部在 src/pwa/updateController.js。 */
import { useSyncExternalStore } from 'react';
import {
  VISIBLE_UPDATE_STATUSES,
  applyPwaUpdate,
  dismissPwaUpdate,
  getPwaUpdateSnapshot,
  subscribePwaUpdate,
} from '../pwa/updateController.js';

/**
 * 在新版本就绪时提示，并展示更新进度、阻塞原因或"其他标签页已更新"的等待状态。
 * 状态来自可订阅的 store，即使横幅晚于更新事件挂载也能正确显示。
 * @returns {JSX.Element|null} 横幅；无需提示或正在静默更新时返回 null。
 */
export default function ServiceWorkerUpdateBanner() {
  const { status, silent, notice } = useSyncExternalStore(subscribePwaUpdate, getPwaUpdateSnapshot, getPwaUpdateSnapshot);

  if (silent || !VISIBLE_UPDATE_STATUSES.includes(status)) return null;

  const applying = status === 'applying';
  // 其他标签页已激活新版本，本页还有未完成工作：不提供按钮，工作结束后由控制器自动刷新。
  const waitingForLocalWork = status === 'reloadPending';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex justify-center">
      <div className="pointer-events-auto mx-4 flex flex-col gap-3 rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg sm:mx-0 sm:flex-row sm:items-center">
        <div>
          <span>
            {waitingForLocalWork
              ? '新版本已在其他标签页启用。完成或保存本页的工作后，本页会自动刷新。'
              : '检测到应用有新版本可用。'}
          </span>
          {notice && <p role="alert" className="mt-1 max-w-xl text-sm text-amber-200">{notice}</p>}
        </div>
        {!waitingForLocalWork && (
          <div className="flex justify-end gap-2 sm:justify-start">
            <button type="button" disabled={applying} className="rounded-md bg-white px-3 py-1.5 font-medium text-gray-900 transition hover:bg-gray-100" onClick={() => void applyPwaUpdate()}>{applying ? '正在更新…' : '立即刷新'}</button>
            <button type="button" disabled={applying} className="rounded-md border border-white/40 px-3 py-1.5 text-white transition hover:bg-white/10" onClick={dismissPwaUpdate}>下次打开时更新</button>
          </div>
        )}
      </div>
    </div>
  );
}
