#!/usr/bin/env node
/**
 * @file ESA EdgeRoutine 自动部署脚本。
 * @description 该脚本负责创建 Routine、上传边缘函数源码、提交暂存代码，
 * 并将最新版本部署到 production 环境。脚本可以在本地或 GitHub Actions 中运行。
 */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const routineName = process.env.ESA_ROUTINE_NAME || 'vfstrackercn';
const codePath = resolve(process.env.ESA_ROUTINE_CODE || 'infra/esa-routine/cn-spa-fallback.js');
const codeDescription = process.env.ESA_ROUTINE_CODE_DESCRIPTION || `deploy-${new Date().toISOString()}`;
const targetEnv = process.env.ESA_ROUTINE_ENV || 'production';

/**
 * 调用 aliyun CLI 并返回标准输出。
 * @param {string[]} args - aliyun CLI 参数。
 * @param {{ allowFailure?: boolean }} options - 调用选项。
 * @returns {{ ok: boolean, stdout: string, error?: unknown }} 调用结果。
 */
function runAliyun(args, options = {}) {
  try {
    const stdout = execFileSync('aliyun', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, stdout };
  } catch (error) {
    if (options.allowFailure) {
      return {
        ok: false,
        stdout: error.stdout?.toString?.() || '',
        error,
      };
    }
    throw error;
  }
}

/**
 * 解析 aliyun CLI JSON 输出。
 * @param {string} stdout - CLI 输出。
 * @returns {Record<string, unknown>} JSON 对象。
 */
function parseJson(stdout) {
  return JSON.parse(stdout);
}

/**
 * 从提交响应中递归查找 CodeVersion。
 * @param {unknown} value - 任意 JSON 值。
 * @returns {string|null} 找到的 CodeVersion。
 */
function findCodeVersion(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (typeof value.CodeVersion === 'string') {
    return value.CodeVersion;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCodeVersion(item);
      if (found) return found;
    }
    return null;
  }

  for (const item of Object.values(value)) {
    const found = findCodeVersion(item);
    if (found) return found;
  }
  return null;
}

/** 确保 Routine 已存在；已存在或已创建都视为成功。 */
function ensureRoutine() {
  const current = runAliyun(['esa', 'GetRoutine', '--Name', routineName], { allowFailure: true });
  if (current.ok) {
    console.log(`[esa-routine] Routine ${routineName} already exists.`);
    return;
  }

  console.log(`[esa-routine] Creating Routine ${routineName}.`);
  runAliyun([
    'esa',
    'CreateRoutine',
    '--Name',
    routineName,
    '--Description',
    'SPA fallback for vfs-tracker.cn GitHub Pages origin',
  ]);
}

/**
 * 上传源码到 ESA 提供的 OSS 暂存位置。
 * @returns {Promise<Record<string, unknown>>} 上传信息 JSON。
 */
async function uploadStagingCode() {
  const uploadInfo = parseJson(runAliyun([
    'esa',
    'GetRoutineStagingCodeUploadInfo',
    '--Name',
    routineName,
  ]).stdout);
  const config = uploadInfo.OssPostConfig;

  if (!config || typeof config.Url !== 'string') {
    throw new Error('Invalid upload info: OssPostConfig.Url is missing.');
  }

  const code = await readFile(codePath, 'utf8');
  const form = new FormData();
  const orderedFields = [
    'key',
    'OSSAccessKeyId',
    'policy',
    'Signature',
    'XOssSecurityToken',
    'callback',
    'x:codeDescription',
  ];

  for (const fieldName of orderedFields) {
    if (config[fieldName]) {
      form.append(fieldName, config[fieldName]);
    }
  }
  // x:codeDescription 被 OSS policy 绑定，必须使用 ESA 返回的原始字段。
  form.append('file', new Blob([code], { type: 'application/javascript' }), 'index.js');

  const response = await fetch(config.Url, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Routine code upload failed: ${response.status} ${body}`);
  }

  console.log(`[esa-routine] Uploaded staging code from ${codePath}.`);
  return uploadInfo;
}

/** 提交暂存代码并部署到目标环境。 */
async function deployRoutine() {
  ensureRoutine();
  const uploadInfo = await uploadStagingCode();
  const commitResult = parseJson(runAliyun([
    'esa',
    'CommitRoutineStagingCode',
    '--Name',
    routineName,
    '--CodeDescription',
    codeDescription,
  ]).stdout);
  const codeVersion = findCodeVersion(commitResult) || uploadInfo.CodeVersion;

  if (!codeVersion || codeVersion === 'unstable') {
    throw new Error(`Cannot determine committed CodeVersion from response: ${JSON.stringify(commitResult)}`);
  }

  const codeVersions = JSON.stringify([{ CodeVersion: codeVersion, Percentage: 100 }]);
  runAliyun([
    'esa',
    'CreateRoutineCodeDeployment',
    '--Name',
    routineName,
    '--Env',
    targetEnv,
    '--Strategy',
    'percentage',
    '--CodeVersions',
    codeVersions,
  ]);
  console.log(`[esa-routine] Deployed ${routineName}@${codeVersion} to ${targetEnv}.`);
}

await deployRoutine();
