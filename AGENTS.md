# Agent Notes / 代理说明

- Development mode detection relies on the completeness of mandatory AWS environment variables.缺少任一必需变量时，`isProductionReady` 会返回 `false` 并触发开发模式逻辑。
- Mandatory variables include `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_ENDPOINT`, and `VITE_S3_BUCKET`.这些配置必须全部存在，应用才会按生产模式执行真实云端请求。
