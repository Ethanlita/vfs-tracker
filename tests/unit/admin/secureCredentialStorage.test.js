/**
 * @file 管理员加密凭证存储测试
 * @description 验证可恢复 PIN 错误、损坏记录和版本不兼容的稳定分类。
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  SecureCredentialStorageError,
  hasEncryptedCredentials,
  loadCredentialsSecure,
  saveCredentialsSecure,
} from '../../../src/admin/utils/secureCredentialStorage';

const STORAGE_KEY = 'vfs-admin-credentials-secure';

describe('secureCredentialStorage', () => {
  beforeEach(() => localStorage.clear());

  it('使用正确 PIN 往返读取凭证，并保留加密记录', async () => {
    await saveCredentialsSecure('AKIA1234567890123456', 'secret-key-for-storage-test-123456', '2580');

    await expect(loadCredentialsSecure('2580')).resolves.toMatchObject({
      accessKeyId: 'AKIA1234567890123456',
      secretAccessKey: 'secret-key-for-storage-test-123456',
    });
    expect(hasEncryptedCredentials()).toBe(true);
  });

  it('错误 PIN 返回稳定错误码且不删除原始密文', async () => {
    await saveCredentialsSecure('AKIA1234567890123456', 'secret-key-for-storage-test-123456', '2580');
    const original = localStorage.getItem(STORAGE_KEY);

    await expect(loadCredentialsSecure('0000')).rejects.toMatchObject({
      name: 'SecureCredentialStorageError',
      code: 'PIN_OR_DATA_INVALID',
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
  });

  it('将损坏 JSON 标记为损坏，同时仍检测到待处理记录', async () => {
    localStorage.setItem(STORAGE_KEY, '{bad-json');

    expect(hasEncryptedCredentials()).toBe(true);
    await expect(loadCredentialsSecure('2580')).rejects.toEqual(
      expect.objectContaining({
        name: 'SecureCredentialStorageError',
        code: 'CORRUPT_DATA',
      })
    );
  });

  it('不支持的未来版本给出独立错误且保留原记录', async () => {
    const futureRecord = JSON.stringify({ version: 2, ciphertext: 'x', salt: 'y', iv: 'z' });
    localStorage.setItem(STORAGE_KEY, futureRecord);

    await expect(loadCredentialsSecure('2580')).rejects.toBeInstanceOf(SecureCredentialStorageError);
    await expect(loadCredentialsSecure('2580')).rejects.toMatchObject({ code: 'UNSUPPORTED_VERSION' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(futureRecord);
  });
});
