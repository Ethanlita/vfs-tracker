import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('前端运行时日志边界', () => {
  it('应用源码不直接调用浏览器控制台', async () => {
    const eslint = new ESLint();
    const results = await eslint.lintFiles(['src/**/*.{js,jsx}']);
    const consoleViolations = results.flatMap(result => result.messages
      .filter(message => message.ruleId === 'no-console')
      .map(message => `${result.filePath}:${message.line}:${message.column}`));

    expect(consoleViolations).toEqual([]);
  });
});
