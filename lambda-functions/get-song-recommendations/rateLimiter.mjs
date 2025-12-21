/**
 * @file [CN] 共享的限速工具模块，用于限制 Gemini API 的请求频率。
 * 
 * 功能：
 * - 从 SSM Parameter Store 获取限速配置
 * - 检查用户是否超出限速
 * - 更新用户的请求历史（存储在用户的 DynamoDB 记录中）
 * - 自动清理超出时间窗口的历史记录
 */

import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';

// AWS 客户端（复用连接）
const dynamoClient = new DynamoDBClient({});
const ssmClient = new SSMClient({});

// 表名常量
const USERS_TABLE = process.env.USERS_TABLE || 'VoiceFemUsers';

// SSM 参数路径前缀
const SSM_PREFIX = '/vfs-tracker/rate-limit';

// 默认限速配置（当无法从 SSM 获取时使用）
const DEFAULT_RATE_LIMIT_CONFIG = {
    adviceWindowHours: 24,
    adviceMaxRequests: 10,
    songWindowHours: 24,
    songMaxRequests: 10
};

// 配置缓存（避免频繁调用 SSM）
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/**
 * [CN] 从 SSM Parameter Store 获取限速配置。
 * 使用缓存避免频繁调用 SSM。
 * @returns {Promise<object>} 限速配置对象
 */
export async function getRateLimitConfig() {
    // 检查缓存是否有效
    const now = Date.now();
    if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
        return configCache;
    }
    
    try {
        const command = new GetParametersCommand({
            Names: [
                `${SSM_PREFIX}/advice-window-hours`,
                `${SSM_PREFIX}/advice-max-requests`,
                `${SSM_PREFIX}/song-window-hours`,
                `${SSM_PREFIX}/song-max-requests`
            ]
        });
        
        const response = await ssmClient.send(command);
        
        // 解析参数值
        const config = { ...DEFAULT_RATE_LIMIT_CONFIG };
        for (const param of response.Parameters || []) {
            const name = param.Name;
            const value = parseInt(param.Value, 10);
            
            if (name.endsWith('/advice-window-hours')) {
                config.adviceWindowHours = value;
            } else if (name.endsWith('/advice-max-requests')) {
                config.adviceMaxRequests = value;
            } else if (name.endsWith('/song-window-hours')) {
                config.songWindowHours = value;
            } else if (name.endsWith('/song-max-requests')) {
                config.songMaxRequests = value;
            }
        }
        
        // 更新缓存
        configCache = config;
        configCacheTime = now;
        
        console.log('[RateLimiter] Loaded config from SSM:', config);
        return config;
    } catch (error) {
        console.error('[RateLimiter] Failed to get rate limit config from SSM:', error);
        return DEFAULT_RATE_LIMIT_CONFIG;
    }
}

/**
 * [CN] 从 DynamoDB 获取用户的限速数据。
 * @param {string} userId - 用户 ID
 * @returns {Promise<object>} 用户的限速数据
 */
export async function getUserRateLimitData(userId) {
    try {
        const command = new GetItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
            ProjectionExpression: 'aiRateLimit, isAdmin'
        });
        
        const response = await dynamoClient.send(command);
        
        if (response.Item) {
            const item = unmarshall(response.Item);
            return {
                isAdmin: item.isAdmin || false,
                aiRateLimit: item.aiRateLimit || {
                    adviceHistory: [],
                    songHistory: [],
                    lastAdviceResponse: null,
                    lastSongRecommendations: null
                }
            };
        }
        
        // 用户不存在，返回默认值
        return {
            isAdmin: false,
            aiRateLimit: {
                adviceHistory: [],
                songHistory: [],
                lastAdviceResponse: null,
                lastSongRecommendations: null
            }
        };
    } catch (error) {
        console.error('[RateLimiter] Failed to get user rate limit data:', error);
        throw error;
    }
}

/**
 * [CN] 清理超出时间窗口的历史记录。
 * @param {string[]} history - 时间戳数组
 * @param {number} windowHours - 时间窗口（小时）
 * @returns {string[]} 清理后的时间戳数组
 */
export function cleanExpiredHistory(history, windowHours) {
    if (!Array.isArray(history) || history.length === 0) {
        return [];
    }
    
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    return history.filter(ts => new Date(ts) > cutoffTime);
}

/**
 * [CN] 检查用户是否超出限速。
 * @param {string[]} history - 清理后的请求历史
 * @param {number} maxRequests - 最大请求数
 * @returns {object} { isLimited: boolean, count: number, oldestTimestamp: string|null }
 */
export function checkRateLimit(history, maxRequests) {
    const count = history.length;
    const isLimited = count >= maxRequests;
    const oldestTimestamp = history.length > 0 ? history[0] : null;
    
    return {
        isLimited,
        count,
        oldestTimestamp
    };
}

/**
 * [CN] 计算下次可用时间。
 * @param {string} oldestTimestamp - 最早的请求时间戳
 * @param {number} windowHours - 时间窗口（小时）
 * @returns {string} ISO 格式的下次可用时间
 */
export function calculateNextAvailableTime(oldestTimestamp, windowHours) {
    const oldestTime = new Date(oldestTimestamp);
    const nextAvailable = new Date(oldestTime.getTime() + windowHours * 60 * 60 * 1000);
    return nextAvailable.toISOString();
}

/**
 * [CN] 格式化下次可用时间为中文友好格式。
 * @param {string} isoTimestamp - ISO 格式时间戳
 * @returns {string} 中文格式时间字符串
 */
export function formatNextAvailableTime(isoTimestamp) {
    const date = new Date(isoTimestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}年${month}月${day}日${hours}时${minutes}分${seconds}秒（UTC）`;
}

/**
 * [CN] 更新用户的 AI 建议限速数据。
 * @param {string} userId - 用户 ID
 * @param {string[]} newAdviceHistory - 新的请求历史
 * @param {string} lastResponse - 最新的 AI 响应内容
 */
export async function updateAdviceRateLimitData(userId, newAdviceHistory, lastResponse) {
    try {
        const command = new UpdateItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
            UpdateExpression: 'SET aiRateLimit.adviceHistory = :history, aiRateLimit.lastAdviceResponse = :response, updatedAt = :updatedAt',
            ExpressionAttributeValues: marshall({
                ':history': newAdviceHistory,
                ':response': lastResponse,
                ':updatedAt': new Date().toISOString()
            })
        });
        
        await dynamoClient.send(command);
        console.log(`[RateLimiter] Updated advice rate limit data for user: ${userId}`);
    } catch (error) {
        // 如果 aiRateLimit 不存在，需要创建整个对象
        if (error.name === 'ValidationException') {
            await initializeAndUpdateAdviceData(userId, newAdviceHistory, lastResponse);
        } else {
            console.error('[RateLimiter] Failed to update advice rate limit data:', error);
            throw error;
        }
    }
}

/**
 * [CN] 初始化并更新用户的 AI 建议限速数据（当 aiRateLimit 属性不存在时）。
 * @param {string} userId - 用户 ID
 * @param {string[]} adviceHistory - 请求历史
 * @param {string} lastResponse - 最新的 AI 响应内容
 */
async function initializeAndUpdateAdviceData(userId, adviceHistory, lastResponse) {
    const command = new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId }),
        UpdateExpression: 'SET aiRateLimit = :rateLimit, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
            ':rateLimit': {
                adviceHistory: adviceHistory,
                songHistory: [],
                lastAdviceResponse: lastResponse,
                lastSongRecommendations: null
            },
            ':updatedAt': new Date().toISOString()
        })
    });
    
    await dynamoClient.send(command);
    console.log(`[RateLimiter] Initialized and updated advice rate limit data for user: ${userId}`);
}

/**
 * [CN] 更新用户的 AI 荐歌限速数据。
 * @param {string} userId - 用户 ID
 * @param {string[]} newSongHistory - 新的请求历史
 * @param {Array} lastRecommendations - 最新的推荐歌曲列表
 */
export async function updateSongRateLimitData(userId, newSongHistory, lastRecommendations) {
    try {
        const command = new UpdateItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ userId }),
            UpdateExpression: 'SET aiRateLimit.songHistory = :history, aiRateLimit.lastSongRecommendations = :recommendations, updatedAt = :updatedAt',
            ExpressionAttributeValues: marshall({
                ':history': newSongHistory,
                ':recommendations': lastRecommendations,
                ':updatedAt': new Date().toISOString()
            })
        });
        
        await dynamoClient.send(command);
        console.log(`[RateLimiter] Updated song rate limit data for user: ${userId}`);
    } catch (error) {
        // 如果 aiRateLimit 不存在，需要创建整个对象
        if (error.name === 'ValidationException') {
            await initializeAndUpdateSongData(userId, newSongHistory, lastRecommendations);
        } else {
            console.error('[RateLimiter] Failed to update song rate limit data:', error);
            throw error;
        }
    }
}

/**
 * [CN] 初始化并更新用户的 AI 荐歌限速数据（当 aiRateLimit 属性不存在时）。
 * @param {string} userId - 用户 ID
 * @param {string[]} songHistory - 请求历史
 * @param {Array} lastRecommendations - 最新的推荐歌曲列表
 */
async function initializeAndUpdateSongData(userId, songHistory, lastRecommendations) {
    const command = new UpdateItemCommand({
        TableName: USERS_TABLE,
        Key: marshall({ userId }),
        UpdateExpression: 'SET aiRateLimit = :rateLimit, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
            ':rateLimit': {
                adviceHistory: [],
                songHistory: songHistory,
                lastAdviceResponse: null,
                lastSongRecommendations: lastRecommendations
            },
            ':updatedAt': new Date().toISOString()
        })
    });
    
    await dynamoClient.send(command);
    console.log(`[RateLimiter] Initialized and updated song rate limit data for user: ${userId}`);
}

/**
 * [CN] 从 API Gateway Cognito Authorizer 提供的 claims 中提取用户 ID。
 * 注意：此函数仅依赖 API Gateway Authorizer 提供的已验证 claims，
 * 不直接解析 Authorization header，以避免签名验证缺失带来的安全风险。
 * @param {object} event - API Gateway Lambda 事件对象
 * @returns {string|null} 用户 ID 或 null（如果未通过 Authorizer 认证）
 */
export function extractUserIdFromEvent(event) {
    try {
        // 从 API Gateway 请求上下文中获取用户 ID（Cognito authorizer 会自动添加）
        const claims = event.requestContext?.authorizer?.claims;
        if (claims && claims.sub) {
            return claims.sub;
        }
        
        // 如果没有 claims，说明请求未通过 Cognito Authorizer 认证
        // 这种情况下返回 null，让调用方决定如何处理（例如返回 401 或跳过限速）
        console.warn('[RateLimiter] No authorizer claims found in event');
        return null;
    } catch (error) {
        console.error('[RateLimiter] Failed to extract user ID from event:', error);
        return null;
    }
}

/**
 * [CN] 生成 AI 建议超限时的响应消息。
 * @param {number} windowHours - 时间窗口（小时）
 * @param {number} maxRequests - 最大请求数
 * @param {string} nextAvailableTime - 下次可用时间（ISO 格式）
 * @param {string} lastResponse - 上次的 AI 建议内容
 * @returns {string} Markdown 格式的响应消息
 */
export function generateAdviceRateLimitMessage(windowHours, maxRequests, nextAvailableTime, lastResponse) {
    const formattedTime = formatNextAvailableTime(nextAvailableTime);
    
    let message = `> ⚠️ **使用量提醒**：您已超出AI建议的使用量上限（每${windowHours}小时${maxRequests}次）。您的下一个AI建议将于${formattedTime}可用。\n`;
    
    if (lastResponse) {
        message += `>\n> 以下是您的上一条AI建议内容：\n\n${lastResponse}`;
    } else {
        message += `>\n> 暂无历史AI建议记录。`;
    }
    
    return message;
}

/**
 * [CN] 生成 AI 荐歌超限时的提示消息。
 * @param {number} windowHours - 时间窗口（小时）
 * @param {number} maxRequests - 最大请求数
 * @param {string} nextAvailableTime - 下次可用时间（ISO 格式）
 * @returns {string} 提示消息
 */
export function generateSongRateLimitMessage(windowHours, maxRequests, nextAvailableTime) {
    const formattedTime = formatNextAvailableTime(nextAvailableTime);
    return `您已超出AI荐歌的使用量上限（每${windowHours}小时${maxRequests}次），本次为您展示上一次的推荐结果。下一次AI荐歌将于${formattedTime}可用。`;
}
