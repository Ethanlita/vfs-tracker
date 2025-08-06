import { get, post } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import { v4 as uuidv4 } from 'uuid';

// 检查是否为生产环境 - 使用更明确的检查方式
const isProductionReady = () => {
  const hasUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const hasClientId = import.meta.env.VITE_COGNITO_USER_POOL_WEB_CLIENT_ID;
  const hasRegion = import.meta.env.VITE_AWS_REGION;

  const ready = !!(hasUserPoolId && hasClientId && hasRegion);
  console.log('🔍 AWS配置检查:', { hasUserPoolId: !!hasUserPoolId, hasClientId: !!hasClientId, hasRegion: !!hasRegion, ready });
  return ready;
};

// 开发模式下的模拟数据生成器
const generateMockEvents = (userId) => {
  const eventTypes = ['hospital_test', 'self_test', 'training', 'surgery'];
  const mockEvents = [];

  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 3); // 每3天一个事件

    mockEvents.push({
      eventId: `mock-event-${i}`,
      userId: userId,
      type: eventTypes[i % eventTypes.length],
      notes: `这是一个演示事件 #${i + 1}。在生产环境中，这里会显示真实的用户事件数据。`,
      attachment: i % 2 === 0 ? `mock-attachment-${i}.pdf` : null,
      status: 'approved',
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
      voiceParameters: {
        fundamental: 120 + Math.random() * 20,
        jitter: 0.5 + Math.random() * 1.5,
        shimmer: 2 + Math.random() * 3,
        hnr: 15 + Math.random() * 10
      }
    });
  }

  return mockEvents;
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
    console.log('🔧 开发模式：返回模拟的公共事件数据');
    const mockPublicEvents = generateMockEvents('public-demo');
    return Promise.resolve(mockPublicEvents);
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
    console.log('🔧 开发模式：返回模拟的用户事件数据', userId);
    const mockUserEvents = generateMockEvents(userId);
    return Promise.resolve(mockUserEvents);
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
