# 资料字段更新与并发保存（#171）

新客户端PUT /user/{userId}发送 `{profilePatch: {...}}`。头像仅提交avatarKey；资料编辑仅提交name、isNamePublic、socials、areSocialsPublic。不会携带旧的其他字段。

后端将每个明确提供的字段构造成 `SET profile.#field = :value`，与updatedAt在同一次DynamoDB UpdateCommand中更新。不同字段的交错写入不会整体替换profile。空数组和false表示明确清空/关闭，省略字段保持原值。请求校验拒绝无效字段和类型；nickname由Cognito管理，旧完整请求中的setupSkipped保留原值。profile map不存在时返回409，要求先完成资料初始化，避免创建残缺资料。

## 协议与发布顺序

必须先部署updateUserProfile后端，再发布前端。新前端使用独立的profilePatch字段，旧后端因缺少profile而返回400，不能把部分数据误当作完整资料替换。新后端兼容旧客户端profile请求并统一执行字段更新；旧客户端仍会携带所有字段，其跨标签页保护需要升级前端后才生效。生产后端尚未部署，因此当前本地前端连接旧生产API的资料/头像保存会被拒绝。

后端路径：lambda-functions/updateUserProfile/index.mjs及profile-update.mjs。SAM按现有函数目录打包，无需新增路由或资源。

## 验证

64项补丁契约/API/资料组件测试通过；追加旧元数据兼容后14项补丁测试通过，Lambda入口与补丁最终22项测试通过。入口测试覆盖跨用户403、无效/冲突请求400、缺失profile map的409及合并结果返回。生产前端构建通过。

开发/生产预览、390/1440px共4组双标签页测试通过：页面A持有旧资料，页面B保存头像后A保存名称；随后B持有旧名称，A先保存新名称再由B保存头像。最终名称和头像都保留，实际请求仅包含各自负责字段。模拟服务执行字段合并，不能替代真实DynamoDB部署验收。

证据：output/playwright/frontend-audit/profile-patch-final-tests.log、profile-patch-handler-tests.log、profile-patch-browser.log。

同一字段被多个客户端同时修改仍采用后写入者结果。本项不解决#154中同页刷新覆盖未保存表单草稿，相关修复仍待完成。尚未提交、部署或关闭issue。
