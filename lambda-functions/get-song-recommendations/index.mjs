/**
 * @file [CN] 该文件包含一个 AWS Lambda 处理程序，用于根据用户的音域推荐歌曲。
 * 
 * 功能特性：
 * - 使用 Gemini AI 生成个性化歌曲推荐
 * - 请求频率限制（可配置的时间窗口和最大请求数）
 * - 管理员豁免限速
 * - 超限时返回上一次的推荐结果
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    createStructuredLogger,
    describeError,
    fingerprintIdentifier,
} from './structuredLogger.mjs';
import {
    getRateLimitConfig,
    getUserRateLimitData,
    cleanExpiredHistory,
    checkRateLimit,
    calculateNextAvailableTime,
    updateSongRateLimitData,
    extractUserIdFromEvent,
    generateSongRateLimitMessage
} from './rateLimiter.mjs';

/**
 * [CN] 创建一个具有 CORS 标头的标准化 API Gateway 响应对象。
 * @param {number} statusCode - HTTP 状态码。
 * @param {object} body - 要在响应正文中进行 JSON 字符串化的对象。
 * @returns {object} 格式化的 API Gateway 响应对象。
 */
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

/**
 * [CN] 一个 AWS Lambda 处理程序，接收用户的最低和最高音符，
 * 并使用 Google Gemini API 生成一个包含 10 首适合该音域的歌曲列表。
 * @param {object} event - API Gateway Lambda 事件对象。它应包含一个带有“lowestNote”和“highestNote”字段的 JSON 正文。
 * @returns {Promise<object>} 一个 API Gateway 响应，其中包含一个歌曲推荐列表或错误消息。
 */
export const handler = async (event, context = {}) => {
    const logger = createStructuredLogger({
        service: 'get-song-recommendations',
        requestId: context.awsRequestId || event.requestContext?.requestId,
    });
    logger.info('invocation_started', { method: event.httpMethod, route: event.path });

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    // 1. Get API Key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        logger.error('configuration_missing', { variable: 'GEMINI_API_KEY' });
        return createResponse(500, { success: false, error: 'Server configuration error.' });
    }

    // 2. Parse and validate the vocal range from the request body
    let lowestNote, highestNote;
    try {
        const body = JSON.parse(event.body);
        lowestNote = body.lowestNote;
        highestNote = body.highestNote;
        if (!lowestNote || typeof lowestNote !== 'string' || !highestNote || typeof highestNote !== 'string') {
            logger.warn('request_validation_failed', {
                fields: ['lowestNote', 'highestNote'],
                lowestNoteType: typeof lowestNote,
                highestNoteType: typeof highestNote,
            });
            return createResponse(400, { success: false, error: "Invalid input. 'lowestNote' and 'highestNote' must be non-empty strings." });
        }
    } catch (error) {
        logger.warn('request_json_invalid', describeError(error));
        return createResponse(400, { success: false, error: 'Invalid JSON in request body.' });
    }

    // 3. Extract user ID from the event (from Cognito authorizer)
    const userId = extractUserIdFromEvent(event);
    if (!userId) {
        logger.warn('identity_missing');
        return createResponse(401, { success: false, error: 'Unable to identify user.' });
    }
    const userHash = fingerprintIdentifier(userId);

    // 4. Check rate limit and pre-charge quota before the AI request.
    // 仅当后续请求失败时回退本次扣减。
    let quotaReservation = null;
    try {
        const [rateLimitConfig, userRateLimitData] = await Promise.all([
            getRateLimitConfig(),
            getUserRateLimitData(userId)
        ]);

        const { songWindowHours, songMaxRequests } = rateLimitConfig;
        const { isAdmin, aiRateLimit } = userRateLimitData;

        logger.debug('rate_limit_configuration_loaded', {
            windowHours: songWindowHours,
            maxRequests: songMaxRequests,
            isAdmin,
        });

        // 管理员跳过限速检查
        if (!isAdmin) {
            // 清理过期历史
            const cleanedHistory = cleanExpiredHistory(aiRateLimit.songHistory || [], songWindowHours);
            const rateLimitResult = checkRateLimit(cleanedHistory, songMaxRequests);

            logger.info('rate_limit_checked', {
                userHash,
                requestCount: rateLimitResult.count,
                maxRequests: songMaxRequests,
            });

            if (rateLimitResult.isLimited) {
                // 用户超限，返回上次的推荐结果
                const nextAvailableTime = calculateNextAvailableTime(rateLimitResult.oldestTimestamp, songWindowHours);
                const rateLimitMessage = generateSongRateLimitMessage(
                    songWindowHours,
                    songMaxRequests,
                    nextAvailableTime
                );

                logger.warn('rate_limit_exceeded', { userHash, nextAvailableAt: nextAvailableTime });

                // 返回 success: true 以便前端能正常处理
                return createResponse(200, {
                    success: true,
                    recommendations: aiRateLimit.lastSongRecommendations || [],
                    rateLimited: true,
                    message: rateLimitMessage,
                    nextAvailableAt: nextAvailableTime
                });
            }

            // 预扣本次请求配额（请求前扣减）
            const reservationTimestamp = new Date().toISOString();
            const reservedHistory = [...cleanedHistory, reservationTimestamp];
            await updateSongRateLimitData(
                userId,
                reservedHistory,
                aiRateLimit.lastSongRecommendations || null
            );

            quotaReservation = {
                timestamp: reservationTimestamp,
                history: reservedHistory,
                previousRecommendations: aiRateLimit.lastSongRecommendations || null
            };
            logger.info('quota_reserved', { userHash, reservedAt: reservationTimestamp });
        } else {
            logger.info('rate_limit_admin_bypass', { userHash });
        }
    } catch (rateLimitError) {
        // 限速/预扣失败时不继续调用 AI，避免配额状态不一致。
        logger.error('rate_limit_service_failed', { userHash, ...describeError(rateLimitError) });
        return createResponse(503, { success: false, error: 'Rate limit service unavailable.' });
    }

    // 5. Construct the specialized prompt for Gemini
    const final_prompt = `You are an expert vocal coach and music curator. A user has provided their vocal range. Your task is to recommend 10 songs that are suitable for them.

The user's vocal range is from ${lowestNote} to ${highestNote}.

Please provide your recommendations in a valid JSON array format. Each element in the array should be an object with the following three fields:
- "songName": The name of the song.
- "artist": The original artist of the song.
- "reason": A brief explanation (in Simplified Chinese) of why this song is a good fit for the user's vocal range and what they can focus on when practicing it.

Do not include any text, markdown formatting, or code block syntax outside of the JSON array in your response. The response should be only the JSON array itself. Note: only songs is English, Janapese and Chinese could be accepted. 
Recommend 5 songs in Chinese, 3 in Japanese and 2 in English every time. Also, ensure these songs are covered by female artists. If the original artist is not female, please suggest a version covered by a female artist.
`;

    /**
     * [CN] 回退本次预扣的 song quota。
     * 仅在 quotaReservation 存在时执行，确保“失败回退”覆盖所有失败路径。
     */
    const rollbackSongQuotaReservation = async () => {
        if (!quotaReservation) {
            return;
        }

        try {
            const latestUserRateLimitData = await getUserRateLimitData(userId);
            const currentHistory = latestUserRateLimitData.aiRateLimit?.songHistory || [];
            const rolledBackHistory = currentHistory.filter(ts => ts !== quotaReservation.timestamp);

            await updateSongRateLimitData(
                userId,
                rolledBackHistory,
                latestUserRateLimitData.aiRateLimit?.lastSongRecommendations || quotaReservation.previousRecommendations || null
            );
            logger.info('quota_reservation_rolled_back', { userHash, reservedAt: quotaReservation.timestamp });
        } catch (rollbackError) {
            logger.error('quota_rollback_failed', { userHash, ...describeError(rollbackError) });
        }
    };

    try {
        // 6. Initialize the Google Generative AI client
        const modelName = 'gemini-flash-latest';
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        logger.info('ai_request_started', { userHash, model: modelName, inputCharacters: final_prompt.length });

        // 7. Call the Gemini API
        const result = await model.generateContent(final_prompt);
        const response = result.response;
        const rawText = response.text();

        logger.info('ai_response_received', { userHash, model: modelName, outputCharacters: rawText.length });

        // 8. Clean and parse the response to ensure it's valid JSON
        let recommendations;
        try {
            // Gemini might wrap the JSON in markdown, so we need to extract it.
            const jsonMatch = rawText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
            const cleanText = jsonMatch ? jsonMatch[1] : rawText;
            recommendations = JSON.parse(cleanText);
        } catch (parseError) {
            logger.error('ai_response_invalid', {
                userHash,
                outputCharacters: rawText.length,
                ...describeError(parseError),
            });
            await rollbackSongQuotaReservation();
            return createResponse(502, { success: false, error: "Received an invalid format from the AI service." });
        }

        // 9. Persist latest recommendations while keeping the pre-charged history.
        try {
            if (quotaReservation) {
                await updateSongRateLimitData(userId, quotaReservation.history, recommendations);
            }
            logger.info('quota_result_persisted', { userHash });
        } catch (updateError) {
            // 更新失败不应影响响应返回
            logger.error('quota_result_persist_failed', { userHash, ...describeError(updateError) });
        }

        // 10. Return the successful response
        logger.info('recommendations_completed', { userHash, recommendationCount: recommendations.length });
        return createResponse(200, { success: true, recommendations });

    } catch (error) {
        // AI 请求失败时回退本次预扣的配额。
        await rollbackSongQuotaReservation();

        logger.error('ai_request_failed', { userHash, ...describeError(error) });
        return createResponse(502, { success: false, error: 'Failed to call Gemini API.' });
    }
};
