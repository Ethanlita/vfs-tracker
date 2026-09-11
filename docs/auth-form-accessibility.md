# 认证表单可访问性（#112）

所有自定义认证步骤共用带可见 label 的输入框，通过 useId 关联标签和输入；保留 username、email、current-password、new-password 和 one-time-code 自动填充语义。密码强度要求作为可见标签的一部分换行展示，不再只依赖被截断的占位符。

每个密码框独立控制显示状态。显示按钮有中文名称、aria-pressed 和 aria-controls，支持 Tab、Enter、空格；预留右侧空间避免遮挡输入，按钮至少 44px 宽。表单以认证步骤作为 key，切换步骤后重新隐藏密码。服务端错误属于整个请求，使用 role=alert，并通过 aria-describedby 关联表单和输入；编辑字段清除错误后同步移除关联，不将所有字段误标为无效。成功信息使用 role=status。

## 验证

- 20 项组件测试覆盖标签、自动填充属性、独立显示、键盘操作、错误关联清理、临时密码步骤及原有 #89 邮箱验证流程。
- 隔离生产构建通过。开发 3110 / 生产预览 3111，320 / 390 / 1440px、根字号 32px：登录、注册、验证、忘记密码、确认重置共 30 组输入边界及标签检查通过；键盘显示/隐藏、确认密码独立性通过。
- 检查生产 320px 注册截图：标签和密码规则换行、按钮可见。测试使用模拟 Cognito 返回，不发送真实验证码；未执行真实读屏或密码管理器自动填充，不代表全站 #144 双倍字号问题均已完成。
- 证据：output/playwright/frontend-audit/auth-accessibility-tests.log、auth-accessibility-browser.log、auth-accessibility-3111-320.png。

本地修复，尚未提交或部署。
