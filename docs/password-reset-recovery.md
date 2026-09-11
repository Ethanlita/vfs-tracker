# 密码重置恢复路径（#120、#121）

登录 SDK 返回 RESET_PASSWORD 时，页面保留去除首尾空格的用户名，清除旧密码，解释重置原因并进入发送验证码表单。仅在用户点击后发送邮件；未知且尚未完成的登录步骤会显示需要管理员协助的提示，不会无声停留或调用登录成功回调。

初次发送与确认页重新发送共用 sendResetCode。同步请求锁防止重复提交，密码重置有独立的 60 秒冷却；失败不启动冷却，允许重试。验证码过期释放冷却并显示重发入口。重发失败保留用户名、验证码及两次密码输入；成功只清空旧验证码，保留新密码草稿。确认重置前移除上次发送成功信息，避免过期错误旁仍显示旧成功状态。

重置成功立即回到登录页，保留用户名、清除密码和验证码并显示成功提示。没有延迟跳转；原登录 URL 的 returnUrl 保持不变，后续成功登录继续沿用现有返回逻辑。

## 验证范围

23 项认证组件测试通过，覆盖 #89、#112、RESET_PASSWORD、未知登录步骤、发送失败重试、过期后重发、请求去重、密码保留和成功回登录。隔离生产构建通过。

浏览器使用真实 Amplify SDK，通过模拟 Cognito 的 PasswordResetRequiredException、ExpiredCodeException、ForgotPassword 和 ConfirmForgotPassword 响应检查 UI/API 衔接，不发送真实邮件或修改账户。证据保存在 output/playwright/frontend-audit/auth-reset-tests.log 和 auth-reset-browser.log。

开发与生产预览各在 390 / 1440px 完成全流程，共 4 组通过。每组请求为一次 InitiateAuth、三次 ForgotPassword（含一次模拟失败）、两次 ConfirmForgotPassword（含一次过期）；最终保留用户名和 returnUrl，展示重置成功提示。生产手机截图确认重发按钮、冷却状态和密码输入均可见。

本地修复，尚未提交或部署。
