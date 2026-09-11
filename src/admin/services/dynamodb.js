/**
 * @file DynamoDB 操作服务
 * 封装管理员页面所需的 DynamoDB 操作
 */

import { 
  ScanCommand, 
  QueryCommand, 
  GetCommand, 
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';

/**
 * DynamoDB 表名常量
 */
export const TABLES = {
  USERS: 'VoiceFemUsers',
  EVENTS: 'VoiceFemEvents',
  TESTS: 'VoiceFemTests',
  READING_PASSAGES: 'VoiceFemReadingPassages',
};

/**
 * 读取全部朗读稿件，供管理页面编辑和启停。
 * @param {DynamoDBDocumentClient} client - DynamoDB 文档客户端。
 * @returns {Promise<Array<object>>} 按标题排序的稿件。
 */
export async function listReadingPassages(client) {
  const items = await scanAllItems(client, TABLES.READING_PASSAGES);
  return items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
}

/**
 * 新增或完整保存一篇朗读稿件。
 * @param {DynamoDBDocumentClient} client - DynamoDB 文档客户端。
 * @param {object} passage - 已验证的完整稿件。
 * @returns {Promise<object>} 实际写入的稿件。
 */
export async function saveReadingPassage(client, passage) {
  const title = passage?.title?.trim();
  const author = passage?.author?.trim();
  const content = passage?.content?.trim();
  if (!passage?.passageId || !title || !author || !content) throw new Error('稿件标题、作者和正文不能为空');
  const now = new Date().toISOString();
  const item = { ...passage, title, author, content, enabled: passage.enabled !== false, updatedAt: now, createdAt: passage.createdAt || now };
  await client.send(new PutCommand({ TableName: TABLES.READING_PASSAGES, Item: item }));
  return item;
}

/** 删除指定朗读稿件。 */
export async function deleteReadingPassage(client, passageId) {
  await client.send(new DeleteCommand({ TableName: TABLES.READING_PASSAGES, Key: { passageId } }));
}

/**
 * 事件状态常量
 */
export const EVENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * 事件类型及其中文名称
 */
export const EVENT_TYPES = {
  self_test: '自测',
  hospital_test: '医院测试',
  voice_training: '声音训练',
  self_practice: '自我练习',
  surgery: 'VFS手术',
  feeling_log: '心情日记',
};

/**
 * 获取表信息（用于检查权限和获取统计）
 * @param {DynamoDBDocumentClient} client - DynamoDB 客户端
 * @param {string} tableName - 表名
 * @returns {Promise<object>} 表信息
 */
export async function describeTable(client, tableName) {
  const command = new DescribeTableCommand({ TableName: tableName });
  const result = await client.send(command);
  return result.Table;
}

/**
 * 扫描表（支持分页和过滤）
 * @param {DynamoDBDocumentClient} client - DynamoDB 客户端
 * @param {string} tableName - 表名
 * @param {object} options - 选项
 * @param {number} [options.limit=50] - 每页数量
 * @param {object} [options.lastEvaluatedKey] - 分页游标
 * @param {string} [options.filterExpression] - 过滤表达式
 * @param {object} [options.expressionValues] - 表达式值
 * @param {object} [options.expressionNames] - 表达式属性名
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null, scannedCount: number}>}
 */
export async function scanTable(client, tableName, options = {}) {
  const { 
    limit = 50, 
    lastEvaluatedKey = null, 
    filterExpression, 
    expressionValues,
    expressionNames,
  } = options;

  const params = {
    TableName: tableName,
    Limit: limit,
    ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    ...(filterExpression && {
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionValues,
    }),
    ...(expressionNames && { ExpressionAttributeNames: expressionNames }),
  };

  const result = await client.send(new ScanCommand(params));

  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey || null,
    scannedCount: result.ScannedCount || 0,
  };
}

/**
 * 扫描所有数据（自动处理分页）
 * 注意：对于大表可能很慢，谨慎使用
 * @param {DynamoDBDocumentClient} client
 * @param {string} tableName
 * @param {object} options
 * @returns {Promise<Array>} 所有项目
 */
export async function scanAllItems(client, tableName, options = {}) {
  const allItems = [];
  let lastKey = null;

  do {
    const result = await scanTable(client, tableName, {
      ...options,
      lastEvaluatedKey: lastKey,
    });
    allItems.push(...result.items);
    lastKey = result.lastEvaluatedKey;
  } while (lastKey);

  return allItems;
}

/**
 * 按 userId 查询项目
 * @param {DynamoDBDocumentClient} client
 * @param {string} tableName
 * @param {string} userId
 * @param {object} [options]
 * @returns {Promise<Array>}
 */
export async function queryByUserId(client, tableName, userId, options = {}) {
  const { limit, lastEvaluatedKey, scanIndexForward = false } = options;

  const params = {
    TableName: tableName,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: {
      ':uid': userId,
    },
    ScanIndexForward: scanIndexForward, // false = 降序
    ...(limit && { Limit: limit }),
    ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
  };

  const result = await client.send(new QueryCommand(params));
  return result.Items || [];
}

/**
 * 获取单个用户
 * @param {DynamoDBDocumentClient} client
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getUser(client, userId) {
  const params = {
    TableName: TABLES.USERS,
    Key: { userId },
  };

  const result = await client.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * 获取单个事件
 * @param {DynamoDBDocumentClient} client
 * @param {string} userId
 * @param {string} eventId
 * @returns {Promise<object|null>}
 */
export async function getEvent(client, userId, eventId) {
  const params = {
    TableName: TABLES.EVENTS,
    Key: { userId, eventId },
  };

  const result = await client.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * 获取测试详情（通过 sessionId）
 * @param {DynamoDBDocumentClient} client
 * @param {string} sessionId
 * @returns {Promise<object|null>}
 */
export async function getTestBySessionId(client, sessionId) {
  const params = {
    TableName: TABLES.TESTS,
    Key: { sessionId },
  };

  const result = await client.send(new GetCommand(params));
  return result.Item || null;
}

/**
 * 更新用户的管理员状态
 * @param {DynamoDBDocumentClient} client
 * @param {string} userId
 * @param {boolean} isAdmin
 * @returns {Promise<object>} 更新后的用户
 */
export async function updateUserAdminStatus(client, userId, isAdmin) {
  const params = {
    TableName: TABLES.USERS,
    Key: { userId },
    UpdateExpression: 'SET isAdmin = :isAdmin, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':isAdmin': isAdmin,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await client.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * 更新事件状态
 * @param {DynamoDBDocumentClient} client
 * @param {string} userId
 * @param {string} eventId
 * @param {string} newStatus - 'pending' | 'approved' | 'rejected'
 * @returns {Promise<object>} 更新后的事件
 */
export async function updateEventStatus(client, userId, eventId, newStatus) {
  if (!Object.values(EVENT_STATUS).includes(newStatus)) {
    throw new Error(`无效的状态值: ${newStatus}`);
  }

  const params = {
    TableName: TABLES.EVENTS,
    Key: { userId, eventId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': newStatus,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await client.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * 删除事件
 * @param {DynamoDBDocumentClient} client
 * @param {string} userId
 * @param {string} eventId
 * @returns {Promise<void>}
 */
export async function deleteEvent(client, userId, eventId) {
  const params = {
    TableName: TABLES.EVENTS,
    Key: { userId, eventId },
  };

  await client.send(new DeleteCommand(params));
}

/**
 * 扫描事件（支持状态过滤）
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.status] - 状态过滤
 * @param {string} [options.type] - 类型过滤
 * @param {number} [options.limit]
 * @param {object} [options.lastEvaluatedKey]
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function scanEvents(client, options = {}) {
  const { status, type, limit = 50, lastEvaluatedKey } = options;

  const filters = [];
  const expressionValues = {};
  const expressionNames = {};

  if (status && status !== 'all') {
    filters.push('#status = :status');
    expressionValues[':status'] = status;
    expressionNames['#status'] = 'status';
  }

  if (type && type !== 'all') {
    filters.push('#type = :type');
    expressionValues[':type'] = type;
    expressionNames['#type'] = 'type';
  }

  return scanTable(client, TABLES.EVENTS, {
    limit,
    lastEvaluatedKey,
    filterExpression: filters.length > 0 ? filters.join(' AND ') : undefined,
    expressionValues: Object.keys(expressionValues).length > 0 ? expressionValues : undefined,
    expressionNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
  });
}

/**
 * 扫描测试
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.status] - 状态过滤 (pending/processing/done/failed)
 * @param {string} [options.sessionId] - Session ID 过滤（精确匹配）
 * @param {string} [options.userId] - User ID 过滤（精确匹配）
 * @param {number} [options.limit]
 * @param {object} [options.lastEvaluatedKey]
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function scanTests(client, options = {}) {
  const { status, sessionId, userId, limit = 50, lastEvaluatedKey } = options;

  const filters = [];
  const expressionValues = {};
  const expressionNames = {};

  // 状态过滤
  if (status && status !== 'all') {
    filters.push('#status = :status');
    expressionValues[':status'] = status;
    expressionNames['#status'] = 'status';
  }

  // Session ID 过滤（支持精确匹配和前缀匹配）
  if (sessionId) {
    filters.push('begins_with(sessionId, :sessionId)');
    expressionValues[':sessionId'] = sessionId;
  }

  // User ID 过滤
  if (userId) {
    filters.push('userId = :userId');
    expressionValues[':userId'] = userId;
  }

  return scanTable(client, TABLES.TESTS, {
    limit,
    lastEvaluatedKey,
    filterExpression: filters.length > 0 ? filters.join(' AND ') : undefined,
    expressionValues: Object.keys(expressionValues).length > 0 ? expressionValues : undefined,
    expressionNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
  });
}

/**
 * 搜索测试（服务端搜索，支持多条件）
 * DynamoDB FilterExpression 不支持 OR 条件，需要分别扫描并合并结果
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.query] - 搜索关键词（搜索 sessionId、userId）
 * @param {string} [options.status] - 状态过滤
 * @param {number} [options.startTime] - 开始时间戳（秒）
 * @param {number} [options.endTime] - 结束时间戳（秒）
 * @param {number} [options.limit]
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function searchTests(client, options = {}) {
  const { query, status, startTime, endTime, limit = 50, lastEvaluatedKey } = options;

  // 构建基础过滤条件（不包括 OR 搜索）
  const baseFilters = [];
  const baseExpressionValues = {};
  const baseExpressionNames = {};

  // 状态过滤
  if (status && status !== 'all') {
    baseFilters.push('#status = :status');
    baseExpressionValues[':status'] = status;
    baseExpressionNames['#status'] = 'status';
  }

  // 时间范围过滤
  if (startTime) {
    baseFilters.push('createdAt >= :startTime');
    baseExpressionValues[':startTime'] = startTime;
  }
  if (endTime) {
    baseFilters.push('createdAt <= :endTime');
    baseExpressionValues[':endTime'] = endTime;
  }

  // 如果有 UUID 格式的查询词，需要分别查询 sessionId 和 userId
  // DynamoDB FilterExpression 不支持 OR 条件
  if (query) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(query)) {
      // UUID 格式：分别查询 sessionId 和 userId，然后合并结果
      const sessionIdFilters = [...baseFilters, 'sessionId = :query'];
      const userIdFilters = [...baseFilters, 'userId = :query'];

      const [sessionIdResult, userIdResult] = await Promise.all([
        scanTable(client, TABLES.TESTS, {
          limit,
          lastEvaluatedKey,
          filterExpression: sessionIdFilters.join(' AND '),
          expressionValues: { ...baseExpressionValues, ':query': query },
          expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
        }),
        scanTable(client, TABLES.TESTS, {
          limit,
          lastEvaluatedKey,
          filterExpression: userIdFilters.join(' AND '),
          expressionValues: { ...baseExpressionValues, ':query': query },
          expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
        }),
      ]);

      // 合并并去重（使用 sessionId 作为唯一标识）
      const itemsMap = new Map();
      for (const item of sessionIdResult.items) {
        itemsMap.set(item.sessionId, item);
      }
      for (const item of userIdResult.items) {
        itemsMap.set(item.sessionId, item);
      }

      return {
        items: Array.from(itemsMap.values()).slice(0, limit),
        lastEvaluatedKey: sessionIdResult.lastEvaluatedKey || userIdResult.lastEvaluatedKey,
      };
    } else {
      // 非 UUID：使用前缀匹配 sessionId
      baseFilters.push('begins_with(sessionId, :query)');
      baseExpressionValues[':query'] = query;
    }
  }

  return scanTable(client, TABLES.TESTS, {
    limit,
    lastEvaluatedKey,
    filterExpression: baseFilters.length > 0 ? baseFilters.join(' AND ') : undefined,
    expressionValues: Object.keys(baseExpressionValues).length > 0 ? baseExpressionValues : undefined,
    expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
  });
}

/**
 * 搜索事件（服务端搜索，支持多条件）
 * DynamoDB FilterExpression 不支持 OR 条件，需要分别扫描并合并结果
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.query] - 搜索关键词（搜索 eventId、userId）
 * @param {string} [options.status] - 状态过滤
 * @param {string} [options.type] - 类型过滤
 * @param {string} [options.userId] - 用户 ID 过滤（精确匹配）
 * @param {number} [options.limit]
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function searchEvents(client, options = {}) {
  const { query, status, type, userId, limit = 50, lastEvaluatedKey } = options;

  // 构建基础过滤条件（不包括 OR 搜索）
  const baseFilters = [];
  const baseExpressionValues = {};
  const baseExpressionNames = {};

  // 状态过滤
  if (status && status !== 'all') {
    baseFilters.push('#status = :status');
    baseExpressionValues[':status'] = status;
    baseExpressionNames['#status'] = 'status';
  }

  // 类型过滤
  if (type && type !== 'all') {
    baseFilters.push('#type = :type');
    baseExpressionValues[':type'] = type;
    baseExpressionNames['#type'] = 'type';
  }

  // 用户 ID 精确过滤
  if (userId) {
    baseFilters.push('userId = :userId');
    baseExpressionValues[':userId'] = userId;
  }

  // 如果有 UUID 格式的查询词，需要分别查询 eventId 和 userId
  // DynamoDB FilterExpression 不支持 OR 条件
  if (query) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(query)) {
      // UUID 格式：分别查询 eventId 和 userId，然后合并结果
      const eventIdFilters = [...baseFilters, 'eventId = :query'];
      const userIdFilters = [...baseFilters, 'userId = :query'];

      const [eventIdResult, userIdResult] = await Promise.all([
        scanTable(client, TABLES.EVENTS, {
          limit,
          lastEvaluatedKey,
          filterExpression: eventIdFilters.join(' AND '),
          expressionValues: { ...baseExpressionValues, ':query': query },
          expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
        }),
        scanTable(client, TABLES.EVENTS, {
          limit,
          lastEvaluatedKey,
          filterExpression: userIdFilters.join(' AND '),
          expressionValues: { ...baseExpressionValues, ':query': query },
          expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
        }),
      ]);

      // 合并并去重（使用 eventId 作为唯一标识）
      const itemsMap = new Map();
      for (const item of eventIdResult.items) {
        itemsMap.set(item.eventId, item);
      }
      for (const item of userIdResult.items) {
        itemsMap.set(item.eventId, item);
      }

      return {
        items: Array.from(itemsMap.values()).slice(0, limit),
        lastEvaluatedKey: eventIdResult.lastEvaluatedKey || userIdResult.lastEvaluatedKey,
      };
    } else {
      // 非 UUID：使用前缀匹配 eventId
      baseFilters.push('begins_with(eventId, :query)');
      baseExpressionValues[':query'] = query;
    }
  }

  return scanTable(client, TABLES.EVENTS, {
    limit,
    lastEvaluatedKey,
    filterExpression: baseFilters.length > 0 ? baseFilters.join(' AND ') : undefined,
    expressionValues: Object.keys(baseExpressionValues).length > 0 ? baseExpressionValues : undefined,
    expressionNames: Object.keys(baseExpressionNames).length > 0 ? baseExpressionNames : undefined,
  });
}

/**
 * 搜索用户（服务端扫描，支持真实游标分页）
 * 为保持 ID、邮箱和资料字段的大小写不敏感包含匹配，逐页扫描后在客户端过滤。
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.query] - 搜索关键词（搜索 userId、邮箱、姓名和昵称）
 * @param {number} [options.limit]
 * @param {object} [options.lastEvaluatedKey] - 上一批扫描返回的真实 DynamoDB 游标
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function searchUsers(client, options = {}) {
  const { query, limit = 20, lastEvaluatedKey = null } = options;
  const normalizedQuery = query?.trim().toLowerCase() || '';

  // 无搜索条件也走同一个服务入口，直接保留 DynamoDB 的分页语义。
  if (!normalizedQuery) {
    return scanTable(client, TABLES.USERS, { limit, lastEvaluatedKey });
  }

  const items = [];
  let cursor = lastEvaluatedKey;

  do {
    // 每次最多评估当前还缺少的数量，确保不会截断同一扫描页中的匹配项。
    const result = await scanTable(client, TABLES.USERS, {
      limit: limit - items.length,
      lastEvaluatedKey: cursor,
    });
    cursor = result.lastEvaluatedKey;

    for (const user of result.items) {
      const searchableValues = [
        user.userId,
        user.email,
        user.profile?.name,
        user.profile?.nickname,
      ];
      if (searchableValues.some(value => String(value || '').toLowerCase().includes(normalizedQuery))) {
        items.push(user);
      }
    }
  } while (cursor && items.length < limit);

  return { items, lastEvaluatedKey: cursor };
}

/**
 * 获取统计数据
 * @param {DynamoDBDocumentClient} client
 * @returns {Promise<{users: number, events: {total: number, pending: number, approved: number}, tests: number}>}
 */
export async function getStats(client) {
  // 并行获取各表数据
  const [users, events, tests] = await Promise.all([
    scanAllItems(client, TABLES.USERS),
    scanAllItems(client, TABLES.EVENTS),
    scanAllItems(client, TABLES.TESTS),
  ]);

  // 统计事件状态
  const eventsByStatus = events.reduce((acc, event) => {
    const status = event.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // 统计事件类型
  const eventsByType = events.reduce((acc, event) => {
    const type = event.type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  // 统计测试状态
  const testsByStatus = tests.reduce((acc, test) => {
    const status = test.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    users: {
      total: users.length,
    },
    events: {
      total: events.length,
      pending: eventsByStatus.pending || 0,
      approved: eventsByStatus.approved || 0,
      rejected: eventsByStatus.rejected || 0,
      byType: eventsByType,
    },
    tests: {
      total: tests.length,
      pending: testsByStatus.pending || 0,
      processing: testsByStatus.processing || 0,
      done: testsByStatus.done || 0,
      failed: testsByStatus.failed || 0,
    },
  };
}
