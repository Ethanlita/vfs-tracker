import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 通用异步请求 hook
 * @param {Function} asyncFn 必须返回 Promise 的函数（不接收参数，需通过闭包捕获依赖）
 * @param {Array} deps 依赖数组，变化时自动重新执行
 * @param {Object} options 选项 { immediate=true, preserveValue=false }
 * @returns {{ value:any, error:Error|null, loading:boolean, execute:Function, reset:Function }}
 */
export function useAsync(asyncFn, deps = [], options = {}) {
  const { immediate = true, preserveValue = true } = options;
  const [value, setValue] = useState(undefined);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn; // 始终保持最新闭包
  const abortRef = useRef(false);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!preserveValue) setValue(undefined);
    const currentCallId = Symbol('call');
    abortRef.current = currentCallId; // 用 callId 来判定是否是最后一次执行
    try {
      const result = await fnRef.current();
      // 仅在未被后续调用取代时更新
      if (abortRef.current === currentCallId) {
        setValue(result);
      }
      return result;
    } catch (err) {
      if (abortRef.current === currentCallId) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
      return undefined;
    } finally {
      if (abortRef.current === currentCallId) {
        setLoading(false);
      }
    }
  }, [preserveValue]);

  const reset = useCallback(() => {
    setError(null);
    setValue(undefined);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps); // 只依赖外部传入 deps 触发重跑

  // 卸载安全：阻止后续 setState
  useEffect(() => {
    return () => { abortRef.current = null; };
  }, []);

  return { value, error, loading, execute, reset };
}

