import { describe, expect, it, vi } from 'vitest';
import {
  CN_MAIN_HOSTS_RULE,
  COMPRESSION_RULE_NAME,
  buildCompressionCommand,
  configureCompression,
  findCompressionRule,
} from '../../../scripts/configure-esa-compression.mjs';

describe('ESA 主站压缩规则脚本', () => {
  it('从嵌套列表响应中找到项目规则', () => {
    const rule = { ConfigId: 42, RuleName: COMPRESSION_RULE_NAME };

    expect(findCompressionRule({ Rules: { Items: [{ RuleName: 'other' }, rule] } })).toEqual(rule);
    expect(findCompressionRule({ Rules: [] })).toBeNull();
  });

  it('首次运行创建限定主站且启用三种编码的规则', () => {
    const command = buildCompressionCommand(null, 'site-1');

    expect(command.slice(0, 2)).toEqual(['esa', 'CreateCompressionRule']);
    expect(command).toEqual(expect.arrayContaining([
      '--SiteId', 'site-1',
      '--RuleName', COMPRESSION_RULE_NAME,
      '--Rule', CN_MAIN_HOSTS_RULE,
      '--Gzip', 'on',
      '--Brotli', 'on',
      '--Zstd', 'on',
    ]));
    expect(command).not.toContain('--ConfigId');
  });

  it('已有规则时按 ConfigId 更新同一规则', () => {
    const command = buildCompressionCommand({
      ConfigId: 99,
      RuleName: COMPRESSION_RULE_NAME,
    }, 'site-2');

    expect(command.slice(0, 4)).toEqual(['esa', 'UpdateCompressionRule', '--ConfigId', '99']);
    expect(command).toEqual(expect.arrayContaining(['--SiteId', 'site-2', '--RuleEnable', 'on']));
  });

  it('配置入口先读取规则并只执行一次更新', () => {
    const runner = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify({
        Data: [{ ConfigId: 108, RuleName: COMPRESSION_RULE_NAME }],
      }))
      .mockReturnValueOnce('{}');

    const command = configureCompression({ siteId: 'site-3', runner });

    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner).toHaveBeenNthCalledWith(1, [
      'esa', 'ListCompressionRules', '--SiteId', 'site-3',
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, command);
    expect(command[1]).toBe('UpdateCompressionRule');
  });
});
