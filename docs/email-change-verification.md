# 更换邮箱验证流程

资料管理页把“修改邮箱”和“完成邮箱更换”视为同一个 Cognito 属性验证流程。`updateUserAttributes` 返回 `CONFIRM_ATTRIBUTE_WITH_CODE` 时，页面显示待验证邮箱、脱敏投递地址和验证码输入框，不再把验证码投递解释成最终成功，也不再提示用户点击不存在的验证链接。

验证码确认使用 `confirmUserAttribute({ userAttributeKey: 'email', confirmationCode })`；重发使用 `sendUserAttributeVerificationCode({ userAttributeKey: 'email' })`。注册流程继续独立使用 `resendSignUpCode`，资料页不再调用注册验证码接口。

待验证记录按 Cognito user ID 保存在浏览器本地，只包含新邮箱、原邮箱、脱敏投递地址和创建时间，不保存验证码。刷新页面后可以继续输入验证码；切换账号不会显示其他账号的记录。确认成功后清除记录并重读 Cognito 属性。取消更换会先通过 Cognito 把邮箱改回原地址，只有服务确认完成后才清除记录；“更改邮箱地址”会保留当前状态并打开账户编辑器，让新提交替换当前待验证地址。

错误码在验证码面板内转换为明确操作：错误验证码保留输入，过期验证码提示重发，限速提示稍后重试。旧邮箱在用户池启用“更新前验证属性”时可能继续显示为已验证，因此页面以独立的“新邮箱待验证”状态为准，确认完成前不会显示最终成功。

测试覆盖属性更新返回值解析、刷新恢复、账号隔离、确认/重发/取消的 SDK 参数、错误/过期/限速、改填地址、昵称与密码既有流程。68 项聚焦测试、完整单元测试 102 个文件/1336 项、完整集成测试 32 个文件/630 项全部通过。生产构建性能预算通过，入口 JavaScript 825949 B、初始 CSS 136532 B、预缓存 4465919 B/74 项。

浏览器验收使用真实 Amplify SDK和模拟 Cognito HTTP 响应，在开发服务器与生产预览的 390px、1440px 四组环境中完成。每组均验证修改邮箱后不误报成功、刷新恢复、错码保留、属性验证码重发、最终确认、恢复记录清理和 SDK 操作序列；注册用的 `ResendConfirmationCode` 调用次数为零，页面异常、控制台错误和横向溢出均为零。证据见 `output/playwright/frontend-audit/email-change-verification-summary.json` 与同目录四张 `email-change-*-pending.png` 截图。合成测试不会发送真实邮件或修改线上账户。

真实邮件验收另外创建两个受令牌保护的 Mail.tm 临时邮箱和一个随机 Cognito 测试账号。第一个邮箱完成注册验证后登录，再把账户邮箱更换为第二个地址；第二个邮箱实际收到属性验证码，页面确认后重读到新邮箱及“已验证”状态。验收结束通过该账号自己的 access token 调用 `DeleteUser`，并删除两个邮箱及其中邮件；清理结果均成功，页面异常为零。脱敏结果保存在 `output/playwright/frontend-audit/email-change-real-mail-summary.json`，脚本不持久化密码、令牌或验证码。
