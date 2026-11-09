/** @file 音阶结束流程回归：通过、失败、跳过、资源释放与「再来一次」。音高算法独立测试。 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({evaluate:vi.fn(),recommend:vi.fn(),instrument:vi.fn(),contexts:[],stop:vi.fn()}));
vi.mock('react-router-dom',()=>({useNavigate:()=>vi.fn()}));
vi.mock('../../../src/api.js',()=>({getSongRecommendations:mocks.recommend}));
vi.mock('soundfont-player',()=>({default:{instrument:mocks.instrument}}));
vi.mock('pitchy',()=>({PitchDetector:{forFloat32Array:n=>({inputLength:n,findPitch:()=>[180,1]})}}));
vi.mock('../../../src/utils/scalePracticeEval.js',async load=>({...await load(),evaluatePhrase:mocks.evaluate,detectEarlyVoicing:()=>({early:false})}));
import ScalePractice from '../../../src/components/ScalePractice.jsx';
import { BPM_STORAGE_KEY } from '../../../src/utils/scaleModes.js';

beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();mocks.contexts=[];localStorage.clear();
 mocks.evaluate.mockReturnValue({passed:false,failedNote:{idx:0,freq:180,type:'miss'}});
 vi.stubGlobal('navigator',{onLine:false,mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:mocks.stop}]})}});
 vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(()=>cb(performance.now()),16));
 vi.stubGlobal('cancelAnimationFrame',id=>clearTimeout(id));
 const param=()=>({value:0,setValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
 vi.stubGlobal('AudioContext',class{
  state='running';sampleRate=48000;currentTime=0;destination={};gains=[];
  constructor(){mocks.contexts.push(this)}
  createMediaStreamSource(){return {connect:vi.fn()}}
  // 记录创建的 GainNode：第一个是输入端软件增益
  createGain(){const node={gain:param(),connect:vi.fn()};this.gains.push(node);return node}
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

/** 读取音高轨迹 polyline 当前绘制的点数。 */
function trailPointCount(container){const line=container.querySelector('polyline');return line?line.getAttribute('points').trim().split(/\s+/).length:0}

it('速度滑块更新每音时长与判定方式，并按模式记住设置',async()=>{
 await setup();
 const slider=screen.getByLabelText(/速度/);expect(slider).toHaveValue('100');
 expect(screen.getByTestId('scale-judge-regime')).toHaveTextContent('稳定保持');
 await act(async()=>fireEvent.change(slider,{target:{value:'160'}}));
 expect(screen.getByText(/一轮约/)).toHaveTextContent('每个音 375 ms');
 expect(screen.getByTestId('scale-judge-regime')).toHaveTextContent('只看音高走势');
 const modeId=screen.getAllByRole('combobox')[0].value;
 expect(JSON.parse(localStorage.getItem(BPM_STORAGE_KEY))).toEqual({[modeId]:160});
 await click('恢复默认（100）');expect(slider).toHaveValue('100');
});
it('用户速度传入整句判定：练习音时长与名义区间来自所选 BPM',async()=>{
 await setup();await act(async()=>fireEvent.change(screen.getByLabelText(/速度/),{target:{value:'60'}}));
 await click('开始练习');await waitFailure();
 const args=mocks.evaluate.mock.calls[0][0];
 expect(args.noteMs).toBeCloseTo(1000,5);expect(args.noteSteps).toHaveLength(5);
 args.noteSteps.forEach(step=>expect(step.endT).toBeGreaterThan(step.startT));
 for(let i=1;i<args.noteSteps.length;i++)expect(args.noteSteps[i].startT).toBe(args.noteSteps[i-1].endT);
 expect(args.frames.length).toBeGreaterThan(0);
});
it('整句判为跟唱太晚时提示估计延迟与耳机建议，本轮按失败处理',async()=>{
 await setup();
 mocks.evaluate.mockReturnValue({passed:false,regime:'stable',requiredMs:200,lagMs:612,notes:[],failedNote:{type:'late',lagMs:612,limitMs:500}});
 await click('开始练习');await waitFailure();
 expect(screen.getByText(/跟唱慢了约612ms/)).toHaveTextContent('蓝牙耳机延迟较大，可换用有线耳机');
 expect(screen.getByRole('button',{name:'强制通过',exact:true})).toBeInTheDocument();
});
it('长轮次中音高轨迹持续绘制，不会在 320 点后冻结',async()=>{
 const{container}=render(<ScalePractice/>);await click('我已知晓，开始');await click('进入耳机检测');await tick(5500);await click('开始录音');await tick(3400);
 await act(async()=>fireEvent.change(screen.getByLabelText(/速度/),{target:{value:'40'}}));
 await click('开始练习');await tick(6000);const early=trailPointCount(container);await tick(4000);const later=trailPointCount(container);
 expect(early).toBeGreaterThan(100);expect(later).toBeGreaterThan(320);expect(later).toBeGreaterThan(early);
});

/** 让麦克风申请返回一条新的音轨（停止时计入 mocks.stop）。 */
function grantMic(){const gum=vi.fn(async()=>({getTracks:()=>[{stop:mocks.stop}]}));navigator.mediaDevices.getUserMedia=gum;return gum}
it('再来一次跳过权限说明、耳机检测与校准，直接回到设置页；结果清空，起始音与增益沿用',async()=>{
 await setup();
 await act(async()=>fireEvent.change(screen.getByLabelText('起始音'),{target:{value:'3'}}));
 await act(async()=>fireEvent.change(screen.getByLabelText('麦克风软件增益'),{target:{value:'0.5'}}));
 mocks.evaluate.mockReturnValueOnce({passed:true});await click('开始练习');await waitFailure();await click('结束并查看结果');
 expect(screen.getByText(/最高音：.*Hz/)).toBeInTheDocument();
 const gum=grantMic();await click('再来一次');await tick(0);
 expect(gum).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('button',{name:'开始练习',exact:true})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'进入耳机检测'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'开始录音'})).not.toBeInTheDocument();
 expect(screen.getByLabelText('起始音')).toHaveValue('3');
 expect(screen.getByLabelText('麦克风软件增益')).toHaveValue('0.5');
 // 新会话的输入增益直接使用当前设置，而不是 0 dB
 expect(mocks.contexts).toHaveLength(2);expect(mocks.contexts[1].gains[0].gain.value).toBe(0.5);
 await click('开始练习');await click('结束练习并查看结果');
 expect(screen.getByText('最高音：未测得')).toBeInTheDocument();expect(screen.getByText('最低音：未测得')).toBeInTheDocument();
 expect(mocks.stop).toHaveBeenCalledTimes(2);expect(mocks.contexts.every(c=>c.state==='closed')).toBe(true);
});
it('再来一次打开麦克风失败时转到权限页显示错误，可从那里走完整流程',async()=>{
 await setup();await click('开始练习');await click('结束练习并查看结果');
 navigator.mediaDevices.getUserMedia=vi.fn(async()=>{throw new Error('denied')});
 await click('再来一次');await tick(0);
 expect(screen.getByRole('alert')).toHaveTextContent('无法获取麦克风权限');
 expect(screen.queryByRole('button',{name:'开始练习',exact:true})).not.toBeInTheDocument();
 expect(mocks.contexts.every(c=>c.state==='closed')).toBe(true);
 grantMic();await click('重新尝试获取权限');await tick(0);
 expect(screen.getByRole('button',{name:'进入耳机检测'})).toBeInTheDocument();
});
it('再来一次等待授权时离开，迟到音轨关闭且不创建新上下文',async()=>{
 await setup();await click('开始练习');await click('结束练习并查看结果');
 let release;navigator.mediaDevices.getUserMedia=vi.fn(()=>new Promise(resolve=>{release=resolve}));
 await click('再来一次');expect(screen.getByText('正在重新打开麦克风…')).toBeInTheDocument();
 cleanup();await act(async()=>release({getTracks:()=>[{stop:mocks.stop}]}));
 expect(mocks.stop).toHaveBeenCalledTimes(2);expect(mocks.contexts).toHaveLength(1);expect(mocks.contexts[0].state).toBe('closed');
});
