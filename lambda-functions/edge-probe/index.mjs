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
