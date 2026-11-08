/**
 * @file PWA 版本更新端到端测试的"两版本站点"。
 * @description 构建两份内容不同的生产包 A/B，并用一个可切换目录的静态服务器模拟 GitHub Pages 部署：
 * 调用 deploy('b') 即相当于发布了新版本。两份构建只差 VITE_API_STAGE（会内联进入口包），
 * 因此入口哈希与 sw.js 都不同；构建使用隔离的假配置，测试不会访问真实 AWS 服务。
 */
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

/** 与 PR 校验一致的隔离配置；VITE_API_STAGE 由版本区分。 */
const ISOLATED_ENV = {
  VITE_GOOGLE_GEMINI_API: 'test-only',
  VITE_COGNITO_USER_POOL_ID: 'us-east-1_testpool',
  VITE_COGNITO_USER_POOL_WEB_CLIENT_ID: '00000000000000000000000000',
  VITE_AWS_REGION: 'us-east-1',
  VITE_API_ENDPOINT: 'https://api.vfs-tracker.invalid',
  VITE_S3_BUCKET: 'vfs-tracker-pr-test',
};

/** 测试中伪造 Cognito 会话时使用的客户端 ID。 */
export const TEST_USER_POOL_CLIENT_ID = ISOLATED_ENV.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 构建 A、B 两个版本；每次运行使用独立临时目录，并发运行互不覆盖。
 * @returns {Promise<{root: string, dirs: {a: string, b: string}, entries: {A: string, B: string}}>}
 *   临时根目录、输出目录与各自的入口脚本名。
 */
export async function buildVersions() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'vfs-pwa-update-e2e-'));
  const dirs = { a: path.join(root, 'a'), b: path.join(root, 'b') };
  for (const [version, outDir] of Object.entries(dirs)) {
    await execFileAsync(process.execPath, [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
      cwd: ROOT,
      env: { ...process.env, ...ISOLATED_ENV, VITE_API_STAGE: `pwa-update-${version}` },
      maxBuffer: 32 * 1024 * 1024,
    });
  }
  const entryOf = dir => readFileSync(path.join(dir, 'index.html'), 'utf8').match(/assets\/index-[\w-]+\.js/)[0];
  return { root, dirs, entries: { A: entryOf(dirs.a), B: entryOf(dirs.b) } };
}

/**
 * 删除 buildVersions 生成的临时目录。
 * @param {string|undefined} root - buildVersions 返回的 root；未构建时为 undefined。
 */
export function removeVersions(root) {
  if (root) rmSync(root, { recursive: true, force: true });
}

/**
 * 启动可切换版本的静态服务器（行为与 GitHub Pages + SPA 回退一致，所有响应 no-cache）。
 * 可为指定路径设置响应延迟，用于模拟慢网络下页面加载与新版本安装的时序。
 * @param {{a: string, b: string}} dirs - 两个版本的构建目录。
 * @returns {Promise<{url: (pathname: string) => string, deploy: (version: 'a'|'b') => void,
 *   delay: (pathname: string, ms: number) => void, clearDelays: () => void, close: () => Promise<void>}>}
 */
export async function startVersionedServer(dirs) {
  let current = 'a';
  /** @type {Map<string, number>} 路径 → 响应延迟（毫秒）。 */
  const delays = new Map();
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const root = dirs[current];
    setTimeout(() => serve(response, root, pathname), delays.get(pathname) ?? 0);
  });

  /**
   * 按 GitHub Pages 的规则返回一个文件。
   * @param {http.ServerResponse} response - 响应对象。
   * @param {string} root - 请求到达时所部署版本的目录。
   * @param {string} pathname - 请求路径。
   */
  function serve(response, root, pathname) {
    let file = path.join(root, pathname);
    const exists = file.startsWith(root) && existsSync(file) && statSync(file).isFile();
    if (!exists) {
      // 部署会删除旧版本的哈希资源：缺失的带扩展名文件返回 404，前端路由回退到 index.html。
      if (path.extname(pathname)) {
        response.writeHead(404);
        response.end('not found');
        return;
      }
      file = path.join(root, 'index.html');
    }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    createReadStream(file).pipe(response);
  }

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: pathname => `http://127.0.0.1:${port}${pathname}`,
    deploy: version => { current = version; },
    delay: (pathname, ms) => { delays.set(pathname, ms); },
    clearDelays: () => delays.clear(),
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}
