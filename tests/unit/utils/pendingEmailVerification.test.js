/** @file 待验证邮箱本地恢复记录测试。 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  pendingEmailVerificationKey,
  readPendingEmailVerification,
  removePendingEmailVerification,
  writePendingEmailVerification,
} from '../../../src/utils/pendingEmailVerification.js';

describe('pendingEmailVerification', () => {
  beforeEach(() => localStorage.clear());

  it('按用户隔离保存并恢复待验证邮箱，且不存储验证码', () => {
    const saved = writePendingEmailVerification('user-a', {
      email: ' new@example.com ',
      previousEmail: 'old@example.com',
      destination: 'n***@example.com',
      deliveryMedium: 'EMAIL',
    });

    expect(readPendingEmailVerification('user-a')).toEqual(saved);
    expect(readPendingEmailVerification('user-b')).toBeNull();
    expect(localStorage.getItem(pendingEmailVerificationKey('user-a'))).not.toContain('123456');
  });

  it('拒绝损坏或归属不符的记录，并仅清除指定账号', () => {
    localStorage.setItem(pendingEmailVerificationKey('user-a'), '{broken');
    localStorage.setItem(pendingEmailVerificationKey('user-b'), JSON.stringify({
      ownerUserId: 'another-user',
      email: 'new@example.com',
      createdAt: new Date().toISOString(),
    }));

    expect(readPendingEmailVerification('user-a')).toBeNull();
    expect(readPendingEmailVerification('user-b')).toBeNull();
    removePendingEmailVerification('user-a');
    expect(localStorage.getItem(pendingEmailVerificationKey('user-a'))).toBeNull();
    expect(localStorage.getItem(pendingEmailVerificationKey('user-b'))).not.toBeNull();
  });
});
