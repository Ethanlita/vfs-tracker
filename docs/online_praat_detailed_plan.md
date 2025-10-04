### 1. 各个API的具体定义

根据 `online_praat_plan.md` 的第 5.1 节
 "API 定义（OpenAPI 风格描述）" 和其他相关描述，定义如下：

*   **`POST /sessions`**
    *   **描述**: 创建一个新的嗓音测试会话。
    *   **请求方法**: `POST`
    *   **请求参数**:
        *   
`userId?`: `string` (可选) - 用户ID，如果用户已登录。
    *   **返回值**:
        *   `sessionId`: `string` - 唯一会话ID。

*   **`POST /uploads`**
    *   **描述**: 请求一个预签名S3 URL
，用于上传音频文件。
    *   **请求方法**: `POST`
    *   **请求参数**:
        *   `sessionId`: `string` - 从 `/sessions` 获取的会话ID。
        *   `step`: `string` - 录音步骤标识，枚举
值包括 `'calibration'`, `'mpt'`, `'glide_up'`, `'glide_down'`, `'note_low'`, `'note_high'`, `'reading'`, `'spontaneous'`。
        *   `fileName`: `string` - 文件名，例如 `step.wav`。
        *   `contentType`: 
`string` - 内容类型，必须是 `'audio/wav'`。
    *   **返回值**:
        *   `putUrl`: `string` - 用于S3 PUT操作的预签名URL。
        *   `objectKey`: `string` - 文件在S3中的对象键。

*   
**`PUT {putUrl}` (直接S3上传)**
    *   **描述**: 使用预签名URL直接将音频文件上传到S3。
    *   **请求方法**: `PUT`
    *   **请求参数**:
        *   `file`: `Blob` - 音
频文件内容。
    *   **请求头**:
        *   `Content-Type`: `audio/wav`
    *   **返回值**: (S3的隐式成功/失败响应)

*   **`POST /analyze`**
    *   **描述**: 触发指定
会话的后端分析。
    *   **请求方法**: `POST`
    *   **请求参数**:
        *   `sessionId`: `string` - 会话ID。
        *   `calibration`: `object` - 校准信息。
            *   `hasExternal`: `boolean` -
 是否进行了外部校准。
            *   `calibOffsetDb?`: `number` (可选) - 如果进行了外部校准，校准偏移量（dB）。
        *   `forms?`: `object` (可选) - 主观问卷结果。
            *   `RBH
?`: `object` - RBH问卷结果，例如 `{ "R": 0-3, "B": 0-3, "H": 0-3 }`。
            *   `VHI9i?`: `number` - VHI-9i总分。
            *   
`TVQ?`: `object` - TVQ问卷结果，例如 `{ "total": number, "percent": number }`。
    *   **返回值**:
        *   `status`: `string` - 状态，固定为 `'queued'`。
        *   `sessionId`: `string` - 会话
ID。

*   **`GET /results/{sessionId}`**
    *   **描述**: 获取指定会话的分析结果。
    *   **请求方法**: `GET`
    *   **请求参数**:
        *   `sessionId`: `string` (路径参数) - 会话
ID。
    *   **返回值**:
        *   `status`: `string` - 分析状态，枚举值包括 `'pending'`, `'processing'`, `'done'`, `'failed'`。
        *   `metrics`: `object` (仅当 `status` 为 `'done'` 时存在) - 计算
出的声学指标。
            *   `sustained`: `object` - 稳定元音指标，包含 `spl_dbA`, `f0_mean`, `f0_sd`, `jitter_local_percent`, `shimmer_local_percent`, `hnr_db`, `mpt_s
`, `formants: {F1, F2, F3}`。
            *   `vrp`: `object` - 音域测定指标，包含 `f0_min`, `f0_max`, `spl_min`, `spl_max`，可选 `glide_jitter_median
`, `glide_jitter_iqr`。
            *   `reading`: `object` - 朗读指标，包含 `duration_s`, `voiced_ratio`, `pause_count`, `f0_stats: {p10, median, p90}`，可选 `spl_db
A_est`。
            *   `spontaneous`: `object` - 自由说话指标，包含 `duration_s`, `voiced_ratio`, `pause_count`，可选 `f0_stats`, `spl_dbA_est`。
            *   `dsi?`: `number
` (可选) - 嗓音障碍指数。
        *   `charts`: `object` - 生成图表的S3 URL，例如 `timeSeries`, `vrp`, `formants`。
        *   `reportPdf`: `string` - 生成PDF报告的S3 URL。

---

### 2
. 各个Lambda函数的具体定义

根据 `online_praat_plan.md` 的第 0 节 "架构与数据流"、第 4 节 "Lambda 如何调用 Praat" 和第 7 节 "后端总体流程"，定义如下：

**通用说明**:
*   所有Lambda
函数将使用 Python 3.13 并在容器镜像中运行。
*   它们将与 S3 (用于音频/图表/报告存储) 和 DynamoDB (用于会话/事件数据) 进行交互。
*   DSP/声学计算将使用 Praat (parselmouth) 以及
 NumPy/SciPy/librosa/pyworld。

1.  **Lambda 函数: `createSession` 处理程序**
    *   **何时调用**: 由 `POST /sessions` API Gateway 端点触发。
    *   **数据流向**:
        *   **输入**: 来自 API
 Gateway 事件的 `userId` (可选)。
        *   **处理**: 生成唯一的 `sessionId`。在 `VoiceTests` DynamoDB 表中写入一个新项，状态为 `'pending'`，主键为 `userOrAnonId`，排序键为 `sessionId`，并记录 `createdAt` 时间
戳。
        *   **输出**: 将 `sessionId` 返回给前端。

2.  **Lambda 函数: `getUploadUrl` 处理程序**
    *   **何时调用**: 由 `POST /uploads` API Gateway 端点触发。
    *   **数据流向**:
        
*   **输入**: 来自 API Gateway 事件的 `sessionId`, `step`, `fileName`, `contentType`。
        *   **处理**: 为指定 `objectKey` (例如 `voice-tests/{userOrAnonId}/{sessionId}/raw/{step}.wav`) 生成一个预签名的 S3 PUT URL。

        *   **输出**: 将 `putUrl` 和 `objectKey` 返回给前端。

3.  **Lambda 函数: `analyze` 处理程序**
    *   **何时调用**: 由 `POST /analyze` API Gateway 端点触发。
    *   **数据流向**:
        
*   **输入**: 来自 API Gateway 事件的 `sessionId`, `calibration` 数据, `forms` 数据。
        *   **处理**: 更新 `VoiceTests` DynamoDB 表中对应 `sessionId` 的项，将其 `status` 设置为 `'processing'`。然后，它会异步调用 (例如通过 SQS 或直接
异步调用) 实际的分析 Lambda 函数，并传递 `sessionId` 和其他相关数据。
        *   **输出**: 返回 `status='queued'` 和 `sessionId` 给前端。

4.  **Lambda 函数: 核心分析 (`analysis` 处理程序)**
    *   **何时调用**: 由
 `analyze` 处理程序异步调用。
    *   **数据流向**:
        *   **输入**: `sessionId`, `calibration` 数据, `forms` 数据。
        *   **处理**:
            1.  从 S3 读取原始 `.wav` 文件 (`voice-tests/{userOr
AnonId}/{sessionId}/raw/*.wav`)。
            2.  使用 `parselmouth` 和其他库执行声学分析：
                *   `analyze_sustained_wav`: 为单个稳定元音录音计算声学指标（F0, Jitter, Shimmer, HNR, SPL）。**MPT（最长发声时）现在基于有效发声时长计算，而非文件总长。**
                *   `analyze_note_file`: 对单个录音（如高/低音）进行**鲁棒的共振峰分析**。该方法通过逐帧预筛选（基于发声、HNR、强度）和时序稳定性检查来提取可靠的 F1, F2, F3。

                *   `analyze_speech_flow`: 计算朗读和自由说话录音的时长、发声比例、停顿次数、F0 统计、SPL。
                *   VRP 计算: 处理滑音录音以构建音域图。
            3.  生成图表 (
时序图、VRP 图、共振峰图) 为 PNG 文件。
            4.  将生成的图表上传到 S3 (`voice-tests/{userOrAnonId}/{sessionId}/artifacts/`)。
            5.  渲染最终的 PDF 报告 (使用 HTML 模板 + Playwright/
Chromium)。
            6.  将 PDF 报告上传到 S3 (`voice-tests/{userOrAnonId}/{sessionId}/report.pdf`)。
            7.  更新 `VoiceTests` DynamoDB 项：
                *   设置 `status='done'` (如果发生错误则为 `'failed'
`)。
                *   存储计算出的 `metrics` (sustained, vrp, reading, spontaneous)。
                *   存储 `charts` 的 S3 URL。
                *   存储 `reportPdf` 的 S3 URL。
                *   在主 VFS Tracker 系统中 (例如 `voiceFemEvents
` 表) 为用户创建一个新事件，类型为“自我测试”，工具为“VFS Tracker Voice Analysis Tools”，并将 PDF 报告作为该事件的附件保存。
        *   **输出**: 更新 DynamoDB；不直接返回给前端。

5.  **Lambda 函数: `getResults` 处理
程序**
    *   **何时调用**: 由 `GET /results/{sessionId}` API Gateway 端点触发。
    *   **数据流向**:
        *   **输入**: 来自 API Gateway 事件的 `sessionId`。
        *   **处理**: 查询 `VoiceTests` DynamoDB 表中对应 `sessionId
` 的项。
        *   **输出**: 将 DynamoDB 项中的 `status`, `metrics`, `charts` S3 URL 和 `reportPdf` S3 URL 返回给前端。

---

### 3. 前端组件的具体定义

根据 `online_praat_plan.md` 的第
 0 节 "架构与数据流"、第 1 节 "嗓音测试向导"、第 5.2 节 "React/TypeScript 封装与调用" 以及附录 A-F (问卷部分)，定义如下：

**主要入口点**:
*   **位置**: 在 
`Mypage` 页面中，在“管理资料”按钮旁边增加一个“启动嗓音测试”按钮。
*   **操作**: 点击该按钮将路由到嗓音测试向导页面。

1.  **组件: `<VoiceTestWizard/>`**
    *   **功能
**: 多步向导 (共8步)，引导用户完成嗓音测试流程。管理测试状态，包括当前步骤、已录制音频和表单数据。
    *   **数据流向**:
        *   初始化新会话 (`createSession`)。
        *   管理每个步骤的录音。

        *   将录制的音频文件上传到 S3 (`getUploadUrl`, `putToS3`)。
        *   收集主观问卷数据 (RBH, OVHS-9, TVQ-G)。
        *   触发后端分析 (`requestAnalyze`)。
        *   轮
询分析结果 (`getResults`)。
        *   显示实时反馈 (电平表、F0 提示)。
        *   完成时显示图表和报告 PDF 链接。
    *   **接口定义**:
        *   Props: 可能需要 `userId` (从 AuthContext 获取)。
        *
   内部状态: `currentStep` (当前步骤), `sessionId` (会话ID), `recordedBlobs` (步骤到 Blob 的映射), `formData` (问卷数据), `analysisStatus` (分析状态), `results` (分析结果)。
    *   **调用关系**:
        
*   调用 `api.createSession()`。
        *   调用 `api.getUploadUrl()`。
        *   调用 `api.putToS3()`。
        *   调用 `api.requestAnalyze()`。
        *   调用 `api.getResults()` (轮询)。
        
*   渲染 `<Recorder/>`, `<LiveMeters/>`, `<Charts/>`, `<ReportViewer/>` 以及问卷组件。

2.  **组件: `<Recorder/>`**
    *   **功能**: 处理 Web Audio API 进行录音 (48 kHz, 单声道, PCM/WAV)。提供
录音/停止按钮。
    *   **数据流向**: 从麦克风捕获音频，输出 `Blob` 数据。
    *   **接口定义**:
        *   Props: `onRecordingComplete(blob: Blob)` (录音完成回调), `isRecording: boolean` (是否正在录音
), `onStartRecording: () => void` (开始录音回调), `onStopRecording: () => void` (停止录音回调)。
        *   内部状态: `mediaRecorder` 实例, `audioChunks`。

3.  **组件: `<LiveMeters/>`**
    *   
**功能**: 显示实时音频反馈 (电平表、F0 提示)。提供过载、环境噪音的视觉提示。
    *   **数据流向**: 从 `<Recorder/>` 或直接从 Web Audio API 接收音频流。
    *   **接口定义**:
        *   Props:
 `audioStream: MediaStream` (音频流), `onFeedback: (feedback: { level: number, f0: number, overload: boolean, noise: boolean }) => void` (反馈回调)。

4.  **组件: `<Charts/>`**
    *   **功能**: 显示从 S3
 获取的生成图表 (时序图、VRP 图、共振峰图)。
    *   **数据流向**: 从 `<VoiceTestWizard/>` 的结果中接收图表的 S3 URL。
    *   **接口定义**:
        *   Props: `chartUrls: { time
Series?: string, vrp?: string, formants?: string }` (图表URL对象)。

5.  **组件: `<ReportViewer/>`**
    *   **功能**: 显示生成的 PDF 报告。
    *   **数据流向**: 从 `<VoiceTestWizard/>` 的结果中接收 PDF
 报告的 S3 URL。
    *   **接口定义**:
        *   Props: `reportPdfUrl: string` (PDF报告URL)。

6.  **组件: `<SurveyRBH/>`**
    *   **功能**: 收集 RBH 问卷分数 (R, B
, H, 0-3 分制)。
    *   **数据流向**: 用户输入，输出 `{ R: number, B: number, H: number }`。
    *   **接口定义**:
        *   Props: `initialValues?: { R: number, B: number, H: number }
` (初始值), `onChange: (values: { R: number, B: number, H: number }) => void` (值改变回调)。

7.  **组件: `<SurveyOVHS9/>` (或 `<SurveyVHI9i/>` 如果有授权)**
    *   
**功能**: 收集 OVHS-9 问卷分数 (9 项, 0-4 分制)。
    *   **数据流向**: 用户输入，输出 `number[]` (分数数组) 或总分。
    *   **接口定义**:
        *   Props: `initialValues?:
 number[]` (初始值), `onChange: (values: number[]) => void` (值改变回调)。

8.  **组件: `<SurveyTVQG/>` (或 `<SurveyTVQ/>` 如果有授权)**
    *   **功能**: 收集 TVQ-G 问卷分数
 (12 项, 0-4 分制)。
    *   **数据流向**: 用户输入，输出 `number[]` (分数数组) 或总分。
    *   **接口定义**:
        *   Props: `initialValues?: number[]` (初始值), `onChange: (
values: number[]) => void` (值改变回调)。

---

### 4. DynamoDB表的具体定义

根据 `online_praat_plan.md` 的第 0 节 "架构与数据流" 和第 6 节 "DynamoDB 表结构（示例）"，定义如下：


**表名**: `VoiceTests`

**主键**:
*   `PK`: `userOrAnonId` (分区键) - 可以是登录用户的 `userId`，或匿名用户的ID。
*   `SK`: `sessionId` (排序键) - 每个嗓音测试会话的
唯一ID。

**属性**:

*   `status`: `string` - 分析的当前状态，枚举值包括 `'pending'`, `'processing'`, `'done'`, `'failed'`。
*   `createdAt`: `string` (ISO 格式) - 会话创建的时间戳。
*   `calibration`: `object` -
 校准详情。
    *   `hasExternal`: `boolean` - 是否进行了外部校准。
    *   `offsetDb?`: `number` (可选) - 外部校准偏移量。
    *   `noiseFloorDbA?`: `number` (可选) - 估计的环境噪音底
线。
*   `tests`: `array` of `object` - 每个录制音频段的详情。
    *   `step`: `string` - 录音步骤 (例如 `'mpt'`, `'reading'`)。
    *   `s3Key`: `string` - 
原始音频文件在 S3 中的键。
    *   `durationMs`: `number` - 录音时长 (毫秒)。
*   `metrics`: `object` (仅当 `status` 为 `'done'` 时存在) - 计算出的声学指标。
    *   `sustained`: `object
`
        *   `spl_dbA`: `number`
        *   `f0_mean`: `number`
        *   `f0_sd`: `number`
        *   `jitter_local_percent`: `number`
        *   `shimmer_local_percent`: `number
`
        *   `hnr_db`: `number`
        *   `mpt_s`: `number`
        *   `formants`: `object` (`F1`, `F2`, `F3` 均为数字)。
    *   `vrp`: `object
`
        *   `f0_min`: `number`
        *   `f0_max`: `number`
        *   `spl_min`: `number`
        *   `spl_max`: `number`
        *   `glide_jitter_median?`: `number` (
可选) - 滑音 Jitter 中位数。
        *   `glide_jitter_iqr?`: `number` (可选) - 滑音 Jitter 四分位距。
    *   `reading`: `object`
        *   `duration_s`: `number`
        *   
`voiced_ratio`: `number`
        *   `pause_count`: `number`
        *   `f0_stats`: `object` (`p10`, `median`, `p90` 均为数字)。
        *   `spl_dbA_est?`: `number
` (可选)。
    *   `spontaneous`: `object`
        *   `duration_s`: `number`
        *   `voiced_ratio`: `number`
        *   `pause_count`: `number`
        *   `f0_stats?`: `object` (可选) - 
自由说话的 F0 统计。
        *   `spl_dbA_est?`: `number` (可选)。
    *   `dsi?`: `number` (可选) - 嗓音障碍指数。
*   `forms`: `object` - 主观问卷结果。
    *   
`RBH`: `object` (`{ "R": number, "B": number, "H": number }`)。
    *   `VHI9i`: `number` (总分)。
    *   `TVQ`: `object` (`{ "total": number, "percent": number }`)。

*   `artifacts`: `object` - 生成文件的 S3 URL。
    *   `timeSeries`: `string` - 时序图 PNG 的 S3 URL。
    *   `vrp`: `string` - VRP 图 PNG 的 S3 URL。
    *   `formants`: `string
` - 共振峰图 PNG 的 S3 URL。
    *   `reportPdf`: `string` - 最终 PDF 报告的 S3 URL。

**全局二级索引 (GSI)**:
*   `GSI1`: `sessionId` (分区键) -> `createdAt` (排序键) -
 用于直接通过 `sessionId` 或创建时间查询会话。

---

### 5. 测试结果的具体数据结构

测试结果的数据结构主要体现在 `GET /results/{sessionId}` API 的返回值中，特别是 `metrics` 和 `forms` 对象。

**`metrics` 对象结构**:


```json
{
  "sustained": {
    "spl_dbA": 76.8,
    "f0_mean": 290,
    "f0_sd": 15.2,
    "jitter_local_percent": 1.04,
    "shimmer_local_percent": 4.52,
    "hnr_db": 20.0,
    "mpt_s": 11.8,
    "formants": {
      "F1": 550,
      "F2": 1500,
      "F3": 2500
    }
  },
  "vrp": {
    "f0_min": 90,
    "f0_max": 596,
    "spl_min": 57,
    "spl_max": 91,
    "glide_jitter_median": 0.8,
    "glide_jitter_iqr": 0.3
  },
  "reading": {
    "duration_s": 25.2,
    "voiced_ratio": 0.78,
    "pause_count": 18,
    "f0_stats": {
      "p10": 180,
      "median": 220,
      "p90": 320
    },
    "spl_dbA_est": 70.5
  },
  "spontaneous": {
    "duration_s": 42.5,
    "voiced_ratio": 0.71,
    "pause_count": 26,
    "f0_stats": {
      "p10": 170,
      "median": 210,
      "p90": 300
    },
    "spl_dbA_est": 68.2
  },
  "dsi": 8.5
}
```


**
`forms` 对象结构**:


```json
{
  "RBH": {
    "R": 1,
    "B": 0,
    "H": 1
  },
  "VHI9i": 18,
  "TVQ": {
    "total": 30,
    "percent": 42
  }
}
```


**`charts` 对象结构**:


```json
{
  "timeSeries": "s3://bucket-name/voice-tests/user-id/session-id/artifacts/timeSeries.png",
  "vrp": "s3://bucket-name/voice-tests/user-id/session-id/artifacts/vrp.png",
  "formants": "s3://bucket-name/voice-tests/user-id/session-id/artifacts/formants.png"
}
```


**`reportPdf` 结构**:


```json
"s3://bucket-name/voice-tests/user-id/session-id/report.pdf"
```


---

### 6. 测试结果PDF的内容

根据 `online_praat_plan.md
` 的第 9 节 "报告版式（要点）" 和第 2 节 "报告指标清单"，定义如下：

**通用布局**:
*   **页眉**: 应用名称/机构、被试信息、日期。
*   **页脚**: 校准方式、免责声明
、版本号。
*   **合规与提示**: 报告页脚注明“量表结果仅作健康教育与自我管理参考，不能替代临床诊断”。

**报告内容分区**:

1.  **嗓音分析 (Voice Analysis)**
    *   **指标表格**:
        *   声
压级 SPL (均值 / SD，A 加权；标注“估算/已校准”)
        *   基频 F0 (均值 / SD)
        *   Jitter (local %)
        *   Shimmer (local %)
        *   谐噪比 HNR (dB)

        *   最长发声时 MPT (s)
        *   F1 / F2 / F3 (Hz)
    *   **图表**: 四联时序图 (SPL, F0, Jitter%, Shimmer%)。

2.  **音域测定 (V
ocal Range Profile - VRP)**
    *   **指标表格**:
        *   最长发声时 (来自 Step 2)
        *   最高基频 F0\_max、最低基频 F0\_min (Hz 与音名)
        *   最大声压级 SPL
\_max、最小声压级 SPL\_min (dB(A))
        *   滑音 Jitter (中位数/IQR)
    *   **图表**: 半音分箱的最小/最大/平均 SPL 折线图 + 阴影。

3.  **朗读与自由说话 (Reading
 and Spontaneous Speech)**
    *   **统计表格**:
        *   语速 (字/秒或音节/秒)
        *   发声占比 (Voiced Ratio)
        *   停顿次数 / 平均停顿时长
        *   F0 与 SPL 的分布统计 (P
10/Median/P90，可选箱线图)。
    *   **可选**: 语流热图 (时间×频率的 F0/能量叠图)。

4.  **量表 (Questionnaires)**
    *   **RBH**: 显示 `RBH: R=x,
 B=y, H=z`，并可选雷达图/色条可视化。包含对三维度的文字解释和 0-3 分的语义。
    *   **OVHS-9 (或 VHI-9i)**: 显示总分和 (可选) 分级 (例如“轻度
/无明显”)。包含文字解释：0-36 分，分数越高表明自觉受影响越大；提醒“阈值随人群而异”。
    *   **TVQ-G (或 TVQ)**: 显示总分和标准化百分比。包含文字解释：阈值来源于机构配置。
    
*   **可选**: 列出用户对每个问卷问题的具体回答。

5.  **高/低唱音 (High/Low Sustained Notes)**
    *   **图表**: 稳态频谱图 + LPC 包络，叠加 F1/F2/F3 的竖线与数值标注。该图表现在同时展示**最低音、最高音和持续元音**的频谱，便于对比。
    *   **表格**: F1-F3 表格。

6.  **额外 (Additional)**
    *   DSI (嗓音障碍指数) 分数，如果已计算。

---