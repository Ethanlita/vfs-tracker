/** @file 测量保存行为：在途/成功防重复，失败可重试，新测量及离开不受旧跳转影响。 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalProfileUser } from '../../../src/test-utils/fixtures/index.js';
const mocks=vi.hoisted(()=>({save:vi.fn(),enqueue:vi.fn(),navigate:vi.fn(),pitch:vi.fn(),guest:false}));
vi.mock('../../../src/api.js',()=>({addEvent:mocks.save}));
vi.mock('../../../src/utils/pendingEvents.js',()=>({enqueuePendingEvent:mocks.enqueue}));
vi.mock('../../../src/contexts/AuthContext.jsx',()=>({useAuth:()=>({user:mocks.guest?null:minimalProfileUser})}));
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.navigate}));
vi.mock('pitchy',()=>({PitchDetector:{forFloat32Array:()=>({inputLength:4,findPitch:mocks.pitch})}}));
vi.mock('recharts',()=>({ResponsiveContainer:({children})=><div>{children}</div>,AreaChart:()=>null,Area:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null}));
import QuickF0Test from '../../../src/components/QuickF0Test.jsx';

beforeEach(()=>{
 mocks.guest=false;vi.useFakeTimers();vi.clearAllMocks();mocks.save.mockResolvedValue({eventId:'created'});mocks.enqueue.mockResolvedValue({queueId:'queued'});
 mocks.pitch.mockReturnValue([220,1]);
 vi.stubGlobal('navigator',{onLine:true,mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:vi.fn()}]})}});
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('AudioContext',class{
  state='running';sampleRate=48000;
  createMediaStreamSource(){return {connect:vi.fn()};}
  createAnalyser(){return {fftSize:4,getFloatTimeDomainData:vi.fn()};}
  close(){this.state='closed';return Promise.resolve();}
 });
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

/** 使用合成音高完成一次真实组件测量流程。 */
async function finishMeasurement(){
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/开始测试|重新测试/})));
 fireEvent.click(screen.getByRole('button',{name:'停止测试'}));
}

describe('QuickF0Test 保存状态',()=>{
 it.each([true,false])('访客在线状态%s可测量，不能保存或创建无归属队列',async online=>{
  mocks.guest=true;navigator.onLine=online;
  render(<QuickF0Test />);await finishMeasurement();
  expect(screen.getByRole('heading',{name:'测试完成'})).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('结果仅保留在本页');
  const save=screen.getByRole('button',{name:'保存结果'});expect(save).toBeDisabled();fireEvent.click(save);
  expect(mocks.save).not.toHaveBeenCalled();expect(mocks.enqueue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/返回/}));expect(mocks.navigate).toHaveBeenCalledWith('/');
 });
 it.each(['stop','unmount'])('等待授权时%s，迟到音轨立即关闭',async action=>{
  let resolve;const stop=vi.fn();
  navigator.mediaDevices.getUserMedia=vi.fn(()=>new Promise(done=>{resolve=done;}));
  const view=render(<QuickF0Test />);
  fireEvent.click(screen.getByRole('button',{name:'开始测试'}));
  if(action==='stop') fireEvent.click(screen.getByRole('button',{name:'停止测试'}));
  else view.unmount();
  await act(async()=>resolve({getTracks:()=>[{stop}]}));
  expect(stop).toHaveBeenCalledTimes(1);expect(mocks.pitch).not.toHaveBeenCalled();
 });

 it.each(['resolve','reject'])('旧授权迟到%s，不影响已启动的新测量',async outcome=>{
  let resolve,reject;const oldStop=vi.fn(),newStop=vi.fn();
  navigator.mediaDevices.getUserMedia=vi.fn()
   .mockImplementationOnce(()=>new Promise((done,fail)=>{resolve=done;reject=fail;}))
   .mockResolvedValueOnce({getTracks:()=>[{stop:newStop}]});
  render(<QuickF0Test />);
  fireEvent.click(screen.getByRole('button',{name:'开始测试'}));
  fireEvent.click(screen.getByRole('button',{name:'停止测试'}));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重新测试'})));
  await act(async()=>outcome==='resolve'?resolve({getTracks:()=>[{stop:oldStop}]}):reject(new Error('旧授权拒绝')));
  expect(newStop).not.toHaveBeenCalled();expect(oldStop).toHaveBeenCalledTimes(outcome==='resolve'?1:0);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'停止测试'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'停止测试'}));
  expect(newStop).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button',{name:'保存结果'})).toBeEnabled();
 });

 it.each([[0,1],[220,.5],[NaN,1],[Infinity,1]])('无有效测量时禁用保存，不生成0Hz结果：%s/%s',async(pitch,clarity)=>{
  mocks.pitch.mockReturnValue([pitch,clarity]);
  render(<QuickF0Test />);await finishMeasurement();
  expect(screen.queryByRole('heading',{name:'测试完成'})).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('未检测到有效基频');
  const save=screen.getByRole('button',{name:'保存结果'});expect(save).toBeDisabled();fireEvent.click(save);
  expect(mocks.save).not.toHaveBeenCalled();expect(mocks.enqueue).not.toHaveBeenCalled();
  mocks.pitch.mockReturnValue([220,1]);await finishMeasurement();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'保存结果'})).toBeEnabled();
 });

 it('离线静音结果不能入队',async()=>{
  navigator.onLine=false;mocks.pitch.mockReturnValue([0,0]);
  render(<QuickF0Test />);await finishMeasurement();
  fireEvent.click(screen.getByRole('button',{name:'保存结果'}));
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'重试保存'})).not.toBeInTheDocument();
 });
 it.each(['online','offline'])('%s成功后不能重复保存',async mode=>{
  navigator.onLine=mode==='online';const operation=mode==='online'?mocks.save:mocks.enqueue;
  render(<QuickF0Test />);await finishMeasurement();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  const saved=screen.getByRole('button',{name:'已保存'});expect(saved).toBeDisabled();
  fireEvent.click(saved);fireEvent.click(saved);expect(operation).toHaveBeenCalledTimes(1);
  await act(async()=>vi.advanceTimersByTime(2000));if(mode==='online') expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/mypage');else expect(mocks.navigate).not.toHaveBeenCalled();
 });

 it.each(['online','offline'])('%s等待期间阻止重复，失败后可重试',async mode=>{
  navigator.onLine=mode==='online';const operation=mode==='online'?mocks.save:mocks.enqueue;
  let reject;operation.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  render(<QuickF0Test />);await finishMeasurement();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  const pending=screen.getByRole('button',{name:'保存中...'});expect(pending).toBeDisabled();fireEvent.click(pending);
  await act(async()=>reject(new Error('模拟保存失败')));
  expect(screen.getByRole('button',{name:'保存结果'})).toBeEnabled();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  expect(operation).toHaveBeenCalledTimes(2);expect(screen.getByRole('button',{name:'已保存'})).toBeDisabled();
 });

 it('成功后重新测量取消旧跳转，相同频率的新测量仍可保存',async()=>{
  render(<QuickF0Test />);await finishMeasurement();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  await finishMeasurement();
  await act(async()=>vi.advanceTimersByTime(2500));expect(mocks.navigate).not.toHaveBeenCalled();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  expect(mocks.save).toHaveBeenCalledTimes(2);
 });

 it('保存成功后离开页面取消延迟跳转',async()=>{
  const view=render(<QuickF0Test />);await finishMeasurement();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  view.unmount();await act(async()=>vi.advanceTimersByTime(2500));expect(mocks.navigate).not.toHaveBeenCalled();
 });

 it('保存等待时离开，迟到成功不创建跳转',async()=>{
  let release;mocks.save.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const view=render(<QuickF0Test />);await finishMeasurement();
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'保存结果'})));
  view.unmount();await act(async()=>release({eventId:'created'}));
  await act(async()=>vi.advanceTimersByTime(2500));expect(mocks.navigate).not.toHaveBeenCalled();
 });
});
