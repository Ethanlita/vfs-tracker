# Error Handling Guide / 错误处理指南

## 事件表单提交错误

EventForm同时展示本地校验错误与useAsync捕获的API错误。错误框重试通过form.requestSubmit进入同一提交路径，保持浏览器必填校验、业务校验、防重入及成功回调一致；不直接调用底层execute绕过表单。详见[事件提交说明](event-form-submission.md)。

## 文档离线缓存缺失

公开目录和正文统一通过 `readDocumentation` 读取。离线读取失败转换为 `DOCUMENT_NOT_AVAILABLE_OFFLINE` 的 `ClientError`，保留原始原因、GET方法和路径，中文提示用户联网重试。在线HTTP错误仍保留实际状态。详见[离线文档说明](offline-documentation.md)。

## 嗓音报告读取恢复

`useVoiceAnalysis`区分读取错误和服务端任务失败。读取失败的重试只调用GET查询现有会话；重新计算走显式确认。401/403不自动重试，网络/408/429/5xx有限退避，10分钟后停止本轮等待。取消信号和超时同时终止底层Amplify GET操作，旧响应不能发布到新会话。详见[报告查询说明](voice-analysis-polling.md)。

## 录音转换错误

Recorder在读取、解码或重采样失败时显示`ClientError`（`AUDIO_CONVERSION_FAILED`），保留原因但不伪造HTTP上下文。失败的原录音仅保存在当前组件内存，用户可“重试转换”或“放弃此段录音”。转换成功前不触发上层录音完成回调，因此不能计入向导进度或请求上传。刷新、离开页面仍会丢失该内存片段，持久化恢复属于独立事项。见[录音生命周期](recorder-lifecycle.md)。

## 离线事件归属校验

带 `clientRequestId` 的事件创建具备服务端条件写入去重：标识非法为400/`INVALID_CLIENT_REQUEST_ID`，同标识对应不同内容为409/`IDEMPOTENCY_CONFLICT`，响应契约见 `eventIdempotencyErrorSchema`。条件失败未返回旧记录或其他服务错误仍为500，不能当作已经保存成功。

`addEvent(eventData, { expectedUserId })` 会核对实际取得并准备发送的 ID Token 所属账号。账号不匹配或无法确认时，在发起 POST 前抛出 `AuthenticationError`；离线同步界面显示错误并保留记录。队列读取和写入问题继续使用 `StorageError`。该检查不替代后端认证，事件请求体不增加账号字段。验证见 `tests/unit/api-event-owner.test.js` 与 [离线队列说明](offline-events.md)。

This document summarizes the shared error classes in `src/utils/apiError.js` and how to work with them in both production and development flows. 本指南汇总 `src/utils/apiError.js` 中的通用错误类，并说明在生产模式与开发模式下应如何使用这些工具。

## addVoiceEvent 请求体错误（Issue #38）

`POST /events` 的请求体缺失、不是合法 JSON、或顶层为 `null`、数组、原始值时，返回 HTTP 400 和 `{ message, errorCode: 'INVALID_REQUEST_BODY' }`，保留 CORS 响应头，不写入 DynamoDB。错误响应契约定义在 `invalidEventBodyResponseSchema`。合法对象的必填字段校验保持原行为，数据库故障继续返回 500。

运行 `npm test -- tests/unit/lambda/addVoiceEvent.test.js` 验证非法输入、合法写入、服务故障和 OPTIONS。这是 Lambda 的输入边界修复，不改变前端开发模式逻辑或认证方式；未涉及 UI，无新增视觉状态。此修改只处理 #38 的请求体分类子问题，其他错误分类仍需独立推进。

## Goals / 目标

- Provide a consistent inheritance tree so that caught errors can be narrowed down quickly. 通过统一的继承树，使捕获到的错误能够快速分类。
- Preserve request metadata and root causes for diagnostics. 保留请求相关的元数据与根因，便于排查问题。
- Offer bilingual defaults and messages to support our Chinese/English audience. 提供中英双语默认提示，以支持中英文使用者。

## Class Hierarchy / 类继承结构

```
Error
└─ AppError
   ├─ ApiError
   │  └─ UploadError
   ├─ AuthenticationError
   ├─ ClientError
   │  ├─ ValidationError
   │  ├─ PermissionError
   │  └─ StorageError
   └─ ServiceError
```

`ClientError` 与 `ServiceError` 都直接继承自 `AppError`，以便区分“客户端问题”与“服务端/第三方问题”。`UploadError` 则是 `ApiError` 的专用变体，用于文件传输失败。This structure keeps client vs service faults separate while letting API-specific failures share network parsing helpers.

## Base Class: AppError / 基础类：AppError

### Constructor & Context / 构造函数与上下文

```js
new AppError(message?: string, context?: AppErrorContext)
```

| Field / 字段 | Description / 说明 |
| --- | --- |
| `statusCode` | HTTP status code when available. 可用时记录 HTTP 状态码。 |
| `requestMethod` | Request method (`GET`, `POST`, ...). 保存 HTTP 动词。 |
| `requestPath` | Request path or URL. 请求路径或完整 URL。 |
| `requestId` | Correlation ID (`x-request-id`, etc.). 关联 ID（如 `x-request-id`）。 |
| `responseBody` | Captured response payload. 捕获到的响应体。 |
| `errorCode` | Domain-specific identifier. 领域内的错误编号。 |
| `details` | Rich structured details (object/array). 结构化详情，可为对象或数组。 |
| `meta` | Extra metadata merged via `mergeMeta`. 通过 `mergeMeta` 合并的扩展信息。 |
| `cause` | Underlying cause (if provided). 可能的底层 `cause`。 |
| `originalError` | The raw `Error` instance when available. 原始错误实例。 |

### Helpful Methods / 关键方法

- `applyContext(context)` – Mutates the instance with extra metadata while preserving existing information. 在保留原有信息的同时，补充新的上下文。
- `static from(input, context)` – Coerces arbitrary values (plain objects, strings, other errors) into a rich `AppError`. 将任意输入（普通对象、字符串、其他错误）转换为结构化的 `AppError`。

**Usage / 用法示例**

```js
try {
  riskyCall();
} catch (error) {
  throw AppError.from(error, { requestPath: '/voice', meta: { feature: 'recorder' } });
}
```

## API-Oriented Errors / 面向 API 的错误

### ApiError

- Inherits from `AppError` and defaults the message to `请求失败，请稍后重试` / “Request failed, please retry.”
- Adds two factory helpers:
  - `ApiError.from(input, context)` enriches any value with HTTP-specific metadata (request IDs, headers, etc.). 用于把原始错误补充为 API 级别的错误，并尽可能提取请求 ID、响应头等元信息。
  - `ApiError.fromResponse(response, context)` consumes a Fetch `Response`, parsing JSON/text bodies automatically. 解析 Fetch `Response`，自动提取 JSON 或文本响应并生成错误。

**Example / 示例**

```js
const response = await fetch(url);
if (!response.ok) {
  throw await ApiError.fromResponse(response, { requestMethod: 'POST', requestPath: url });
}
```

### UploadError

专门用于上传失败，保持 `ApiError` 的全部行为，并额外记录：
- `objectKey` – S3 object key or file identifier. S3 对象键或文件标识。
- `uploadUrl` – Presigned URL or endpoint. 预签名 URL 或上传端点。

## Client-Facing Errors / 面向客户端的错误

### AuthenticationError

- Message: `未登录：请求未发送，请先完成登录后重试。`
- Default `errorCode` is `AUTH_MISSING_ID_TOKEN` and `statusCode` remains undefined to indicate “request not sent.” 默认 `errorCode` 为 `AUTH_MISSING_ID_TOKEN`，并保持 `statusCode` 为 `undefined` 以标记“请求未发送”。

### ClientError and Derivatives

`ClientError` acts as the umbrella for validation, permission, and storage problems raised on the frontend. `ClientError` 是前端校验、权限或存储问题的总类。

| Class / 类 | Extra Fields / 附加字段 | Notes / 说明 |
| --- | --- | --- |
| `ValidationError` | `fieldErrors` – Array of `{ field, message }`. `fieldErrors` 数组用于记录字段错误。 |
| `PermissionError` | `permissionName` – e.g., `microphone`. `permissionName` 表示缺失的权限。 |
| `StorageError` | `operation`, `key`, `quotaExceeded`. 记录本地存储操作、键名以及配额是否超限。 |

## ServiceError / 服务端错误

Represents downstream or third-party failures. 用于标记下游或第三方服务失败。

- Optional `serviceName` identifies which dependency failed. 可选的 `serviceName` 指出失败的外部依赖。
- `applyContext` ensures later calls can inject or override `serviceName` while retaining previous metadata. `applyContext` 允许后续补充或覆盖 `serviceName`，同时保留已有元数据。

## Helper Utilities / 工具方法

| Function / 函数 | Purpose / 作用 |
| --- | --- |
| `ensureAppError(error, context)` | Returns an `AppError` (reusing an existing instance) with merged context. 返回复用并补充上下文的 `AppError`。 |
| `ensureApiError(error, context)` | Guarantees an `ApiError`, upgrading plain inputs or `AppError` instances. 确保拿到 `ApiError`，同时兼容普通输入或 `AppError`。 |
| `normalizeFetchError(response, context)` | Normalizes Fetch failures by combining `Response` metadata and overrides. 结合 `Response` 元数据与上下文，生成规范化的 API 错误。 |

**Example Flow / 处理流程示例**

```js
async function loadProfile(signal) {
  try {
    const response = await fetch('/profile', { signal });
    if (!response.ok) {
      throw await ApiError.fromResponse(response, { requestPath: '/profile' });
    }
    return await response.json();
  } catch (error) {
    const apiError = ensureApiError(error, { requestMethod: 'GET' });
    if (apiError instanceof AuthenticationError) {
      promptLogin();
      return;
    }
    reportError(apiError);
    throw apiError;
  }
}
```

## Extending the System / 如何扩展

- Derive new classes from the closest existing parent (`ClientError`, `ServiceError`, etc.) to inherit context handling. 从最贴近的父类（如 `ClientError` 或 `ServiceError`）继承，以获得上下文合并能力。
- Provide bilingual default messages and document any extra fields in this guide. 为默认消息提供中英双语表达，并在本指南中记录新增字段。
- Add targeted unit tests in `tests/unit/utils/apiError.test.js` to capture new behaviors. 为新增行为在 `tests/unit/utils/apiError.test.js` 中编写单元测试。

## Development vs Production / 开发模式与生产模式

In development mode the client may short-circuit requests (for example when credentials are missing). 即便在开发模式下，客户端可能会因为缺失凭证而提前终止请求。Wrap such guards with `AuthenticationError` or other `ClientError` variants so the behavior is explicit and debuggable. 建议使用 `AuthenticationError` 或其他 `ClientError` 变体来显式标记这些行为，方便调试与定位。

## Further Reading / 延伸阅读

- Tests verifying the scenarios above live in `tests/unit/utils/apiError.test.js`. 对应的验证案例位于 `tests/unit/utils/apiError.test.js`。
- Development readiness criteria are tracked in `README.md` and summarized in `AGENTS.md`. 开发模式与生产模式的判定标准记录在 `README.md`，并在 `AGENTS.md` 中有摘要。

## 公开资料读取错误

公共仪表板的资料读取具有独立加载与错误状态。ApiErrorNotice直接展示原错误，重试仅读取当前用户资料，不以空对象掩盖失败，也不刷新事件明细。详见[公开资料加载说明](public-profile-loading.md)。

## 个人历史读取状态

MyPage历史加载、错误和成功互斥。错误不转换为空记录，重试清除旧值，成功空结果才触发新记录引导；详见[个人历史状态](personal-history-status.md)。
