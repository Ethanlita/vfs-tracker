import { get, post } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Uploads a file to S3.
 * The file is stored in a user-specific "folder" to ensure separation of data.
 * @param {File} file The file object to upload.
 * @param {string} userId The unique ID of the user, used as a prefix for the S3 key.
 * @returns {Promise<string>} A promise that resolves with the unique S3 key of the uploaded file.
 * @throws Will throw an error if the upload fails.
 */
export const uploadFile = async (file, userId) => {
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