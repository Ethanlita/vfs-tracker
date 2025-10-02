# **错误处理规范 (Error Handling Guidelines)**

## 核心原则 (Core Principle)

**所有在UI层（React组件）中发起的、可能会失败的操作（特别是API调用），都必须被包裹在 `try...catch` 块中。**

捕获到的错误必须被设置到一个组件的状态（state）中，并交由 `<ApiErrorNotice />` 组件进行统一渲染。严禁使用 `alert()` 或 `console.error()` 作为用户错误反馈的唯一途径。

This is the golden rule for error handling in this repository. All potentially failing operations (especially API calls) initiated from the UI layer (React components) **MUST** be wrapped in a `try...catch` block. The caught error must be set into a component's state and rendered using the `<ApiErrorNotice />` component. Using `alert()` or `console.error()` as the sole means of user feedback for errors is strictly forbidden.

---

## 示例：如何正确处理错误 (Example: How to Handle Errors Correctly)

下面是一个在React组件中调用API并处理其成功或失败状态的典型示例。

```jsx
import React, { useState } from 'react';
import { someApiCall } from '../api';
import { ApiErrorNotice } from '../components/ApiErrorNotice.jsx';
import { ensureAppError } from '../utils/apiError.js';

function MyComponent() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    setError(null); // 在每次新操作前清除旧错误

    try {
      const result = await someApiCall({ id: '123' });
      console.log('API call successful:', result);
      // 处理成功逻辑...
    } catch (err) {
      // 捕获从API层抛出的、已被包装好的错误
      console.error('API call failed:', err);
      setError(ensureAppError(err, { message: '操作失败，请重试。' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 在UI中渲染错误通知 */}
      {error && (
        <div className="my-4">
          <ApiErrorNotice error={error} onRetry={handleAction} />
        </div>
      )}

      <button onClick={handleAction} disabled={loading}>
        {loading ? '处理中...' : '执行操作'}
      </button>
    </div>
  );
}
```

---

## 错误类API参考 (Error Class API Reference)

所有自定义错误都继承自一个通用的 `AppError` 基类。请在 `src/utils/apiError.js` 中查看源码。

### 继承关系 (Inheritance Tree)

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

### `AppError` (Base Class)
所有自定义错误的基类。

-   **构造函数**: `new AppError(message, context)`
-   **`context` 对象可接受的属性:**
    -   `message`: (String) 错误的主要描述信息。
    -   `cause`: (Error) 导致此错误的原始错误对象。
    -   `details`: (Object | Array) 任何有助于调试的结构化上下文数据。
    -   `statusCode`: (Number) 相关的HTTP状态码。
    -   `errorCode`: (String) 一个独特的、可编程的错误代码。
    -   `requestMethod`: (String) 相关的HTTP请求方法。
    -   `requestPath`: (String) 相关的请求路径或URL。

### `ApiError`
用于表示所有源自后端API请求失败的通用错误。

-   **继承自**: `AppError`
-   **额外 `context` 属性:**
    -   `requestId`: (String) 从响应头中获取的请求ID (`x-request-id`)。
    -   `responseBody`: (String | Object) 从失败响应中解析出的响应体。

### `UploadError`
专门用于文件上传（如到S3）失败的场景。

-   **继承自**: `ApiError`
-   **额外 `context` 属性:**
    -   `objectKey`: (String) 尝试上传的文件在S3中的对象键。
    -   `uploadUrl`: (String) 用于上传的预签名URL。

### `AuthenticationError`
当用户未登录或身份凭证无效，导致请求无法发送时使用。

-   **继承自**: `AppError`

### `ServiceError`
当API请求成功（HTTP 200），但返回的数据体表示一个业务逻辑失败时使用。

-   **继承自**: `AppError`
-   **额外 `context` 属性:**
    -   `serviceName`: (String) 发生错误的业务服务名称（例如，"Gemini Proxy"）。

### `ClientError` (Base Class)
用于纯前端错误的基类。

-   **继承自**: `AppError`

### `ValidationError`
用于处理表单或数据验证失败。

-   **继承自**: `ClientError`
-   **额外 `context` 属性:**
    -   `fieldErrors`: (Array) 一个对象数组，每个对象描述一个字段的错误，例如 `[{ field: 'email', message: '格式不正确' }]`。

### `PermissionError`
用于处理浏览器API权限被拒绝的场景。

-   **继承自**: `ClientError`
-   **额外 `context` 属性:**
    -   `permissionName`: (String) 被拒绝的权限名称（例如，"microphone"）。

### `StorageError`
用于处理本地存储 (`localStorage`) 操作失败的场景。

-   **继承自**: `ClientError`
-   **额外 `context` 属性:**
    -   `operation`: (String) 失败的操作类型 (`'get'`, `'set'`, `'remove'`)。
    -   `key`: (String) 操作失败时使用的存储键。
    -   `quotaExceeded`: (Boolean) 错误是否由超出存储配额引起。

---

## 工具与辅助函数 (Tools & Helper Functions)

### `ensureAppError(error, context)`
这是最常用的错误处理工具，用于确保任何被 `catch` 的未知错误都能被转换成一个标准的 `AppError` 实例。

-   **用途**: 在 `catch` 块的末端使用，以保证传递给UI层的总是一个标准错误对象。
-   **示例**: `setError(ensureAppError(err, { message: '操作失败，请重试。' }));`

### `<ApiErrorNotice />` (React Component)
这是用于在UI上渲染错误的唯一指定组件。

-   **核心 Props:**
    -   `error`: (AppError) 要显示的错误对象。
    -   `onRetry`: (Function) 一个可选的回调函数。如果提供，组件将显示一个“重试”按钮，点击后会调用此函数。
    -   `compact`: (Boolean) 是否使用紧凑模式进行显示。
-   **功能**:
    -   自动显示错误的 `message` 作为摘要。
    -   如果错误对象包含 `details`, `statusCode` 等详细信息，则会显示一个“显示全部”按钮，供用户展开查看。
    -   能够根据不同的错误类型（如 `ValidationError`）展示特定的格式化信息。