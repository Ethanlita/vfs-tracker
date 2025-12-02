/**
 * @file DynamoDB 操作服务
 * 封装管理员页面所需的 DynamoDB 操作
 */

import { 
  ScanCommand, 
  QueryCommand, 
  GetCommand, 
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
};

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

  const filters = [];
  const expressionValues = {};
  const expressionNames = {};

  // 状态过滤
  if (status && status !== 'all') {
    filters.push('#status = :status');
    expressionValues[':status'] = status;
    expressionNames['#status'] = 'status';
  }

  // 时间范围过滤
  if (startTime) {
    filters.push('createdAt >= :startTime');
    expressionValues[':startTime'] = startTime;
  }
  if (endTime) {
    filters.push('createdAt <= :endTime');
    expressionValues[':endTime'] = endTime;
  }

  // 关键词搜索：sessionId 或 userId
  // 注意：DynamoDB 不支持 OR 条件和 contains 同时使用，需要分别查询或使用 Scan
  if (query) {
    // 如果是完整的 UUID 格式，尝试精确匹配
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(query)) {
      // 可能是 sessionId 或 userId
      filters.push('(sessionId = :query OR userId = :query)');
      expressionValues[':query'] = query;
    } else {
      // 前缀匹配 sessionId
      filters.push('begins_with(sessionId, :query)');
      expressionValues[':query'] = query;
    }
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
 * 搜索事件（服务端搜索，支持多条件）
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

  const filters = [];
  const expressionValues = {};
  const expressionNames = {};

  // 状态过滤
  if (status && status !== 'all') {
    filters.push('#status = :status');
    expressionValues[':status'] = status;
    expressionNames['#status'] = 'status';
  }

  // 类型过滤
  if (type && type !== 'all') {
    filters.push('#type = :type');
    expressionValues[':type'] = type;
    expressionNames['#type'] = 'type';
  }

  // 用户 ID 精确过滤
  if (userId) {
    filters.push('userId = :userId');
    expressionValues[':userId'] = userId;
  }

  // 关键词搜索
  if (query) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(query)) {
      // 精确匹配 eventId 或 userId
      filters.push('(eventId = :query OR userId = :query)');
      expressionValues[':query'] = query;
    } else {
      // 前缀匹配 eventId
      filters.push('begins_with(eventId, :query)');
      expressionValues[':query'] = query;
    }
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
 * 搜索用户（服务端搜索）
 * @param {DynamoDBDocumentClient} client
 * @param {object} options
 * @param {string} [options.query] - 搜索关键词（搜索 userId、显示名称）
 * @param {number} [options.limit]
 * @returns {Promise<{items: Array, lastEvaluatedKey: object|null}>}
 */
export async function searchUsers(client, options = {}) {
  const { query, limit = 50, lastEvaluatedKey } = options;

  // DynamoDB 不支持对嵌套属性的 contains 搜索，需要全表扫描后过滤
  // 或者可以在用户表上添加 GSI
  const result = await scanTable(client, TABLES.USERS, {
    limit: limit * 2, // 获取更多以便本地过滤
    lastEvaluatedKey,
  });

  if (!query) {
    return {
      items: result.items.slice(0, limit),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }

  const queryLower = query.toLowerCase();
  const filtered = result.items.filter(user => {
    // 搜索 userId
    if (user.userId?.toLowerCase().includes(queryLower)) return true;
    // 搜索 profile.name
    if (user.profile?.name?.toLowerCase().includes(queryLower)) return true;
    // 搜索 profile.nickname
    if (user.profile?.nickname?.toLowerCase().includes(queryLower)) return true;
    return false;
  });

  return {
    items: filtered.slice(0, limit),
    lastEvaluatedKey: result.lastEvaluatedKey,
  };
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
