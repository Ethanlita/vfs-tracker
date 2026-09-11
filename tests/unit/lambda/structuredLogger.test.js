/** @file #39 Lambda 结构化日志、敏感字段清理与部署副本一致性测试。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createStructuredLogger,
  describeError,
  fingerprintIdentifier,
} from '../../../lambda-functions/shared/structuredLogger.mjs';

const projectRoot = resolve(import.meta.dirname, '../../..');
const lambdaDirectories = [
  'gemini-proxy',
  'get-song-recommendations',
  'autoApproveEvent',
  'addVoiceEvent',
  'getVoiceEvents',
  'getUserProfile',
  'updateUserProfile',
  'deleteEvent',
  'getAllPublicEvents',
  'getAvatarUrl',
  'getFileUrl',
  'getUploadUrl',
  'getUserPublicProfile',
  'getReadingPassages',
  'vfsTrackerUserProfileSetup',
  'cleanupStorage',
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Lambda 结构化日志', () => {
  it('输出单行 JSON，并在任意层级清理请求和凭据字段', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createStructuredLogger({
      service: 'test-service',
      requestId: 'request-123',
      level: 'INFO',
      now: () => '2026-09-11T00:00:00.000Z',
    });

    logger.info('request_received', {
      route: '/test',
      body: 'private body',
      nested: { prompt: 'health data', authorization: 'Bearer secret', count: 2 },
      attachmentCount: 2,
      attachmentUrl: 'https://private.example/file.wav',
      safeText: 'one\ntwo',
    });

    expect(output).toHaveBeenCalledTimes(1);
    const serialized = output.mock.calls[0][0];
    const parsed = JSON.parse(serialized);
    expect(serialized).not.toContain('\n');
    expect(serialized).not.toContain('private body');
    expect(serialized).not.toContain('health data');
    expect(serialized).not.toContain('Bearer secret');
    expect(parsed).toMatchObject({
      timestamp: '2026-09-11T00:00:00.000Z',
      level: 'INFO',
      service: 'test-service',
      event: 'request_received',
      requestId: 'request-123',
      route: '/test',
      body: '[REDACTED]',
      nested: { prompt: '[REDACTED]', authorization: '[REDACTED]', count: 2 },
      attachmentCount: 2,
      attachmentUrl: '[REDACTED]',
      safeText: 'one two',
    });
  });

  it('按 LOG_LEVEL 过滤，并只记录安全错误分类', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createStructuredLogger({ service: 'test', level: 'WARN' });
    const error = Object.assign(new Error('token=secret'), {
      code: 'ThrottlingException',
      status: 429,
      stack: 'private stack',
    });

    logger.info('hidden');
    logger.error('operation_failed', describeError(error));

    expect(log).not.toHaveBeenCalled();
    const parsed = JSON.parse(errorOutput.mock.calls[0][0]);
    expect(parsed).toMatchObject({
      level: 'ERROR',
      event: 'operation_failed',
      errorName: 'Error',
      errorCode: 'ThrottlingException',
      errorStatus: 429,
    });
    expect(errorOutput.mock.calls[0][0]).not.toContain('token=secret');
    expect(errorOutput.mock.calls[0][0]).not.toContain('private stack');
  });

  it('用户标识只以稳定且不可逆的短指纹出现', () => {
    expect(fingerprintIdentifier('user-123')).toBe(fingerprintIdentifier('user-123'));
    expect(fingerprintIdentifier('user-123')).toMatch(/^[a-f0-9]{12}$/);
    expect(fingerprintIdentifier('user-123')).not.toContain('user-123');
  });

  it('十六个独立 CodeUri 中的运行时副本与共享源完全一致', async () => {
    const canonical = await readFile(resolve(projectRoot, 'lambda-functions/shared/structuredLogger.mjs'), 'utf8');
    const copies = await Promise.all(lambdaDirectories.map(directory => readFile(
      resolve(projectRoot, `lambda-functions/${directory}/structuredLogger.mjs`),
      'utf8'
    )));

    for (const copy of copies) expect(copy).toBe(canonical);
  });

  it('高风险处理程序不再直接输出请求、模型正文或完整事件', async () => {
    const handlerSources = await Promise.all(lambdaDirectories.map(directory => readFile(
      resolve(projectRoot, `lambda-functions/${directory}/index.mjs`),
      'utf8'
    )));
    const rateLimiterSources = await Promise.all(['gemini-proxy', 'get-song-recommendations'].map(directory => readFile(
      resolve(projectRoot, `lambda-functions/${directory}/rateLimiter.mjs`),
      'utf8'
    )));

    for (const source of [...handlerSources, ...rateLimiterSources]) {
      expect(source).not.toMatch(/console\.(?:log|info|warn|error|debug)/);
      expect(source).not.toMatch(/JSON\.stringify\(\s*event\s*[,)]/);
      expect(source).not.toMatch(/error:\s*error\.message/);
      expect(source).not.toMatch(/details:\s*error\.message/);
      expect(source).not.toMatch(/reason:\s*\w+\.message/);
    }
    for (const source of handlerSources) {
      expect(source).not.toContain('RAW RESPONSE FROM GEMINI');
      expect(source).not.toContain('REQUEST TO GEMINI');
      expect(source).not.toContain('Processing new event');
    }
  });

  it('开发与生产 SAM 模板都为 Lambda 设置 INFO 应用日志级别', async () => {
    const templates = await Promise.all(['template.yaml', 'template-production.yaml'].map(name => readFile(
      resolve(projectRoot, `infra/${name}`),
      'utf8'
    )));

    for (const template of templates) {
      expect(template).toMatch(/LOG_LEVEL:\s*INFO/);
      expect(template).toMatch(/ApplicationLogLevel:\s*INFO/);
    }
  });

});
