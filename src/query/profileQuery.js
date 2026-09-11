/**
 * @file 用户资料的唯一服务器状态查询定义。
 * @description 统一 queryKey、响应校验、缓存时效与刷新策略，供 AuthContext 的读取和写入共用。
 */
import { queryOptions } from '@tanstack/react-query';
import { getUserProfile } from '../api.js';
import { profileQueryResponseSchema, validateData } from '../api/schemas.js';

export const PROFILE_STALE_TIME_MS = 60_000;
export const PROFILE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 按 Cognito 用户隔离资料，任何读取、更新与失效都必须使用此 key。 */
export const profileQueryKey = userId => ['profile', userId];

/**
 * 校验服务响应及资料归属，拒绝把另一账号的数据写入当前缓存。
 * @param {unknown} response - 资料 API 原始响应。
 * @param {string} expectedUserId - 当前查询对应的 Cognito 用户 ID。
 * @returns {object} 已校验并规范化的资料响应。
 * @throws {TypeError} 响应结构或账号归属不符合契约时抛出。
 */
export const validateProfileQueryResponse = (response, expectedUserId) => {
  const validation = validateData(profileQueryResponseSchema, response);
  if (!validation.valid) {
    throw new TypeError('用户资料响应不符合数据契约。');
  }
  if (validation.value.userId !== expectedUserId) {
    throw new TypeError('用户资料响应与当前登录账号不匹配。');
  }
  return validation.value;
};

/** 创建资料查询的唯一选项，主动读取、组件订阅和刷新不能各自定义请求策略。 */
export const profileQueryOptions = userId => queryOptions({
  queryKey: profileQueryKey(userId),
  queryFn: async () => validateProfileQueryResponse(await getUserProfile(userId), userId),
  staleTime: PROFILE_STALE_TIME_MS,
  gcTime: PROFILE_CACHE_MAX_AGE_MS,
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  meta: { persist: true },
});
