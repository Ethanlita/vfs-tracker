/** @file 公共事件接口：完整扫描、轻量首屏以及按事件 ID 分页读取公开明细。 */
import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const eventsTable = process.env.EVENTS_TABLE || 'VoiceFemEvents';
const usersTable = process.env.USERS_TABLE || 'VoiceFemUsers';
const ttl = 15_000;
const lightFields = ['fundamentalFrequency', 'doctor', 'customDoctor', 'surgeryMethod'];
const detailFields = [...lightFields, 'sound', 'customSoundDetail', 'voicing', 'customVoicingDetail',
  'trainingContent', 'practiceContent', 'location', 'customLocation', 'instructor',
  'voiceStatus', 'feelings', 'content', 'notes', 'formants', 'pitch', 'jitter', 'shimmer', 'hnr'];
const headers = {
  'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,If-None-Match,Cache-Control',
  'Access-Control-Expose-Headers': 'ETag,Cache-Control', 'Cache-Control': 'no-store'
};

/**
 * 选择明确允许公开的字段，统一历史类型并排除无效基频和日期。
 * @param {object} item 数据库事件。
 * @param {boolean} light 是否为首屏投影。
 * @returns {object} 不含附件及 full_metrics 的公共事件。
 */
function project(item, light) {
  const details = Object.fromEntries((light ? lightFields : detailFields)
    .filter(key => item.details?.[key] !== undefined).map(key => [key, item.details[key]]));
  const value = details.fundamentalFrequency;
  const frequency = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  if (Number.isFinite(frequency) && frequency > 0) details.fundamentalFrequency = frequency;
  else delete details.fundamentalFrequency;
  return { userId: item.userId, eventId: item.eventId,
    type: typeof item.type === 'string' ? item.type.replaceAll('-', '_') : 'unknown',
    date: item.date && Number.isFinite(Date.parse(item.date)) ? item.date : null, details };
}

/**
 * 创建处理器；依赖可注入以验证分页、重试和缓存的实际行为。
 * @param {object} dependencies 数据库、时钟和退避等待函数。
 * @returns {Function} API Gateway 处理器。
 */
export function createHandler({ db = docClient, now = Date.now,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let cache;
  let inFlight;

  /**
   * 批量读取并重试未处理键；重试耗尽时整体失败，禁止返回伪完整结果。
   * @param {string} table 表名。
   * @param {object[]} keys 唯一主键列表。
   * @param {string} projection 投影表达式。
   * @returns {Promise<object[]>} 所有已处理键中存在的记录。
   */
  async function batchRead(table, keys, projection) {
    const items = [];
    for (let offset = 0; offset < keys.length; offset += 100) {
      let request = { [table]: { Keys: keys.slice(offset, offset + 100),
        ConsistentRead: true, ...(projection ? { ProjectionExpression: projection } : {}) } };
      for (let attempt = 0; ; attempt++) {
        const result = await db.send(new BatchGetCommand({ RequestItems: request }));
        items.push(...(result.Responses?.[table] || []));
        request = result.UnprocessedKeys;
        if (!request?.[table]?.Keys?.length) break;
        console.info('PublicBatchRetry', { table, attempt: attempt + 1, remaining: request[table].Keys.length });
        if (attempt >= 4) throw new Error('Public data read retries exhausted');
        // 有界指数退避加抖动，避免限流时集中重试。
        await sleep(50 * 2 ** attempt + Math.floor(Math.random() * 50));
      }
    }
    return items;
  }

  /**
   * 扫描全部分页并读取公开姓名；过滤后空页也必须继续读取。
   * @param {boolean} light 是否仅扫描首屏字段。
   * @returns {Promise<object[]>} 完整、按日期降序排列的公开事件。
   */
  async function scanEvents(light) {
    const items = [];
    let cursor;
    const started = now();
    let pages = 0;
    let scanned = 0;
    let readCapacity = 0;
    do {
      const result = await db.send(new ScanCommand({ TableName: eventsTable, ConsistentRead: true, ReturnConsumedCapacity: 'TOTAL',
        FilterExpression: '#st = :approved',
        ExpressionAttributeNames: { '#st': 'status', '#type': 'type', '#date': 'date' },
        ExpressionAttributeValues: { ':approved': 'approved' },
        ProjectionExpression: `userId, eventId, #type, #date, ${light
          ? lightFields.map(key => `details.${key}`).join(', ') : 'details, createdAt'}`,
        ...(cursor ? { ExclusiveStartKey: cursor } : {})
      }));
      items.push(...(result.Items || []));
      pages++;
      scanned += result.ScannedCount || 0;
      readCapacity += result.ConsumedCapacity?.CapacityUnits || 0;
      cursor = result.LastEvaluatedKey;
    } while (cursor && Object.keys(cursor).length);
    const ids = [...new Set(items.map(item => item.userId))];
    const users = await batchRead(usersTable, ids.map(userId => ({ userId })), 'userId, profile');
    const names = new Map(users.map(user => [user.userId, user.profile?.isNamePublic
      ? (user.profile.name || '（未设置）') : '（非公开）']));
    const events = items.map(item => ({ ...(light ? project(item, true) : item),
      userName: names.get(item.userId) || '（非公开）' }))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)
        || a.eventId.localeCompare(b.eventId));
    // 仅记录聚合读成本与响应大小，不输出姓名、ID 或事件正文。
    console.info('PublicEventsRead', { light, pages, scanned, returned: events.length, users: ids.length,
      readCapacity, bytes: Buffer.byteLength(JSON.stringify(events)), ms: now() - started });
    return events;
  }

  /**
   * 路由请求；首屏缓存最多 15 秒，明细每次强一致检查 approved 状态。
   * @param {object} event API Gateway 请求。
   * @returns {Promise<object>} 带 CORS 和明确缓存策略的响应。
   */
  return async function handler(event) {
    const respond = (statusCode, body, extra = {}) => ({ statusCode, headers: { ...headers, ...extra },
      body: statusCode === 304 ? '' : JSON.stringify(body) });
    if (event.httpMethod === 'OPTIONS') return respond(200, { message: 'OK' });
    try {
      const route = event.resource || event.path || '/all-events';
      if (route.endsWith('/public/users/{userId}/events') || /\/public\/users\/[^/]+\/events$/.test(route)) {
        const userId = event.pathParameters?.userId;
        let ids;
        try { ids = JSON.parse(event.queryStringParameters?.ids); } catch { /* 非法查询统一返回 400。 */ }
        if (!userId || !Array.isArray(ids) || !ids.length || ids.length > 20
          || ids.some(id => typeof id !== 'string' || !id || id.length > 256) || new Set(ids).size !== ids.length) {
          return respond(400, { message: 'Provide 1 to 20 unique event IDs' });
        }
        const items = await batchRead(eventsTable, ids.map(eventId => ({ userId, eventId })));
        const byId = new Map(items.filter(item => item.status === 'approved').map(item => [item.eventId, project(item, false)]));
        return respond(200, ids.filter(id => byId.has(id)).map(id => byId.get(id)));
      }
      if (route.endsWith('/public/dashboard')) {
        const requestHeaders = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
        if (!cache || now() >= cache.expires || /no-cache|no-store/.test(requestHeaders['cache-control'] || '')) {
          if (!inFlight) {
            // 从开始读库时计时，缓存寿命不会因读库耗时或 HTTP 缓存而叠加。
            const started = now();
            inFlight = scanEvents(true).then(items => {
              const body = JSON.stringify(items);
              cache = { items, expires: started + ttl, etag: `"${createHash('sha256').update(body).digest('hex')}"` };
            }).finally(() => { inFlight = undefined; });
          }
          await inFlight;
        }
        const cacheHeaders = { 'Cache-Control': `public, max-age=${Math.max(0, Math.floor((cache.expires - now()) / 1000))}, must-revalidate`, ETag: cache.etag };
        return respond(requestHeaders['if-none-match'] === cache.etag ? 304 : 200, cache.items, cacheHeaders);
      }
      if (route.endsWith('/all-events')) return respond(200, await scanEvents(false));
      return respond(404, { message: 'Not found' });
    } catch (error) {
      console.error('Error fetching public events:', error);
      return respond(503, { message: 'Public data is temporarily unavailable' });
    }
  };
}

export const handler = createHandler();
