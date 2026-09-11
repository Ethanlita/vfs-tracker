import { describe, expect, it } from 'vitest';
import {
  createProductionConsoleGuardPlugin,
  getBuildLoggingOptions,
} from '../../config/buildLogging.js';

describe('前端发布日志策略', () => {
  it('发布构建移除所有浏览器 console 和 debugger 语句', () => {
    expect(getBuildLoggingOptions('build')).toEqual({
      drop: ['console', 'debugger'],
    });
  });

  it('开发服务器保留本地诊断输出', () => {
    expect(getBuildLoggingOptions('serve')).toBeUndefined();
  });

  it('发布 HTML 在应用脚本前关闭依赖包的控制台输出且不会重复注入', () => {
    const plugin = createProductionConsoleGuardPlugin();
    const html = '<html><head></head><body><script type="module" src="/src/main.jsx"></script></body></html>';
    const guarded = plugin.transformIndexHtml(html);

    expect(plugin.apply).toBe('build');
    expect(guarded.indexOf('data-vfs-production-console-guard'))
      .toBeLessThan(guarded.indexOf('type="module"'));
    expect(plugin.transformIndexHtml(guarded)).toBe(guarded);
  });
});
