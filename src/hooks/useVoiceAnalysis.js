/** @file 嗓音分析生命周期：串行查询、离线暂停、有限退避与旧请求隔离。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { requestVoiceTestAnalyze, getVoiceTestResults } from '../api';
import { ClientError, ServiceError, ensureAppError } from '../utils/apiError';

const initialState = { status: 'idle', results: null, error: null, failureKind: null, offline: false };
export const ANALYSIS_WAIT_MS = 10 * 60 * 1000;

/** 管理单个会话的分析；结果读取重试不会再次提交分析任务。 */
export function useVoiceAnalysis(sessionId) {
  const [state, setState] = useState(initialState);
  const active = useRef(null);

  /** 取消本地等待和在途查询，不承诺撤回服务端已经收到的分析任务。 */
  const cancel = useCallback(() => {
    const run = active.current;
    active.current = null;
    if (!run) return;
    run.live = false;
    clearTimeout(run.timer);
    clearTimeout(run.deadline);
    run.controller?.abort();
  }, []);

  const reset = useCallback(() => { cancel(); setState(initialState); }, [cancel]);

  /** 每轮操作持有独立身份，迟到响应无法发布到新的操作。 */
  const createRun = useCallback(() => {
    cancel();
    const run = { live: true, inFlight: false, errors: 0, querying: false };
    active.current = run;
    const valid = () => active.current === run && run.live;
    run.finish = (status, error = null, failureKind = null, results = null) => {
      if (!valid()) return;
      run.live = false;
      clearTimeout(run.timer); clearTimeout(run.deadline);
      run.controller?.abort();
      setState({ status, error, failureKind, results, offline: false });
    };
    run.deadline = setTimeout(() => run.finish('failed', new ClientError(
      '等待分析结果已超过10分钟。可以继续查询原任务，或稍后再试。'
    ), 'read'), ANALYSIS_WAIT_MS);
    run.schedule = delay => {
      clearTimeout(run.timer);
      run.timer = null;
      if (!valid() || run.inFlight) return;
      if (!navigator.onLine) {
        setState(previous => ({ ...previous, offline: true }));
        return;
      }
      run.timer = setTimeout(run.poll, delay);
    };
    run.poll = async () => {
      run.timer = null;
      if (!valid() || run.inFlight) return;
      if (!navigator.onLine) { run.schedule(0); return; }
      run.inFlight = true;
      const controller = new AbortController();
      run.controller = controller;
      let delay = 3000;
      try {
        const results = await getVoiceTestResults(sessionId, { signal: controller.signal });
        if (!valid() || controller.signal.aborted) return;
        run.errors = 0;
        if (results.status === 'done') run.finish('done', null, null, results);
        else if (results.status === 'failed') run.finish('failed', new ServiceError('分析任务失败，请确认后重新分析。'), 'task');
      } catch (cause) {
        if (!valid()) return;
        if (controller.signal.aborted) delay = 0;
        else {
          const status = cause.statusCode ?? cause.status;
          if (status === 404 || status === 410) {
            run.finish('failed', new ClientError(
              '原分析会话已过期，无法继续查询。请放弃旧进度并新建测试。'
            ), 'expired');
            return;
          }
          const transient = status == null || status === 429 || status >= 500 || status === 408;
          run.errors += 1;
          if (!transient || run.errors >= 3) run.finish('failed', ensureAppError(cause, {
            message: '暂时无法读取分析结果，请继续查询原任务。', requestMethod: 'GET', requestPath: `/results/${sessionId}`
          }), 'read');
          else delay = Math.min(3000 * (2 ** run.errors), 30000);
        }
      } finally {
        run.inFlight = false;
        if (valid()) run.schedule(delay);
      }
    };
    setState({ ...initialState, status: 'processing', offline: !navigator.onLine });
    return run;
  }, [cancel, sessionId]);

  /** 用户明确生成时只提交一次；结果读取异常由独立查询入口恢复。 */
  const generate = useCallback(async forms => {
    if (!sessionId || active.current?.live) return;
    if (!navigator.onLine) {
      setState({ ...initialState, status: 'failed', failureKind: 'submit', error: new ClientError('当前离线，恢复网络后再发起分析。') });
      return;
    }
    const run = createRun();
    try {
      await requestVoiceTestAnalyze(sessionId, { hasExternal: false }, forms);
      if (active.current !== run || !run.live) return;
      run.querying = true;
      run.schedule(3000);
    } catch (cause) {
      run.finish('failed', ensureAppError(cause, { message: '分析请求未能确认，可以先查询原任务状态。', requestMethod: 'POST', requestPath: '/analyze' }), 'read');
    }
  }, [createRun, sessionId]);

  const retryQuery = useCallback(() => {
    if (!sessionId || active.current?.live) return;
    const run = createRun(); run.querying = true; run.schedule(0);
  }, [createRun, sessionId]);

  useEffect(() => {
    reset();
    const offline = () => {
      const run = active.current;
      if (!run?.live) return;
      clearTimeout(run.timer); run.timer = null;
      run.controller?.abort();
      setState(previous => ({ ...previous, offline: true }));
    };
    const online = () => {
      const run = active.current;
      if (!run?.live) return;
      setState(previous => ({ ...previous, offline: false }));
      if (run.querying) run.schedule(0);
    };
    window.addEventListener('offline', offline); window.addEventListener('online', online);
    return () => { cancel(); window.removeEventListener('offline', offline); window.removeEventListener('online', online); };
  }, [sessionId, reset, cancel]);

  return { ...state, generate, retryQuery, reset, cancel };
}
