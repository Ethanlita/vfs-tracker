# 嗓音测试功能技术方案（React + Vite + GitHub Pages / AWS API Gateway + Lambda + DynamoDB）

> 目标：新增“嗓音测试向导 + 报告生成 + 数据入库”能力，报告内容对齐你提供的样例，涵盖 **嗓音分析** 与 **音域测定**，并额外支持“朗读指定语句”和“自由说话”的分析。本文给出步骤拆解、后端部署、Lambda 调用 Praat（含代码）、前端 API 调用（含代码）。

---

## 0. 架构与数据流

* **前端**（React + Vite，部署在 GitHub Pages）：

    * 组件：`<VoiceTestWizard/>`（多步向导）、`<Recorder/>`（Web Audio 采集）、`<LiveMeters/>`（实时电平/F0 提示）、`<Charts/>`、`<ReportViewer/>`。
    * 入口：在Mypage已有的“管理资料”按钮右边增加一个“启动嗓音测试”按钮，路由到嗓音测试向导。
    * 录音：Web Audio API + MediaRecorder（目标：48 kHz，单声道，PCM/WAV）。
    * 上传：使用系统内已有的上传逻辑。
    * 触发分析：`POST /analyze`，Lambda函数异步执行，执行完毕后在voiceFemEvents表中为用户新建事件，类型为自我测试，工具为“VFS Tracker Voice Analysis Tools”，.pdf报告作为该事件的附件保存。测试结果信息存入DynamoDB表，并且标明用户id，以便后期新功能开发时可查询。

* **后端**（AWS）：

    * API Gateway（HTTP API）→ Lambda（Python 3.11，容器镜像）→ S3（音频/图表/报告）→ DynamoDB（存储用户事件信息）。
    * DSP/声学计算：**Praat(parselmouth)** + **NumPy/SciPy/librosa/pyworld**。

* **S3 目录结构**（示例）：

    * `voice-tests/{userOrAnonId}/{sessionId}/raw/*.wav`
    * `.../artifacts/{timeSeries.png, vrp.png, formants.png}`
    * `.../report.pdf`

* **DynamoDB 表**：`VoiceTests(PK=userOrAnonId, SK=sessionId)`；见 §6。

---

## 1. 嗓音测试向导（8 步）

> 每步会生成一段或多段音频文件，以 `step` 标识上传。所有正式指标以**后端**计算为准；前端只给实时反馈。

### Step 0｜说明与同意（可选）

* 展示声明：非医疗诊断、数据用途、隐私条款。
* 指定填写量表（RBH/VHI-9i/TVQ）还是跳过。

### Step 1｜设备与环境校准（Calibration）

* **目标**：估计 A 加权 SPL 校准常数、底噪、是否触发系统 AGC。
* **录音**：

    1. **静音 5s**（`calib_silence.wav`）
    2. **标准句 10s** （`calib_ref.wav`）标准句为“他去无锡市，我到黑龙江”，2遍
    3. **可选外部校准**：前端播放 1 kHz -12 dBFS，用户用手机分贝计读值并输入。记录 `calibOffset`。提示用户：如果校准了就能获得更准确的数据，不校准的话结果就只是相对值，不保证绝对数值准确性。
* **前端反馈**：电平表、是否过载、环境噪声是否过高。

### Step 2｜最长发声时 MPT + 稳定元音（Sustained Vowel）

* **目标**：计算 MPT、F0、Jitter、Shimmer、HNR、F1–F3、SPL。
* **录音**：/a/ 持续发声（3–10 s，**重复 2 次**，取最佳）。`mpt_a_1.wav`、`mpt_a_2.wav`。

### Step 3｜音域测定：滑音（Glissando）

* **目标**：构建 **VRP（音域图）**；得到最高/最低基频、最大/最小 SPL；统计滑音 Jitter。
* **录音**：

    * 上滑音 2 次：`glide_up_1.wav`, `glide_up_2.wav`
    * 下滑音 2 次：`glide_down_1.wav`, `glide_down_2.wav`

### Step 4｜定点音 + 共振峰（Formants）

* **目标**：在最低/最高可控音的稳态处，提取频谱与 **F1/F2/F3**，绘制“高/低唱音与频率-声压级关系图”。
* **录音**：`note_low_a.wav`、`note_high_a.wav`（各 3–4 s 稳态，重复可选）。

### Step 5｜朗读指定语句（Reading Passage）

* **目标**：评估自然朗读时的 **语速、停顿率、F0 分布、SPL 分布、节律** 及基础质量指标（Jitter/Shimmer 粗估）。
* **录音**：用户按屏幕文字朗读约 15–30 s（`reading.wav`）。指定文字：许多人将跨性别女生与程序员联系，源于计算机科学之父图灵。他因性取向被判刑，选择雌激素注射以替代监禁，因此身体受损还长出乳房。若施刑者是跨性别女性，这种惩罚便成了奖赏。这样的反转仿佛图灵无声守护后辈，让性别认同获得庇护。每次解锁电脑与手机时，我们都应铭记他，不仅因科学贡献，也因他给予后人的保护与爱。
* **输出**：

    * 语速（字/秒或音节/秒）、发声占比（Voiced Ratio）、平均停顿时长/次数；
    * F0 统计（P10/Median/P90）、SPL 统计；
    * 连读/节律可视化（强度与基频热图）。

### Step 6｜自由说话（Spontaneous Speech）

* **目标**：与朗读对比，反映自发语音的 **韵律与稳定性**。
* **录音**：给一个开放话题，30–60 s（`spontaneous.wav`）。开放话题是：介绍一下你最喜欢的食物
* **输出**：同 Step 5 的统计对比 + 句间停顿分布。

### Step 7｜主观量表（可选）

* **RBH**（0–3）自评或他评；**VHI-9i**、**TVQ** 表单。

### Step 8｜结果确认与报告生成

* 预览图表与关键数值 → 点击“生成报告”。
* 后端合成 PDF（含：时序图、VRP 图、共振峰图、朗读/自发语音统计表），入库，为用户创建嗓音事件。

---

## 2. 报告指标清单（与样例对齐）

### 嗓音分析（基于稳定元音）

* 声压级 SPL（均值 / SD，A 加权；标注“估算/已校准”）
* 基频 F0（均值 / SD）
* Jitter（local %）
* Shimmer（local %）
* 谐噪比 HNR（dB）
* 最长发声时 MPT（s）
* F1 / F2 / F3（Hz）
* **时序图**：SPL、F0、Jitter%、Shimmer%（与样例第二张风格一致）

### 音域测定（VRP）

* 最长发声时（来自 Step 2）
* 最高基频 F0\_max、最低基频 F0\_min（Hz 与音名）
* 最大声压级 SPL\_max、最小声压级 SPL\_min（dB(A)）
* 滑音 Jitter（中位数/IQR）
* **图**：半音分箱的最小/最大/平均 SPL 折线 + 阴影

### 朗读与自由说话

* 语速（字/秒或音节/秒）、发声占比、停顿次数/平均时长
* F0 与 SPL 的分布统计与箱线图（可选）
* 语流热图（时间×频率的 F0/能量叠图，选做）

### 额外：DSI（嗓音障碍指数，选配）

```
DSI = 0.13*MPT + 0.0053*F0_high - 0.26*I_low - 1.18*Jitter(%) + 12.4
```

---

## 3. 后端部署：Praat 等工具类如何上云

### 方案 A：Lambda **容器镜像**（推荐）

* 基础镜像：`public.ecr.aws/lambda/python:3.11`。
* 安装依赖：`numpy scipy librosa webrtcvad soundfile matplotlib`、`praat-parselmouth`（多平台 wheel 内置 Praat C 代码）。
* 可选：安装 `praat` CLI（headless）以运行 `.praat`/`.psc` 脚本；或完全使用 parselmouth API。

**Dockerfile（节选）**

```dockerfile
FROM public.ecr.aws/lambda/python:3.11

# 系统依赖（soundfile/librosa 需要）
RUN dnf install -y libsndfile && dnf clean all

# Python 依赖
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 代码
COPY app/ ${LAMBDA_TASK_ROOT}/

CMD ["app.handler"]
```

**requirements.txt**

```
boto3
numpy
scipy
librosa
soundfile
webrtcvad
matplotlib
praat-parselmouth
```

### 方案 B：Lambda **Layer**（可行但不如容器稳）

* 将 `praat-parselmouth`、科学计算库打包为 Layer；函数仅引用。
* 注意 manylinux 兼容与 `libsndfile` 的系统依赖（通常需另做 Layer）。

---

## 4. Lambda 如何调用 Praat 等工具（含示例代码）

> 以下示例基于 **parselmouth**（优先推荐），并演示如何从 S3 读文件、计算核心指标、写回 DynamoDB。

```python
# app/analysis.py
import io, json, math, os
import boto3
import numpy as np
import parselmouth as psm
from parselmouth.praat import call
import soundfile as sf

s3 = boto3.client('s3')
ddb = boto3.resource('dynamodb').Table(os.environ['DDB_TABLE'])
BUCKET = os.environ['BUCKET']

# --- 基础工具 ---
def read_wav_from_s3(key: str):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    data, sr = sf.read(io.BytesIO(obj['Body'].read()))
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    return data.astype(np.float64), sr

def a_weighting_db(samples, sr):
    # 简化：用等效功率近似（正式版请用双二阶 IIR）
    rms = np.sqrt(np.mean(samples**2) + 1e-12)
    dbfs = 20 * np.log10(rms + 1e-12)
    # 占位：与校准常数合成（前端传 calibOffset），此处只返回相对值
    return dbfs + 94.0  # 以 94dB 参考占位，报告中标注“估算”

# --- 指标计算（稳定元音） ---
def analyze_sustained_wav(key: str):
    samples, sr = read_wav_from_s3(key)
    snd = psm.Sound(samples, sampling_frequency=sr)

    # Pitch
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=800)
    f0_values = pitch.selected_array['frequency']
    f0_values = f0_values[np.isfinite(f0_values) & (f0_values>0)]
    f0_mean = float(np.median(f0_values)) if f0_values.size else 0.0
    f0_sd   = float(np.std(f0_values)) if f0_values.size else 0.0

    # Jitter/Shimmer/HNR（按 Praat 定义）
    point_process = call(snd, "To PointProcess (periodic, cc)", 75, 800)
    jitter_local = float(call([snd, point_process], "Get jitter (local)", 0, 0, 75, 800, 1.3, 1.6) * 100)
    shimmer_local = float(call([snd, point_process], "Get shimmer (local)", 0, 0, 75, 800, 1.3, 1.6, 1.6) * 100)
    hnr = float(call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0).values.mean())

    # Formants（Burg）
    formants = call(snd, "To Formant (burg)", 0.01, 5.0, 5500, 0.025, 50)
    # 取中点 0.5 处
    tmid = snd.xmax / 2
    F1 = float(call(formants, "Get value at time", 1, tmid, 'Hertz', 'Linear'))
    F2 = float(call(formants, "Get value at time", 2, tmid, 'Hertz', 'Linear'))
    F3 = float(call(formants, "Get value at time", 3, tmid, 'Hertz', 'Linear'))

    # MPT：基于能量门限近似
    thr = 0.02 * np.max(np.abs(samples))
    voiced = np.where(np.abs(samples) > thr, 1, 0)
    from itertools import groupby
    runs = [sum(1 for _ in g) for k, g in groupby(voiced) if k==1]
    mpt_s = (max(runs) / sr) if runs else 0.0

    spl = a_weighting_db(samples, sr)

    return {
        'f0_mean': f0_mean, 'f0_sd': f0_sd,
        'jitter_local_percent': jitter_local,
        'shimmer_local_percent': shimmer_local,
        'hnr_db': hnr,
        'formants': {'F1': F1, 'F2': F2, 'F3': F3},
        'mpt_s': mpt_s,
        'spl_dbA': spl,
    }

# --- 朗读/自发：节律与分布 ---
import webrtcvad

def analyze_speech_flow(key: str):
    samples, sr = read_wav_from_s3(key)
    # 统一到 16k 便于 VAD
    import resampy
    x = resampy.resample(samples, sr, 16000)
    sr = 16000
    # VAD 分帧
    vad = webrtcvad.Vad(2)
    frame_ms = 30
    step = int(sr * frame_ms / 1000)
    frames = [x[i:i+step] for i in range(0, len(x)-step, step)]
    import struct
    def to_bytes(fr):
        fr16 = np.clip(fr * 32768, -32768, 32767).astype(np.int16)
        return struct.pack('<%dh' % len(fr16), *fr16)
    voiced_flags = [vad.is_speech(to_bytes(fr), sr) for fr in frames]
    voiced_ratio = sum(voiced_flags)/len(voiced_flags) if frames else 0

    # 粗略语速：以有声段数量 / 时间近似（更严谨可接 ASR）
    duration_s = len(x)/sr
    pauses = 0
    in_pause = False
    for v in voiced_flags:
        if not v and not in_pause:
            in_pause = True; pauses += 1
        if v and in_pause:
            in_pause = False

    # F0/SPL 分布（用 parselmouth）
    snd = psm.Sound(x, sr)
    f0 = snd.to_pitch(0.01, 75, 500).selected_array['frequency']
    f0 = f0[np.isfinite(f0) & (f0>0)]
    f0_stats = {
        'p10': float(np.percentile(f0,10)) if f0.size else 0,
        'median': float(np.median(f0)) if f0.size else 0,
        'p90': float(np.percentile(f0,90)) if f0.size else 0,
    }
    spl = a_weighting_db(x, sr)

    return {
        'duration_s': duration_s,
        'voiced_ratio': voiced_ratio,
        'pause_count': pauses,
        'f0_stats': f0_stats,
        'spl_dbA_est': spl
    }
```

**Lambda 入口与路由（简化版）**

```python
# app/__init__.py
# 空

# app/handler.py
import json, os
from analysis import analyze_sustained_wav, analyze_speech_flow
import boto3

ddb = boto3.resource('dynamodb').Table(os.environ['DDB_TABLE'])


def handler(event, context):
    route = event.get('rawPath') or event.get('path')
    body = json.loads(event.get('body') or '{}')

    if route.endswith('/analyze/sustained'):
        res = analyze_sustained_wav(body['s3Key'])
        return _ok(res)

    if route.endswith('/analyze/speech'):
        res = analyze_speech_flow(body['s3Key'])
        return _ok(res)

    return _ok({'message':'OK'})


def _ok(data, code=200):
    return {'statusCode': code, 'headers': {'content-type':'application/json','access-control-allow-origin':'*'}, 'body': json.dumps(data)}
```

> 若需要运行 **Praat 脚本**（`.praat`）而非 parselmouth，可在容器内安装 `praat` CLI，并通过 `subprocess.run(["praat","--run","script.praat",in_wav,out_txt])` 调用；脚本内用 Praat 原生命令输出指标到文本/JSON。

**Praat 脚本调用（示例）**

```python
import subprocess, tempfile, json

def call_praat_script(wav_path: str, script_path: str):
    tmp = tempfile.NamedTemporaryFile(suffix='.json', delete=False)
    subprocess.run(["/opt/praat", "--run", script_path, wav_path, tmp.name], check=True)
    with open(tmp.name,'r') as f:
        return json.load(f)
```

---

## 5. 前端如何调用 API（含代码与 API 定义）

### 5.1 API 定义（OpenAPI 风格描述）

* `POST /sessions`

    * **Req**：`{ "userId?": string }`
    * **Resp**：`{ "sessionId": string }`

* `POST /uploads`

    * **Req**：`{ "sessionId": string, "step": "calibration"|"mpt"|"glide_up"|"glide_down"|"note_low"|"note_high"|"reading"|"spontaneous", "fileName": string, "contentType": "audio/wav" }`
    * **Resp**：`{ "putUrl": string, "objectKey": string }`

* `POST /analyze`

    * **Req**：`{ "sessionId": string, "calibration": { "hasExternal": boolean, "calibOffsetDb?": number }, "forms?": { "RBH?": {"R":0-3,"B":0-3,"H":0-3}, "VHI9i?": number, "TVQ?": number } }`
    * **Resp**：`{ "status": "queued", "sessionId": string }`

* `GET /results/{sessionId}`

    * **Resp**（节选）：

```json
{
  "status": "done",
  "metrics": {
    "sustained": {"spl_dbA": 76.8, "f0_mean": 290, "jitter_local_percent": 1.04, "shimmer_local_percent": 4.52, "hnr_db": 20.0, "mpt_s": 11.8, "formants": {"F1": 550, "F2": 1500, "F3": 2500}},
    "vrp": {"f0_min": 90, "f0_max": 596, "spl_min": 57, "spl_max": 91},
    "reading": {"duration_s": 25.2, "voiced_ratio": 0.78, "pause_count": 18, "f0_stats": {"p10": 180, "median": 220, "p90": 320}},
    "spontaneous": {"duration_s": 42.5, "voiced_ratio": 0.71, "pause_count": 26}
  },
  "charts": {"timeSeries": "s3://.../timeSeries.png", "vrp": "s3://.../vrp.png", "formants": "s3://.../formants.png"},
  "reportPdf": "s3://.../report.pdf"
}
```

### 5.2 React/TypeScript 封装与调用

**API 客户端**（`src/api.ts`）

```ts
export type Step = 'calibration'|'mpt'|'glide_up'|'glide_down'|'note_low'|'note_high'|'reading'|'spontaneous';
const BASE = import.meta.env.VITE_API_BASE;

export async function createSession(userId?: string){
  const r = await fetch(`${BASE}/sessions`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userId})});
  return r.json() as Promise<{sessionId:string}>;
}

export async function getUploadUrl(sessionId: string, step: Step, fileName: string){
  const r = await fetch(`${BASE}/uploads`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({sessionId, step, fileName, contentType:'audio/wav'})});
  return r.json() as Promise<{putUrl:string, objectKey:string}>;
}

export async function putToS3(putUrl: string, file: Blob){
  const r = await fetch(putUrl, {method:'PUT', headers:{'content-type':'audio/wav'}, body: file});
  if(!r.ok) throw new Error('upload failed');
}

export async function requestAnalyze(sessionId: string, calibration: {hasExternal:boolean, calibOffsetDb?:number}, forms?: any){
  const r = await fetch(`${BASE}/analyze`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({sessionId, calibration, forms})});
  return r.json();
}

export async function getResults(sessionId: string){
  const r = await fetch(`${BASE}/results/${sessionId}`);
  return r.json();
}
```

**录音上传与触发分析（简化示例）**

```ts
import { createSession, getUploadUrl, putToS3, requestAnalyze, getResults } from './api';

async function runFlow(files: Record<string, Blob>){
  const { sessionId } = await createSession();
  // 顺序上传
  for(const [step, blob] of Object.entries(files)){
    const { putUrl } = await getUploadUrl(sessionId, step as any, `${step}.wav`);
    await putToS3(putUrl, blob);
  }
  await requestAnalyze(sessionId, {hasExternal:false});

  // 轮询
  let res;
  for(let i=0;i<30;i++){
    res = await getResults(sessionId);
    if(res.status==='done') break;
    await new Promise(r=>setTimeout(r, 2000));
  }
  return res;
}
```

**向导步骤 UI（要点）**

* 每步显示：说明 → 录音按钮 → 实时电平/F0 → 合格提示（电平范围、噪声限制）→ 可重录。
* Step 5/6：显示文本/话题提示，计时与剩余时间。

---

## 6. DynamoDB 表结构（示例）

```json
{
  "TableName": "VoiceTests",
  "PK": "userOrAnonId",
  "SK": "sessionId",
  "Attributes": {
    "status": "pending|processing|done|failed",
    "createdAt": "ISO",
    "calibration": {"hasExternal": true, "offsetDb": 0.0, "noiseFloorDbA": 32.1},
    "tests": [{"step":"mpt","s3Key":"...","durationMs":6400}],
    "metrics": {
      "sustained": {"spl_dbA":76.8,"f0_mean":290,"jitter_local_percent":1.04,"shimmer_local_percent":4.52,"hnr_db":20.0,"mpt_s":11.8,"formants":{"F1":550,"F2":1500,"F3":2500}},
      "vrp": {"f0_min":90,"f0_max":596,"spl_min":57,"spl_max":91},
      "reading": {"duration_s":25.2,"voiced_ratio":0.78,"pause_count":18},
      "spontaneous": {"duration_s":42.5,"voiced_ratio":0.71,"pause_count":26}
    },
    "artifacts": {"timeSeries":"s3://...","vrp":"s3://...","formants":"s3://...","pdf":"s3://..."}
  },
  "GSI1": "sessionId->createdAt"
}
```

---

## 7. 后端总体流程（队列可选）

1. `POST /sessions` 生成 `sessionId`，DDB 写入 `status=pending`。
2. 前端 `POST /uploads` 获取预签名 URL → 直传音频到 `raw/`。
3. `POST /analyze` 变更 `status=processing`，异步 Lambda：

    * 读取 `raw/*.wav`，分别调用 `analyze_sustained_wav`、`VRP` 计算、`analyze_speech_flow`；
    * 生成图表 PNG；
    * 组装指标 JSON，写 DDB；
    * 渲染报告 PDF（HTML 模板 + Playwright/Chromium）；
    * `status=done`。
4. 前端 `GET /results/{sessionId}` 获取结果与报告下载链接。

---

## 8. VRP（音域图）与图表生成（方法概述）

* F0 序列 → 半音映射：`midi = 69 + 12*log2(F0/440)`，四舍五入至整数箱。
* 每箱统计 `SPL_min/max/mean`；绘制上下包络线，并在最高/最低 MIDI 处标记。
* 时序图：以 50–100 ms 步长绘制 SPL、F0、Jitter%、Shimmer% 曲线。
* 共振峰图：稳态频谱（Welch 或 FFT）、LPC 包络，叠加 F1/F2/F3 的竖线与数值标注。

---

## 9. 报告版式（要点）

* 页眉：应用名/机构、被试信息、日期。
* **嗓音分析**：指标表 + 四联时序图。
* **音域测定**：VRP 图 + 极值表（F0\_max/min、SPL\_max/min、Jitter）。
* **高/低唱音**：频谱+共振峰标注图，附 F1–F3 表格。
* **朗读/自由说话**：统计表（语速、停顿、F0/SPL 分布）。
* **量表**：RBH、VHI-9i、TVQ。
* 页脚：校准方式、免责声明、版本号。

---

## 10. 安全、性能与成本

* **权限**：前端仅获与 session 绑定的 S3 预签名 URL；S3/DDB 仅由 Lambda 角色访问。
* **CORS**：允许 GitHub Pages 源域名；S3 预签名 `PUT` 指定 `Content-Type`。
* **限流**：API Gateway + WAF；
* **性能**：Lambda 2048–3072 MB，超时 60 s；单次分析 2–8 s。
* **存储策略**：S3 生命周期 180 天后归档或删除（可配置）。

---

## 11. 任务拆解（执行清单）

1. 前端：搭建 `VoiceTestWizard`（8 步状态机，录音 + 直传）。
2. 后端：部署 Lambda 容器（Docker + ECR + API Gateway）。
3. 实现 `/sessions`、`/uploads`、`/analyze`、`/results`、`/report`。
4. 完成 parselmouth 指标计算、VRP、朗读/自发统计；
5. 图表生成与 PDF 模板；
6. DynamoDB 表与 IAM 权限；
7. 端到端联调与验收；
8. 文档与监控告警。

---

### 附：如果采用 **Praat CLI + 脚本** 的最小可用脚本（伪代码）

```praat
form AnalyzeOne
    sentence inWav
    sentence outJson
endform

Read from file: inWav
To Pitch: 0.01, 75, 800
To PointProcess (periodic, cc): 75, 800
jitter = Get jitter (local): 0, 0, 75, 800, 1.3, 1.6
shimmer = Get shimmer (local): 0, 0, 75, 800, 1.3, 1.6, 1.6
To Harmonicity (cc): 0.01, 75, 0.1, 1.0
hnr = Get mean: 0, 0
To Formant (burg): 0.01, 5, 5500, 0.025, 50
f1 = Get value at time: 1, 0.5, "Hertz", "Linear"
f2 = Get value at time: 2, 0.5, "Hertz", "Linear"
f3 = Get value at time: 3, 0.5, "Hertz", "Linear"
# 输出 JSON（略），或用 Write to text file + 格式化
```

# 附录1：量表本体（RBH / OVHS‑9 / TVQ‑G，可直接落地）

> **许可与来源说明**
>
> * **RBH**（Rauhigkeit/Breathiness/Heiserkeit）为描述性分级量表，条目为通用描述，可直接使用。
> * **VHI‑9i 与部分 TVQ 版本**通常受版权/授权限制。为确保合规，本文提供 **开放替代量表**：
    >
    >   * **OVHS‑9（Open Voice Handicap Short‑9）**：结构和评分与 VHI‑9i 等价（功能/情感/生理三域各 3 项），文本为自编开放内容；如贵机构拥有官方 VHI‑9i 授权，可在后台将条目文本替换为官方版本。
>   * **TVQ‑G（Talking Voice Questionnaire – Generic 12）**：通用 12 项开放版。若后续采用机构授权版本，可无缝替换文本与阈值。
> * 下文给出 **中英双语条目 + 评分说明 + JSON 模板**，可直接接入前端表单与后端计分。

---

## A. RBH 量表（0–3 分）

* **作答人**：受试者自评或评估者他评均可（请在报告中注明）。
* **评分**：每一维 `0–3`，整数；`0=无`，`1=轻度`，`2=中度`，`3=重度`。

| 分值 R（粗糙 Roughness） B（气息 Breathiness） H（嘶哑 Hoarseness/Overall） |              |           |            |
| ------------------------------------------------------------- | ------------ | --------- | ---------- |
| 0                                                             | 发声规则，无明显周期扰动 | 无气声或漏气感   | 音质清亮，无可闻嘶哑 |
| 1                                                             | 轻微粗糙，偶发不规则   | 轻微漏气，偶有气声 | 轻度嘶哑，清晰度略降 |
| 2                                                             | 明显粗糙，持续不规则   | 明显漏气，持续气声 | 中度嘶哑，理解需用力 |
| 3                                                             | 重度粗糙，振动近乎失序  | 重度漏气，接近失声 | 重度嘶哑，理解困难  |

> **计分与呈现**：报告显示 `RBH: R=x, B=y, H=z`，并可选雷达图/色条可视化。

---

## B. OVHS‑9（开放短版嗓音不便指数，0–4 计分制）

* **维度**：功能 F、情感 E、生理 P，各 3 项，共 9 项。
* **量表**：`0 从不 / 1 几乎不 / 2 有时 / 3 经常 / 4 总是`
* **总分范围**：0–36，分数越高表明自觉受影响越大。
* **建议阈值（可配置）**：0–9 轻度/无明显；10–19 轻–中度；20–29 中度；30–36 重度。

### 中文条目（可直接使用）

**功能 F**

1. **F1** 我在嘈杂环境下很难让别人清楚地听到我的声音。
2. **F2** 我的声音问题影响了工作/学习或社交效率。
3. **F3** 我需要重复或提高音量才能被听清。

**情感 E**
4\. **E1** 我的声音让我感到尴尬或不自在。
5\. **E2** 因为声音问题，我感到焦虑或担心被误解。
6\. **E3** 我因声音问题而回避打电话或当众发言。

**生理 P**
7\. **P1** 说话一段时间后，我的喉咙会感到疲劳或疼痛。
8\. **P2** 我需要用很大力气才能发声或保持音量。
9\. **P3** 早晨或长时间不用声后，我的嗓音更差，需要热嗓才能正常说话。

### English items

**Functional (F)**

1. **F1** In noisy places, people have difficulty hearing me clearly.
2. **F2** My voice problem interferes with my work/study or social efficiency.
3. **F3** I need to repeat myself or raise my volume to be understood.

**Emotional (E)**
4\. **E1** My voice makes me feel embarrassed or self‑conscious.
5\. **E2** I feel anxious or worry about being misunderstood because of my voice.
6\. **E3** I avoid phone calls or public speaking due to my voice.

**Physical (P)**
7\. **P1** After speaking for a while, my throat feels tired or painful.
8\. **P2** I must exert a lot of effort to produce or maintain my voice.
9\. **P3** My voice is worse in the morning or after long rest and needs warm‑up.

---

## C. TVQ‑G（通用 12 项开放版，0–4 计分制）

* **量表**：`0 从不 / 1 很少 / 2 有时 / 3 经常 / 4 总是`
* **总分**：0–48；同时给出标准化百分比 `percent = round(total/(12*4)*100)`。

### 中文条目

**沟通与负担**

1. **C1** 我需要比别人更费力才能把话说清楚。
2. **C2** 长时间说话后，我不得不暂停或喝水才能继续。
3. **C3** 说话后，我的嗓音会变得嘶哑或沙哑。
4. **C4** 在打电话或线上会议中，我常被要求重复。

**社交与情绪**
5\. **S1** 我因为嗓音而减少社交或公开发言。
6\. **S2** 我担心自己的声音让别人误以为我生病或情绪不好。
7\. **S3** 嗓音问题影响了我的自信心。
8\. **S4** 我在需要提高音量（如户外）时感到吃力。

**症状与自我管理**
9\. **P1** 我经常清嗓或咳嗽以获得更清晰的声音。
10\. **P2** 早晨或久不说话后，声音明显更差。
11\. **P3** 我说话时出现破音、断裂或不稳定。
12\. **P4** 即使休息后，我的声音也很难完全恢复。

### English items

**Communication & Effort**

1. **C1** I need more effort than others to speak clearly.
2. **C2** After talking for a while, I must pause or drink water to continue.
3. **C3** My voice becomes hoarse or raspy after speaking.
4. **C4** On phone or online meetings, I am often asked to repeat myself.

**Social & Emotion**
5\. **S1** I reduce social activities or public speaking because of my voice.
6\. **S2** I worry that my voice makes others think I am sick or upset.
7\. **S3** My voice problems affect my confidence.
8\. **S4** Raising my voice (e.g., outdoors) is difficult for me.

**Symptoms & Self‑management**
9\. **P1** I frequently clear my throat or cough to sound clearer.
10\. **P2** My voice is notably worse in the morning or after long silence.
11\. **P3** I experience voice breaks or instability while speaking.
12\. **P4** Even with rest, my voice hardly returns to normal.

---

## D. 评分与阈值（可配置）

* **OVHS‑9**：总分=9 项之和（0–36）。默认分级：0–9 轻度/无明显；10–19 轻–中度；20–29 中度；30–36 重度。
* **TVQ‑G**：总分=12 项之和（0–48）；标准化百分比 `percent`。默认分级：0–24% 轻度/无明显；25–49% 轻–中度；50–74% 中度；75–100% 重度。
* **RBH**：三项独立呈现，不合成总分；可给出 `H` 作为总体主观音质指标。

---

## E. JSON 模板（前端可直接加载）

```
{
  "RBH": {
    "id": "RBH_v1",
    "items": [
      {"id":"R","label":"R 粗糙度(0-3)"},
      {"id":"B","label":"B 气息感(0-3)"},
      {"id":"H","label":"H 嘶哑/总体(0-3)"}
    ]
  },
  "OVHS9": {
    "id": "OVHS9_zh_en_v1",
    "scale": "0-4",
    "items": [
      {"id":"F1","zh":"我在嘈杂环境下很难让别人清楚地听到我的声音。","en":"In noisy places, people have difficulty hearing me clearly."},
      {"id":"F2","zh":"我的声音问题影响了工作/学习或社交效率。","en":"My voice problem interferes with my work/study or social efficiency."},
      {"id":"F3","zh":"我需要重复或提高音量才能被听清。","en":"I need to repeat myself or raise my volume to be understood."},
      {"id":"E1","zh":"我的声音让我感到尴尬或不自在。","en":"My voice makes me feel embarrassed or self‑conscious."},
      {"id":"E2","zh":"因为声音问题，我感到焦虑或担心被误解。","en":"I feel anxious or worry about being misunderstood because of my voice."},
      {"id":"E3","zh":"我因声音问题而回避打电话或当众发言。","en":"I avoid phone calls or public speaking due to my voice."},
      {"id":"P1","zh":"说话一段时间后，我的喉咙会感到疲劳或疼痛。","en":"After speaking for a while, my throat feels tired or painful."},
      {"id":"P2","zh":"我需要用很大力气才能发声或保持音量。","en":"I must exert a lot of effort to produce or maintain my voice."},
      {"id":"P3","zh":"早晨或长时间不用声后，我的嗓音更差，需要热嗓才能正常说话。","en":"My voice is worse in the morning or after long rest and needs warm‑up."}
    ],
    "thresholds": {"mild":[0,9],"mild_moderate":[10,19],"moderate":[20,29],"severe":[30,36]}
  },
  "TVQG": {
    "id": "TVQG_zh_en_v1",
    "scale": "0-4",
    "items": [
      {"id":"C1","zh":"我需要比别人更费力才能把话说清楚。","en":"I need more effort than others to speak clearly."},
      {"id":"C2","zh":"长时间说话后，我不得不暂停或喝水才能继续。","en":"After talking for a while, I must pause or drink water to continue."},
      {"id":"C3","zh":"说话后，我的嗓音会变得嘶哑或沙哑。","en":"My voice becomes hoarse or raspy after speaking."},
      {"id":"C4","zh":"在打电话或线上会议中，我常被要求重复。","en":"On phone or online meetings, I am often asked to repeat myself."},
      {"id":"S1","zh":"我因为嗓音而减少社交或公开发言。","en":"I reduce social activities or public speaking because of my voice."},
      {"id":"S2","zh":"我担心自己的声音让别人误以为我生病或情绪不好。","en":"I worry that my voice makes others think I am sick or upset."},
      {"id":"S3","zh":"嗓音问题影响了我的自信心。","en":"My voice problems affect my confidence."},
      {"id":"S4","zh":"我在需要提高音量（如户外）时感到吃力。","en":"Raising my voice (e.g., outdoors) is difficult for me."},
      {"id":"P1","zh":"我经常清嗓或咳嗽以获得更清晰的声音。","en":"I frequently clear my throat or cough to sound clearer."},
      {"id":"P2","zh":"早晨或久不说话后，声音明显更差。","en":"My voice is notably worse in the morning or after long silence."},
      {"id":"P3","zh":"我说话时出现破音、断裂或不稳定。","en":"I experience voice breaks or instability while speaking."},
      {"id":"P4","zh":"即使休息后，我的声音也很难完全恢复。","en":"Even with rest, my voice hardly returns to normal."}
    ],
    "grading": {"type":"percentile","bands":[[0,24],[25,49],[50,74],[75,100]]}
  }
}

```

---

## F. 集成与合规模板

* 如果贵机构 **已获得官方 VHI‑9i/TVQ 授权**：在后台“量表管理”中创建新量表，将上面的 OVHS‑9/TVQ‑G 条目逐条替换为官方文本；`id` 不变即可沿用现有计分器。
* 如果 **暂未授权**：直接使用本开放条目，在报告页脚注明“量表文本为开放版本，仅供健康教育与自我管理参考”。

---

> 以上内容可直接复制到现有《嗓音测试功能技术方案》附录末尾；若需要，我可以把这些条目导出为独立 `JSON` 文件并提供上传脚本。

# 附录2：量表的评分标准（可直接追加到方案文档末尾）

> 本附录用于在报告中展示与存档 **RBH**、**VHI‑9i** 与 **TVQ** 的量表说明、评分方法与系统实现细则。考虑到不同机构采用的量表版本、阈值与语言可能存在差异，以下阈值提供“默认模板（可配置）”，生产环境应以贵机构伦理/授权版本为准。

---

## A. RBH 量表（Rauhigkeit / Breathiness / Heiserkeit）

* **用途**：快速自/他评声音质量的三个维度：粗糙度（R）、气息感（B）、嘶哑度（H）。
* **评分范围**：每项 **0–3** 分，整数；0=无异常，3=重度。
* **报告呈现**：`RBH: R=1, B=0, H=1`（并用颜色条表示 0–3）。

| 分值 | R（粗糙）示例描述  | B（气息）示例描述 | H（嘶哑/总体）示例描述 |
| -- | ---------- | --------- | ------------ |
| 0  | 无粗糙、振动规则   | 无气息感      | 无嘶哑，清亮稳定     |
| 1  | 轻微粗糙，偶发不规则 | 轻微漏气，轻度气声 | 轻度嘶哑，偶尔不清    |
| 2  | 明显粗糙，持续不规则 | 明显漏气，持续气声 | 中度嘶哑，持续不清    |
| 3  | 重度粗糙，几近无规则 | 重度漏气，几近失声 | 重度嘶哑，理解困难    |

> **实现**：前端以 3 个单选条收集分数；DynamoDB 存为 `forms.RBH = {R,B,H}`。报告以彩色徽标或雷达图可视化（可选）。

---

## B. VHI‑9i（Voice Handicap Index—9 item）

* **用途**：评估声音问题在功能、情感和生理方面对生活的影响（短版 9 项）。
* **作答**：Likert 5 级（**0**=从不，**1**=几乎不，**2**=有时，**3**=经常，**4**=总是）。
* **计分**：总分 = 9 项之和，**范围 0–36 分**，分数越高表明自感受影响越大。
* **默认分级（可配置）**：

    * 0–9：轻度/无明显
    * 10–19：轻–中度
    * 20–29：中度
    * 30–36：重度
* **条目内容**：因版权与授权原因，系统不内置官方条目文本；请在后台以 JSON 方式导入机构授权版本（支持中/英文）。示例分类：**功能**（沟通受限/工作影响）、**情感**（尴尬/沮丧）、**生理**（发声费力/疲劳）。
* **报告呈现**：显示总分与（可选）分级；若开启规范化，附“同年龄/性别常模百分位”。

**前端 JSON 结构（导入/编辑）**

```
{
  "id": "VHI9i_zh_CN_v1",
  "scale": "0-4",
  "items": [
    {"id":"F1","text":"我的声音影响了日常交流"},
    {"id":"P1","text":"我说话需要费很大力气"},
    {"id":"E1","text":"我对自己的声音感到困扰"}
    // ... 共 9 条（按授权版本导入）
  ],
  "thresholds": {"mild": [0,9], "mild_moderate": [10,19], "moderate": [20,29], "severe": [30,36]}
}
```

**计分函数（TS/前端或后端皆可）**

```
export function scoreVHI9i(values: number[]): {total:number, level: string} {
  const total = values.reduce((a,b)=>a+(b||0),0);
  const level = total<=9? '轻度/无明显' : total<=19? '轻–中度' : total<=29? '中度' : '重度';
  return { total, level };
}
```

> **注意**：不同研究/人群的阈值不尽相同，上述区间仅作**默认模板**。生产环境建议：显示**原始分 + 百分位**，分级阈值由机构在后台配置。

---

## C. TVQ（配置化量表占位说明）

> 业内存在多种 “TVQ” 量表版本（条目数与维度不同）。为避免误用，本系统将 **TVQ** 做为“可配置量表”接入：

* **作答**：Likert 5 级（0–4）。
* **计分**：总分 = 条目分之和；系统同时提供 **标准化得分**：`percent = round(total / (items*4) * 100)`。
* **默认分级（按标准化百分比，可配置）**：

    * 0–24：轻度/无明显
    * 25–49：轻–中度
    * 50–74：中度
    * 75–100：重度
* **后台模板示例**：

```
{
  "id": "TVQ_Generic_v1",
  "name": "TVQ（通用模板）",
  "scale": "0-4",
  "items": [
    {"id":"T1","text":"我的声音问题影响了工作/学习"},
    {"id":"T2","text":"我需要重复讲话以被听清"}
    // ... N 条（由机构导入授权文本）
  ],
  "grading": {"type":"percentile", "bands":[[0,24],[25,49],[50,74],[75,100]]}
}
```

**计分函数**

```
export function scoreTVQ(values: number[]): {total:number, percent:number, level:string} {
  const items = values.length || 1;
  const total = values.reduce((a,b)=>a+(b||0),0);
  const percent = Math.round(total/(items*4)*100);
  const level = percent<=24? '轻度/无明显' : percent<=49? '轻–中度' : percent<=74? '中度' : '重度';
  return { total, percent, level };
}
```

---

## D. 前端表单与校验（实现规范）

* **组件**：`<SurveyRBH/>`、`<SurveyVHI9i/>`、`<SurveyTVQ/>` 三个受控表单组件；支持：保存草稿、跳过、国际化、多设备无障碍（键盘/屏读）。
* **校验**：VHI‑9i/TVQ 若未填写完成，允许保存为草稿但提示“未完成”；RBH 必须三项都有 0–3 分。
* **提交**：随 `POST /analyze` 传入 `forms` 字段；或单独 `POST /forms`（可选）。

**前端提交示例**

```
await requestAnalyze(sessionId, {hasExternal:false}, {
  RBH: {R:1,B:0,H:1},
  VHI9i: 18,
  TVQ: { total: 30, percent: 42 }
});
```

---

## E. 报告呈现规范

* **主报告**：在“量表”区块列出 `RBH`、`VHI‑9i`、`TVQ` 的 **原始分** 与（可选）**分级**，并用颜色条或小型条形图提示范围。
* **文字解释**：

    * RBH：三维度解释各自含义与 0–3 语义。
    * VHI‑9i：0–36 分，分高表示主观受影响程度更高；提醒“阈值随人群而异”。
    * TVQ：展示原始分与标准化百分比，阈值来源于机构配置。
* **合规与提示**：页脚注明“量表结果仅作健康教育与自我管理参考，不能替代临床诊断”。

---

---

> **落地提示**：将本附录直接粘贴到主文档《嗓音测试功能技术方案》末尾的“附录”章节；前端与后端按上述 JSON/接口即可对接实现。
