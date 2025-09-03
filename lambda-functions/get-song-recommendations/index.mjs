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
    console.log("🚀 --- Lambda Invocation Start: get-song-recommendations --- 🚀");
    // Log essential request context
    console.log("📝 EVENT CONTEXT:", JSON.stringify({
        httpMethod: event.httpMethod,
        path: event.path,
        sourceIp: event.requestContext?.identity?.sourceIp,
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

    // 2. Parse and validate the vocal range from the request body
    let lowestNote, highestNote;
    try {
        const body = JSON.parse(event.body);
        lowestNote = body.lowestNote;
        highestNote = body.highestNote;
        if (!lowestNote || typeof lowestNote !== 'string' || !highestNote || typeof highestNote !== 'string') {
            console.error("❌ Validation Error: Invalid 'lowestNote' or 'highestNote' in request body.", { body });
            return createResponse(400, { success: false, error: "Invalid input. 'lowestNote' and 'highestNote' must be non-empty strings." });
        }
    } catch (error) {
        console.error('❌ Failed to parse request body:', error);
        return createResponse(400, { success: false, error: 'Invalid JSON in request body.' });
    }

    // 3. Construct the specialized prompt for Gemini
    const final_prompt = `You are an expert vocal coach and music curator. A user has provided their vocal range. Your task is to recommend 10 songs that are suitable for them.

The user's vocal range is from ${lowestNote} to ${highestNote}.

Please provide your recommendations in a valid JSON array format. Each element in the array should be an object with the following three fields:
- "songName": The name of the song.
- "artist": The original artist of the song.
- "reason": A brief explanation (in Simplified Chinese) of why this song is a good fit for the user's vocal range and what they can focus on when practicing it.

Do not include any text, markdown formatting, or code block syntax outside of the JSON array in your response. The response should be only the JSON array itself. Note: only songs is English, Janapese and Chinese could be accepted. 
Recommend 5 songs in Chinese, 3 in Japanese and 2 in English every time. Also, ensure these songs are covered by female artists. If the original artist is not female, please suggest a version covered by a female artist.
`;

    try {
        // 4. Initialize the Google Generative AI client
        const modelName = 'gemini-2.5-flash';
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log("➡️ --- Calling Gemini API --- ➡️");
        console.log("REQUEST TO GEMINI (Prompt):", final_prompt);

        // 5. Call the Gemini API
        const result = await model.generateContent(final_prompt);
        const response = result.response;
        const rawText = response.text();

        console.log("⬅️ --- Gemini API Response Received --- ⬅️");
        console.log("RAW RESPONSE FROM GEMINI:", rawText);

        // 6. Clean and parse the response to ensure it's valid JSON
        let recommendations;
        try {
            // Gemini might wrap the JSON in markdown, so we need to extract it.
            const jsonMatch = rawText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
            const cleanText = jsonMatch ? jsonMatch[1] : rawText;
            recommendations = JSON.parse(cleanText);
        } catch (parseError) {
            console.error("❌ Failed to parse Gemini response as JSON:", parseError);
            console.error("Problematic raw text:", rawText);
            return createResponse(502, { success: false, error: "Received an invalid format from the AI service." });
        }

        // 7. Return the successful response
        console.log('✅ Successfully parsed recommendations.');
        return createResponse(200, { success: true, recommendations });

    } catch (error) {
        console.error("❌ --- Gemini API Call Failed --- ❌");
        console.error("ERROR DETAILS:", JSON.stringify({
            message: error.message,
            stack: error.stack,
        }, null, 2));
        return createResponse(502, { success: false, error: 'Failed to call Gemini API.' });
    }
};
