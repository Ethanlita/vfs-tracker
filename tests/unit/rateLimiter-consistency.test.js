/**
 * @file rateLimiter 文件一致性检查测试
 * 确保 gemini-proxy 和 get-song-recommendations 两个 Lambda 目录中的
 * rateLimiter.mjs 文件内容完全一致，防止代码 drift
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// 获取项目根目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath - 文件路径
 * @returns {string} MD5 哈希值
 */
function getFileHash(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('md5').update(content).digest('hex');
}

describe('rateLimiter 文件一致性检查', () => {
  const geminiProxyPath = resolve(projectRoot, 'lambda-functions/gemini-proxy/rateLimiter.mjs');
  const songRecommendationsPath = resolve(projectRoot, 'lambda-functions/get-song-recommendations/rateLimiter.mjs');

  it('两个 Lambda 目录中的 rateLimiter.mjs 应该完全相同', () => {
    const geminiProxyHash = getFileHash(geminiProxyPath);
    const songRecommendationsHash = getFileHash(songRecommendationsPath);

    expect(geminiProxyHash).toBe(songRecommendationsHash);
  });

  it('rateLimiter.mjs 应该存在于两个 Lambda 目录中', () => {
    // 如果文件不存在，readFileSync 会抛出错误
    expect(() => readFileSync(geminiProxyPath)).not.toThrow();
    expect(() => readFileSync(songRecommendationsPath)).not.toThrow();
  });

  it('rateLimiter.mjs 应该导出必需的函数', () => {
    const content = readFileSync(geminiProxyPath, 'utf-8');
    
    // 同步函数
    const syncExports = [
      'cleanExpiredHistory',
      'checkRateLimit',
      'calculateNextAvailableTime',
      'formatNextAvailableTime',
      'extractUserIdFromEvent',
      'generateAdviceRateLimitMessage',
      'generateSongRateLimitMessage'
    ];

    // 异步函数
    const asyncExports = [
      'getRateLimitConfig',
      'getUserRateLimitData',
      'updateAdviceRateLimitData',
      'updateSongRateLimitData'
    ];

    for (const exportName of syncExports) {
      expect(content).toContain(`export function ${exportName}`);
    }

    for (const exportName of asyncExports) {
      expect(content).toContain(`export async function ${exportName}`);
    }
  });
});
