/**
 * @file 前后端发布顺序与质量门禁测试。
 * @description 防止需要新 Lambda 协议的前端先发布，或后端未测试便更新真实资源。
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('release pipeline', () => {
  it('每次 master 推送先运行后端工作流，再由成功结果触发前端', async () => {
    const [backend, frontend, pullRequest] = await Promise.all([
      readFile('.github/workflows/deploy-backend.yml', 'utf8'),
      readFile('.github/workflows/deploy.yml', 'utf8'),
      readFile('.github/workflows/verify-pr.yml', 'utf8'),
    ]);

    const normalizedBackend = backend.replaceAll('\r\n', '\n');

    expect(normalizedBackend).toContain('branches:\n      - master');
    expect(normalizedBackend).not.toContain('branches:\n      - master\n    paths:');
    expect(frontend).toContain("workflows: ['Deploy Backend']");
    expect(frontend).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(frontend).toContain('ref: ${{ github.event.workflow_run.head_sha }}');
    expect(frontend).not.toContain('workflow_dispatch:');
    expect(pullRequest).toContain('  pull_request:');
    expect(pullRequest).toContain('Run integration tests');
    expect(pullRequest).toContain('Run production PWA offline tests');
    expect(pullRequest).toContain('Build production SAM application');
    expect(pullRequest).toContain('VITE_API_ENDPOINT: https://api.vfs-tracker.invalid');
    expect(pullRequest).not.toContain('${{ secrets.API_ENDPOINT }}');
    expect(pullRequest).not.toContain('id-token: write');
  });

  it('后端部署与镜像更新都依赖自动回归验证', async () => {
    const [workflow, imageWorkflow] = await Promise.all([
      readFile('.github/workflows/deploy-backend.yml', 'utf8'),
      readFile('.github/workflows/build-python-lambda.yml', 'utf8'),
    ]);
    const verification = workflow.indexOf('  verify:');
    const imageBuild = workflow.indexOf('  build-python-image:');
    const deployment = workflow.indexOf('  deploy:');

    expect(verification).toBeGreaterThan(0);
    expect(imageBuild).toBeGreaterThan(verification);
    expect(deployment).toBeGreaterThan(imageBuild);
    expect(workflow).toContain('needs: [check-image-changes, verify]');
    expect(workflow).toContain('needs: [check-image-changes, verify, build-python-image]');
    expect(workflow).toContain('tests/integration/api');
    expect(workflow).not.toContain('skip_image_build');
    expect(workflow).not.toContain('deploy_api_gateway');
    expect(imageWorkflow).toContain('  workflow_call:');
    expect(imageWorkflow).not.toContain('workflow_dispatch:');
    expect(imageWorkflow).not.toContain('id-token: write');
    expect(imageWorkflow).toContain('push: ${{ inputs.publish }}');
    expect(workflow).toContain('publish: true');
    expect(imageWorkflow).toContain('image_uri: ${{ steps.image-uri.outputs.image_uri }}');
    expect(imageWorkflow).not.toContain('aws lambda update-function-code');
    expect(workflow.indexOf('sam deploy')).toBeLessThan(workflow.indexOf('Publish verified Python Lambda image'));
    expect(workflow).toContain('IMAGE_URI: ${{ needs.build-python-image.outputs.image_uri }}');
    expect(workflow).toContain('--image-uri "$IMAGE_URI"');

    const pullRequest = await readFile('.github/workflows/verify-pr.yml', 'utf8');
    expect(pullRequest).toContain("grep -q '^lambda-functions/online-praat-analysis/'");
    expect(pullRequest).toContain('uses: ./.github/workflows/build-python-lambda.yml');
    expect(pullRequest).toContain('publish: false');
  });

  it('Python Lambda 镜像构建完整测试且不把 pytest 带入运行阶段', async () => {
    const [dockerfile, dockerignore, runtimeRequirements, testRequirements, imageWorkflow, localInstaller] = await Promise.all([
      readFile('lambda-functions/online-praat-analysis/Dockerfile', 'utf8'),
      readFile('lambda-functions/online-praat-analysis/.dockerignore', 'utf8'),
      readFile('lambda-functions/online-praat-analysis/requirements.txt', 'utf8'),
      readFile('lambda-functions/online-praat-analysis/requirements-test.txt', 'utf8'),
      readFile('.github/workflows/build-python-lambda.yml', 'utf8'),
      readFile('scripts/install_parselmouth_dev.py', 'utf8'),
    ]);

    expect(dockerfile).toContain('FROM public.ecr.aws/lambda/python:3.13 AS parselmouth-builder');
    expect(dockerfile).toContain('git checkout --detach "${PARSELMOUTH_SOURCE_COMMIT}"');
    expect(dockerfile).toContain('To Pitch (filtered autocorrelation)');
    expect(dockerfile).toContain('FROM prepared AS test');
    expect(dockerfile).toContain('pip install --no-cache-dir -r requirements-test.txt');
    expect(dockerfile).toContain('python -m pytest tests');
    expect(dockerfile).toContain('FROM prepared AS runtime');
    expect(dockerfile).toContain('COPY --from=test /tmp/python-tests-passed');
    expect(dockerfile).toContain('RUN rm -rf tests .pytest_cache');
    expect(dockerignore.split(/\r?\n/)).not.toContain('tests/');
    expect(runtimeRequirements).not.toContain('praat-parselmouth');
    expect(testRequirements).toContain('pytest');
    expect(testRequirements).toContain('moto[s3,dynamodb]');
    expect(imageWorkflow).toContain("PARSELMOUTH_SOURCE_COMMIT: '0a0594265823f5c3fdaa661a05c887cdf02ec143'");
    expect(imageWorkflow).not.toContain('gh run download');
    expect(imageWorkflow).not.toContain('PARSELMOUTH_DEV_WHEEL_ENABLED');
    expect(localInstaller).toContain('DEFAULT_COMMIT = "0a0594265823f5c3fdaa661a05c887cdf02ec143"');
    expect(localInstaller).toContain('FILTERED_AUTOCORRELATION=available');
    expect(localInstaller).not.toContain('gh run download');
  });
});
