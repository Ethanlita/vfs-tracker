/** @file WORLD 按需脚本加载的单次请求与失败重试测试。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 每项测试加载新的模块实例，避免单例 Promise 跨用例共享。 */
const importLoader = async () => {
  vi.resetModules();
  return import('../../../src/utils/worldJsLoader.js');
};

describe('loadWorldJs', () => {
  beforeEach(() => {
    document.head.querySelectorAll('#vfs-worldjs-runtime').forEach(node => node.remove());
    delete window.Module;
  });

  it('已有运行时直接复用且不插入脚本', async () => {
    window.Module = { Dio_JS: vi.fn() };
    const { loadWorldJs } = await importLoader();

    await expect(loadWorldJs()).resolves.toBe(window.Module);
    expect(document.querySelector('#vfs-worldjs-runtime')).toBeNull();
  });

  it('并发调用只插入一个脚本并等待运行时初始化', async () => {
    const { loadWorldJs } = await importLoader();
    const first = loadWorldJs();
    const second = loadWorldJs();
    const script = document.querySelector('#vfs-worldjs-runtime');

    expect(second).toBe(first);
    expect(document.querySelectorAll('#vfs-worldjs-runtime')).toHaveLength(1);
    expect(script.getAttribute('src')).toBe('/WorldJS.js');

    window.Module.Dio_JS = vi.fn();
    window.Module.onRuntimeInitialized();
    await expect(first).resolves.toBe(window.Module);
  });

  it('加载失败会移除旧脚本并允许下一次重试', async () => {
    const { loadWorldJs } = await importLoader();
    const first = loadWorldJs();
    document.querySelector('#vfs-worldjs-runtime').dispatchEvent(new Event('error'));

    await expect(first).rejects.toThrow('failed to load');
    expect(document.querySelector('#vfs-worldjs-runtime')).toBeNull();

    const second = loadWorldJs();
    expect(document.querySelectorAll('#vfs-worldjs-runtime')).toHaveLength(1);
    window.Module.Dio_JS = vi.fn();
    window.Module.onRuntimeInitialized();
    await expect(second).resolves.toBe(window.Module);
  });
});
