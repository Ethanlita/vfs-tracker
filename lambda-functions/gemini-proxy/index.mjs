import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper function to return a consistent response format
const createResponse = (statusCode, body) => {
    return {
        statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*', // Allow requests from any origin
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'OPTIONS,POST',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    };
};

export const handler = async (event) => {
    console.log("🚀 --- Lambda Invocation Start --- 🚀");
    // Log essential request context
    console.log("📝 EVENT CONTEXT:", JSON.stringify({
        httpMethod: event.httpMethod,
        path: event.path,
        sourceIp: event.requestContext?.identity?.sourceIp,
        userAgent: event.requestContext?.identity?.userAgent,
        cognitoIdentityId: event.requestContext?.identity?.cognitoIdentityId,
    }, null, 2));

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    // 1. Get API Key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ FATAL: GEMINI_API_KEY is not set in environment variables.');
        return createResponse(500, { success: false, error: 'Server configuration error.' });
    }

    // 2. Parse and validate the prompt from the request body
    let prompt;
    try {
        const body = JSON.parse(event.body);
        prompt = body.prompt;
        if (!prompt || typeof prompt !== 'string') {
            console.error("❌ Validation Error: 'prompt' is missing or not a string in the request body.", { body });
            return createResponse(400, { success: false, error: "Invalid 'prompt' in request body. It must be a non-empty string." });
        }
    } catch (error) {
        console.error('❌ Failed to parse request body:', error);
        return createResponse(400, { success: false, error: 'Invalid JSON in request body.' });
    }

    try {
        // 3. Initialize the Google Generative AI client
        const modelName = 'gemini-2.5-flash'; // Using the user-specified model
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        // 4. Log the exact data being sent to Gemini
        const geminiRequestPayload = {
            model: modelName,
            prompt: prompt, // The actual prompt content
        };
        console.log("➡️ --- Calling Gemini API --- ➡️");
        console.log("REQUEST TO GEMINI:", JSON.stringify(geminiRequestPayload, null, 2));

        // 5. Call the Gemini API
        const result = await model.generateContent(prompt);

        // 6. Log the full, raw response from Gemini for debugging
        console.log("⬅️ --- Gemini API Response Received --- ⬅️");
        console.log("RAW RESPONSE FROM GEMINI:", JSON.stringify(result, null, 2));

        const response = result.response;
        const text = response.text();
        console.log('✅ Successfully extracted text from Gemini response.');

        // 7. Return the successful response
        return createResponse(200, { success: true, response: text });

    } catch (error) {
        // 8. Log the full error object for detailed debugging
        console.error("❌ --- Gemini API Call Failed --- ❌");
        console.error("ERROR DETAILS:", JSON.stringify({
            message: error.message,
            stack: error.stack,
            status: error.status, // For GoogleGenerativeAIFetchError
            statusText: error.statusText, // For GoogleGenerativeAIFetchError
        }, null, 2));
        return createResponse(502, { success: false, error: 'Failed to call Gemini API.' });
    }
};
