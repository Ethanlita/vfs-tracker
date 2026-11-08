/** @file 将实时试听资源生命周期绑定到页面挂载和 PWA 更新协调器。 */
import { useEffect, useState } from 'react';
import { LiveEffectMonitor } from '../audio/liveEffectMonitor.js';
import { usePwaUpdateBlocker } from './usePwaUpdateBlocker.js';

/** 提供实时控制器与最新状态；卸载和切换模式会立即停止采集。 */
export function useLiveEffect() {
  const [controller] = useState(() => new LiveEffectMonitor());
  const [state, setState] = useState(() => controller.getDiagnostics());
  useEffect(() => {
    const update = () => setState(controller.getDiagnostics());
    const events = ['state', 'config', 'stats', 'reference', 'error'];
    events.forEach(type => controller.addEventListener(type, update));
    return () => {
      events.forEach(type => controller.removeEventListener(type, update));
      void controller.stop();
    };
  }, [controller]);
  usePwaUpdateBlocker(state.phase !== 'idle', '实时试听');
  return { controller, state };
}
