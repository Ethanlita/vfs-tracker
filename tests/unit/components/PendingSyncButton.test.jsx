/**
 * 单元测试: src/components/PendingSyncButton.jsx
 * 
 * 测试离线记录同步按钮组件
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PendingSyncButton from '../../../src/components/PendingSyncButton.jsx';
import * as api from '../../../src/api.js';
import { minimalSelfTest } from '../../../src/test-utils/fixtures/index.js';
import { enqueuePendingEvent, readPendingEvents } from '../../../src/utils/pendingEvents.js';
const account = vi.hoisted(() => ({ user: null }));
vi.mock('../../../src/contexts/AuthContext.jsx', () => ({ useAuth: () => account }));

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
  let originalLocks;

  beforeAll(() => {
    // 保存原始对象
    originalLocalStorage = global.localStorage;
    originalOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    originalAlert = global.alert;
    originalDispatchEvent = global.dispatchEvent;
    originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  });

  afterAll(() => {
    // 恢复原始对象
    global.localStorage = originalLocalStorage;
    if (originalOnLine) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnLine);
    }
    global.alert = originalAlert;
    global.dispatchEvent = originalDispatchEvent;
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else delete navigator.locks;
  });
  
  // Mock localStorage
  let localStorageMock;
  
  beforeEach(() => {
    account.user = { userId: minimalSelfTest.userId };
    // 重置所有mocks
    vi.clearAllMocks();
    
    // Mock localStorage
    const stored = new Map();
    localStorageMock = {
      getItem: vi.fn(key => stored.get(key) ?? null),
      setItem: vi.fn((key, value) => stored.set(key, value)),
      removeItem: vi.fn(key => stored.delete(key)),
      clear: vi.fn(() => stored.clear())
    };
    global.localStorage = localStorageMock;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn(async (_name, callback) => callback()) } });
    
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
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test', date: '2024-01-01' } },
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'hospital-test', date: '2024-01-02' } }
      ];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      
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

    it('localStorage包含无效JSON时显示读取错误并阻止同步', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '离线记录读取失败' })).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('无法读取离线记录');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('localStorage包含非数组时显示读取错误并保留原始内容', () => {
      localStorageMock.getItem.mockReturnValue('{"not": "an array"}');
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: '离线记录读取失败' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '重新读取' })).toBeEnabled();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('存储权限恢复后原地重读显示真实计数，不自动提交', async () => {
      const user = userEvent.setup();
      const queue = [{ ownerUserId: minimalSelfTest.userId, when: 1, eventData: minimalSelfTest }];
      localStorageMock.getItem.mockImplementation(() => { throw new DOMException('拒绝访问', 'SecurityError'); });
      render(<PendingSyncButton />);
      expect(screen.getByRole('alert')).toHaveTextContent('无法读取离线记录');
      localStorageMock.getItem.mockImplementation(() => JSON.stringify(queue));
      await user.click(screen.getByRole('button', { name: '重新读取' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🔄 同步离线记录 (1)' })).toBeEnabled();
      expect(api.addEvent).not.toHaveBeenCalled();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('重读仍失败时保留错误，恢复为空数组后才显示空队列', async () => {
      const user = userEvent.setup();
      localStorageMock.getItem.mockReturnValue('{bad');
      render(<PendingSyncButton />);
      await user.click(screen.getByRole('button', { name: '重新读取' }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      localStorageMock.getItem.mockReturnValue('[]');
      await user.click(screen.getByRole('button', { name: '重新读取' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🔄 同步离线记录' })).toBeEnabled();
      expect(api.addEvent).not.toHaveBeenCalled();
    });

    it('点击同步时新发生的读取失败不误报没有记录或开始写入', async () => {
      const user = userEvent.setup();
      localStorageMock.getItem.mockReturnValue(JSON.stringify([{ ownerUserId: minimalSelfTest.userId, when: 1, eventData: minimalSelfTest }]));
      render(<PendingSyncButton />);
      localStorageMock.getItem.mockImplementation(() => { throw new DOMException('拒绝访问', 'SecurityError'); });
      await user.click(screen.getByRole('button', { name: /同步离线记录/ }));
      expect(screen.getByRole('alert')).toHaveTextContent('无法读取离线记录');
      expect(api.addEvent).not.toHaveBeenCalled();
      expect(global.alert).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
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
      
      expect(global.alert).toHaveBeenCalledWith('当前账号没有可同步的离线记录');
      expect(api.addEvent).not.toHaveBeenCalled();
    });

    it('成功同步所有记录', async () => {
      const user = userEvent.setup();
      const queue = [
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test', date: '2024-01-01' } },
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'hospital-test', date: '2024-01-02' } }
      ];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      api.addEvent.mockResolvedValue({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(api.addEvent).toHaveBeenCalledTimes(2);
      });
      
      await waitFor(() => expect(localStorageMock.removeItem).toHaveBeenCalledWith(OFFLINE_QUEUE_KEY));
      expect(global.alert).toHaveBeenCalledWith('同步完成：成功 2 条，失败 0 条');
    });

    it('部分记录同步失败应该保留失败的记录', async () => {
      const user = userEvent.setup();
      const queue = [
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test', date: '2024-01-01' } },
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'hospital-test', date: '2024-01-02' } },
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'surgery', date: '2024-01-03' } }
      ];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      
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
      await waitFor(() => expect(global.alert).toHaveBeenCalledWith('同步完成：成功 2 条，失败 1 条'));
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        OFFLINE_QUEUE_KEY,
        expect.stringContaining('hospital-test')
      );
      expect(global.alert).toHaveBeenCalledWith('同步完成：成功 2 条，失败 1 条');
    });

    it('同步中按钮应该显示"同步中..."并禁用', async () => {
      const user = userEvent.setup();
      const queue = [{ ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } }];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      
      // 让 addEvent 返回一个挂起的 Promise
      let resolveSync;
      api.addEvent.mockImplementation(() => new Promise(resolve => {
        resolveSync = resolve;
      }));
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // 同步中应该显示"同步中..."
      expect(screen.getByRole('button', { name: '同步中...' })).toBeDisabled();
      
      // 完成同步以避免挂起
      await act(async () => resolveSync({ item: { eventId: '123' } }));
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
      const queue = [{ ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } }];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
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
      const queue = [{ ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } }];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      api.addEvent.mockRejectedValue(new Error('API Error'));
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      
      await expect(user.click(button)).resolves.not.toThrow();
    });

    it('空的eventData保留为失败条目，不提交或删除', async () => {
      const user = userEvent.setup();
      const queue = [
        { ownerUserId: minimalSelfTest.userId, eventData: null },
        { ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } }
      ];
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      api.addEvent.mockResolvedValue({ success: true });
      
      render(<PendingSyncButton />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      await waitFor(() => {
        expect(api.addEvent).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => expect(global.alert).toHaveBeenCalledWith('同步完成：成功 1 条，失败 1 条'));
      expect(readPendingEvents()).toEqual([expect.objectContaining({ ownerUserId: minimalSelfTest.userId, eventData: null })]);
    });

    it('显示大量离线记录数', () => {
      const queue = Array(99).fill({ ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } });
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录 \(99\)/ })).toBeInTheDocument();
    });

    it('处理非常长的队列', () => {
      const queue = Array(1000).fill({ ownerUserId: minimalSelfTest.userId, eventData: { type: 'self-test' } });
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); localStorageMock.setItem.mockClear();
      
      render(<PendingSyncButton />);
      
      expect(screen.getByRole('button', { name: /同步离线记录 \(1000\)/ })).toBeInTheDocument();
    });
  });

  describe('同步中继续新增', () => {
    const data = { type: minimalSelfTest.type, date: minimalSelfTest.date, details: minimalSelfTest.details };

    it('旧请求成功后保留等待期间追加的记录', async () => {
      const user = userEvent.setup();
      await enqueuePendingEvent(data, minimalSelfTest.userId);
      let release;
      api.addEvent.mockImplementation(() => new Promise(resolve => { release = resolve; }));
      render(<PendingSyncButton />);
      await user.click(screen.getByRole('button', { name: /同步离线记录/ }));
      await waitFor(() => expect(api.addEvent).toHaveBeenCalledTimes(1));
      let added;
      await act(async () => {
        added = await enqueuePendingEvent(data, minimalSelfTest.userId);
        release({ eventId: 'created' });
      });
      await waitFor(() => expect(global.alert).toHaveBeenCalledWith('同步完成：成功 1 条，失败 0 条'));
      expect(readPendingEvents()).toEqual([added]);
      expect(screen.getByRole('button', { name: '🔄 同步离线记录 (1)' })).toBeEnabled();
    });

    it('本地清理失败时仅重试清理，不再次发送事件', async () => {
      const user = userEvent.setup();
      await enqueuePendingEvent(data, minimalSelfTest.userId);
      api.addEvent.mockResolvedValue({ eventId: 'created' });
      localStorageMock.removeItem.mockImplementationOnce(() => { throw new Error('denied'); });
      render(<PendingSyncButton />);
      await user.click(screen.getByRole('button', { name: /同步离线记录/ }));
      await screen.findByRole('button', { name: '重试本地清理' });
      expect(screen.getByRole('button', { name: /同步离线记录/ })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: '重试本地清理' }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(api.addEvent).toHaveBeenCalledTimes(1);
      expect(readPendingEvents()).toEqual([]);
    });
  });

  describe('同步账号切换', () => {
    const data = { type: minimalSelfTest.type, date: minimalSelfTest.date, details: minimalSelfTest.details };
    it('只统计及提交当前账号，其他账号和无归属旧条目保留', async () => {
      const user = userEvent.setup();
      const a = await enqueuePendingEvent(data, minimalSelfTest.userId);
      const b = await enqueuePendingEvent(data, 'other-account');
      const legacy = { when: 1, eventData: data };
      localStorageMock.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([a,b,legacy]));
      api.addEvent.mockResolvedValue({eventId:'created'});
      render(<PendingSyncButton />);
      expect(screen.getByRole('status')).toHaveTextContent('不会自动同步');
      await user.click(screen.getByRole('button',{name:'🔄 同步离线记录 (1)'}));
      await waitFor(()=>expect(readPendingEvents()).toEqual([b,legacy]));
      expect(api.addEvent).toHaveBeenCalledExactlyOnceWith(data,{expectedUserId:minimalSelfTest.userId,clientRequestId:a.queueId});
    });

    it.each(['switch','unmount'])('%s之后不继续发送旧账号剩余记录', async mode => {
      const user=userEvent.setup();
      await enqueuePendingEvent(data,minimalSelfTest.userId);
      const second=await enqueuePendingEvent(data,minimalSelfTest.userId);
      const other=await enqueuePendingEvent(data,'other-account');
      let release;
      api.addEvent.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
      const view=render(<PendingSyncButton />);
      await user.click(screen.getByRole('button',{name:'🔄 同步离线记录 (2)'}));
      await waitFor(()=>expect(api.addEvent).toHaveBeenCalledTimes(1));
      if(mode==='switch'){account.user={userId:'other-account'};view.rerender(<PendingSyncButton />);}else view.unmount();
      await act(async()=>release({eventId:'created'}));
      await waitFor(()=>expect(readPendingEvents()).toEqual([second,other]));
      expect(api.addEvent).toHaveBeenCalledTimes(1);
      expect(global.alert).not.toHaveBeenCalled();
      if(mode==='switch')expect(screen.getByRole('button',{name:'🔄 同步离线记录 (1)'})).toBeEnabled();
    });

    it('未登录时不能同步', () => {
      account.user=null;
      render(<PendingSyncButton />);
      expect(screen.getByRole('button',{name:'🔄 同步离线记录'})).toBeDisabled();
    });
  });
});
