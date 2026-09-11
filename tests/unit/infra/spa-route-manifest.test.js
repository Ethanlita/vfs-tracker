/**
 * @file SPA 深链路由清单一致性测试。
 * @description 防止 React 新页面未同步到 .app Worker 或 .cn ESA Routine，导致直接访问走错误缓存分支。
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** 从 JavaScript 数组声明中提取单引号路径。 */
function arrayRoutes(source, declaration) {
  const body = source.match(new RegExp(`${declaration}\\s*=\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  return [...body.matchAll(/'([^']+)'/g)].map(match => match[1]).sort();
}

/** 从 React Router 声明中提取需要 CDN 识别的静态绝对路径。 */
function applicationRoutes(source) {
  return [...source.matchAll(/<Route[^>]*\bpath="([^"]+)"/g)]
    .map(match => match[1])
    .filter(route => route.startsWith('/') && !route.includes('*') && route !== '/')
    .concat('/')
    .sort();
}

/** 递归读取目录中的 JavaScript 文件，供测试清单检查复用。 */
async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : [];
  }));
  return nested.flat();
}

/** 提取 Playwright page.goto 使用的站内字面量路径。 */
function playwrightRoutes(source) {
  const directNavigations = [...source.matchAll(/page\.goto\(\s*(['"`])(\/[^'"`]*)\1/g)];
  const tableDrivenNavigations = [...source.matchAll(/\bpath:\s*(['"`])(\/[^'"`]*)\1/g)];
  return [...directNavigations, ...tableDrivenNavigations]
    .map(match => match[2].split(/[?#]/, 1)[0]);
}

describe('SPA route manifests', () => {
  it('React、Cloudflare 与 ESA 使用完全相同的静态路由集合', async () => {
    const [app, cloudflare, esa] = await Promise.all([
      readFile('src/App.jsx', 'utf8'),
      readFile('infra/cloudflare-worker/spa-router.js', 'utf8'),
      readFile('infra/esa-routine/cn-spa-fallback.js', 'utf8'),
    ]);
    const expected = applicationRoutes(app);

    expect(arrayRoutes(cloudflare, 'const knownRoutes')).toEqual(expected);
    expect(arrayRoutes(esa, 'const KNOWN_ROUTES')).toEqual(expected);
  });

  it('两套边缘路由都覆盖管理后台动态前缀', async () => {
    const [cloudflare, esa] = await Promise.all([
      readFile('infra/cloudflare-worker/spa-router.js', 'utf8'),
      readFile('infra/esa-routine/cn-spa-fallback.js', 'utf8'),
    ]);

    expect(arrayRoutes(cloudflare, 'const knownPrefixes')).toContain('/admin');
    expect(arrayRoutes(esa, 'const KNOWN_PREFIXES')).toContain('/admin');
  });

  it('Playwright 用例只访问当前应用实际存在的页面', async () => {
    const app = await readFile('src/App.jsx', 'utf8');
    const allowedRoutes = new Set(applicationRoutes(app));
    const files = (await Promise.all([
      javascriptFiles('tests/e2e'),
      javascriptFiles('tests/e2e-production'),
    ])).flat();
    const invalidReferences = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const route of playwrightRoutes(source)) {
        if (!allowedRoutes.has(route) && route !== '/admin' && !route.startsWith('/admin/')) {
          invalidReferences.push(`${file}: ${route}`);
        }
      }
    }

    expect(invalidReferences).toEqual([]);
  });

  it('前端发布在上传产物前执行浏览器和 PWA 门禁', async () => {
    const workflow = await readFile('.github/workflows/deploy.yml', 'utf8');
    const qualityCommands = [
      'npm run lint',
      'npm run test:unit',
      'npx playwright install --with-deps chromium',
      'npx playwright test --project=chromium --workers=1 --reporter=list',
      'npm run test:e2e:pwa',
    ];
    const uploadPosition = workflow.indexOf('actions/upload-pages-artifact');

    expect(uploadPosition).toBeGreaterThan(0);
    for (const command of qualityCommands) {
      const commandPosition = workflow.indexOf(command);
      expect(commandPosition, command).toBeGreaterThan(0);
      expect(commandPosition, command).toBeLessThan(uploadPosition);
    }
  });
});
