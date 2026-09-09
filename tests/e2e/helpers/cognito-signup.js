/** @file Cognito 邮箱验证网络 fixture；保留真实 SDK 的序列化与错误转换。 */
export const signupAccount = { username: 'signup-review', email: 'signup-review@example.com', password: 'Passw0rd!', code: '123456' };

/**
 * 拦截 Cognito 请求并模拟未验证用户；意外操作直接失败，不向云端透传。
 * @param {import('@playwright/test').Page} page - 当前测试页面
 * @param {{failResend?: boolean}} options - 是否模拟重发服务不可用（包含 SDK 内部重试）
 * @returns {Promise<{calls: Array, allowResend: Function}>} 调用记录及恢复重发服务的控制器
 */
export async function mockCognitoSignUp(page, { failResend = false } = {}) {
  const calls = [];
  let rejectResend = failResend;
  await page.route('https://cognito-idp.us-east-1.amazonaws.com/**', async route => {
    const request = route.request();
    const operation = request.headers()['x-amz-target']?.split('.').pop();
    const body = request.postDataJSON();
    calls.push({ operation, body });
    const delivery = { Destination: 's***@example.com', DeliveryMedium: 'EMAIL', AttributeName: 'email' };
    let response = {};
    let error;
    switch (operation) {
      case 'SignUp':
        response = { UserConfirmed: false, UserSub: '00000000-0000-4000-8000-000000000093', CodeDeliveryDetails: delivery };
        break;
      case 'InitiateAuth':
        // 真实 SDK 必须把此服务端异常转换成 CONFIRM_SIGN_UP。
        error = 'UserNotConfirmedException';
        break;
      case 'ResendConfirmationCode':
        // SDK 会自动重试限流错误，必须持续失败才能测试组件中的手动重试入口。
        if (rejectResend) error = 'LimitExceededException';
        else response = { CodeDeliveryDetails: delivery };
        break;
      case 'ConfirmSignUp':
        if (body.ConfirmationCode === '000000') error = 'CodeMismatchException';
        else if (body.ConfirmationCode === '111111') error = 'ExpiredCodeException';
        else if (body.ConfirmationCode !== signupAccount.code) error = 'CodeMismatchException';
        break;
      default:
        throw new Error(`Unexpected Cognito operation: ${operation}`);
    }
    await route.fulfill({
      status: error ? 400 : 200,
      contentType: 'application/x-amz-json-1.1',
      headers: error ? { 'x-amzn-errortype': error } : {},
      body: JSON.stringify(error ? { __type: error, message: error } : response)
    });
  });
  return { calls, allowResend: () => { rejectResend = false; } };
}
