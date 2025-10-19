/**
 * 单元测试: src/components/PendingSyncButton.jsx
 * 
 * 测试离线记录同步按钮组件
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PendingSyncButton from '../../../src/components/PendingSyncButton.jsx';
import * as api from '../../../src/api.js';

// Mock api模块
vi.mock('../../../src/api.js', () => ({
  addEvent: vi.fn()
}));

const OFFLINE_QUEUE_KEY = 'pendingEvents:v1';

describe('PendingSyncButton 组件测试', () => {
  // 备份原始的全局对象
  let originalLocalStorage;
  let originalOnLine;
  let originalAlert;
  let originalDispatchEvent;

  beforeAll(() => {
    // 保存原始对象
    originalLocalStorage = global.localStorage;
    originalOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    originalAlert = global.alert;
    originalDispatchEvent = global.dispatchEvent;
  });

  afterAll(() => {
    // 恢复原始对象
    global.localStorage = originalLocalStorage;
    if (originalOnLine) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnLine);
    }
    global.alert = originalAlert;
    global.dispatchEvent = originalDispatchEvent;
  });
  
  // Mock localStorage
  let localStorageMock;
  
  beforeEach(() => {
    // 重置所有mocks
    vi.clearAllMocks();
    
    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    global.localStorage = localStorageMock;
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Mock window.alert
    global.alert = vi.fn();
    
    // Mock window events
    global.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // 基础渲染测试
  // ============================================
  
  describe('基础渲染', () => {
    it('没有离线记录时应该显示默认文字', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录/ })).toBeInTheDocument();
    });

    it('有离线记录时应该显示记录数量', () => {
      const queue = [
        { eventData: { type: 'self-test', date: '2024-01-01' } },
        { eventData: { type: 'hospital-test', date: '2024-01-02' } }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录 \(2\)/ })).toBeInTheDocument();
    });

    it('应该有默认样式类', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gradient-to-r');
      expect(button.className).toContain('from-yellow-500');
    });

    it('应该支持自定义className', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<PendingSyncButton className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button.className).toBe('custom-class');
    });
  });

  // ============================================
  // 队列读取测试
  // ============================================
  
  describe('队列读取', () => {
    it('localStorage为空时应该显示0条记录', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '🔄 同步离线记录' })).toBeInTheDocument();
    });

    it('localStorage包含空数组时应该显示0条记录', () => {
      localStorageMock.getItem.mockReturnValue('[]');
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '🔄 同步离线记录' })).toBeInTheDocument();
    });

    it('localStorage包含无效JSON时应该降级为0条记录', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '🔄 同步离线记录' })).toBeInTheDocument();
    });

    it('localStorage包含非数组时应该降级为0条记录', () => {
      localStorageMock.getItem.mockReturnValue('{"not": "an array"}');
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '🔄 同步离线记录' })).toBeInTheDocument();
    });
  });

  // ============================================
  // 同步功能测试
  // ============================================
  
  describe('同步功能', () => {
    it('离线时点击应该提示联网', async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(global.alert).toHaveBeenCalledWith('当前仍处于离线状态，请联网后再同步。');
      expect(api.addEvent).not.toHaveBeenCalled();
    });

    it('没有离线记录时点击应该提示', async () => {
      const user = userEvent.setup();
      localStorageMock.getItem.mockReturnValue('[]');
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(global.alert).toHaveBeenCalledWith('没有离线记录');
      expect(api.addEvent).not.toHaveBeenCalled();
    });

    it('成功同步所有记录', async () => {
      const user = userEvent.setup();
      const queue = [
        { eventData: { type: 'self-test', date: '2024-01-01' } },
        { eventData: { type: 'hospital-test', date: '2024-01-02' } }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      api.addEvent.mockResolvedValue({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(api.addEvent).toHaveBeenCalledTimes(2);
      });
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(OFFLINE_QUEUE_KEY);
      expect(global.alert).toHaveBeenCalledWith('同步完成：成功 2 条，失败 0 条');
    });

    it('部分记录同步失败应该保留失败的记录', async () => {
      const user = userEvent.setup();
      const queue = [
        { eventData: { type: 'self-test', date: '2024-01-01' } },
        { eventData: { type: 'hospital-test', date: '2024-01-02' } },
        { eventData: { type: 'surgery', date: '2024-01-03' } }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      
      // 第二个请求失败
      api.addEvent
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(api.addEvent).toHaveBeenCalledTimes(3);
      });
      
      // 应该保存失败的记录
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        OFFLINE_QUEUE_KEY,
        expect.stringContaining('hospital-test')
      );
      expect(global.alert).toHaveBeenCalledWith('同步完成：成功 2 条，失败 1 条');
    });

    it('同步中按钮应该显示"同步中..."并禁用', async () => {
      const user = userEvent.setup();
      const queue = [{ eventData: { type: 'self-test' } }];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      
      // 让addEvent挂起一段时间
      api.addEvent.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // 同步中应该显示"同步中..."
      expect(screen.getByRole('button', { name: '同步中...' })).toBeDisabled();
    });
  });

  // ============================================
  // 事件监听测试
  // ============================================
  
  describe('事件监听', () => {
    it('应该在初始化时设置事件监听器', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      localStorageMock.getItem.mockReturnValue('[]');
      
      render(<PendingSyncButton />);
      
      // 验证监听器已被添加
      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pending-events-updated', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
    });

    it('应该在卸载时清除事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      localStorageMock.getItem.mockReturnValue('[]');
      
      const { unmount } = render(<PendingSyncButton />);
      
      unmount();
      
      // 验证监听器已被移除
      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pending-events-updated', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });

    it('同步完成后应该触发pending-events-updated事件', async () => {
      const user = userEvent.setup();
      const queue = [{ eventData: { type: 'self-test' } }];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      api.addEvent.mockResolvedValue({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(global.dispatchEvent).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'pending-events-updated' })
        );
      });
    });
  });

  // ============================================
  // 边界情况测试
  // ============================================
  
  describe('边界情况', () => {
    it('localStorage.setItem失败时不应该崩溃', async () => {
      const user = userEvent.setup();
      const queue = [{ eventData: { type: 'self-test' } }];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      api.addEvent.mockRejectedValue(new Error('API Error'));
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      
      await expect(user.click(button)).resolves.not.toThrow();
    });

    it('处理空的eventData', async () => {
      const user = userEvent.setup();
      const queue = [
        { eventData: null },
        { eventData: { type: 'self-test' } }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      api.addEvent.mockResolvedValue({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(api.addEvent).toHaveBeenCalledTimes(2);
      });
    });

    it('显示大量离线记录数', () => {
      const queue = Array(99).fill({ eventData: { type: 'self-test' } });
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录 \(99\)/ })).toBeInTheDocument();
    });

    it('处理非常长的队列', () => {
      const queue = Array(1000).fill({ eventData: { type: 'self-test' } });
      localStorageMock.getItem.mockReturnValue(JSON.stringify(queue));
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录 \(1000\)/ })).toBeInTheDocument();
    });
  });
});
