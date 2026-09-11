#!/usr/bin/env node
/**
 * @file ESA 主站压缩规则配置脚本。
 * @description 为 vfs-tracker.cn 与 www.vfs-tracker.cn 创建或更新唯一的压缩规则，
 * 让 EdgeRoutine 返回的可压缩静态资源继续经过 ESA 内容优化层。
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const COMPRESSION_RULE_NAME = 'cn-main-static-compression';
export const CN_MAIN_HOSTS_RULE = '(http.host in {"vfs-tracker.cn" "www.vfs-tracker.cn"})';
const DEFAULT_SITE_ID = '929690936461856';

/**
 * 遍历 ESA JSON 响应并查找符合条件的对象。
 * @param {unknown} value - 当前 JSON 值。
 * @param {(item: Record<string, unknown>) => boolean} predicate - 对象匹配条件。
 * @returns {Record<string, unknown>[]} 匹配的对象。
 */
export function findObjects(value, predicate) {
  if (!value || typeof value !== 'object') return [];

  const matches = [];
  if (!Array.isArray(value) && predicate(value)) matches.push(value);
  for (const item of Object.values(value)) {
    matches.push(...findObjects(item, predicate));
  }
  return matches;
}

/**
 * 从压缩规则列表中读取本项目的唯一规则。
 * @param {unknown} response - ListCompressionRules 的 JSON 响应。
 * @returns {Record<string, unknown>|null} 已有规则或 null。
 */
export function findCompressionRule(response) {
  return findObjects(response, (item) => item.RuleName === COMPRESSION_RULE_NAME)[0] || null;
}

/**
 * 生成创建或更新压缩规则所需的 aliyun CLI 参数。
 * @param {Record<string, unknown>|null} existingRule - 已有规则。
 * @param {string} siteId - ESA 站点 ID。
 * @returns {string[]} aliyun CLI 参数。
 */
export function buildCompressionCommand(existingRule, siteId = DEFAULT_SITE_ID) {
  const args = [
    'esa',
    existingRule?.ConfigId ? 'UpdateCompressionRule' : 'CreateCompressionRule',
  ];

  if (existingRule?.ConfigId) {
    args.push('--ConfigId', String(existingRule.ConfigId));
  }

  args.push(
    '--SiteId', siteId,
    '--RuleName', COMPRESSION_RULE_NAME,
    '--Rule', CN_MAIN_HOSTS_RULE,
    '--RuleEnable', 'on',
    '--Sequence', '5',
    '--Gzip', 'on',
    '--Brotli', 'on',
    '--Zstd', 'on',
  );
  return args;
}

/**
 * 调用 aliyun CLI。
 * @param {string[]} args - CLI 参数。
 * @returns {string} 标准输出。
 */
function runAliyun(args) {
  return execFileSync('aliyun', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/**
 * 确保 ESA 主站压缩规则存在并与仓库定义一致。
 * @param {{ siteId?: string, runner?: (args: string[]) => string }} options - 可测试的执行参数。
 * @returns {string[]} 实际执行的创建或更新命令。
 */
export function configureCompression({
  siteId = process.env.ESA_SITE_ID || DEFAULT_SITE_ID,
  runner = runAliyun,
} = {}) {
  const current = JSON.parse(runner(['esa', 'ListCompressionRules', '--SiteId', siteId]));
  const command = buildCompressionCommand(findCompressionRule(current), siteId);
  runner(command);
  return command;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const command = configureCompression();
  console.log(`[esa-compression] Applied ${COMPRESSION_RULE_NAME} with ${command[1]}.`);
}
