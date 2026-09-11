/** @file 分析查询并发、重试语义、离线和生命周期回归。 */
import { act, renderHook, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../../../src/api',()=>({requestVoiceTestAnalyze:vi.fn(),getVoiceTestResults:vi.fn()}));
import { requestVoiceTestAnalyze, getVoiceTestResults } from '../../../src/api';
import { useVoiceAnalysis, ANALYSIS_WAIT_MS } from '../../../src/hooks/useVoiceAnalysis';

/** 显式控制服务器响应顺序，避免依赖真实执行速度。 */
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
beforeEach(()=>{
 vi.useFakeTimers();vi.resetAllMocks();vi.stubGlobal('navigator',{onLine:true});
 requestVoiceTestAnalyze.mockResolvedValue({status:'processing'});
 getVoiceTestResults.mockResolvedValue({status:'processing'});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const tick=ms=>act(async()=>vi.advanceTimersByTimeAsync(ms));

describe('分析结果查询',()=>{
 it('慢请求不重叠，重复生成只提交一次',async()=>{
  const pending=deferred();getVoiceTestResults.mockReturnValueOnce(pending.promise);
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>{result.current.generate({});result.current.generate({});});
  await tick(15000);expect(getVoiceTestResults).toHaveBeenCalledTimes(1);
  await act(async()=>pending.resolve({status:'processing'}));
  await tick(3000);expect(getVoiceTestResults).toHaveBeenCalledTimes(2);
  expect(requestVoiceTestAnalyze).toHaveBeenCalledTimes(1);
 });
 it.each([401,403])('%s读取失败后只重查，不重复分析',async statusCode=>{
  getVoiceTestResults.mockRejectedValueOnce(Object.assign(new Error('读取失败'),{statusCode}));
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>result.current.generate({}));await tick(3000);
  expect(result.current.failureKind).toBe('read');
  getVoiceTestResults.mockResolvedValueOnce({status:'done'});
  act(()=>result.current.retryQuery());await tick(0);
  expect(result.current.status).toBe('done');expect(requestVoiceTestAnalyze).toHaveBeenCalledTimes(1);
 });
 it.each([404,410])('%s表示原分析会话过期，不能再次提交',async statusCode=>{
  getVoiceTestResults.mockRejectedValueOnce(Object.assign(new Error('会话失效'),{statusCode}));
  const {result}=renderHook(()=>useVoiceAnalysis('expired-session'));
  act(()=>result.current.retryQuery());await tick(0);
  expect(result.current.status).toBe('failed');expect(result.current.failureKind).toBe('expired');
  expect(result.current.error.message).toContain('原分析会话已过期');
  expect(requestVoiceTestAnalyze).not.toHaveBeenCalled();
 });
 it.each([429,500])('%s最多连续重试三次并退避',async statusCode=>{
  getVoiceTestResults.mockRejectedValue(Object.assign(new Error('暂不可用'),{statusCode}));
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>result.current.generate({}));await tick(3000);
  await tick(5999);expect(getVoiceTestResults).toHaveBeenCalledTimes(1);
  await tick(1);expect(getVoiceTestResults).toHaveBeenCalledTimes(2);
  await tick(12000);expect(getVoiceTestResults).toHaveBeenCalledTimes(3);
  expect(result.current.status).toBe('failed');await tick(30000);
  expect(getVoiceTestResults).toHaveBeenCalledTimes(3);
 });
 it('离线取消在途查询，联网恢复不重新提交',async()=>{
  let signal;getVoiceTestResults.mockImplementationOnce((_id,options)=>new Promise((_resolve,reject)=>{
   signal=options.signal;signal.addEventListener('abort',()=>reject(signal.reason));
  }));
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>result.current.generate({}));await tick(3000);
  await act(async()=>{navigator.onLine=false;window.dispatchEvent(new Event('offline'));});
  expect(signal.aborted).toBe(true);expect(result.current.offline).toBe(true);
  await tick(30000);expect(getVoiceTestResults).toHaveBeenCalledTimes(1);
  getVoiceTestResults.mockResolvedValueOnce({status:'done'});
  act(()=>{navigator.onLine=true;window.dispatchEvent(new Event('online'));});await tick(0);
  expect(result.current.status).toBe('done');expect(requestVoiceTestAnalyze).toHaveBeenCalledTimes(1);
 });
 it('旧会话响应不能覆盖新会话结果',async()=>{
  const old=deferred();getVoiceTestResults.mockReturnValueOnce(old.promise);
  const {result,rerender}=renderHook(({id})=>useVoiceAnalysis(id),{initialProps:{id:'old'}});
  await act(async()=>result.current.generate({}));await tick(3000);
  const signal=getVoiceTestResults.mock.calls[0][1].signal;
  rerender({id:'new'});expect(signal.aborted).toBe(true);
  getVoiceTestResults.mockResolvedValueOnce({status:'done',marker:'new'});
  await act(async()=>result.current.generate({}));await tick(3000);
  await act(async()=>old.resolve({status:'done',marker:'old'}));
  expect(result.current.results.marker).toBe('new');
 });
 it('卸载后迟到的提交结果不启动查询',async()=>{
  const pending=deferred();requestVoiceTestAnalyze.mockReturnValueOnce(pending.promise);
  const {result,unmount}=renderHook(()=>useVoiceAnalysis('one'));
  act(()=>{result.current.generate({});});unmount();
  await act(async()=>pending.resolve({}));await tick(5000);
  expect(getVoiceTestResults).not.toHaveBeenCalled();
 });
 it('等待上限取消在途请求，显式重试仅查询原任务',async()=>{
  getVoiceTestResults.mockImplementationOnce(()=>new Promise(()=>{}));
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>result.current.generate({}));await tick(ANALYSIS_WAIT_MS);
  expect(result.current.status).toBe('failed');expect(getVoiceTestResults.mock.calls[0][1].signal.aborted).toBe(true);
  act(()=>result.current.retryQuery());await tick(0);
  expect(requestVoiceTestAnalyze).toHaveBeenCalledTimes(1);expect(getVoiceTestResults).toHaveBeenCalledTimes(2);
 });
 it('任务失败区分于读取失败，断网时不提交',async()=>{
  getVoiceTestResults.mockResolvedValueOnce({status:'failed'});
  const {result}=renderHook(()=>useVoiceAnalysis('one'));
  await act(async()=>result.current.generate({}));await tick(3000);expect(result.current.failureKind).toBe('task');
  act(()=>result.current.reset());navigator.onLine=false;
  await act(async()=>result.current.generate({}));expect(result.current.failureKind).toBe('submit');
  expect(requestVoiceTestAnalyze).toHaveBeenCalledTimes(1);
 });
});
