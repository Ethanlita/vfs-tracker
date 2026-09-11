/** @file StrictMode转换及音色慢加载、取消与重试行为。 */
import React,{StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),osc:vi.fn(),play:vi.fn(),contexts:[]}));
vi.mock('soundfont-player',()=>({default:{instrument:mocks.load}}));
import NoteFrequencyTool from '../../../src/components/NoteFrequencyTool';
beforeEach(()=>{
 vi.clearAllMocks();mocks.contexts=[];vi.stubGlobal('navigator',{onLine:true});
 const param=()=>({setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
 vi.stubGlobal('AudioContext',class{
 state='running';currentTime=0;destination={};constructor(){mocks.contexts.push(this)}
 createOscillator(){return {frequency:{value:0},connect:vi.fn(),start:mocks.osc,stop:vi.fn()}}
 createGain(){return {gain:param(),connect:vi.fn()}}
 close(){this.state='closed';return Promise.resolve()}
 });
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()});
async function key(name){await act(async()=>fireEvent.click(screen.getByRole('button',{name:name+' 键',exact:true})))}
it('StrictMode重复设置后表单仍能转换',async()=>{
 navigator.onLine=false;render(<StrictMode><NoteFrequencyTool/></StrictMode>);
 const input=screen.getByRole('textbox',{name:'频率（Hz）'});fireEvent.change(input,{target:{value:'220'}});
 await act(async()=>fireEvent.submit(input.closest('form')));
 expect(screen.getByRole('textbox',{name:/音名/})).toHaveValue('A3');expect(mocks.osc).toHaveBeenCalledTimes(1);
});
it('慢加载只请求一次，立即播放合成音且完成时不补播',async()=>{
 let release;mocks.load.mockImplementation(()=>new Promise(resolve=>{release=resolve}));render(<NoteFrequencyTool/>);
 await key('C4');await key('D4');await key('E4');expect(mocks.load).toHaveBeenCalledTimes(1);expect(mocks.osc).toHaveBeenCalledTimes(3);
 expect(screen.getByText('音色加载中（当前使用合成器）')).toBeInTheDocument();
 await act(async()=>release({play:mocks.play}));expect(mocks.play).not.toHaveBeenCalled();
 await key('F4');expect(mocks.play).toHaveBeenCalledExactlyOnceWith('F4',0,{duration:1.2,gain:3.2});
});
it('慢失败不补播，断网恢复后新键重试加载',async()=>{
 mocks.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({play:mocks.play});render(<NoteFrequencyTool/>);
 await key('C4');await key('D4');expect(mocks.load).toHaveBeenCalledTimes(1);expect(mocks.osc).toHaveBeenCalledTimes(2);
 await act(async()=>{navigator.onLine=false;window.dispatchEvent(new Event('offline'))});
 await act(async()=>{navigator.onLine=true;window.dispatchEvent(new Event('online'))});
 await key('E4');expect(mocks.load).toHaveBeenCalledTimes(2);expect(mocks.play).not.toHaveBeenCalled();
 await key('F4');expect(mocks.play).toHaveBeenCalledTimes(1);
});
it('离开后迟到音色不播放，返回后新上下文可播放',async()=>{
 let release;mocks.load.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve})).mockResolvedValue({play:mocks.play});
 const view=render(<NoteFrequencyTool/>);await key('C4');view.unmount();await act(async()=>release({play:mocks.play}));
 expect(mocks.contexts[0].state).toBe('closed');expect(mocks.play).not.toHaveBeenCalled();render(<NoteFrequencyTool/>);await key('D4');await key('E4');expect(mocks.play).toHaveBeenCalledTimes(1);
});
it.each([['C0','A0','27.50'],['C9','C8','4186.01'],['C5','C5','523.25'],['Bb3','A#3','233.08'],['B#3','C4','261.63'],['A0','A0','27.50'],['C8','C8','4186.01']])('%s转换的等式与输入、高亮琴键一致',async(input,note,hz)=>{
 navigator.onLine=false;render(<StrictMode><NoteFrequencyTool/></StrictMode>);
 const field=screen.getByRole('textbox',{name:'音名',exact:true});fireEvent.change(field,{target:{value:input}});await act(async()=>fireEvent.submit(field.closest('form')));
 expect(field).toHaveValue(note);expect(screen.getByText(`${note} = ${hz} Hz`)).toBeInTheDocument();
 expect(screen.getByRole('textbox',{name:'频率（Hz）'})).toHaveValue(hz);
 if(input==='C0'||input==='C9')expect(screen.getByText(new RegExp('原输入 '+input+' 超出范围'))).toBeInTheDocument();
 expect(mocks.osc).toHaveBeenCalledTimes(1);
});
it('无效音名不播放，不留下旧结果等式',async()=>{
 navigator.onLine=false;render(<NoteFrequencyTool/>);const field=screen.getByRole('textbox',{name:'音名',exact:true});fireEvent.change(field,{target:{value:'wrong'}});await act(async()=>fireEvent.submit(field.closest('form')));
 expect(screen.queryByText('A4 = 440.00 Hz')).not.toBeInTheDocument();expect(mocks.osc).not.toHaveBeenCalled();
});
