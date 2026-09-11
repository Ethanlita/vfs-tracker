# S3 存储清理

`cleanupStorage` 由 EventBridge 每天调用一次，清理两类不会再被产品使用的对象：

- `attachments/` 中超过七天且没有出现在 `VoiceFemEvents.attachments` 的文件；
- `voice-tests/{sessionId}/raw/` 中已完成、已失败或长期无进展会话的原始录音。

事件表是附件引用的唯一真源。任务先列出附件，再对事件表进行强一致完整扫描；七天宽限期保护刚上传、尚未写入事件的文件。嗓音测试按 `VoiceFemTests` 会话状态判断：`done`/`failed` 保留一小时，`created`/`pending` 保留两小时，卡在 `processing` 的会话保留六小时。任务一次列出 `voice-tests/` 对象并只选择 `raw/` 前缀删除，不触碰 `artifacts/` 和 `report.pdf`，后两者仍用于结果页及事件报告。这样不会为每个历史会话单独发送 S3 列表请求。

清理不依赖上传请求携带对象标签，因此不会改变 ESA、Cloudflare 和 S3 预签名 PUT 的请求头契约。`Content-Type: audio/wav` 继续作为音频格式声明，不参与生命周期匹配。

## 配置与运行

SAM 模板配置以下环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `BUCKET_NAME` | 业务存储桶 | S3 存储桶 |
| `EVENTS_TABLE` | `VoiceFemEvents` | 附件引用来源 |
| `VOICE_TESTS_TABLE` | `VoiceFemTests` | 会话状态来源 |
| `ATTACHMENT_GRACE_DAYS` | `7` | 孤儿附件宽限期 |
| `TERMINAL_RAW_RETENTION_HOURS` | `1` | 完成/失败会话原始录音保留期 |
| `ABANDONED_RAW_RETENTION_HOURS` | `2` | 未发起分析会话原始录音保留期 |
| `PROCESSING_RAW_RETENTION_HOURS` | `6` | 卡住的分析会话原始录音保留期 |
| `DRY_RUN` | `false` | 设为 `true` 时只统计不删除 |

上线前可临时将 `DRY_RUN` 设为 `true`，在 CloudWatch 中核对 `storage_cleanup_completed` 的聚合计数。日志只包含数量和状态分类，不记录对象键、用户 ID 或文件名。删除批次中任一对象失败都会使本次调用失败，从而保留 Lambda 错误指标并进入 EventBridge 的重试流程。

2026-09-11 使用本地 AWS 凭证执行了真实只读演练：扫描到 36 个附件对象，其中 25 个被事件引用、11 个超过七天且未被引用；扫描 1492 个测试会话，其中 1491 个满足原始录音清理条件，共选中 4122 个 `raw/` 对象。演练返回 `deletedObjects: 0`，没有发送删除请求；一次完整扫描耗时约 10 秒。该结果证明现有生产数据结构能够被清理器识别，首次部署前仍应按当时数据重新核对聚合计数。

## 验证

```bash
npm test -- tests/unit/lambda/cleanupStorage.test.js
sam validate --lint --template-file infra/template-production.yaml
sam validate --lint --template-file infra/template.yaml
```

模板使用 `nodejs24.x`，本地 SAM CLI 必须至少为 `1.147.1`。更旧版本附带的 CloudFormation 规则库会把仓库中所有 Node.js 24 函数误报为无效运行时。

单元测试覆盖 DynamoDB 分页、引用解析、宽限期、三类会话保留期、仅删除原始录音、演练模式和 S3 部分删除失败。
