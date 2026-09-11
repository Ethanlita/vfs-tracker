/** @file 朗读稿件基础设施声明测试 */
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('SAM模板声明稿件表、只读Lambda和公开GET路由', async () => {
  const templates = await Promise.all([
    readFile('infra/template.yaml', 'utf8'),
    readFile('infra/template-production.yaml', 'utf8'),
  ]);
  for (const template of templates) {
    expect(template).toContain('VoiceFemReadingPassagesTable:');
    expect(template).toContain('GetReadingPassagesFunction:');
    expect(template).toContain('READING_PASSAGES_TABLE_NAME: !Ref VoiceFemReadingPassagesTable');
    expect(template).toContain('Path: /reading-passages');
  }
  expect(templates[1]).toContain('DynamoDBReadPolicy:');
});

it('后端部署成功后运行不覆盖现有内容的初始化脚本', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const seed = await readFile('scripts/seed-reading-passages.mjs', 'utf8');
  const workflow = await readFile('.github/workflows/deploy-backend.yml', 'utf8');
  expect(packageJson.scripts['deploy:backend']).toContain('node scripts/seed-reading-passages.mjs');
  expect(seed).toContain("ConditionExpression: 'attribute_not_exists(passageId)'");
  expect(workflow).toContain('node scripts/seed-reading-passages.mjs');
  expect(workflow).toContain('github.event.before');
});

it('开发和生产模板都公开仪表盘轻量接口与分页明细接口', async () => {
  const templates = await Promise.all([
    readFile('infra/template.yaml', 'utf8'),
    readFile('infra/template-production.yaml', 'utf8'),
  ]);
  for (const template of templates) {
    expect(template).toContain('Path: /public/dashboard');
    expect(template).toContain('Path: /public/users/{userId}/events');
    expect(template).toContain('USERS_TABLE: !Ref VoiceFemUsersTable');
  }
});
