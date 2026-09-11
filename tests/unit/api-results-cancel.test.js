/** @file 结果查询取消信号必须传递给Amplify原生操作，不能只忽略响应。 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('aws-amplify/api',()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),del:vi.fn()}));
vi.mock('aws-amplify/auth',()=>({fetchAuthSession:vi.fn()}));
import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getVoiceTestResults } from '../../src/api';
import { getTimeout } from '../../src/utils/timeout';
beforeEach(()=>{vi.resetAllMocks();fetchAuthSession.mockResolvedValue({tokens:{idToken:'synthetic-token'}});});
afterEach(()=>vi.useRealTimers());
describe('结果查询取消',()=>{
 it('取消在途查询调用Amplify.cancel',async()=>{
  let reject;const operation={response:new Promise((_resolve,fail)=>{reject=fail;}),cancel:vi.fn(()=>reject(new Error('cancelled')))};
  get.mockReturnValue(operation);const controller=new AbortController();
  const pending=getVoiceTestResults('one',{signal:controller.signal});
  const assertion=expect(pending).rejects.toThrow('cancelled');
  await vi.waitFor(()=>expect(get).toHaveBeenCalledTimes(1));controller.abort();await assertion;
  expect(operation.cancel).toHaveBeenCalledTimes(1);
 });
 it('已取消的请求不访问API',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(getVoiceTestResults('one',{signal:controller.signal})).rejects.toBeDefined();
  expect(get).not.toHaveBeenCalled();
 });
 it('适配器没有cancel时仍可携带信号完成读取',async()=>{
  const operation={response:Promise.resolve({body:{json:async()=>({status:'done'})}})};
  get.mockReturnValue(operation);const controller=new AbortController();
  await expect(getVoiceTestResults('one',{signal:controller.signal})).resolves.toEqual({status:'done'});
 });
 it('超时同时取消底层请求',async()=>{
  vi.useFakeTimers();let reject;
  const operation={response:new Promise((_resolve,fail)=>{reject=fail;}),cancel:vi.fn(()=>reject(new Error('cancelled')))};
  get.mockReturnValue(operation);const pending=getVoiceTestResults('one');
  const assertion=expect(pending).rejects.toMatchObject({errorCode:'TIMEOUT'});
  await vi.advanceTimersByTimeAsync(getTimeout('/results/one'));await assertion;
  expect(operation.cancel).toHaveBeenCalledTimes(1);
 });
});
