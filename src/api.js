import { get, post } from 'aws-amplify/api';
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
  if (!session.tokens?.accessToken) {
    throw new Error('User not authenticated');
  }

  const op = get({
    apiName: 'api',
    path,
    options: {
      headers: {
        Authorization: `Bearer ${session.tokens.accessToken}`
      }
    }
  });

  const { body } = await op.response;
  return body.json();
}

/**
 * 认证API调用 - POST请求
 */
async function authenticatedPost(path, bodyData) {
  console.log('[authenticatedPost] making authenticated request to:', path);

  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken) {
    throw new Error('User not authenticated');
  }

  const op = post({
    apiName: 'api',
    path,
    options: {
      body: bodyData,
      headers: {
        Authorization: `Bearer ${session.tokens.accessToken}`
      }
    }
  });

  const { body } = await op.response;
  return body.json();
}

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
 * Fetches all public, approved events for the main dashboard.
 * This calls the `/all-events` endpoint of our API Gateway.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of event objects.
 * @throws Will throw an error if the API call fails.
 */
export const getAllEvents = async () => {
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log('🔧 开发/未就���：返回 mock 所有事件');
    return Promise.resolve(mockData.events);
  }
  console.log('[getAllEvents] attempting fetch, config=', Amplify.getConfig?.().API);
  try {
    return await simpleGet('/all-events');
  } catch (error) {
    console.error('Error fetching all public events:', error);
    throw error;
  }
};

/**
 * Fetches all events for a specific authenticated user.
 * This calls the `/events/{userId}` endpoint of our API Gateway with authentication.
 * @param {string} userId The unique ID of the user whose events are to be fetched.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of the user's event objects.
 * @throws Will throw an error if the API call fails.
 */
export const getEventsByUserId = async (userId) => {
  console.log('🔍 API: getEventsByUserId 被调用', { userId, isProdReady: isProductionReady(), cfg: Amplify.getConfig?.().API });
  // 在开发模式下返回模拟数据
  if (!isProductionReady() && !import.meta.env.VITE_FORCE_REAL) {
    console.log(`🔧 开发/未就绪：mock 用户事件 userId=${userId}`);
    const userEvents = mockData.events.filter(event => event.userId === userId);
    return Promise.resolve(userEvents);
  }
  try {
    // 使用认证的API调用
    const data = await authenticatedGet(`/events/${userId}`);
    console.log('✅ API: user events fetched (count)', data?.length);
    return data;
  } catch (error) {
    console.error('❌ API: 获取用户事件失败:', error);
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
    // 只发送客户端数据，���务端会添加userId等字段
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
- 近期训练次数（7天内��: ${userData.events?.filter(e =>
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

    const prompt = `作为一名专业且富有同理心的声音训练助手，请根据用户的训练数据给出个性化的鼓励性评价（25-35字）：\n\n${userProgressSummary}\n请分析用户的训练模式、进步趋势和当前状态，用温暖、专业且具有激励性的语气回复。可以：\n- 赞扬用户的坚��和努力\n- 针对具体的训练类型给出认可\n- 根据数据趋势提供正面的展望\n- 用温馨的话语给予情感支持\n\n回复应该简洁但充满正能量，让用户感受到被理解和鼓励。`;

    console.log('🤖 ��送Gemini请求:', {
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
            text: "你是一个专业的声音训练助手，负责为用户��供鼓励和建议。请用温暖、专业的语气回复，保持简洁但充满正能量。"
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
          topP: 0.95,             // 提高累积概率，允许更多创意表达
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
      throw new Error('Gemini响应中没有��选内容');
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

/**
 * 安全提示：
 * 1. 切勿在前端暴露长期 AWS Access Key / Secret；当前项目不再使用它们（如 .env.local 中仍存在应删除）。
 * 2. Gemini Key 仅临时用于前端演示，生产应通过后端代理（TODO: /ai/encouragement 端点）。
 */
