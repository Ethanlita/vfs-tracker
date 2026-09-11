# 账户改密输入完整性（#122）

资料页只要任一密码字段非空，就验证当前密码、新密码和确认新密码是否齐全，以及两次新密码是否一致。错误显示在对应字段下，通过 label、aria-invalid 和 aria-describedby 关联，并聚焦首个错误字段。所有输入保留；验证未通过时不提交昵称、邮箱或密码变更。

三个密码字段全空时仍可单独修改昵称或邮箱。没有账户变更时提示“没有需要保存的账户修改”，保留编辑状态且不发送请求。服务拒绝后保留密码草稿；成功后沿用既有流程清空密码并退出编辑。密码字段同时补齐 current-password / new-password 自动填充属性。

## 验证

24 项 UserProfileManager 集成测试通过，包括缺当前密码、缺新密码、缺确认密码、不一致、无修改、只改昵称、完整改密、服务失败与重试。隔离生产构建通过。

浏览器验证使用合成登录和模拟 Cognito ChangePassword，不修改真实账号。测试证据：output/playwright/frontend-audit/profile-password-tests.log、profile-password-browser.log、profile-password-3111-390.png。

开发与生产预览各在390/1440px完成四种无效组合阻断，以及服务拒绝→保留输入→重试成功。每组无效输入零次ChangePassword，完整改密两次（失败一次、成功一次）。生产手机截图确认字段错误显示且焦点位于确认密码。

昵称/邮箱/密码多请求的部分成功恢复已由 #125 补齐，详见[账户资料部分成功恢复](account-partial-update.md)。资料刷新覆盖草稿等关联问题仍按各自验收记录处理。尚未提交或部署。
