# Agent Notes / 代理说明

- Development mode detection relies on the completeness of mandatory AWS environment variables.
- 缺少任一必需变量时，`isProductionReady` 会返回 `false` 并触发开发模式逻辑。
- Mandatory variables include `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`, `VITE_AWS_REGION`, `VITE_API_ENDPOINT`, and `VITE_S3_BUCKET`.
- 这些配置必须全部存在，应用才会按生产模式执行真实云端请求。
- Error handling updates on this branch follow the patterns captured in `docs/error-handling-guide.md`; please consult it for constructors, metadata fields, helper utilities, and bilingual examples before modifying `src/utils/apiError.js` or related tests.
- 本分支的错误处理约定整理在 `docs/error-handling-guide.md`，涉及构造函数、上下文字段、工具方法与双语示例，修改 `src/utils/apiError.js` 或相关测试前请先阅读。
- `docs/`文件夹下的文档是技术文档，包括了数据约定，API定义，数据结构定义，功能定义等内容，不可不看（看和当前任务有关的就行）。
- `posts/`下的文档是面向用户的文档，可以不看。
- 进行了修改后，应当及时确保对应的文档可以反映最新的功能。
- 修改时一定要同时添加规范的docstring和双语注释，不要单独删除原有的注释。（除非是原本的代码也被一起删除了）
- Lambda函数的代码在`lambda-functions/`下。
- 对于API和依赖库的具体调用方法，涉及到第三方的，先在网上找最新的manual确认使用方法，项目内的文档中可能有些信息已经过时。
- Lambda函数目前还需要手动部署。
- 注意UI的美观，创建和修改页面组件时要确保其外观风格和这个项目中其他地方一致。样式要符合Tailwind CSS的最佳实践。
- 测试非常重要，要写详细的单元测试以确保功能正常。前端还要进行视觉测试和组件测试。最后你应该尽量进行端到端的测试。