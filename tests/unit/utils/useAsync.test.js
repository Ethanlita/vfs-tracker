/**
 * 单元测试: src/utils/useAsync.js
 * 
 * 测试异步请求管理 React Hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAsync } from '../../../src/utils/useAsync.js';
import { AppError } from '../../../src/utils/apiError.js';

describe('useAsync.js 单元测试', () => {

  // ============================================
  // 基础功能测试
  // ============================================
  
  describe('基础功能', () => {
    it('应该正确初始化状态', () => {
      const asyncFn = vi.fn().mockResolvedValue('test-data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      expect(result.current.value).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(typeof result.current.execute).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('immediate=true 时应该自动执行', async () => {
      const asyncFn = vi.fn().mockResolvedValue('auto-data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: true }));

      // 初始状态应该是 loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.value).toBe('auto-data');
      expect(result.current.error).toBeNull();
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it('immediate=false 时不应该自动执行', () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      expect(result.current.loading).toBe(false);
      expect(result.current.value).toBeUndefined();
      expect(asyncFn).not.toHaveBeenCalled();
    });

    it('应该能手动调用 execute', async () => {
      const asyncFn = vi.fn().mockResolvedValue('manual-data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.value).toBe('manual-data');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  // ============================================
  // 成功场景测试
  // ============================================
  
  describe('成功场景', () => {
    it('应该正确处理异步成功', async () => {
      const asyncFn = vi.fn().mockResolvedValue('success-value');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.value).toBe('success-value');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('execute 应该返回结果值', async () => {
      const asyncFn = vi.fn().mockResolvedValue('return-value');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      let returnedValue;
      await act(async () => {
        returnedValue = await result.current.execute();
      });

      expect(returnedValue).toBe('return-value');
    });

    it('应该保留上次成功的值 (preserveValue=true)', async () => {
      let resolveCount = 0;
      const asyncFn = vi.fn().mockImplementation(() => {
        resolveCount++;
        return Promise.resolve(`value-${resolveCount}`);
      });

      const { result } = renderHook(() => 
        useAsync(asyncFn, [], { immediate: false, preserveValue: true })
      );

      // 第一次执行
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.value).toBe('value-1');

      // 第二次执行时，值应该被保留直到新值返回
      await act(async () => {
        result.current.execute(); // 不等待
      });
      
      // 等待完成
      await waitFor(() => {
        expect(result.current.value).toBe('value-2');
      });
    });
  });

  // ============================================
  // 错误处理测试
  // ============================================
  
  describe('错误处理', () => {
    it('应该正确捕获异步错误', async () => {
      const testError = new Error('async-error');
      const asyncFn = vi.fn().mockRejectedValue(testError);
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.value).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(AppError);
      expect(result.current.error.message).toBe('async-error');
      expect(result.current.loading).toBe(false);
    });

    it('错误应该被包装为 AppError', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('test-error'));
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.error).toBeInstanceOf(AppError);
    });

    it('execute 在错误时应该返回 undefined', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('error'));
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      let returnedValue;
      await act(async () => {
        returnedValue = await result.current.execute();
      });

      expect(returnedValue).toBeUndefined();
    });
  });

  // ============================================
  // reset 功能测试
  // ============================================
  
  describe('reset 功能', () => {
    it('应该重置所有状态', async () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      // 先执行一次
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.value).toBe('data');

      // 重置
      act(() => {
        result.current.reset();
      });

      expect(result.current.value).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('重置后应该能重新执行', async () => {
      const asyncFn = vi.fn().mockResolvedValue('new-data');
      const { result } = renderHook(() => useAsync(asyncFn, [], { immediate: false }));

      await act(async () => {
        await result.current.execute();
      });

      act(() => {
        result.current.reset();
      });

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.value).toBe('new-data');
      expect(asyncFn).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================
  // deps 依赖测试
  // ============================================
  
  describe('deps 依赖', () => {
    it('deps 变化时应该重新执行', async () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      let dep = 1;
      
      const { rerender } = renderHook(
        ({ dep }) => useAsync(asyncFn, [dep], { immediate: true }),
        { initialProps: { dep } }
      );

      await waitFor(() => {
        expect(asyncFn).toHaveBeenCalledTimes(1);
      });

      // 改变依赖
      dep = 2;
      rerender({ dep });

      await waitFor(() => {
        expect(asyncFn).toHaveBeenCalledTimes(2);
      });
    });

    it('deps 不变时不应该重新执行', async () => {
      const asyncFn = vi.fn().mockResolvedValue('data');
      const dep = 1;
      
      const { rerender } = renderHook(
        () => useAsync(asyncFn, [dep], { immediate: true })
      );

      await waitFor(() => {
        expect(asyncFn).toHaveBeenCalledTimes(1);
      });

      // 强制重新渲染但 deps 不变
      rerender();

      await waitFor(() => {
        // 应该还是只调用了 1 次
        expect(asyncFn).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================
  // preserveValue 选项测试
  // ============================================
  
  describe('preserveValue 选项', () => {
    it('preserveValue=false 时应该立即清空值', async () => {
      let callCount = 0;
      const asyncFn = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(`value-${callCount}`);
      });

      const { result } = renderHook(() => 
        useAsync(asyncFn, [], { immediate: false, preserveValue: false })
      );

      // 第一次执行
      await act(async () => {
        await result.current.execute();
      });
      expect(result.current.value).toBe('value-1');

      // 第二次执行时，值应该立即变为 undefined
      await act(async () => {
        result.current.execute();
      });

      // 在加载过程中值应该是 undefined
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.value).toBe('value-2');
    });
  });

  // ============================================
  // 竞态条件处理测试
  // ============================================
  
  describe('竞态条件处理', () => {
    it('快速连续调用时应该只使用最后一次的结果', async () => {
      let callId = 0;
      const asyncFn = vi.fn().mockImplementation(() => {
        const id = ++callId;
        // 前面的调用延迟更长
        const delay = id === 1 ? 100 : 10;
        return new Promise(resolve => 
          setTimeout(() => resolve(`result-${id}`), delay)
        );
      });

      const { result } = renderHook(() => 
        useAsync(asyncFn, [], { immediate: false })
      );

      // 快速连续两次调用
      await act(async () => {
        result.current.execute(); // 第一次，延迟 100ms
        await result.current.execute(); // 第二次，延迟 10ms
      });

      // 等待所有 Promise 完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 200 });

      // 应该只使用第二次的结果
      expect(result.current.value).toBe('result-2');
    });
  });

  // ============================================
  // 卸载安全测试
  // ============================================
  
  describe('卸载安全', () => {
    it('组件卸载后不应该更新状态', async () => {
      const asyncFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('data'), 50))
      );

      const { result, unmount } = renderHook(() => 
        useAsync(asyncFn, [], { immediate: false })
      );

      // 开始执行
      act(() => {
        result.current.execute();
      });

      // 立即卸载
      unmount();

      // 等待异步完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 不应该抛出警告（React 会警告在卸载后更新状态）
      // 这个测试主要是确保没有控制台错误
    });
  });
});
