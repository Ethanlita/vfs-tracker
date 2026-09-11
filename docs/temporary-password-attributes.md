# 临时密码必填资料（#123）

CustomAuthenticator 保存 Amplify 的 missingAttributes，仅为缺失属性显示输入，不展示或覆盖挑战中已有的属性。常用 Cognito 属性使用中文标签；扩展属性显示字段名供填写。邮箱使用 email 输入类型，全部缺失属性必填，另在提交处理器中阻止空白值。提交时通过 confirmSignIn 的 options.userAttributes 发送去除首尾空格的值。服务拒绝后保留新密码和属性草稿。

confirmSignIn 返回 isSignedIn=true 后才读取当前用户并调用登录成功回调。若仍需新密码挑战则更新缺失属性；RESET_PASSWORD 转入重置；其他未支持挑战显示明确提示。挑战失效提供返回登录入口，保留用户名并清空密码和属性草稿。

## 验证

- 26项认证回归测试通过，涵盖#89、#112、#120、#121及缺属性/空值阻断/失败保留/无缺失属性/后续验证未完成/过期返回登录。
- 隔离生产构建通过。开发与生产预览分别在390/1440px运行，共4组真实Amplify SDK + 模拟Cognito SRP挑战：空属性零次响应；填写昵称邮箱后模拟失败保留；重试成功后进入/mypage。
- 请求仅记录字段名：userAttributes.nickname、userAttributes.email、NEW_PASSWORD、USERNAME。每组两次新密码挑战响应，首次模拟服务拒绝，第二次认证完成。合成令牌与模拟API用于流程测试，没有发送真实邮件或修改真实账号。
- 已检查生产手机截图，必填字段、错误和返回登录按钮可见。证据：output/playwright/frontend-audit/auth-required-tests.log、auth-required-browser.log、auth-required-3111-390.png。

本地修复，尚未提交或部署。
