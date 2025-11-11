/**
 * @file 用户测试数据 - 统一导出
 */

export { completeProfileUser } from './complete-profile.js';
export { minimalProfileUser } from './minimal-profile.js';
export { publicProfileUser } from './public-profile.js';
export { privateProfileUser } from './private-profile.js';

import { completeProfileUser } from './complete-profile.js';
import { minimalProfileUser } from './minimal-profile.js';
import { publicProfileUser } from './public-profile.js';
import { privateProfileUser } from './private-profile.js';

// 导出用户数组
export const mockUsers = [
  completeProfileUser,
  minimalProfileUser,
  publicProfileUser,
  privateProfileUser,
];

// 导出别名：profile 形式（仅包含 profile 字段）
// 这些用于测试期望只验证 profile 部分的场景
export const completeProfile = completeProfileUser.profile;
export const minimalProfile = minimalProfileUser.profile;
export const publicProfile = publicProfileUser.profile;
export const privateProfile = privateProfileUser.profile;
