# 邮箱补充验证测试

登录必须按照 Amplify v6 的 `nextStep.signInStep` 处理未验证用户。SDK 会把 Cognito HTTP 的 `UserNotConfirmedException` 转换为 `CONFIRM_SIGN_UP` 正常返回值；组件不应依赖捕获该异常。自动重发失败后保留验证页面，允许手动重试。

## 自动化验证

```sh
npm test -- tests/unit/components/CustomAuthenticator.test.jsx tests/unit/utils/pendingSignUp.test.js
npx playwright test --config playwright.auth.config.js
```

专项 Playwright 配置启动开发服务器（3095）和生产构建预览（3096），在桌面 Chrome 和移动视口分别执行。需本机安装 Chrome，并安装锁文件依赖。使用虚构 AWS 配置，Cognito HTTP 请求由 Playwright 拦截；不加载测试账号、不创建线上用户、不发送邮件。生产构建会更新本地 `dist`。

浏览器保留真实 Amplify SDK，覆盖请求序列化、服务端错误解析、`CONFIRM_SIGN_UP` 转换和界面状态，不直接 mock SDK 方法。覆盖注册后刷新恢复、邮箱误填拦截、错误/过期验证码、重发成功和失败、验证成功后返回登录与清除记录。每个测试使用独立浏览器上下文，截图与失败 trace 位于 `test-results`。

这些测试不能证明真实用户池配置或邮件投递正常。真实云端验收还需专用一次性邮箱：注册后关闭页面，再用注册用户名登录，收取最新验证码并确认；最后验证账号可正常登录。不要使用已有正式账号改变验证状态。

## 2026-09-09 真实云端验收

使用 [Mail.tm](https://docs.mail.tm/) 的密码/令牌保护临时邮箱，在修复后的本地页面连接真实 Cognito 用户池完成验收，认证请求没有被模拟：

- 注册返回 200、账号处于未验证状态，邮箱实际收到 `verify-no-reply@vfs-tracker.app` 发出的验证码邮件。
- 刷新页面后恢复待验证账号提示；用注册用户名登录后进入验证页，自动重发返回 200，并收到第二封邮件。
- 使用第二封邮件的验证码确认成功（200），返回登录页、保留用户名、清除待验证记录。
- 验证后登录成功（200），Cognito 签发会话，ID token 的 `email_verified` 为 `true`。
- 验收后通过当前测试用户自身的 `deleteUser` 删除 Cognito 账号，再删除临时邮箱及邮件，清除临时凭据。未提交用户资料或创建嗓音事件。

本次验证覆盖邮箱注册和认证闭环，不代表资料 API、其他后端功能或线上已部署版本也完成了验收。
