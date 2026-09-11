/** @file 校验生产入口、favicon 与 PWA 安装包体积预算。 */
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const DIST_DIR = resolve('dist');
const LIMITS = {
  entryJavaScript: 900 * 1024,
  initialCss: 150 * 1024,
  favicon: 64 * 1024,
  precache: 4.5 * 1024 * 1024,
};

/** 把站点绝对 URL 转成 dist 内文件，拒绝路径逃逸。 */
const distributionPath = url => {
  const filePath = resolve(DIST_DIR, decodeURIComponent(url.replace(/^\//, '')));
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${sep}`)) {
    throw new Error(`Invalid distribution path: ${url}`);
  }
  return filePath;
};

/** 读取文件大小并在超过预算时给出可操作错误。 */
const enforceSize = async (label, url, limit) => {
  const { size } = await stat(distributionPath(url));
  if (size > limit) throw new Error(`${label} exceeds budget: ${size} > ${limit} bytes (${url})`);
  return size;
};

const indexHtml = await readFile(resolve(DIST_DIR, 'index.html'), 'utf8');
if (/<script[^>]+src=["']\/WorldJS\.js["']/i.test(indexHtml)) {
  throw new Error('Homepage must not load WorldJS directly');
}

const entryUrl = indexHtml.match(/<script type="module"[^>]+src="([^"]+)"/)?.[1];
const initialCssUrl = indexHtml.match(/href="(\/assets\/index-[^"]+\.css)"/)?.[1];
const faviconUrl = indexHtml.match(/<link rel="icon"[^>]+href="([^"]+)"/)?.[1];
if (!entryUrl || !initialCssUrl || !faviconUrl) throw new Error('Unable to locate initial production resources');

const swSource = await readFile(resolve(DIST_DIR, 'sw.js'), 'utf8');
const precacheUrls = [...swSource.matchAll(/\{url:"([^"]+)",revision:(?:"[^"]*"|null)\}/g)].map(match => match[1]);
if (!precacheUrls.length) throw new Error('Unable to read Workbox precache manifest');
if (precacheUrls.some(url => /(?:icon_origin|icons\/icon\.png|AdminApp-)/.test(url))) {
  throw new Error('Unused source icons and online-only admin bundle must stay outside the PWA precache');
}

const offlineAssets = [
  'WorldJS.js',
  'WorldJS.wasm',
  'assets/VFSEffectPreview-',
  'assets/QuickF0Test-',
  'assets/ScalePractice-',
  'assets/NoteFrequencyTool-',
];
for (const required of offlineAssets) {
  if (!precacheUrls.some(url => url.startsWith(required))) {
    throw new Error(`Offline tool asset missing from precache: ${required}`);
  }
}

const precacheSizes = await Promise.all(precacheUrls.map(async url => (await stat(distributionPath(url))).size));
const summary = {
  entryJavaScript: await enforceSize('Initial JavaScript', entryUrl, LIMITS.entryJavaScript),
  initialCss: await enforceSize('Initial CSS', initialCssUrl, LIMITS.initialCss),
  favicon: await enforceSize('Favicon', faviconUrl, LIMITS.favicon),
  precache: precacheSizes.reduce((total, size) => total + size, 0),
  precacheEntries: precacheUrls.length,
};
if (summary.precache > LIMITS.precache) {
  throw new Error(`PWA precache exceeds budget: ${summary.precache} > ${LIMITS.precache} bytes`);
}

console.log(`Performance budgets passed: ${JSON.stringify(summary)}`);
