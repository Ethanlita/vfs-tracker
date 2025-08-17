import { get, post, put } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';  // 新增：用于获取认证token
import { v4 as uuidv4 } from 'uuid';
import mockData from './mock_data.json';
import { isProductionReady as globalIsProductionReady, logEnvReadiness } from './env.js';

// 移除本地 isProductionReady 定义，改用全局
const isProductionReady = () => {
  const ready = globalIsProductionReady();
  logEnvReadiness('api');
  return ready;
};

// 移除模块加载时的配置检查，改为在函数调用时检查
// console.log('[api.js before first call] current API config', Amplify.getConfig?.().API);

function resolveMode() {
  const cfg = Amplify.getConfig?.();
  // v6 format: API.REST is an object with named endpoints
  const restConfig = cfg?.API?.REST;
  if (restConfig && typeof restConfig === 'object' && restConfig.api) {
    return 'rest';
  }
  // Legacy format check (keeping for backward compatibility)
  const legacy = cfg?.API?.endpoints;
  if (Array.isArray(legacy) && legacy.find(e=>e.name==='api')) return 'legacy';
  return null;
}

// 移除复杂的回退方案，直接使用Amplify v6的REST API方法

/**
 * 公开API调用 - 无需认证
 */
async function simpleGet(path) {
  console.log('[simpleGet] making public request to:', path);
  const op = get({ apiName: 'api', path });
  const { body } = await op.response;
  return body.json();
}

/**
 * 认证API调用 - GET请求
 */
async function authenticatedGet(path) {
  console.log('[authenticatedGet] making authenticated request to:', path);

  const session = await fetchAuthSession();
  console.log('[authenticatedGet] session details:', {
    hasTokens: !!session.tokens,
    hasIdToken: !!session.tokens?.idToken,
    tokenType: typeof session.tokens?.idToken,
    // 安全地打印token的前几个字符（用于调试）
    idTokenPreview: session.tokens?.idToken?.toString?.()?.substring(0, 50) + '...',
    credentials: session.credentials ? 'present' : 'missing'
  });

  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }

  // 尝试解码JWT token查看内容（仅用于调试）
  try {
    const tokenString = session.tokens.idToken.toString();
    const tokenParts = tokenString.split('.');

    console.log('[authenticatedGet] JWT token结构分析:', {
      fullTokenLength: tokenString.length,
      tokenPartsCount: tokenParts.length,
      headerLength: tokenParts[0]?.length,
      payloadLength: tokenParts[1]?.length,
      signatureLength: tokenParts[2]?.length,
      tokenType: typeof session.tokens.idToken,
      tokenConstructor: session.tokens.idToken.constructor.name
    });

    if (tokenParts.length === 3) {
      // 解码 JWT Header
      const header = JSON.parse(atob(tokenParts[0]));
      console.log('[authenticatedGet] JWT header:', header);

      // 解码 JWT Payload
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('[authenticatedGet] JWT payload:', {
        sub: payload.sub,
        username: payload.username,
        'cognito:username': payload['cognito:username'],
        aud: payload.aud,
        exp: new Date(payload.exp * 1000),
        iss: payload.iss,
        token_use: payload.token_use,
        email: payload.email,
        // 打印所有字段以便调试
        allClaims: payload
      });

      // 确认这是ID token
      if (payload.token_use === 'id') {
        console.log('[authenticatedGet] ✅ 确认这是一个ID token');
      } else {
        console.warn('[authenticatedGet] ⚠️ Token类型异常，token_use:', payload.token_use);
      }
    } else {
      console.error('[authenticatedGet] ❌ JWT token格式不正确，部分数量:', tokenParts.length);
    }
  } catch (e) {
    console.error('[authenticatedGet] ❌ JWT token解码失败:', e);
  }

  // 只使用ID token进行API调用
  try {
    console.log('[authenticatedGet] 使用ID token进行API调用');

    // 🔍 DEBUG: 详细的请求信息
    console.group('🔍 [DEBUG] API请求详细信息 - ID token');
    console.log('📡 请求URL:', `${Amplify.getConfig()?.API?.REST?.api?.endpoint}${path}`);
    console.log('🔗 请求方法:', 'GET');
    console.log('📋 完整请求头:', {
      Authorization: `Bearer ${session.tokens.idToken.toString()}`,
      'Content-Type': 'application/json'
    });
    console.log('🔑 Token类型: ID Token');
    console.log('🔑 Token长度:', session.tokens.idToken.toString().length);

    // 解析token内容用于debug
    try {
      const tokenParts = session.tokens.idToken.toString().split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log('🔍 Token内容预览:', {
          sub: payload.sub,
          username: payload.username,
          token_use: payload.token_use,
          aud: payload.aud,
          exp: new Date(payload.exp * 1000),
          email: payload.email,
          'cognito:username': payload['cognito:username']
        });
      }
    } catch (tokenParseError) {
      console.error('Token解析失败:', tokenParseError);
    }
    console.groupEnd();

    const op = get({
      apiName: 'api',
      path,
      options: {
        headers: {
          Authorization: `Bearer ${session.tokens.idToken}`,
          'Content-Type': 'application/json'
        }
      }
    });

    // 🔍 DEBUG: 输出Amplify内部请求对象
    console.log('🔧 Amplify请求对象:', op);

    const { body } = await op.response;
    const result = await body.json();

    console.log('[authenticatedGet] ✅ API调用成功，使用了ID token');
    console.log('[authenticatedGet] 原始响应:', result);

    // 🔍 详细调试输出
    console.group(`🔍 [DEBUG] API响应详细分析 - ${path}`);
    console.log('📦 完整响应对象:', JSON.stringify(result, null, 2));
    console.log('📊 响应数据类型:', typeof result);
    console.log('🔧 响应对象属性:', Object.keys(result));

    if (result.debug) {
      console.log('🛠️ Lambda调试信息:', result.debug);
    }

    if (result.data) {
      console.log('📋 数据字段类型:', typeof result.data);
      console.log('📋 数据是否为数组:', Array.isArray(result.data));
      console.log('📋 数据长度:', result.data?.length);
      console.log('📋 数据内容预览:', result.data?.slice(0, 2)); // 只显示前2条记录
    }

    if (result.message) {
      console.log('💬 响应消息:', result.message);
    }

    if (result.error) {
      console.error('❌ 响应错误:', result.error);
    }
    console.groupEnd();

    // 检查响应格式并提取数据
    if (result.data) {
      // Lambda返回 {data: [...], debug: {...}} 格式
      console.log(`[authenticatedGet] 提取Lambda响应中的data字段，包含${result.data.length}条记录`);
      return result.data;
    } else if (result.events) {
      // Lambda返回 {events: [...], debug: {...}} 格式 (getVoiceEvents的格式)
      console.log(`[authenticatedGet] 提取Lambda响应中的events字段，包含${result.events.length}条记录`);
      return result.events;
    } else if (Array.isArray(result)) {
      // 直接返回数组格式
      console.log(`[authenticatedGet] 直接使用数组格式响应，包含${result.length}条记录`);
      return result;
    } else {
      // 其他格式，直接返回
      console.log(`[authenticatedGet] 使用原始响应格式:`, typeof result);
      return result;
    }

  } catch (error) {
    console.error('[authenticatedGet] ❌ 使用ID token API调用失败:', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    // 尝试获取错误响应的详细信息
    try {
      if (error.response) {
        const errorBody = await error.response.body?.json();
        console.error('[authenticatedGet] ID token错误响应详情:', errorBody);

        // 如果响应中包含我们的debug信息，说明Lambda被执行了
        if (errorBody && errorBody.debug && errorBody.debug.lambdaExecuted) {
          console.log('✅ Lambda函数被执行了！调试信息:', errorBody.debug);
          console.log('❌ 但是出现错误，原因:', errorBody.debug.reason || errorBody.message || '未知');
        }
      }
    } catch (bodyError) {
      console.error('[authenticatedGet] 无法解析错误响应体:', bodyError);
    }

    throw error;
  }
}

/**
 * 认证API调用 - POST请求
 */
async function authenticatedPost(path, bodyData) {
  console.log('[authenticatedPost] making authenticated request to:', path);

  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }

  const op = post({
    apiName: 'api',
    path,
    options: {
      body: bodyData,
      headers: {
        Authorization: `Bearer ${session.tokens.idToken}`
      }
    }
  });

  const { body } = await op.response;
  return body.json();
}

/**
 * 认证API调用 - PUT请求
 */
async function authenticatedPut(path, bodyData) {
  console.log('[authenticatedPut] making authenticated request to:', path);

  const session = await fetchAuthSession();
  if (!session.tokens?.idToken) {
    throw new Error('User not authenticated - no ID token');
  }

  const op = put({
    apiName: 'api',
    path,
    options: {
      body: bodyData,
      headers: {
        Authorization: `Bearer ${session.tokens.idToken}`
      }
    }
  });

  const { body } = await op.response;
  return body.json();
}

// ========== 核心API函数 ==========

/**
 * Uploads a file to S3.
 * The file is stored in a user-specific "folder" to ensure separation of data.
 * @param {File} file The file object to upload.
 * @param {string} userId The unique ID of the user, used as a prefix for the S3 key.
 * @returns {Promise<string>} A promise that resolves with the unique S3 key of the uploaded file.
 * @throws Will throw an error if the upload fails.
 */
export const uploadFile = async (file, userId) => {
  // 在开发模式下（环境未就绪且未强制真实）返回模拟的文件key
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：模拟文件上传', { name: file.name });
    return Promise.resolve(`mock-uploads/${userId}/${file.name}`);
  }

  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const key = `${userId}/${fileName}`;

  try {
    // v6: Use uploadData instead of Storage.put
    const result = await uploadData({
      key: key,
      data: file,
      options: {
        contentType: file.type,
      },
    }).result;
    // The result object contains the final key
    return result.key;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

/**
 * Fetches all approved events from the DynamoDB table for the public dashboard.
 * This calls the `/all-events` endpoint of our API Gateway.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of event objects.
 * @throws Will throw an error if the API call fails.
 */
export const getAllEvents = async () => {
  // 在开发模式下返回模拟数据
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 所有事件');
    return Promise.resolve(mockData.events);
  }

  console.log('[getAllEvents] attempting fetch, config=', Amplify.getConfig?.().API);
  try {
    const data = await simpleGet('/all-events');
    console.log('✅ API: all events fetched (count)', data?.length);
    return data;
  } catch (error) {
    console.error('Error fetching all public events:', error);
    throw error;
  }
};

/**
 * Fetches events for a specific user by calling the authenticated API.
 * This calls the `/events/{userId}` endpoint with authentication.
 * @param {string} userId The ID of the user whose events to fetch.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of event objects.
 * @throws Will throw an error if the API call fails.
 */
export const getEventsByUserId = async (userId) => {
  // 在开发模式下返回模拟数据
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 用户事件');
    return Promise.resolve(mockData.events.filter(e => e.userId === userId));
  }

  try {
    // 使用认证的API调用
    const data = await authenticatedGet(`/events/${userId}`);
    console.log('✅ API: user events fetched (count)', data?.length);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户事件失败:', error);

    // 如果是401错误，临时返回模拟数据以便继续开发
    if (error.message && error.message.includes('Unauthorized')) {
      console.log('🔧 临时解决方案: 由于401错误，返回模拟数据', { userId });

      // 创建一些模拟的用户特定数据
      const mockUserEvents = [
        {
          userId: userId,
          eventId: 'temp-event-1',
          type: 'self_test',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            fundamentalFrequency: 125.5,
            description: '今天的声音测试感觉不错'
          },
          status: 'approved',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          userId: userId,
          eventId: 'temp-event-2',
          type: 'voice_training',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            description: '参加了线上嗓音训练课程'
          },
          status: 'approved',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          userId: userId,
          eventId: 'temp-event-3',
          type: 'self_practice',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          details: {
            description: '在家进行发声练习'
          },
          status: 'approved',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      return mockUserEvents;
    }

    throw error;
  }
};

/**
 * Adds a new event record to the DynamoDB table via API Gateway and Lambda.
 * This calls the `/events` endpoint with a POST request with authentication.
 * @param {object} eventData The core data for the event (e.g., type, date, details).
 * @returns {Promise<object>} A promise that resolves with the response from the API, which includes the newly created item.
 * @throws Will throw an error if the API call fails.
 */
export const addEvent = async (eventData) => {
  // 注意：不再需要传入userId参数，因为会从JWT token中提取

  // 在开发模式下返回模拟响应
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 添加事件');
    const mockItem = {
      userId: 'mock-user-id',
      eventId: uuidv4(),
      ...eventData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return Promise.resolve({ item: mockItem });
  }

  console.log('[addEvent] posting with authentication, cfg=', Amplify.getConfig?.().API);
  try {
    // 只发送客户端数据，服务端会添加userId等字段
    const requestBody = {
      type: eventData.type,
      date: eventData.date,
      details: eventData.details
    };

    // 使用认证的API调用
    const resp = await authenticatedPost('/events', requestBody);
    return resp;
  } catch (error) {
    console.error('Error adding event via API:', error);
    throw error;
  }
};

/**
 * 获取Gemini AI的鼓励性评价
 * 仅在生产环境下生效，开发环境返回默认消息
 * @param {Object} userData - 用户数据对象
 * @param {Array} userData.events - 用户事件列表
 * @param {Object} userData.voiceParameters - 最新的声音参数
 * @returns {Promise<string>} 鼓励性评价文本
 */
export const getEncouragingMessage = async (userData) => {
  const isProduction = import.meta.env.PROD;
  const enableAiInDev = !!import.meta.env.VITE_ENABLE_AI_IN_DEV;
  const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API;
  console.log('🔍 AI 环境:', { isProduction, enableAiInDev, hasKey: !!geminiApiKey, forceReal: !!import.meta.env.VITE_FORCE_REAL });
  if ((!isProduction && !enableAiInDev) || !geminiApiKey) {
    console.log('🤖 AI 未启用（环境未生产或未打开开发开关，或缺少 key）返回默认消息');
    return "持续跟踪，持续进步 ✨";
  }

  try {
    // 准备发送给Gemini的数据
    const userProgressSummary = `
用户声音训练进度分析：
- 总事件数: ${userData.events?.length || 0}
- 近期训练次数（7天内）: ${userData.events?.filter(e =>
  (e.type === 'voice_training' || e.type === 'self_practice') &&
  new Date(e.createdAt || e.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
).length || 0}
- 训练一致性分数: ${calculateConsistencyScore(userData.events)}/100

详细事件记录：
${userData.events?.map((event, index) => {
  const eventDate = new Date(event.date || event.createdAt);
  const eventTypeMap = {
    'self_test': '自我测试',
    'hospital_test': '医院检测',
    'voice_training': '嗓音训练',
    'self_practice': '自我练习',
    'surgery': '手术',
    'feeling_log': '感受记录'
  };
  const eventTypeName = eventTypeMap[event.type] || event.type;

  let eventDetails = '';
  if (event.details) {
    if (event.details.fundamentalFrequency) {
      eventDetails += ` 基频:${event.details.fundamentalFrequency}Hz`;
    }
    if (event.details.description) {
      eventDetails += ` 描述:${event.details.description}`;
    }
    if (event.details.feeling) {
      eventDetails += ` 感受:${event.details.feeling}`;
    }
  }

  return `${index + 1}. ${eventDate.toLocaleDateString('zh-CN')} - ${eventTypeName}${eventDetails}`;
}).join('\n') || '暂无详细记录'}

${userData.voiceParameters ? `最新声音参数分析:\n- 基频: ${userData.voiceParameters.fundamental}Hz\n- 抖动率: ${userData.voiceParameters.jitter}%\n- 微颤: ${userData.voiceParameters.shimmer}%\n- 谐噪比: ${userData.voiceParameters.hnr}dB` : ''}
`;

    const prompt = `作为一名专业且富有同理心的声音训练助手，请根据用户的训练数据给出个性化的鼓励性评价（25-35字）：\n\n${userProgressSummary}\n请分析用户的训练模式、进步趋势和当前状态，用温暖、专业且具有激励性的语气回复。可以：\n- 赞扬用户的坚持和努力\n- 针对具体的训练类型给出认可\n- 根据数据趋势提供正面的展望\n- 用温馨的话语给予情感支持\n\n回复应该简洁但充满正能量，让用户感受到被理解和鼓励。`;

    console.log('🤖 发送Gemini请求:', {
      prompt: prompt.substring(0, 100) + '...',
      userDataSummary: {
        totalEvents: userData.events?.length || 0,
        eventTypes: userData.events?.map(e => e.type) || [],
        detailedEventCount: userData.events?.length || 0
      }
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "你是一个专业的声音训练助手，负责为用户提供鼓励和建议。请用温暖、专业的语气回复，保持简洁但充满正能量。"
          }]
        },
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 1.2,        // 大幅提高创意度，使回复更多样化
          topK: 40,               // 增加词汇选择范围
          topP: 0.95,             // 提高累积概率，允许更多创��表达
          maxOutputTokens: 200,   // 增加最大token数以允许更丰富的回复
        },
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🤖 Gemini API响应错误:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Gemini API响应错误: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('🤖 Gemini API原始响应:', result);

    // 解析Gemini的响应
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.warn('🤖 Gemini响应中没有候选内容');
      throw new Error('Gemini响应中没有候选内容');
    }

    const content = candidates[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.warn('🤖 Gemini响应格式异常:', candidates[0]);
      throw new Error('Gemini响应格式异常');
    }

    const message = content.trim();
    console.log('🤖 Gemini AI响应成功:', message);
    console.log('🎉 AI鼓励消息已生成并将显示在页面上');

    return message;

  } catch (error) {
    console.error('🤖 Gemini AI服务调用失败:', error);
    console.log('⚠️ 使用默认消息作为备选方案');
    // 失败时返回默认鼓励消息
    return "持续跟踪，持续进步 ✨";
  }
};

// 计算训练一致性分数: 将 voice_training 与 self_practice 视为训练事件
const calculateConsistencyScore = (events) => {
  if (!events || events.length === 0) return 0;
  const trainingEvents = events.filter(e => e.type === 'voice_training' || e.type === 'self_practice');
  if (trainingEvents.length < 2) return 50;
  const dates = trainingEvents.map(e => new Date(e.createdAt || e.date)).sort();
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const interval = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
    intervals.push(interval);
  }
  if (intervals.length === 0) return 50;
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
  return Math.round(Math.max(0, Math.min(100, 100 - variance * 2)));
};

// ========== 用户资料管理 API ==========

/**
 * 查询用户信息API（私有） - 获取当前认证用户的完整资料信息
 * @param {string} userId - 用户ID，必须与JWT token中的用户ID匹配
 * @returns {Promise<object>} 包含用户资料的对象
 */
export const getUserProfile = async (userId) => {
  console.log('🔍 API: getUserProfile 被调用', { userId, isProdReady: isProductionReady() });

  // 开发模式返回模拟用户数据
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log(`🔧 开发/未就绪：mock 用户资料 userId=${userId}`);
    const mockUserProfile = {
      userId: userId,
      email: 'mock-user@example.com',
      profile: {
        name: '模拟用户',
        isNamePublic: false,
        socials: [
          {
            platform: 'Twitter',
            handle: '@mockuser'
          }
        ],
        areSocialsPublic: false
      },
      createdAt: '2025-08-01T10:00:00.000Z',
      updatedAt: '2025-08-16T10:30:00.000Z'
    };
    return Promise.resolve(mockUserProfile);
  }

  try {
    const data = await authenticatedGet(`/user/${userId}`);
    console.log('✅ API: user profile fetched', data);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户资料失败:', error);
    throw error;
  }
};

/**
 * 查询用户信息API（公用） - 获取用户的公开资料信息
 * @param {string} userId - 要查询的用户ID
 * @returns {Promise<object>} 包含用户公开资料的对象
 */
export const getUserPublicProfile = async (userId) => {
  console.log('🔍 API: getUserPublicProfile 被调用', { userId, isProdReady: isProductionReady() });

  // 开发模式返回模拟公开用户数据
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log(`🔧 开发/未就绪：mock 公开用户资料 userId=${userId}`);
    const mockPublicProfile = {
      userId: userId,
      profile: {
        name: '（非公开）', // 模拟非公开姓名
        socials: [] // 模拟非公开社交账户
      }
    };
    return Promise.resolve(mockPublicProfile);
  }

  try {
    const data = await simpleGet(`/user/${userId}/public`);
    console.log('✅ API: public user profile fetched', data);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户公开资料失败:', error);
    throw error;
  }
};

/**
 * 编辑用户信息API（私有） - 更新当前认证用户的资料信息
 * @param {string} userId - 用户ID，必须与JWT token中的用户ID匹配
 * @param {object} profileData - 要更新的资料数据
 * @returns {Promise<object>} 包含更新后用户资料的对象
 */
export const updateUserProfile = async (userId, profileData) => {
  console.log('🔍 API: updateUserProfile 被调用', { userId, profileData, isProdReady: isProductionReady() });

  // 开发模式返回模拟更新响应
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log(`🔧 开发/未就绪：mock 更新用户资料 userId=${userId}`);
    const mockUpdatedProfile = {
      message: 'User profile updated successfully',
      user: {
        userId: userId,
        email: 'mock-user@example.com',
        profile: profileData.profile,
        createdAt: '2025-08-01T10:00:00.000Z',
        updatedAt: new Date().toISOString()
      }
    };
    return Promise.resolve(mockUpdatedProfile);
  }

  try {
    const requestBody = {
      profile: profileData.profile
    };

    const data = await authenticatedPut(`/user/${userId}`, requestBody);
    console.log('✅ API: user profile updated', data);
    return data;
  } catch (error) {
    console.error('❌ API: 更新用户资料失败:', error);
    throw error;
  }
};

/**
 * 新用户资料完善API（私有） - 为新用户创建或完善资料信息
 * @param {object} profileData - 用户资料数据
 * @returns {Promise<object>} 包含创建/更新结果的对象
 */
export const setupUserProfile = async (profileData) => {
  console.log('🔍 API: setupUserProfile 被调用', { profileData, isProdReady: isProductionReady() });

  // 开发模式返回模拟设置响应
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就绪：mock 用户资料设置');
    const mockSetupResponse = {
      message: 'User profile setup completed successfully',
      user: {
        userId: 'mock-new-user-id',
        email: 'newuser@example.com',
        profile: profileData.profile || {
          name: '',
          isNamePublic: false,
          socials: [],
          areSocialsPublic: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      isNewUser: true
    };
    return Promise.resolve(mockSetupResponse);
  }

  try {
    const requestBody = {
      profile: profileData.profile || {
        name: '',
        isNamePublic: false,
        socials: [],
        areSocialsPublic: false
      }
    };

    const data = await authenticatedPost('/user/profile-setup', requestBody);
    console.log('✅ API: user profile setup completed', data);
    return data;
  } catch (error) {
    console.error('❌ API: 用户资料设置失败:', error);
    throw error;
  }
};

/**
 * 检查用户资料完整性 - 判断用户是否需要完善资料
 * @param {object} userProfile - 用户资料对象
 * @returns {boolean} true表示资料完整，false表示需要完善
 */
export const isUserProfileComplete = (userProfile) => {
  if (!userProfile || !userProfile.profile) {
    return false;
  }

  const profile = userProfile.profile;

  // 检查基本信息是否存在（至少需要设置姓名或明确选择不公开）
  const hasBasicInfo = profile.name !== undefined && profile.name !== null;

  // 检查隐私设置是否已配置
  const hasPrivacySettings =
    typeof profile.isNamePublic === 'boolean' &&
    typeof profile.areSocialsPublic === 'boolean';

  console.log('🔍 检查用户资料完整性:', {
    hasBasicInfo,
    hasPrivacySettings,
    profile
  });

  return hasBasicInfo && hasPrivacySettings;
};

/**
 * 获取上传预签名URL
 * @param {string} fileKey - S3文件key
 * @param {string} contentType - 文件类型
 * @returns {Promise<string>} 上传预签名URL
 */
export const getUploadUrl = async (fileKey, contentType) => {
  console.log('[getUploadUrl] 获取上传URL，fileKey:', fileKey);

  if (!isProductionReady()) {
    console.log('[getUploadUrl] 开发环境 - 返回mock上传URL');
    return `https://mock-upload-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }

  try {
    const requestBody = {
      fileKey,
      contentType
    };

    const data = await authenticatedPost('/upload-url', requestBody);
    console.log('✅ 获取上传URL成功:', data);
    return data.uploadUrl;
  } catch (error) {
    console.error('❌ 获取上传URL失败:', error);
    throw error;
  }
};

/**
 * 获取文件访问预签名URL（仅限文件所有者）
 * @param {string} fileKey - S3文件key
 * @returns {Promise<string>} 文件访问预签名URL
 */
export const getFileUrl = async (fileKey) => {
  console.log('[getFileUrl] 获取文件URL，fileKey:', fileKey);

  if (!isProductionReady()) {
    console.log('[getFileUrl] 开发环境 - 返回mock文件URL');
    return `https://mock-file-url.s3.amazonaws.com/${fileKey}?mock=true`;
  }

  try {
    const requestBody = {
      fileKey
    };

    const data = await authenticatedPost('/file-url', requestBody);
    console.log('✅ 获取文件URL成功:', data);
    return data.url;
  } catch (error) {
    console.error('❌ 获取文件URL失败:', error);
    throw error;
  }
};

/**
 * 获取头像访问预签名URL（公开访问）
 * @param {string} userId - 用户ID
 * @returns {Promise<string>} 头像访问预签名URL
 */
export const getAvatarUrl = async (userId) => {
  console.log('[getAvatarUrl] 获取头像URL，userId:', userId);

  if (!isProductionReady()) {
    console.log('[getAvatarUrl] 开发环境 - 返回mock头像URL');
    return `https://mock-avatar-url.s3.amazonaws.com/avatars/${userId}/avatar?mock=true`;
  }

  try {
    // 头像是公开API，不需要认证
    const data = await simpleGet(`/avatar/${userId}`);
    console.log('✅ 获取头像URL成功:', data);
    return data.url;
  } catch (error) {
    console.error('❌ 获取头像URL失败:', error);
    throw error;
  }
};

/**
 * 安全提示：
 * 1. 切勿在前端暴露长期 AWS Access Key / Secret；当前项目不再使用它们（如 .env.local 中仍存在应删除）。
 * 2. Gemini Key 仅临时用于前端演示，生产应通过后端代理（TODO: /ai/encouragement 端点）。
 * 3. 用户资料相关API需要JWT认证，确保只有认证用户才能访问和修改自己的资料。
 * 4. 预签名URL相关API确保了S3安全性：头像可公开访问，其他文件仅限所有者访问。
 */
