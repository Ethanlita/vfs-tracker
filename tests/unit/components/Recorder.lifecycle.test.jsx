/** @file 录音生命周期回归：授权取消、卸载、处理期间重入与资源释放。 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Recorder from '../../../src/components/Recorder.jsx';
import { Blob as NodeBlob } from 'node:buffer';

let recorders, contexts, getUserMedia, complete;
/** 创建具有可验证释放行为的音轨替身。 */
function stream() { const stop=vi.fn();return {getTracks:()=>[{stop}],stop}; }
/** 创建可独立控制完成顺序的异步请求。 */
function deferred(){let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};}
beforeEach(()=>{
 recorders=[];contexts=[];complete=vi.fn();
 vi.stubGlobal('Blob',NodeBlob);
 getUserMedia=vi.fn().mockResolvedValue(stream());
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.stubGlobal('alert',vi.fn());
 vi.stubGlobal('AudioContext',class{
  constructor(){contexts.push(this);}
  close=vi.fn().mockResolvedValue();
  async decodeAudioData(){return {duration:1,length:4,sampleRate:48000,numberOfChannels:1,getChannelData:()=>new Float32Array(4)};}
  createMediaStreamSource(){return {connect:vi.fn()};}
  createAnalyser(){return {getByteTimeDomainData:data=>data.fill(128)};}
 });
 vi.stubGlobal('OfflineAudioContext',class{
  createBuffer(){return {copyToChannel:vi.fn()};}
  createBufferSource(){return {connect:vi.fn(),start:vi.fn()};}
  async startRendering(){return {getChannelData:()=>new Float32Array(4)};}
 });
 vi.stubGlobal('MediaRecorder',class{
  static isTypeSupported(){return true;}
  constructor(){recorders.push(this);}
  state='inactive';mimeType='audio/wav';
  start(){this.state='recording';}
  stop(){this.state='inactive';}
  pause(){this.state='paused';}
  resume(){this.state='recording';}
 });
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('Recorder 请求和资源归属',()=>{
 it.each(['retry','discard','leave'])('转换失败后%s保留正确行为且不重复提交',async action=>{
  const later=deferred();let calls=0;
  AudioContext.prototype.decodeAudioData=vi.fn(async()=>{
   calls++;if(calls===1)throw new Error('首次解码失败');return later.promise;
  });
  const discarded=vi.fn();const view=render(<Recorder onRecordingComplete={complete} onDiscardRecording={discarded}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  act(()=>recorders[0].ondataavailable({data:new Blob(['retained-audio'])}));
  fireEvent.click(screen.getByRole('button',{name:'停止录音且继续'}));
  await act(async()=>recorders[0].onstop());
  expect(complete).not.toHaveBeenCalled();
  if(action==='discard'){
   fireEvent.click(screen.getByRole('button',{name:'放弃此段录音'}));
   expect(discarded).toHaveBeenCalledTimes(1);expect(screen.queryByRole('alert')).not.toBeInTheDocument();
   expect(screen.getByRole('button',{name:'开始录音'})).toBeEnabled();return;
  }
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'重试转换'})));
  expect(screen.getByRole('button',{name:'正在处理录音...'})).toBeDisabled();
  expect(screen.queryByRole('button',{name:'重试转换'})).not.toBeInTheDocument();
  expect(getUserMedia).toHaveBeenCalledTimes(1);expect(calls).toBe(2);
  if(action==='leave')view.unmount();
  await act(async()=>later.resolve({duration:1,length:4,sampleRate:48000,numberOfChannels:1,getChannelData:()=>new Float32Array(4)}));
  expect(complete).toHaveBeenCalledTimes(action==='leave'?0:1);
 });
 it.each([15,60])('%s秒上限只累计录音时间，连续暂停恢复后按上限停止',async limit=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval','performance']});
  render(<Recorder onRecordingComplete={complete} maxDurationSec={limit}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  act(()=>vi.advanceTimersByTime(1000));
  fireEvent.click(screen.getByRole('button',{name:'暂停'}));
  expect(screen.getByText('已录制 1.0s')).toBeInTheDocument();
  expect(screen.getByText('录音已暂停。')).toBeInTheDocument();
  expect(screen.queryByText('正在录音...')).not.toBeInTheDocument();
  act(()=>vi.advanceTimersByTime((limit+5)*1000));
  expect(screen.getByText('已录制 1.0s')).toBeInTheDocument();expect(recorders[0].state).toBe('paused');
  fireEvent.click(screen.getByRole('button',{name:'继续录音'}));
  act(()=>vi.advanceTimersByTime(1000));fireEvent.click(screen.getByRole('button',{name:'暂停'}));
  act(()=>vi.advanceTimersByTime(5000));expect(screen.getByText('已录制 2.0s')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'继续录音'}));
  act(()=>vi.advanceTimersByTime((limit-2)*1000));
  expect(recorders[0].state).toBe('inactive');
  expect(screen.getByRole('button',{name:'正在处理录音...'})).toBeDisabled();
 });
 it('授权等待禁止重复点击；取消后迟到音轨释放',async()=>{
  const pending=deferred(),old=stream();getUserMedia.mockReturnValueOnce(pending.promise);
  render(<Recorder onRecordingComplete={complete}/>);
  fireEvent.click(screen.getByRole('button',{name:'开始录音'}));
  const waiting=screen.getByRole('button',{name:'等待麦克风授权...'});
  expect(waiting).toBeDisabled();fireEvent.click(waiting);expect(getUserMedia).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'取消授权等待'}));
  await act(async()=>pending.resolve(old));
  expect(old.stop).toHaveBeenCalledTimes(1);expect(recorders).toHaveLength(0);
  expect(screen.getByRole('button',{name:'开始录音'})).toBeEnabled();
 });
 it.each(['resolve','reject'])('新录音开始后，旧授权%s不影响新音轨',async outcome=>{
  const pending=deferred(),old=stream(),current=stream();
  getUserMedia.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(current);
  render(<Recorder onRecordingComplete={complete}/>);
  fireEvent.click(screen.getByRole('button',{name:'开始录音'}));
  fireEvent.click(screen.getByRole('button',{name:'取消授权等待'}));
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  await act(async()=>outcome==='resolve'?pending.resolve(old):pending.reject(new Error('过期授权')));
  expect(current.stop).not.toHaveBeenCalled();expect(recorders).toHaveLength(1);
  expect(screen.getByRole('button',{name:'停止录音且继续'})).toBeEnabled();
  expect(alert).not.toHaveBeenCalled();
 });
 it('卸载后授权成功不创建录音器',async()=>{
  const pending=deferred(),old=stream();getUserMedia.mockReturnValueOnce(pending.promise);
  const view=render(<Recorder onRecordingComplete={complete}/>);
  fireEvent.click(screen.getByRole('button',{name:'开始录音'}));view.unmount();
  await act(async()=>pending.resolve(old));
  expect(old.stop).toHaveBeenCalledTimes(1);expect(recorders).toHaveLength(0);
 });
 it('停止等待原生回调时不能重开；完成后释放旧资源并允许新录音',async()=>{
  const current=stream();getUserMedia.mockResolvedValueOnce(current);
  render(<Recorder onRecordingComplete={complete}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  const recorder=recorders[0];
  act(()=>recorder.ondataavailable({data:new Blob(['take-one'],{type:'audio/wav'})}));
  fireEvent.click(screen.getByRole('button',{name:'停止录音且继续'}));
  expect(screen.getByRole('button',{name:'正在处理录音...'})).toBeDisabled();
  await act(async()=>recorder.onstop());
  expect(complete).toHaveBeenCalledTimes(1);expect(complete.mock.calls[0][0].type).toBe('audio/wav');
  expect(current.stop).toHaveBeenCalledTimes(1);expect(contexts[0].close).toHaveBeenCalledTimes(1);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  expect(recorders).toHaveLength(2);
 });
 it('录音中卸载停止原生录音并忽略已排队的结束回调',async()=>{
  const current=stream();getUserMedia.mockResolvedValueOnce(current);
  const view=render(<Recorder onRecordingComplete={complete}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  const recorder=recorders[0],queued=recorder.onstop;view.unmount();
  await act(async()=>queued());
  expect(recorder.state).toBe('inactive');expect(recorder.onstop).toBeNull();
  expect(current.stop).toHaveBeenCalledTimes(1);expect(complete).not.toHaveBeenCalled();
 });
 it.each([false,true])('原生自行停止后转码保持禁用，卸载=%s时不回传旧音频',async leave=>{
  const decoded=deferred();
  vi.stubGlobal('Blob',class extends Blob{async arrayBuffer(){return new ArrayBuffer(8);}});
  AudioContext.prototype.decodeAudioData=()=>decoded.promise;
  vi.stubGlobal('OfflineAudioContext',class{
   createBuffer(){return {copyToChannel:vi.fn()};}
   createBufferSource(){return {connect:vi.fn(),start:vi.fn()};}
   async startRendering(){return {getChannelData:()=>new Float32Array(4)};}
  });
  const view=render(<Recorder onRecordingComplete={complete}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  recorders[0].mimeType='audio/webm';
  recorders[0].state='inactive';
  let processing;await act(async()=>{processing=recorders[0].onstop();});
  expect(screen.getByRole('button',{name:'正在处理录音...'})).toBeDisabled();
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  if(leave){view.unmount();expect(contexts[1].close).toHaveBeenCalledTimes(1);}
  await act(async()=>{
   decoded.resolve({duration:1,length:4,sampleRate:48000,numberOfChannels:1,getChannelData:()=>new Float32Array(4)});
   await processing;
  });
  expect(complete).toHaveBeenCalledTimes(leave?0:1);
  expect(contexts[1].close).toHaveBeenCalledTimes(1);
  if(!leave)expect(screen.getByRole('button',{name:'开始录音'})).toBeEnabled();
 });
 it.each(['success','decode','render'])('转码%s路径关闭临时上下文',async outcome=>{
  vi.stubGlobal('Blob',class extends Blob{async arrayBuffer(){return new ArrayBuffer(8);}});
  AudioContext.prototype.decodeAudioData=async()=>{
   if(outcome==='decode')throw new Error('解码失败');
   return {duration:1,length:4,sampleRate:48000,numberOfChannels:1,getChannelData:()=>new Float32Array(4)};
  };
  vi.stubGlobal('OfflineAudioContext',class{
   createBuffer(){return {copyToChannel:vi.fn()};}
   createBufferSource(){return {connect:vi.fn(),start:vi.fn()};}
   async startRendering(){
    expect(contexts[1].close).toHaveBeenCalledTimes(1);
    if(outcome==='render')throw new Error('重采样失败');
    return {getChannelData:()=>new Float32Array(4)};
   }
  });
  render(<Recorder onRecordingComplete={complete}/>);
  await act(async()=>fireEvent.click(screen.getByRole('button',{name:'开始录音'})));
  recorders[0].mimeType='audio/webm';
  fireEvent.click(screen.getByRole('button',{name:'停止录音且继续'}));
  await act(async()=>recorders[0].onstop());
  expect(contexts[1].close).toHaveBeenCalledTimes(1);
  if(outcome==='success')expect(screen.getByRole('button',{name:'开始录音'})).toBeEnabled();
  else {
   expect(complete).not.toHaveBeenCalled();
   expect(screen.getByRole('alert')).toHaveTextContent('录音转换失败');
   expect(screen.getByRole('button',{name:'重试转换'})).toBeEnabled();
   expect(screen.getByRole('button',{name:'开始录音'})).toBeDisabled();
  }
 });
});
