#!/usr/bin/env node
/**
 * @file ESA .cn 主站回滚脚本。
 * @description 将 vfs-tracker.cn 从 EdgeRoutine 关联记录回滚到旧的
 * ESA -> Cloudflare vfs-tracker.app 链路，并移除主站托管的 RoutineRoute 与缓存规则。
 * origin-probe 与 routine-probe 测试资源会被保留。
 */

import { execFileSync } from 'node:child_process';

const dryRun = !process.argv.includes('--apply');
const siteId = process.env.ESA_SITE_ID || '929690936461856';
const originRuleId = process.env.ESA_MAIN_ORIGIN_RULE_ID || '455472864108544';
const routineName = process.env.ESA_ROUTINE_NAME || 'vfstrackercn';
const mainHosts = ['vfs-tracker.cn', 'www.vfs-tracker.cn'];
const managedOriginRuleNames = new Set([
  'cn-github-pages-origin',
]);
const managedRoutineRouteNames = new Set([
  'cn-spa-fallback',
]);
const managedCacheRuleNames = new Set([
  'cn-html-short-cache',
  'cn-hashed-assets-long-cache',
]);

/**
 * 运行或展示 aliyun CLI 命令。
 * @param {string[]} args - aliyun CLI 参数。
 * @returns {string} 标准输出。
 */
function runAliyun(args) {
  const printable = ['aliyun', ...args].join(' ');
  if (dryRun) {
    console.log(`[dry-run] ${printable}`);
    return '{}';
  }
  return execFileSync('aliyun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

/**
 * 安全解析 JSON。
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
  if (!value || typeof value !== 'object') {
    return [];
  }

  const matches = [];
  if (!Array.isArray(value) && predicate(value)) {
    matches.push(value);
  }

  for (const item of Object.values(value)) {
    matches.push(...findObjects(item, predicate));
  }
  return matches;
}

/** 删除本次新增的 GitHub Pages 回源规则。 */
function deleteManagedOriginRules() {
  const originRules = parseJson(runAliyun(['esa', 'ListOriginRules', '--SiteId', siteId]));
  const managedRules = findObjects(originRules, (item) =>
    Boolean(item.ConfigId) && managedOriginRuleNames.has(String(item.RuleName))
  );

  for (const rule of managedRules) {
    runAliyun([
      'esa',
      'DeleteOriginRule',
      '--SiteId',
      siteId,
      '--ConfigId',
      String(rule.ConfigId),
    ]);
  }
}

/** 删除主站托管的 RoutineRoute，保留 probe 测试 Route。 */
function deleteRoutineRoutes() {
  const routes = parseJson(runAliyun(['esa', 'ListRoutineRoutes', '--RoutineName', routineName]));
  const managedRoutes = findObjects(routes, (item) =>
    Boolean(item.ConfigId) &&
    String(item.SiteId || siteId) === String(siteId) &&
    managedRoutineRouteNames.has(String(item.RouteName))
  );

  for (const route of managedRoutes) {
    runAliyun([
      'esa',
      'DeleteRoutineRoute',
      '--SiteId',
      siteId,
      '--ConfigId',
      String(route.ConfigId),
    ]);
  }
}

/** 删除主站 Routine 关联记录，保留 origin-probe/routine-probe 测试记录。 */
function deleteMainRoutineRelatedRecords() {
  const relatedRecords = parseJson(runAliyun([
    'esa',
    'ListRoutineRelatedRecords',
    '--Name',
    routineName,
    '--PageSize',
    '100',
  ]));
  const mainRelatedRecords = findObjects(relatedRecords, (item) =>
    Boolean(item.RecordId) && mainHosts.includes(String(item.RecordName))
  );

  for (const record of mainRelatedRecords) {
    runAliyun([
      'esa',
      'DeleteRoutineRelatedRecord',
      '--Name',
      routineName,
      '--SiteId',
      siteId,
      '--RecordName',
      String(record.RecordName),
      '--RecordId',
      String(record.RecordId),
    ]);
  }
}

/** 删除本次新增的缓存规则。 */
function deleteManagedCacheRules() {
  const cacheRules = parseJson(runAliyun(['esa', 'ListCacheRules', '--SiteId', siteId]));
  const managedRules = findObjects(cacheRules, (item) =>
    Boolean(item.ConfigId) && managedCacheRuleNames.has(String(item.RuleName))
  );

  for (const rule of managedRules) {
    runAliyun([
      'esa',
      'DeleteCacheRule',
      '--SiteId',
      siteId,
      '--ConfigId',
      String(rule.ConfigId),
    ]);
  }
}

/** 恢复旧主站回源。 */
function restoreMainOrigin() {
  const records = parseJson(runAliyun(['esa', 'ListRecords', '--SiteId', siteId, '--PageSize', '100']));
  const mainRecord = findObjects(records, (item) => item.RecordName === 'vfs-tracker.cn')[0];

  if (mainRecord?.RecordId) {
    runAliyun([
      'esa',
      'UpdateRecord',
      '--RecordId',
      String(mainRecord.RecordId),
      '--Data',
      JSON.stringify({ Value: 'vfs-tracker.app' }),
    ]);
  } else {
    runAliyun([
      'esa',
      'CreateRecord',
      '--SiteId',
      siteId,
      '--RecordName',
      'vfs-tracker.cn',
      '--Type',
      'CNAME',
      '--Ttl',
      '1',
      '--Data',
      JSON.stringify({ Value: 'vfs-tracker.app' }),
      '--Proxied',
      'true',
      '--BizName',
      'web',
      '--HostPolicy',
      'follow_origin_domain',
      '--SourceType',
      'Domain',
    ]);
  }

  runAliyun([
    'esa',
    'UpdateOriginRule',
    '--SiteId',
    siteId,
    '--ConfigId',
    originRuleId,
    '--RuleName',
    '页面回源规则',
    '--Rule',
    '(http.host in {"vfs-tracker.cn" "www.vfs-tracker.cn"})',
    '--RuleEnable',
    'off',
    '--OriginHost',
    'vfs-tracker.app',
    '--DnsRecord',
    'vfs-tracker.app',
  ]);
}

deleteManagedOriginRules();
deleteRoutineRoutes();
deleteMainRoutineRelatedRecords();
deleteManagedCacheRules();
restoreMainOrigin();
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

console.log(dryRun
  ? '[rollback] Dry-run complete. Re-run with --apply to execute rollback.'
  : '[rollback] ESA .cn rollback complete.');
