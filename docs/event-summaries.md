# 事件摘要的契约解释

事件管理列表通过 `eventSummary` 生成摘要（#140）。训练/练习的可选内容缺失时使用明确空态，避免可选链结果与省略号相加产生 `undefined...`。短文本原样显示，只有超过50个Unicode字符才截断并添加省略号，避免切断emoji。

契约仍支持的旧感受字段 `feeling` 与当前 `content` 统一由 `feelingContent` 解释，当前字段优先。自定义医生由 `doctorName` 返回 `customDoctor`。摘要和对应详情共享这两个函数；搜索继续读取契约字段全文，可检索旧感受和自定义姓名。原始存储数据不修改。

测试样本位于 `src/test-utils/fixtures/event-summary.js`，均通过 `eventSchemaPrivate`。8项摘要测试覆盖缺字段、短文本、长文本、Unicode边界和字段优先级；配合事件管理/删除测试共26项通过，生产构建通过。

使用隔离合成账号和模拟事件读取，不修改真实事件。尚未提交或部署。

2026-09-11：开发/生产×390/1440px四组浏览器检查通过，共24次摘要断言，旧感受/自定义姓名搜索与详情一致。已查看生产手机截图。证据为 output/playwright/frontend-audit/event-summary-*。
