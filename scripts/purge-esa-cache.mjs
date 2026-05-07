#!/usr/bin/env node
/**
 * @file ESA 缓存刷新脚本。
 * @description 在 GitHub Pages 发布完成后刷新 vfs-tracker.cn 的 ESA 缓存，
 * 确保 ESA 边缘节点尽快读取最新的前端文件。
 */

import { execFileSync } from 'node:child_process';

const siteId = process.env.ESA_SITE_ID || '929690936461856';
const content = JSON.stringify({ PurgeAll: true });

execFileSync('aliyun', [
  'esa',
  'PurgeCaches',
  '--SiteId',
  siteId,
  '--Type',
  'purgeall',
  '--Content',
  content,
], {
  stdio: 'inherit',
});

console.log(`[esa-cache] Purged all ESA cache for site ${siteId}.`);
