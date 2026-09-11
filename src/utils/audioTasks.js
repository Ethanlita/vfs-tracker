/**
 * 创建单次音频会话的等待任务集合。取消立即释放计时器/动画帧并完成Promise。
 * @returns {{wait: (ms:number)=>Promise<boolean>, sample: (ms:number, read:Function)=>Promise<number|null>, cancel: Function}}
 */
export function createAudioTasks() {
  const pending = new Set();
  let cancelled = false;
  return {
    /** 等待正常完成返回true，取消返回false，取消后的会话不能重新调度。 */
    wait(ms) {
      if (cancelled) return Promise.resolve(false);
      return new Promise(resolve => {
        const cancel = () => { clearTimeout(id); pending.delete(cancel); resolve(false); };
        const id = setTimeout(() => { pending.delete(cancel); resolve(true); }, ms);
        pending.add(cancel);
      });
    },
    /** 逐帧采样并返回平均值；取消返回null，不再读取已经关闭的分析器。 */
    sample(ms, read) {
      if (cancelled) return Promise.resolve(null);
      return new Promise((resolve, reject) => {
        let frame;
        const values = [];
        const end = performance.now() + ms;
        const cancel = () => { cancelAnimationFrame(frame); pending.delete(cancel); resolve(null); };
        const tick = () => {
          if (cancelled) return cancel();
          try { values.push(read()); }
          catch (error) { pending.delete(cancel); reject(error); return; }
          if (performance.now() < end) frame = requestAnimationFrame(tick);
          else { pending.delete(cancel); resolve(values.reduce((a, b) => a + b, 0) / values.length); }
        };
        pending.add(cancel);
        tick();
      });
    },
    /** 结束会话，逐项结清待处理工作，重复取消无副作用。 */
    cancel() {
      cancelled = true;
      for (const cancel of [...pending]) cancel();
    }
  };
}
