import { get, post } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import { v4 as uuidv4 } from 'uuid';
import mockData from './mock_data.json';

// 检查是否为生产环境 - 使用更明确的检查方式
const isProductionReady = () => {
  const hasUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const hasClientId = import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID;
  const hasRegion = import.meta.env.VITE_AWS_REGION;

  const ready = !!(hasUserPoolId && hasClientId && hasRegion);
  console.log('🔍 AWS配置检查:', { hasUserPoolId: !!hasUserPoolId, hasClientId: !!hasClientId, hasRegion: !!hasRegion, ready });
  return ready;
};

/**
 * Uploads a file to S3.
 * The file is stored in a user-specific "folder" to ensure separation of data.
 * @param {File} file The file object to upload.
 * @param {string} userId The unique ID of the user, used as a prefix for the S3 key.
 * @returns {Promise<string>} A promise that resolves with the unique S3 key of the uploaded file.
 * @throws Will throw an error if the upload fails.
 */
export const uploadFile = async (file, userId) => {
  // 在开发模式下返回模拟的文件key
  if (!isProductionReady()) {
    console.log('🔧 开发模式：模拟文件上传', file.name);
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
  // 在开发模式下返回模拟数据
  if (!isProductionReady()) {
    console.log('🔧 开发模式：返回所有模拟事件作为公共数据');
    // For the public dashboard, we can decide which events to show.
    // Here, we'll return all events for simplicity.
    return Promise.resolve(mockData.events);
  }

  try {
    const apiName = 'api';
    const path = '/all-events';
    // v6: Use the get function directly. The response body needs to be parsed from JSON.
    const restOperation = get({
      apiName,
      path,
    });
    const { body } = await restOperation.response;
    return await body.json();
  } catch (error) {
    console.error('Error fetching all public events:', error);
    throw error;
  }
};

/**
 * Fetches all approved events for a specific user.
 * This calls the `/events/{userId}` endpoint of our API Gateway.
 * @param {string} userId The unique ID of the user whose events are to be fetched.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of the user's event objects.
 * @throws Will throw an error if the API call fails.
 */
export const getEventsByUserId = async (userId) => {
  // 在开发模式下返回模拟数据
  if (!isProductionReady()) {
    console.log(`🔧 开发模式：为用户 ${userId} 返回模拟事件数据`);
    const userEvents = mockData.events.filter(event => event.userId === userId);
    return Promise.resolve(userEvents);
  }

  try {
    const apiName = 'api';
    const path = `/events/${userId}`;
    // v6: Use the get function directly.
    const restOperation = get({
      apiName,
      path,
    });
    const { body } = await restOperation.response;
    return await body.json();
  } catch (error) {
    console.error('Error fetching events by user ID:', error);
    throw error;
  }
};

/**
 * Adds a new event record to the DynamoDB table via API Gateway and Lambda.
 * This calls the `/events` endpoint with a POST request.
 * @param {object} eventData The core data for the event (e.g., type, notes, attachment key).
 * @param {string} userId The unique ID of the user creating the event.
 * @returns {Promise<object>} A promise that resolves with the response from the API, which includes the newly created item.
 * @throws Will throw an error if the API call fails.
 */
export const addEvent = async (eventData, userId) => {
  const eventId = uuidv4();
  const timestamp = new Date().toISOString();

  const item = {
    userId, // Partition Key for DynamoDB
    eventId, // Sort Key for DynamoDB
    ...eventData,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // 在开发模式下返回模拟响应
  if (!isProductionReady()) {
    console.log('🔧 开发模式：模拟添加事件', item);
    return Promise.resolve({ item });
  }

  try {
    const apiName = 'api'; // This name is defined in our Amplify config in `main.jsx`
    const path = '/events';

    // v6: Use the post function directly. The body is passed in the options object.
    const restOperation = post({
      apiName,
      path,
      options: {
        body: item,
      },
    });

    const { body } = await restOperation.response;
    return await body.json();
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
  // 检查是否为生产环境且有Gemini API配置
  const isProduction = import.meta.env.PROD;
  const geminiApiKey = import.meta.env.VITE_GOOGLE_GEMINI_API;

  console.log('🔍 环境检查:', {
    isProduction,
    hasGeminiKey: !!geminiApiKey,
    envMode: import.meta.env.MODE
  });

  if (!isProduction || !geminiApiKey) {
    console.log('🤖 Gemini AI服务未启用 - 使用默认鼓励消息');
    console.log('💡 提示: 需要在生产环境中配置 VITE_GOOGLE_GEMINI_API 环境变量');
    return "持续跟踪，持续进步 ✨";
  }

  try {
    // 准备发送给Gemini的数据
    const userProgressSummary = `
用户声音训练进度：
- 总事件数: ${userData.events?.length || 0}
- 近期训练次数（7天内）: ${userData.events?.filter(e => 
  e.type === 'training' && 
  new Date(e.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
).length || 0}
- 训练一致性分数: ${calculateConsistencyScore(userData.events)}/100
${userData.voiceParameters ? `- 最新声音参数: 基频 ${userData.voiceParameters.fundamental}Hz, 抖动 ${userData.voiceParameters.jitter}%, 微颤 ${userData.voiceParameters.shimmer}%` : ''}
`;

    const prompt = `作为一名专业的声音训练助手，请根据以下用户的训练数据给出简短的鼓励性评价（不超过30个字）：

${userProgressSummary}

请用温暖、专业的语气，针对用户的具体情况给出个性化的鼓励和建议。回复应该简洁、积极向上。`;

    console.log('🤖 发送Gemini请求:', {
      prompt: prompt.substring(0, 100) + '...',
      userDataSummary: {
        totalEvents: userData.events?.length || 0,
        recentTraining: userData.events?.filter(e =>
          e.type === 'training' &&
          new Date(e.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length || 0
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
          temperature: 0.8,        // 适中的创意度
          topK: 20,               // 选择前20个最可能的词汇
          topP: 0.9,              // 累积概率90%
          maxOutputTokens: 150,   // 增加最大token数以允许更丰富的回复
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

/**
 * 计算用户训练一致性分数
 * @param {Array} events - 用户事件列表
 * @returns {number} 0-100的一致性分数
 */
const calculateConsistencyScore = (events) => {
  if (!events || events.length === 0) return 0;

  const trainingEvents = events.filter(e => e.type === 'training');
  if (trainingEvents.length < 2) return 50;

  // 计算训练频率的一致性
  const dates = trainingEvents.map(e => new Date(e.createdAt)).sort();
  const intervals = [];

  for (let i = 1; i < dates.length; i++) {
    const interval = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24); // 天数
    intervals.push(interval);
  }

  if (intervals.length === 0) return 50;

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;

  // 一致性分数：方差越小，分数越高
  const consistencyScore = Math.max(0, Math.min(100, 100 - variance * 2));

  return Math.round(consistencyScore);
};
