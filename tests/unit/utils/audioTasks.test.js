/** @file 音频等待与逐帧采样的取消契约。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createAudioTasks } from '../../../src/utils/audioTasks';
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('requestAnimationFrame',cb=>setTimeout(cb,16));vi.stubGlobal('cancelAnimationFrame',id=>clearTimeout(id));});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('正常等待及采样返回结果',async()=>{
 const tasks=createAudioTasks();const wait=tasks.wait(100);const sample=tasks.sample(64,()=>2);
 await vi.advanceTimersByTimeAsync(100);expect(await wait).toBe(true);expect(await sample).toBe(2);expect(vi.getTimerCount()).toBe(0);
});
it('取消同时完成所有Promise、清理计时器且不再采样',async()=>{
 const tasks=createAudioTasks();const read=vi.fn(()=>1),wait=tasks.wait(3000),sample=tasks.sample(3000,read);
 expect(read).toHaveBeenCalledTimes(1);tasks.cancel();tasks.cancel();
 expect(await wait).toBe(false);expect(await sample).toBe(null);expect(vi.getTimerCount()).toBe(0);
 await vi.advanceTimersByTimeAsync(5000);expect(read).toHaveBeenCalledTimes(1);
 expect(await tasks.wait(1)).toBe(false);expect(await tasks.sample(1,read)).toBe(null);
});
it('采样失败保留错误且不再调度',async()=>{
 const tasks=createAudioTasks();const error=new Error('read failed');
 await expect(tasks.sample(100,()=>{throw error})).rejects.toBe(error);tasks.cancel();expect(vi.getTimerCount()).toBe(0);
});
