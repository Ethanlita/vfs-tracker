/**
 * @file [CN] index.mjs 是一个用于边缘探测的 AWS Lambda 函数。
 */

/**
 * [CN] 一个简单的 Lambda 处理程序，用于探测边缘位置接收到的请求信息。
 * 它会返回一个 JSON 对象，其中包含请求的 Host 头、转发头和 API Gateway 域上下文，用于调试和验证。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {Promise<object>} 一个包含请求详情的 API Gateway 响应对象。
 */
/**
 * @file [CN] index.mjs 是一个用于边缘探测的 AWS Lambda 函数。
 */

/**
 * [CN] 一个简单的 Lambda 处理程序，用于探测边缘位置接收到的请求信息。
 * 它会返回一个 JSON 对象，其中包含请求的 Host 头、转发头和 API Gateway 域上下文，用于调试和验证。
 * @param {object} event - API Gateway Lambda 事件对象。
 * @returns {Promise<object>} 一个包含请求详情的 API Gateway 响应对象。
 */
export const handler = async (event) => {
    const h = event.headers || {};
    return {
        statusCode: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({
            receivedHost: h.host || h.Host,
            xForwardedHost: h['x-forwarded-host'],
            requestContextDomain: event.requestContext?.domainName,
            method: event.httpMethod,
            path: event.path,
        }),
    };
};