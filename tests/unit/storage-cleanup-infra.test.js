import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const productionTemplate = fs.readFileSync(path.join(root, 'infra/template-production.yaml'), 'utf8');
const developmentTemplate = fs.readFileSync(path.join(root, 'infra/template.yaml'), 'utf8');
const cleanupPackage = JSON.parse(fs.readFileSync(path.join(root, 'lambda-functions/cleanupStorage/package.json'), 'utf8'));
const cleanupLock = JSON.parse(fs.readFileSync(path.join(root, 'lambda-functions/cleanupStorage/package-lock.json'), 'utf8'));

describe('cleanupStorage infrastructure', () => {
  it.each([
    ['production', productionTemplate],
    ['development', developmentTemplate],
  ])('declares the scheduled cleanup function in the %s template', (_name, template) => {
    expect(template).toContain('CleanupStorageFunction:');
    expect(template).toContain('CodeUri: ../lambda-functions/cleanupStorage/');
    expect(template).toContain('Type: Schedule');
    expect(template).toContain('Schedule: cron(15 3 * * ? *)');
    expect(template).toContain('ATTACHMENT_GRACE_DAYS: "7"');
    expect(template).toContain('PROCESSING_RAW_RETENTION_HOURS: "6"');
  });

  it('limits production deletion permissions to attachments and voice-test raw recordings', () => {
    expect(productionTemplate).toContain('Action: dynamodb:Scan');
    expect(productionTemplate).toContain('Action: s3:DeleteObject');
    expect(productionTemplate).toContain('/attachments/*');
    expect(productionTemplate).toContain('/voice-tests/*/raw/*');
  });

  it('locks every AWS SDK dependency required by the isolated Lambda package', () => {
    for (const dependency of Object.keys(cleanupPackage.dependencies)) {
      expect(cleanupLock.packages[`node_modules/${dependency}`]).toBeTruthy();
    }
  });
});
