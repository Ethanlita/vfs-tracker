/** @file 构建期版本号与页面版本文本测试。 */
import { describe, expect, it, vi } from 'vitest';
import { FRONTEND_VERSION_PATHS, resolveAppVersion } from '../../config/appVersion.js';
import { formatAppVersion } from '../../src/appVersion.js';

describe('构建期版本号', () => {
  it('开发服务器与测试固定为 dev，不调用 git', () => {
    const run = vi.fn();
    expect(resolveAppVersion('serve', run)).toEqual({ commit: 'dev', date: '' });
    expect(run).not.toHaveBeenCalled();
  });

  it('生产构建取最后一次改动前端路径的提交', () => {
    const run = vi.fn().mockReturnValue('e057653 2026-11-08\n');

    expect(resolveAppVersion('build', run)).toEqual({ commit: 'e057653', date: '2026-11-08' });
    expect(run).toHaveBeenCalledWith(['log', '-1', '--abbrev=7', '--format=%h %cs', '--', ...FRONTEND_VERSION_PATHS]);
    expect(FRONTEND_VERSION_PATHS).toEqual(expect.arrayContaining(['src', 'public', 'posts', 'package-lock.json']));
  });

  it('git 历史中找不到前端提交时构建失败', () => {
    expect(() => resolveAppVersion('build', () => '')).toThrow('fetch-depth: 0');
  });
});

describe('页面版本文本', () => {
  it('生产版本显示提交与日期', () => {
    expect(formatAppVersion({ commit: 'e057653', date: '2026-11-08' })).toBe('e057653（2026-11-08）');
  });

  it('开发模式只显示 dev', () => {
    expect(formatAppVersion({ commit: 'dev', date: '' })).toBe('dev');
    expect(formatAppVersion()).toBe('dev');
  });
});
