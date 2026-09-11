/** @file 音阶结束流程回归：通过、失败、跳过与资源释放。音高算法独立测试。 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({evaluate:vi.fn(),recommend:vi.fn(),instrument:vi.fn(),contexts:[],stop:vi.fn()}));
vi.mock('react-router-dom',()=>({useNavigate:()=>vi.fn()}));
vi.mock('../../../src/api.js',()=>({getSongRecommendations:mocks.recommend}));
vi.mock('soundfont-player',()=>({default:{instrument:mocks.instrument}}));
vi.mock('pitchy',()=>({PitchDetector:{forFloat32Array:n=>({inputLength:n,findPitch:()=>[180,1]})}}));
vi.mock('../../../src/utils/scalePracticeEval.js',async load=>({...await load(),evaluateNoteStability:mocks.evaluate,detectEarlyVoicing:()=>({early:false})}));
import ScalePractice from '../../../src/components/ScalePractice.jsx';

beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();mocks.contexts=[];
 mocks.evaluate.mockReturnValue({passed:false,failedNote:{idx:0,freq:180,type:'miss'}});
 vi.stubGlobal('navigator',{onLine:false,mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:mocks.stop}]})}});
 vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(()=>cb(performance.now()),16));
 vi.stubGlobal('cancelAnimationFrame',id=>clearTimeout(id));
 const param=()=>({value:0,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
 vi.stubGlobal('AudioContext',class{
  state='running';sampleRate=48000;currentTime=0;destination={};
  constructor(){mocks.contexts.push(this)}
  createMediaStreamSource(){return {connect:vi.fn()}}
  createGain(){return {gain:param(),connect:vi.fn()}}
  createOscillator(){return {frequency:param(),connect:vi.fn(),start:vi.fn(),stop:vi.fn()}}
  createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,getFloatTimeDomainData:a=>a.fill(.1),getFloatFrequencyData:a=>a.fill(-80)}}
  close(){this.state='closed';return Promise.resolve()}
 });
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()});
/** 分段推进，确保每轮Promise与React更新在下一次操作前完成。 */
async function tick(ms){await act(async()=>{await vi.advanceTimersByTimeAsync(ms)})}
async function click(name){await act(async()=>fireEvent.click(screen.getByRole('button',{name,exact:true})))}
async function setup(){
 render(<ScalePractice/>);await click('我已知晓，开始');await click('进入耳机检测');await tick(5500);
 await click('开始录音');await tick(3400);
}
async function waitFailure(){for(let i=0;i<30&&!screen.queryByRole('button',{name:'强制通过',exact:true});i++)await tick(500);expect(screen.getByRole('button',{name:'强制通过',exact:true})).toBeInTheDocument()}
function assertStopped(){expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.contexts.every(c=>c.state==='closed')).toBe(true);expect(screen.queryByText('麦克风音量')).not.toBeInTheDocument();expect(screen.getByText('练习已结束，麦克风已关闭。')).toBeInTheDocument()}

it.each(['early','failed','skip','descending'])('%s结束不制造音域并关闭麦克风',async scenario=>{
 await setup();await click('开始练习');
 if(scenario!=='early')await waitFailure();
 if(scenario==='skip')await click('强制通过');
 if(scenario==='descending'){await click('开始下降练习');await waitFailure();await click('结束')}
 else await click(scenario==='failed'?'结束并查看结果':'结束练习并查看结果');
 expect(screen.getByText('最高音：未测得')).toBeInTheDocument();expect(screen.getByText('最低音：未测得')).toBeInTheDocument();
 const recommend=screen.getByRole('button',{name:'获取歌曲推荐'});expect(recommend).toBeDisabled();fireEvent.click(recommend);expect(mocks.recommend).not.toHaveBeenCalled();assertStopped();
 await tick(10000);expect(screen.getByText('最高音：未测得')).toBeInTheDocument();
});
it('已通过上行结果在后续失败结束时保留，未通过下降仍未测得',async()=>{
 await setup();mocks.evaluate.mockReturnValueOnce({passed:true});await click('开始练习');await waitFailure();await click('结束并查看结果');
 expect(screen.getByText(/最高音：.*Hz/)).toBeInTheDocument();expect(screen.getByText('最低音：未测得')).toBeInTheDocument();assertStopped();
});
it('上下行通过轮次保留完整边界，后续失败不覆盖结果',async()=>{
 await setup();mocks.evaluate.mockReturnValueOnce({passed:true});await click('开始练习');await waitFailure();
 mocks.evaluate.mockReturnValueOnce({passed:true});await click('开始下降练习');await waitFailure();await click('结束');
 expect(screen.getByText(/最高音：.*Hz/)).toBeInTheDocument();expect(screen.getByText(/最低音：.*Hz/)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'获取歌曲推荐'})).toBeEnabled();assertStopped();
});
it('演示不计入正式测量，演示后开始并结束仍无结果',async()=>{
 await setup();mocks.evaluate.mockReturnValue({passed:true});await click('熟悉操作');
 for(let i=0;i<30&&!screen.queryByRole('button',{name:'开始练习',exact:true});i++)await tick(500);
 await click('开始练习');await click('结束练习并查看结果');
 expect(screen.getByText('最高音：未测得')).toBeInTheDocument();expect(screen.getByText('最低音：未测得')).toBeInTheDocument();assertStopped();
});
it('练习中离开立即停止音轨与上下文，迟到轮次不再评估',async()=>{
 await setup();await click('开始练习');cleanup();await tick(10000);
 expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.contexts.every(c=>c.state==='closed')).toBe(true);expect(mocks.evaluate).not.toHaveBeenCalled();
});

it('授权未完成时离开，迟到音轨关闭且不创建上下文',async()=>{
 let release;navigator.mediaDevices.getUserMedia=vi.fn(()=>new Promise(resolve=>{release=resolve}));
 const view=render(<ScalePractice/>);await click('我已知晓，开始');view.unmount();
 await act(async()=>release({getTracks:()=>[{stop:mocks.stop}]}));
 expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.contexts).toHaveLength(0);
});
it.each(['resolve','reject'])('音色加载期间离开，迟到%s不恢复采集',async outcome=>{
 navigator.onLine=true;let release,reject;mocks.instrument.mockImplementationOnce(()=>new Promise((resolve,fail)=>{release=resolve;reject=fail}));
 const view=render(<ScalePractice/>);await click('我已知晓，开始');
 expect(mocks.contexts).toHaveLength(1);view.unmount();
 await act(async()=>outcome==='resolve'?release({play:vi.fn()}):reject(new Error('late instrument')));
 expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.contexts[0].state).toBe('closed');
});
it('初始化上下文失败会释放已获准的麦克风',async()=>{
 vi.stubGlobal('AudioContext',class{constructor(){throw new Error('context unavailable')}});
 render(<ScalePractice/>);await click('我已知晓，开始');
 expect(screen.getByRole('alert')).toHaveTextContent('无法获取麦克风权限');expect(mocks.stop).toHaveBeenCalledTimes(1);
});
it.each(['rms','frequency','tone','calibrationDelay','calibrationTone','calibrationRecording'])('%s等待时离开不恢复流程或读取已释放分析器',async phase=>{
 const view=render(<ScalePractice/>);await click('我已知晓，开始');await click('进入耳机检测');
 const elapsed={rms:100,frequency:1000,tone:3000,calibrationDelay:4900,calibrationTone:5500,calibrationRecording:5500}[phase];await tick(elapsed);
 if(phase.startsWith('calibration')&&phase!=='calibrationDelay'){await click('开始录音');await tick(phase==='calibrationTone'?100:1000)}
 view.unmount();await tick(10000);
 expect(mocks.stop).toHaveBeenCalledTimes(1);expect(mocks.contexts.every(c=>c.state==='closed')).toBe(true);
 expect(mocks.evaluate).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
