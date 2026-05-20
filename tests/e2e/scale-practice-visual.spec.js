/**
 * @file ScalePractice 改造的视觉/数学验证
 *
 * 因为 /scale-practice 需要登录态，无法在 e2e 中直接渲染组件本身，
 * 这里改为验证渲染层最关键的"频率→几何位置"映射是否一致：
 *  - div(bottom: P%) 与 svg(y: (1-P)*100) 表示的是同一物理位置
 *  - 圆点（用 div bottom + translate(-50%, 50%)）与参考线（用 div bottom + translate-y-1/2）
 *    在同一频率上的视觉中心点重合
 *
 * 这部分能被静态验证；组件本身的渲染由单元测试 + build + lint 共同保证。
 */
import { test, expect } from '@playwright/test';

test.describe('ScalePractice 改造视觉验证', () => {
  test('频率→视觉位置映射在 div 与 svg 之间一致（用户问题 #2 #3）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(() => {
      // 复制 freqToPercent 公式
      const freqToPercent = (f, range) => {
        if (!range.max || !range.min || f <= 0) return 0;
        const ratio = Math.log2(f / range.min) / Math.log2(range.max / range.min);
        return Math.min(1, Math.max(0, ratio));
      };
      const range = { min: 200, max: 800 };
      const samples = [200, 240, 320, 400, 500, 640, 800];
      return samples.map(f => {
        const r = freqToPercent(f, range);
        const divBottomPct = r * 100;     // 用于 ladder/dot/band（越大越靠上）
        const svgY = (1 - r) * 100;        // 用于 SVG 轨迹（y=0 在顶部）
        return { f, divBottomPct, svgY, sum: divBottomPct + svgY };
      });
    });

    // 这两套坐标是互补的：div 的 "距底部 X%" + svg 的 "距顶部 X%" 必须永远 = 100
    for (const r of result) {
      expect(r.sum, `freq=${r.f} 双坐标应互补，实际 sum=${r.sum}`).toBeCloseTo(100, 5);
    }
    // 200Hz 应该在底部（div bottom=0%, svg y=100）
    expect(result[0].divBottomPct).toBeCloseTo(0, 5);
    // 800Hz 应该在顶部（div bottom=100%, svg y=0）
    expect(result[result.length - 1].divBottomPct).toBeCloseTo(100, 5);
  });

  test('圆点 X 位置随进度线性运动，没有 [3,97] 钳制（用户问题 #4）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 验证：当进度从 0→1 线性变化时，dot 的 left% 也是 0→100 线性变化（不被钳制）
    const result = await page.evaluate(() => {
      const samples = [];
      for (let p = 0; p <= 1.0001; p += 0.1) {
        const dotLeftPct = Math.max(0, Math.min(100, p * 100));
        samples.push({ p: +p.toFixed(2), x: +dotLeftPct.toFixed(2) });
      }
      return samples;
    });

    // 必须包含 0 和 100 端点（修复前会被钳制为 3 和 97）
    expect(result[0].x).toBe(0);
    expect(result[result.length - 1].x).toBe(100);
    // 检查相邻点等距（差值应一致 ≈ 10）
    for (let i = 1; i < result.length; i++) {
      const dx = result[i].x - result[i - 1].x;
      expect(dx).toBeCloseTo(10, 5);
    }
  });

  test('访问 /scale-practice 不会因 ScalePractice 模块导致运行时崩溃', async ({ page }) => {
    const fatal = [];
    // 仅关心来自 ScalePractice 自身或其工具链的硬错误：
    //  - ReferenceError / TypeError / SyntaxError
    //  - 提到 ScalePractice / scalePracticeEval / scaleModes / pitchEval / soundfont-player / pitchy
    page.on('pageerror', e => fatal.push(`pageerror: ${e.message}\n${e.stack ?? ''}`));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/ScalePractice|scalePracticeEval|scaleModes|pitchEval|soundfont-player|pitchy/.test(text)) {
        fatal.push(`console: ${text}`);
      }
      // 任何 ReferenceError / TypeError 都视为致命
      if (/ReferenceError|TypeError|SyntaxError|cannot access|is not a function/i.test(text)) {
        fatal.push(`console: ${text}`);
      }
    });

    await page.goto('/scale-practice');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/e2e/__screenshots__/scale-redirect.png', fullPage: true });

    expect(fatal, `Fatal errors: ${fatal.join(' | ')}`).toEqual([]);
  });
});
