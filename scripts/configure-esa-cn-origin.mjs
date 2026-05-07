#!/usr/bin/env node
/**
 * @file ESA .cn 主站配置脚本。
 * @description 实验性脚本：将 vfs-tracker.cn 切换为 ESA EdgeRoutine 关联记录，
 * 由 Routine 显式读取 origin-probe.vfs-tracker.cn 上游并处理 SPA fallback，同时
 * 配置 HTML 短缓存与 Vite 哈希资源长缓存。该脚本会替换主站 DNS 记录，应用前必须
 * 同时设置 ESA_CONFIRM_GITHUB_ORIGIN=yes 与 ESA_CONFIRM_REPLACE_MAIN_RECORD=yes。
 */

import { execFileSync } from 'node:child_process';

const apply = process.argv.includes('--apply');
const confirmed = process.env.ESA_CONFIRM_GITHUB_ORIGIN === 'yes';
const replaceConfirmed = process.env.ESA_CONFIRM_REPLACE_MAIN_RECORD === 'yes';
const siteId = process.env.ESA_SITE_ID || '929690936461856';
const routineName = process.env.ESA_ROUTINE_NAME || 'vfstrackercn';
const mainHosts = ['vfs-tracker.cn', 'www.vfs-tracker.cn'];

if (apply && (!confirmed || !replaceConfirmed)) {
  throw new Error('ESA main record replacement is experimental. Set ESA_CONFIRM_GITHUB_ORIGIN=yes and ESA_CONFIRM_REPLACE_MAIN_RECORD=yes to apply.');
}

const cnHostsRule = '(http.host in {"vfs-tracker.cn" "www.vfs-tracker.cn"})';
const staticAssetsRule = `(${cnHostsRule} and starts_with(http.request.uri.path,"/assets/"))`;
const htmlRule = `(${cnHostsRule} and not (http.request.uri.path.extension in {"js" "css" "png" "jpg" "jpeg" "gif" "ico" "svg" "woff" "woff2" "json" "webp" "mp3" "wav" "ttf" "eot" "map" "wasm" "md" "txt" "xml"}))`;

const cacheRules = [
  {
    name: 'cn-hashed-assets-long-cache',
    sequence: '10',
    rule: staticAssetsRule,
    edgeCacheMode: 'override_origin',
    edgeCacheTtl: '31536000',
    browserCacheMode: 'override_origin',
    browserCacheTtl: '31536000',
  },
  {
    name: 'cn-html-short-cache',
    sequence: '20',
    rule: htmlRule,
    edgeCacheMode: 'override_origin',
    edgeCacheTtl: '60',
    browserCacheMode: 'override_origin',
    browserCacheTtl: '60',
  },
];

/**
 * 执行或展示 aliyun CLI 命令。
 * @param {string[]} args - aliyun CLI 参数。
 * @returns {{ ok: boolean, stdout: string }} 调用结果。
 */
function runAliyun(args) {
  const printable = ['aliyun', ...args].join(' ');
  if (!apply) {
    console.log(`[dry-run] ${printable}`);
    return { ok: true, stdout: '{}' };
  }

  const stdout = execFileSync('aliyun', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return { ok: true, stdout };
}

/**
 * 解析 JSON 输出。
 * @param {string} stdout - CLI 输出。
 * @returns {unknown} JSON 对象。
 */
function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return {};
  }
}

/**
 * 遍历 JSON 树查找对象。
 * @param {unknown} value - JSON 值。
 * @param {(item: Record<string, unknown>) => boolean} predicate - 匹配函数。
 * @returns {Record<string, unknown>[]} 匹配对象列表。
 */
function findObjects(value, predicate) {
  if (!value || typeof value !== 'object') return [];

  const matches = [];
  if (!Array.isArray(value) && predicate(value)) {
    matches.push(value);
  }
  for (const item of Object.values(value)) {
    matches.push(...findObjects(item, predicate));
  }
  return matches;
}

/** 删除会与 Routine 关联记录冲突的主站普通 DNS 记录。 */
function deleteConflictingDnsRecords() {
  const records = parseJson(runAliyun(['esa', 'ListRecords', '--SiteId', siteId, '--PageSize', '100']).stdout);
  const conflictingRecords = findObjects(records, (item) =>
    Boolean(item.RecordId) && mainHosts.includes(String(item.RecordName))
  );

  for (const record of conflictingRecords) {
    runAliyun([
      'esa',
      'DeleteRecord',
      '--RecordId',
      String(record.RecordId),
    ]);
  }
}

/** 确保主站域名使用 Routine 关联记录。 */
function ensureRoutineRelatedRecords() {
  const relatedRecords = parseJson(runAliyun([
    'esa',
    'ListRoutineRelatedRecords',
    '--Name',
    routineName,
    '--PageSize',
    '100',
  ]).stdout);

  for (const host of mainHosts) {
    const existing = findObjects(relatedRecords, (item) => item.RecordName === host)[0];
    if (existing?.RecordId) {
      console.log(`[esa-cn] Routine related record already exists: ${host}`);
      continue;
    }

    runAliyun([
      'esa',
      'CreateRoutineRelatedRecord',
      '--Name',
      routineName,
      '--SiteId',
      siteId,
      '--RecordName',
      host,
    ]);
  }
}

/** 确保主站 RoutineRoute 使用纯 Host 匹配，静态资源放在 Routine 内部处理。 */
function ensureRoutineRoute() {
  const routes = parseJson(runAliyun(['esa', 'ListRoutineRoutes', '--RoutineName', routineName]).stdout);
  const route = findObjects(routes, (item) =>
    item.RouteName === 'cn-spa-fallback' || item.Rule === cnHostsRule
  )[0];

  if (route?.ConfigId) {
    console.log(`[esa-cn] RoutineRoute already exists: ${route.ConfigId}`);
    return;
  }

  runAliyun([
    'esa',
    'CreateRoutineRoute',
    '--RoutineName',
    routineName,
    '--SiteId',
    siteId,
    '--RouteName',
    'cn-spa-fallback',
    '--Rule',
    cnHostsRule,
    '--RouteEnable',
    'on',
    '--Fallback',
    'on',
    '--Sequence',
    '10',
  ]);
}

/** 创建或更新缓存规则。 */
function configureCacheRules() {
  const current = parseJson(runAliyun(['esa', 'ListCacheRules', '--SiteId', siteId]).stdout);

  for (const rule of cacheRules) {
    const existing = findObjects(current, (item) => item.RuleName === rule.name)[0];
    const command = existing?.ConfigId ? 'UpdateCacheRule' : 'CreateCacheRule';
    const args = [
      'esa',
      command,
      '--SiteId',
      siteId,
      '--RuleName',
      rule.name,
      '--Rule',
      rule.rule,
      '--RuleEnable',
      'on',
      '--Sequence',
      rule.sequence,
      '--EdgeCacheMode',
      rule.edgeCacheMode,
      '--EdgeCacheTtl',
      rule.edgeCacheTtl,
      '--BrowserCacheMode',
      rule.browserCacheMode,
      '--BrowserCacheTtl',
      rule.browserCacheTtl,
      '--QueryStringMode',
      'reserve_all',
    ];

    if (existing?.ConfigId) {
      args.splice(2, 0, '--ConfigId', String(existing.ConfigId));
    }

    runAliyun(args);
  }
}

/** 刷新站点缓存，确保切换后边缘节点读取最新源站内容。 */
function purgeSiteCache() {
  runAliyun([
    'esa',
    'PurgeCaches',
    '--SiteId',
    siteId,
    '--Type',
    'purgeall',
    '--Content',
    JSON.stringify({ PurgeAll: true }),
  ]);
}

deleteConflictingDnsRecords();
ensureRoutineRelatedRecords();
configureCacheRules();
purgeSiteCache();
ensureRoutineRoute();

console.log(apply
  ? '[esa-cn] Applied Routine related records, RoutineRoute, cache rules, and purge.'
  : '[esa-cn] Dry-run complete. Re-run with --apply and both confirmations to configure ESA.');
