import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachmentKeyFromReference,
  createStorageCleanupHandler,
  rawRecordingSessionId,
  timestampToMilliseconds,
  voiceSessionCleanupDecision,
} from '../../../lambda-functions/cleanupStorage/index.mjs';

const NOW = Date.parse('2026-09-11T08:00:00.000Z');

function awsClients({ eventPages, sessionPages, objectPages }) {
  let eventPage = 0;
  let sessionPage = 0;
  const documentClient = {
    send: vi.fn(command => {
      if (command.input.TableName === 'events') return Promise.resolve(eventPages[eventPage++]);
      if (command.input.TableName === 'tests') return Promise.resolve(sessionPages[sessionPage++]);
      throw new Error(`Unexpected table ${command.input.TableName}`);
    }),
  };
  const s3Client = {
    send: vi.fn(command => {
      if (command.constructor.name === 'ListObjectsV2Command') {
        const pages = objectPages[command.input.Prefix] || [{ Contents: [] }];
        const index = command.input.ContinuationToken ? 1 : 0;
        return Promise.resolve(pages[index]);
      }
      if (command.constructor.name === 'DeleteObjectsCommand') return Promise.resolve({});
      throw new Error(`Unexpected S3 command ${command.constructor.name}`);
    }),
  };
  return { documentClient, s3Client };
}

describe('cleanupStorage helpers', () => {
  it('normalizes seconds, milliseconds and ISO timestamps', () => {
    expect(timestampToMilliseconds(1_700_000_000)).toBe(1_700_000_000_000);
    expect(timestampToMilliseconds('1700000000000')).toBe(1_700_000_000_000);
    expect(timestampToMilliseconds('2026-09-11T08:00:00Z')).toBe(NOW);
    expect(timestampToMilliseconds(new Date(NOW))).toBe(NOW);
    expect(timestampToMilliseconds('invalid')).toBeNull();
  });

  it('only accepts attachment keys from the configured bucket', () => {
    expect(attachmentKeyFromReference('attachments/user/report.pdf', 'bucket-a')).toBe('attachments/user/report.pdf');
    expect(attachmentKeyFromReference('s3://bucket-a/attachments/user/report.pdf', 'bucket-a')).toBe('attachments/user/report.pdf');
    expect(attachmentKeyFromReference('https://storage.example/attachments/user/a%20b.pdf', 'bucket-a')).toBe('attachments/user/a b.pdf');
    expect(attachmentKeyFromReference('s3://bucket-b/attachments/user/report.pdf', 'bucket-a')).toBeNull();
    expect(attachmentKeyFromReference('avatars/user/avatar.png', 'bucket-a')).toBeNull();
    expect(rawRecordingSessionId('voice-tests/session-a/raw/2/take.wav')).toBe('session-a');
    expect(rawRecordingSessionId('voice-tests/session-a/artifacts/chart.png')).toBeNull();
  });

  it('uses separate retention windows for terminal, abandoned and processing sessions', () => {
    const retention = { terminalMs: 60_000, abandonedMs: 120_000, processingMs: 360_000 };
    expect(voiceSessionCleanupDecision({ sessionId: 'done', status: 'done', updatedAt: (NOW - 60_000) / 1000 }, NOW, retention)).toEqual({ eligible: true, reason: 'terminal' });
    expect(voiceSessionCleanupDecision({ sessionId: 'new', status: 'created', createdAt: (NOW - 60_000) / 1000 }, NOW, retention).eligible).toBe(false);
    expect(voiceSessionCleanupDecision({ sessionId: 'old', status: 'pending', createdAt: (NOW - 120_000) / 1000 }, NOW, retention).reason).toBe('abandoned');
    expect(voiceSessionCleanupDecision({ sessionId: 'busy', status: 'processing', updatedAt: (NOW - 359_999) / 1000 }, NOW, retention).eligible).toBe(false);
    expect(voiceSessionCleanupDecision({ sessionId: 'future', status: 'failed', updatedAt: NOW + 1 }, NOW, retention).eligible).toBe(false);
  });
});

describe('cleanupStorage handler', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));

  it('paginates scans, keeps referenced and fresh attachments, and deletes only eligible raw recordings', async () => {
    const old = new Date(NOW - 8 * 24 * 60 * 60 * 1000);
    const fresh = new Date(NOW - 60 * 60 * 1000);
    const clients = awsClients({
      eventPages: [
        { Items: [{ attachments: [{ fileUrl: 'attachments/u/kept.pdf' }] }], LastEvaluatedKey: { userId: 'u' } },
        { Items: [{ attachments: [{ fileUrl: 's3://bucket/attachments/u/also-kept.pdf' }] }] },
      ],
      sessionPages: [{ Items: [
        { sessionId: 'done-session', status: 'done', updatedAt: (NOW - 2 * 60 * 60 * 1000) / 1000 },
        { sessionId: 'active-session', status: 'processing', updatedAt: (NOW - 60 * 60 * 1000) / 1000 },
        { sessionId: 'abandoned-session', status: 'created', createdAt: (NOW - 3 * 60 * 60 * 1000) / 1000 },
      ] }],
      objectPages: {
        'attachments/': [
          {
            Contents: [
              { Key: 'attachments/u/kept.pdf', LastModified: old },
              { Key: 'attachments/u/also-kept.pdf', LastModified: old },
            ],
            IsTruncated: true,
            NextContinuationToken: 'attachments-page-2',
          },
          { Contents: [
            { Key: 'attachments/u/orphan.pdf', LastModified: old },
            { Key: 'attachments/u/fresh.pdf', LastModified: fresh },
          ] },
        ],
        'voice-tests/': [{ Contents: [
          { Key: 'voice-tests/done-session/raw/2/a.wav' },
          { Key: 'voice-tests/done-session/report.pdf' },
          { Key: 'voice-tests/abandoned-session/raw/1/a.wav' },
          { Key: 'voice-tests/active-session/raw/1/a.wav' },
        ] }],
      },
    });
    const run = createStorageCleanupHandler({
      ...clients,
      clock: () => NOW,
      environment: { BUCKET_NAME: 'bucket', EVENTS_TABLE: 'events', VOICE_TESTS_TABLE: 'tests' },
    });

    const result = await run();

    expect(result).toMatchObject({ orphanAttachmentCount: 1, eligibleSessionCount: 2, rawRecordingCount: 2, deletedObjects: 3 });
    const deleteCommand = clients.s3Client.send.mock.calls.map(([command]) => command)
      .find(command => command.constructor.name === 'DeleteObjectsCommand');
    expect(deleteCommand.input.Delete.Objects).toEqual([
      { Key: 'attachments/u/orphan.pdf' },
      { Key: 'voice-tests/done-session/raw/2/a.wav' },
      { Key: 'voice-tests/abandoned-session/raw/1/a.wav' },
    ]);
    expect(clients.s3Client.send.mock.calls.filter(([command]) => command.constructor.name === 'ListObjectsV2Command')).toHaveLength(3);
    expect(clients.documentClient.send).toHaveBeenCalledTimes(3);
  });

  it('supports dry-run without sending DeleteObjects', async () => {
    const clients = awsClients({
      eventPages: [{ Items: [] }],
      sessionPages: [{ Items: [] }],
      objectPages: {
        'attachments/': [{ Contents: [{ Key: 'attachments/u/orphan.pdf', LastModified: new Date(NOW - 8 * 24 * 60 * 60 * 1000) }] }],
        'voice-tests/': [{ Contents: [] }],
      },
    });
    const run = createStorageCleanupHandler({
      ...clients,
      clock: () => NOW,
      environment: { BUCKET_NAME: 'bucket', EVENTS_TABLE: 'events', VOICE_TESTS_TABLE: 'tests', DRY_RUN: 'true' },
    });

    await expect(run()).resolves.toMatchObject({ dryRun: true, orphanAttachmentCount: 1, deletedObjects: 0 });
    expect(clients.s3Client.send.mock.calls.every(([command]) => command.constructor.name !== 'DeleteObjectsCommand')).toBe(true);
  });

  it('fails the run when S3 reports a partial batch deletion error', async () => {
    const clients = awsClients({
      eventPages: [{ Items: [] }],
      sessionPages: [{ Items: [] }],
      objectPages: {
        'attachments/': [{ Contents: [{ Key: 'attachments/u/orphan.pdf', LastModified: new Date(NOW - 8 * 24 * 60 * 60 * 1000) }] }],
        'voice-tests/': [{ Contents: [] }],
      },
    });
    clients.s3Client.send.mockImplementation(command => {
      if (command.constructor.name === 'ListObjectsV2Command') return Promise.resolve({ Contents: [{ Key: 'attachments/u/orphan.pdf', LastModified: new Date(NOW - 8 * 24 * 60 * 60 * 1000) }] });
      if (command.constructor.name === 'DeleteObjectsCommand') return Promise.resolve({ Errors: [{ Key: 'attachments/u/orphan.pdf', Code: 'AccessDenied' }] });
      throw new Error('Unexpected command');
    });
    const run = createStorageCleanupHandler({
      ...clients,
      clock: () => NOW,
      environment: { BUCKET_NAME: 'bucket', EVENTS_TABLE: 'events', VOICE_TESTS_TABLE: 'tests' },
    });

    await expect(run()).rejects.toThrow('object deletion errors');
  });

  it('splits more than 1000 objects into valid S3 deletion batches', async () => {
    const old = new Date(NOW - 8 * 24 * 60 * 60 * 1000);
    const objects = Array.from({ length: 1001 }, (_, index) => ({
      Key: `attachments/u/orphan-${index}.pdf`,
      LastModified: old,
    }));
    const clients = awsClients({
      eventPages: [{ Items: [] }],
      sessionPages: [{ Items: [] }],
      objectPages: {
        'attachments/': [{ Contents: objects }],
        'voice-tests/': [{ Contents: [] }],
      },
    });
    const run = createStorageCleanupHandler({
      ...clients,
      clock: () => NOW,
      environment: { BUCKET_NAME: 'bucket', EVENTS_TABLE: 'events', VOICE_TESTS_TABLE: 'tests' },
    });

    await expect(run()).resolves.toMatchObject({ orphanAttachmentCount: 1001, deletedObjects: 1001 });
    const batches = clients.s3Client.send.mock.calls.map(([command]) => command)
      .filter(command => command.constructor.name === 'DeleteObjectsCommand');
    expect(batches.map(command => command.input.Delete.Objects.length)).toEqual([1000, 1]);
  });
});
