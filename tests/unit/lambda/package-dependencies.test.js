/**
 * @file Node.js Lambda 独立依赖与可复现构建测试。
 * @description 防止根目录 node_modules 掩盖 CodeUri 中缺失的直接依赖或锁文件漂移。
 */
import { isBuiltin } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const lambdaRoot = path.join(process.cwd(), 'lambda-functions');
const importPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/** 将子路径模块名归一化为 package.json 中的包名。 */
function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

/** 递归读取目录中的 JavaScript 源文件，忽略安装产物。 */
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(resolved));
    else if (/\.(?:m?js|cjs)$/.test(entry.name)) files.push(resolved);
  }
  return files;
}

/** 收集 Lambda 源码直接导入的第三方包。 */
async function externalImports(directory) {
  const imports = new Set();
  for (const file of await sourceFiles(directory)) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !isBuiltin(specifier)) {
        imports.add(packageName(specifier));
      }
    }
  }
  return [...imports].sort();
}

const lambdaDirectories = (await readdir(lambdaRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(lambdaRoot, entry.name));

describe('Node.js Lambda package boundaries', () => {
  it.each(lambdaDirectories.map(directory => [path.basename(directory), directory]))(
    '%s declares every direct external import and locks the dependency graph',
    async (_name, directory) => {
      let packageJson;
      try {
        packageJson = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
      }

      const declared = { ...packageJson.dependencies, ...packageJson.optionalDependencies };
      for (const imported of await externalImports(directory)) expect(declared).toHaveProperty(imported);

      const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
      expect(lock.packages['']?.dependencies ?? {}).toEqual(packageJson.dependencies ?? {});
      for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
        expect(lock.packages).toHaveProperty(`node_modules/${dependency}`);
      }
    },
  );
});

it('两套 SAM 模板的每个 Node.js 函数都强制使用 npm ci', async () => {
  const templates = await Promise.all([
    readFile('infra/template.yaml', 'utf8'),
    readFile('infra/template-production.yaml', 'utf8'),
  ]);
  for (const template of templates) {
    const nodeFunctions = template.match(/^[ ]{2}[A-Za-z0-9]+Function:\r?\n[\s\S]*?(?=^[ ]{2}[A-Za-z0-9]+(?:Function|Table|Api|Role):|(?![\s\S]))/gm)
      ?.filter(block => block.includes('Runtime: nodejs24.x')) ?? [];
    expect(nodeFunctions.length).toBeGreaterThan(0);
    for (const block of nodeFunctions) expect(block).toContain('UseNpmCi: true');
  }
});
