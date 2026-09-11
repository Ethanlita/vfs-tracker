/** @file 用户资料 Query key、运行时契约与缓存策略测试。 */
import { describe, expect, it } from 'vitest';
import {
  PROFILE_CACHE_MAX_AGE_MS,
  PROFILE_STALE_TIME_MS,
  profileQueryKey,
  profileQueryOptions,
  validateProfileQueryResponse,
} from '../../../src/query/profileQuery.js';

const owner = 'us-east-1:profile-query-owner';

describe('profileQuery', () => {
  it('按账号生成唯一且稳定的 queryKey', () => {
    expect(profileQueryKey(owner)).toEqual(['profile', owner]);
    expect(profileQueryKey('us-east-1:another-owner')).not.toEqual(profileQueryKey(owner));
  });

  it('接受尚未完成的账号资料并规范化 exists', () => {
    expect(validateProfileQueryResponse({
      userId: owner,
      profile: { name: '', isNamePublic: false, areSocialsPublic: false },
    }, owner)).toMatchObject({ exists: true, userId: owner });
  });

  it('接受服务端确认不存在的首次登录记录', () => {
    expect(validateProfileQueryResponse({ exists: false, userId: owner }, owner)).toEqual({
      exists: false,
      userId: owner,
    });
  });

  it('拒绝错误账号或缺少 profile 的存在记录', () => {
    expect(() => validateProfileQueryResponse({
      userId: 'us-east-1:another-owner',
      profile: { name: '其他账号' },
    }, owner)).toThrow('当前登录账号不匹配');
    expect(() => validateProfileQueryResponse({ exists: true, userId: owner }, owner))
      .toThrow('不符合数据契约');
  });

  it('使用一分钟 staleTime、24 小时 GC 与显式持久化标记', () => {
    const options = profileQueryOptions(owner);
    expect(options).toMatchObject({
      queryKey: ['profile', owner],
      staleTime: PROFILE_STALE_TIME_MS,
      gcTime: PROFILE_CACHE_MAX_AGE_MS,
      retry: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      meta: { persist: true },
    });
  });
});
