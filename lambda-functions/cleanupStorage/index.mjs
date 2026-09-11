/**
 * @file 定期清理 S3 中未被事件引用的附件，以及不再需要的嗓音测试原始录音。
 *
 * 清理任务以 DynamoDB 为引用真源。事件附件设置七天宽限期，避免用户长时间停留在
 * 表单时被清理；嗓音测试只删除 `raw/` 下的录音，保留报告与图表。
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createStructuredLogger } from './structuredLogger.mjs';

const defaultDocumentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const defaultS3Client = new S3Client({});

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['done', 'failed']);
const ABANDONED_STATUSES = new Set(['created', 'pending']);

/**
 * 将环境变量中的正整数转换为毫秒。
 * @param {unknown} value - 以小时或天为单位的环境变量值。
 * @param {number} fallback - 无效输入时使用的默认值。
 * @param {number} unitMs - 单位对应的毫秒数。
 * @returns {number} 转换后的毫秒数。
 */
function durationFromEnvironment(value, fallback, unitMs) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * unitMs : fallback;
}

/**
 * 将 DynamoDB 时间字段转换为毫秒时间戳，兼容秒、毫秒和 ISO 8601 字符串。
 * @param {unknown} value - DynamoDB 中保存的时间值。
 * @returns {number|null} 有效毫秒时间戳；无法解析时返回 null。
 */
export function timestampToMilliseconds(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 1e12 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 从事件附件引用中提取当前存储桶内的附件对象键。
 * @param {unknown} reference - 纯对象键、S3 URI 或 HTTPS URL。
 * @param {string} bucketName - 当前业务存储桶名称。
 * @returns {string|null} `attachments/` 对象键；其他路径或无效值返回 null。
 */
export function attachmentKeyFromReference(reference, bucketName) {
  if (typeof reference !== 'string' || !reference.trim()) return null;
  const value = reference.trim();
  let key = value.replace(/^\/+/, '');

  if (value.startsWith('s3://')) {
    const withoutScheme = value.slice(5);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex < 0 || withoutScheme.slice(0, slashIndex) !== bucketName) return null;
    key = withoutScheme.slice(slashIndex + 1);
  } else if (value.startsWith('https://') || value.startsWith('http://')) {
    try {
      key = decodeURIComponent(new URL(value).pathname.replace(/^\/+/, ''));
    } catch {
      return null;
    }
  }

  return key.startsWith('attachments/') ? key : null;
}

/**
 * 从嗓音测试对象键中提取原始录音所属的会话 ID。
 * @param {unknown} key - S3 对象键。
 * @returns {string|null} `voice-tests/{sessionId}/raw/` 中的会话 ID；其他对象返回 null。
 */
export function rawRecordingSessionId(key) {
  if (typeof key !== 'string') return null;
  const parts = key.split('/');
  return parts.length >= 4 && parts[0] === 'voice-tests' && parts[1] && parts[2] === 'raw'
    ? parts[1]
    : null;
}

/**
 * 判断一个嗓音测试会话的原始录音是否可以清理。
 * @param {object} session - VoiceFemTests 表中的会话记录。
 * @param {number} nowMs - 当前毫秒时间戳。
 * @param {{terminalMs:number, abandonedMs:number, processingMs:number}} retention - 各状态保留时长。
 * @returns {{eligible:boolean, reason:string|null}} 清理资格与原因。
 */
export function voiceSessionCleanupDecision(session, nowMs, retention) {
  const status = String(session?.status || '').toLowerCase();
  const lastChanged = timestampToMilliseconds(session?.updatedAt)
    ?? timestampToMilliseconds(session?.createdAt);
  if (!session?.sessionId || lastChanged === null || lastChanged > nowMs) {
    return { eligible: false, reason: null };
  }
  const age = nowMs - lastChanged;
  if (TERMINAL_STATUSES.has(status) && age >= retention.terminalMs) {
    return { eligible: true, reason: 'terminal' };
  }
  if (ABANDONED_STATUSES.has(status) && age >= retention.abandonedMs) {
    return { eligible: true, reason: 'abandoned' };
  }
  if (status === 'processing' && age >= retention.processingMs) {
    return { eligible: true, reason: 'stale-processing' };
  }
  return { eligible: false, reason: null };
}

/**
 * 完整扫描 DynamoDB 表，消费所有 LastEvaluatedKey 页面。
 * @param {DynamoDBDocumentClient} client - DynamoDB 文档客户端。
 * @param {object} input - ScanCommand 的基础参数。
 * @returns {Promise<object[]>} 所有扫描结果。
 */
async function scanAll(client, input) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const response = await client.send(new ScanCommand({ ...input, ExclusiveStartKey }));
    items.push(...(response.Items || []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/**
 * 完整列出指定前缀下的所有 S3 对象。
 * @param {S3Client} client - S3 客户端。
 * @param {string} bucketName - 存储桶名称。
 * @param {string} prefix - 对象键前缀。
 * @returns {Promise<object[]>} 对象元数据列表。
 */
async function listAllObjects(client, bucketName, prefix) {
  const objects = [];
  let ContinuationToken;
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken,
    }));
    objects.push(...(response.Contents || []));
    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

/**
 * 以 S3 每批最多 1000 个对象的限制执行删除，并检查逐对象错误。
 * @param {S3Client} client - S3 客户端。
 * @param {string} bucketName - 存储桶名称。
 * @param {string[]} keys - 待删除对象键。
 * @returns {Promise<number>} 成功提交删除的对象数量。
 */
async function deleteObjectKeys(client, bucketName, keys) {
  let deleted = 0;
  for (let offset = 0; offset < keys.length; offset += 1000) {
    const batch = keys.slice(offset, offset + 1000);
    const response = await client.send(new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true },
    }));
    if (response.Errors?.length) {
      throw new Error(`S3 reported ${response.Errors.length} object deletion errors`);
    }
    deleted += batch.length;
  }
  return deleted;
}

/**
 * 创建可注入 AWS 客户端和时钟的清理处理程序，便于单元测试覆盖真实分页与删除流程。
 * @param {object} [dependencies] - 可替换依赖。
 * @param {DynamoDBDocumentClient} [dependencies.documentClient] - DynamoDB 文档客户端。
 * @param {S3Client} [dependencies.s3Client] - S3 客户端。
 * @param {() => number} [dependencies.clock] - 返回当前毫秒时间戳的函数。
 * @param {object} [dependencies.environment] - 覆盖运行时环境变量的配置。
 * @returns {() => Promise<object>} EventBridge Lambda 处理程序。
 */
export function createStorageCleanupHandler({
  documentClient = defaultDocumentClient,
  s3Client = defaultS3Client,
  clock = () => Date.now(),
  environment = process.env,
  logger = createStructuredLogger({ service: 'cleanupStorage' }),
} = {}) {
  return async function cleanupStorage() {
    const bucketName = environment.BUCKET_NAME;
    const eventsTable = environment.EVENTS_TABLE;
    const testsTable = environment.VOICE_TESTS_TABLE;
    if (!bucketName || !eventsTable || !testsTable) {
      throw new Error('BUCKET_NAME, EVENTS_TABLE and VOICE_TESTS_TABLE are required');
    }

    const nowMs = clock();
    const dryRun = String(environment.DRY_RUN || '').toLowerCase() === 'true';
    const attachmentGraceMs = durationFromEnvironment(environment.ATTACHMENT_GRACE_DAYS, 7 * DAY_MS, DAY_MS);
    const retention = {
      terminalMs: durationFromEnvironment(environment.TERMINAL_RAW_RETENTION_HOURS, HOUR_MS, HOUR_MS),
      abandonedMs: durationFromEnvironment(environment.ABANDONED_RAW_RETENTION_HOURS, 2 * HOUR_MS, HOUR_MS),
      processingMs: durationFromEnvironment(environment.PROCESSING_RAW_RETENTION_HOURS, 6 * HOUR_MS, HOUR_MS),
    };

    // 先列对象、后强一致扫描引用；宽限期保护扫描期间刚上传但尚未写入事件的文件。
    const attachmentObjects = await listAllObjects(s3Client, bucketName, 'attachments/');
    const events = await scanAll(documentClient, {
      TableName: eventsTable,
      ProjectionExpression: 'attachments',
      ConsistentRead: true,
    });
    const referencedAttachments = new Set(events.flatMap(event => (
      Array.isArray(event.attachments)
        ? event.attachments.map(item => attachmentKeyFromReference(item?.fileUrl ?? item?.s3Key, bucketName)).filter(Boolean)
        : []
    )));
    const attachmentCutoff = nowMs - attachmentGraceMs;
    const orphanAttachmentKeys = attachmentObjects
      .filter(object => object.Key
        && !referencedAttachments.has(object.Key)
        && timestampToMilliseconds(object.LastModified) !== null
        && timestampToMilliseconds(object.LastModified) <= attachmentCutoff)
      .map(object => object.Key);

    // 先固定 S3 对象快照，再读取会话状态；扫描之后才上传的对象不会被本轮误删。
    const voiceTestObjects = await listAllObjects(s3Client, bucketName, 'voice-tests/');
    const sessions = await scanAll(documentClient, {
      TableName: testsTable,
      ProjectionExpression: 'sessionId, #status, createdAt, updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ConsistentRead: true,
    });
    const eligibleSessions = new Set();
    const voiceReasons = { terminal: 0, abandoned: 0, 'stale-processing': 0 };
    for (const session of sessions) {
      const decision = voiceSessionCleanupDecision(session, nowMs, retention);
      if (!decision.eligible) continue;
      voiceReasons[decision.reason] += 1;
      eligibleSessions.add(session.sessionId);
    }
    const rawKeys = voiceTestObjects
      .filter(object => eligibleSessions.has(rawRecordingSessionId(object.Key)))
      .map(object => object.Key);

    const selectedKeys = [...new Set([...orphanAttachmentKeys, ...rawKeys])];
    const deletedObjects = dryRun ? 0 : await deleteObjectKeys(s3Client, bucketName, selectedKeys);
    const summary = {
      dryRun,
      referencedAttachmentCount: referencedAttachments.size,
      scannedAttachmentCount: attachmentObjects.length,
      orphanAttachmentCount: orphanAttachmentKeys.length,
      scannedSessionCount: sessions.length,
      eligibleSessionCount: Object.values(voiceReasons).reduce((sum, count) => sum + count, 0),
      rawRecordingCount: rawKeys.length,
      deletedObjects,
      voiceReasons,
    };
    logger.info('storage_cleanup_completed', summary);
    return summary;
  };
}

/** EventBridge 每日调用的默认 Lambda 入口。 */
export const handler = createStorageCleanupHandler();
