/**
 * 单元测试: src/utils/pendingSignUp.js
 *
 * 测试待验证注册账号记录的保存、读取、过期与清除逻辑（Issue #89）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PENDING_SIGNUP_STORAGE_KEY,
  PENDING_SIGNUP_TTL_MS,
  savePendingSignUp,
  loadPendingSignUp,
  clearPendingSignUp,
  looksLikeEmail
} from '../../../src/utils/pendingSignUp.js';

describe('pendingSignUp.js 单元测试', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // looksLikeEmail
  // ============================================
  describe('looksLikeEmail', () => {
    it('含有 @ 的标识视为邮箱', () => {
      expect(looksLikeEmail('someone@example.com')).toBe(true);
      expect(looksLikeEmail(' a@b ')).toBe(true);
    });

    it('普通用户名和空值不视为邮箱', () => {
      expect(looksLikeEmail('alice')).toBe(false);
      expect(looksLikeEmail('')).toBe(false);
      expect(looksLikeEmail(undefined)).toBe(false);
      expect(looksLikeEmail(null)).toBe(false);
    });
  });

  // ============================================
  // savePendingSignUp / loadPendingSignUp
  // ============================================
  describe('savePendingSignUp / loadPendingSignUp', () => {
    it('保存后可以原样读取，并会去掉首尾空格', () => {
      const saved = savePendingSignUp({ username: ' alice ', email: ' alice@example.com ' }, NOW);

      expect(saved).toEqual({ username: 'alice', email: 'alice@example.com', createdAt: NOW });
      expect(loadPendingSignUp(NOW)).toEqual(saved);
    });

    it('用户名为空时不保存', () => {
      expect(savePendingSignUp({ username: '   ', email: 'a@b.com' }, NOW)).toBeNull();
      expect(localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY)).toBeNull();
    });

    it('同一用户名再次保存且未提供邮箱时沿用已记录的邮箱', () => {
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' }, NOW);
      const resaved = savePendingSignUp({ username: 'alice' }, NOW + 1000);

      expect(resaved).toEqual({ username: 'alice', email: 'alice@example.com', createdAt: NOW + 1000 });
    });

    it('不同用户名再次保存时不沿用旧邮箱', () => {
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' }, NOW);
      const resaved = savePendingSignUp({ username: 'bob' }, NOW + 1000);

      expect(resaved).toEqual({ username: 'bob', email: '', createdAt: NOW + 1000 });
    });

    it('未超过保留期的记录可以读取', () => {
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' }, NOW);

      expect(loadPendingSignUp(NOW + PENDING_SIGNUP_TTL_MS)).not.toBeNull();
    });

    it('超过保留期的记录读取时返回 null 并被清除', () => {
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' }, NOW);

      expect(loadPendingSignUp(NOW + PENDING_SIGNUP_TTL_MS + 1)).toBeNull();
      expect(localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY)).toBeNull();
    });

    it('存储内容损坏时返回 null 并清除', () => {
      localStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, '{not valid json');

      expect(loadPendingSignUp(NOW)).toBeNull();
      expect(localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY)).toBeNull();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('缺少必要字段的记录视为无效并清除', () => {
      localStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify({ email: 'a@b.com' }));

      expect(loadPendingSignUp(NOW)).toBeNull();
      expect(localStorage.getItem(PENDING_SIGNUP_STORAGE_KEY)).toBeNull();
    });

    it('没有记录时返回 null', () => {
      expect(loadPendingSignUp(NOW)).toBeNull();
    });
  });

  // ============================================
  // clearPendingSignUp
  // ============================================
  describe('clearPendingSignUp', () => {
    it('清除后读取返回 null', () => {
      savePendingSignUp({ username: 'alice', email: 'alice@example.com' }, NOW);
      clearPendingSignUp();

      expect(loadPendingSignUp(NOW)).toBeNull();
    });

    it('没有记录时调用也不会报错', () => {
      expect(() => clearPendingSignUp()).not.toThrow();
    });
  });
});
