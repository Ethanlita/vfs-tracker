/** @file WORLD 声码器脚本的按需、单次加载入口。 */

const WORLD_SCRIPT_ID = 'vfs-worldjs-runtime';
let activeLoad = null;

/** 判断 Emscripten 运行时是否已经公开本项目需要的 WORLD API。 */
const isReady = windowRef => Boolean(windowRef?.Module?.Dio_JS);

/**
 * 只在效果预览需要时加载 WORLD JavaScript 与其 WASM。
 * 并发调用共用一个 Promise；失败后允许用户沿同一路径重试。
 * @returns {Promise<object>} 已初始化的 Emscripten Module。
 */
export function loadWorldJs() {
  const windowRef = globalThis.window;
  const documentRef = globalThis.document;
  if (isReady(windowRef)) return Promise.resolve(windowRef.Module);
  if (!windowRef || !documentRef) return Promise.reject(new Error('WORLD runtime requires a browser document'));
  if (activeLoad) return activeLoad;

  activeLoad = new Promise((resolve, reject) => {
    const module = windowRef.Module || {};
    const previousReady = module.onRuntimeInitialized;
    let script = documentRef.getElementById(WORLD_SCRIPT_ID);
    let createdScript = false;
    let settled = false;

    /** 完成单次加载并解除 DOM 监听，避免重复发布结果。 */
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
      if (error) {
        activeLoad = null;
        if (createdScript) script?.remove();
        reject(error);
      } else {
        resolve(windowRef.Module);
      }
    };

    const handleLoad = () => {
      if (isReady(windowRef)) finish();
    };
    const handleError = () => finish(new Error('WORLD runtime failed to load'));

    module.onRuntimeInitialized = () => {
      if (typeof previousReady === 'function') previousReady();
      if (isReady(windowRef)) finish();
      else finish(new Error('WORLD runtime initialized without required API'));
    };
    windowRef.Module = module;

    if (!script) {
      script = documentRef.createElement('script');
      script.id = WORLD_SCRIPT_ID;
      script.src = '/WorldJS.js';
      script.async = true;
      createdScript = true;
      documentRef.head.appendChild(script);
    }
    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);
    if (isReady(windowRef)) finish();
  });

  return activeLoad;
}
