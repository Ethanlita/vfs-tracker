# Online Praat Analysis Lambda

## 1. Function Description

This AWS Lambda function provides the backend services for the "Online Praat" voice analysis feature. It is designed to be deployed as a Docker container.

The service exposes a set of RESTful APIs via Amazon API Gateway, enabling clients to create voice test sessions, upload audio files for analysis, trigger the analysis process, and retrieve the results.

The core functionality includes:
- **Session Management**: Creates and tracks unique voice test sessions.
- **Secure File Uploads**: Generates pre-signed S3 URLs to allow clients to securely upload audio files directly to an S3 bucket.
- **Acoustic Analysis**: Leverages the `praat-parselmouth` library to perform detailed acoustic analysis on voice recordings, calculating metrics such as F0, jitter, shimmer, and HNR.
- **Artifact Generation**: Creates visual artifacts from the analysis, including time-series charts of waveforms and F0 contours using `matplotlib`, and generates comprehensive PDF reports using `reportlab`.
- **Data Persistence**: Stores session information, analysis metrics, and artifact locations in a DynamoDB table.

### Refactored v2 pipeline (default)

This module now contains a refactored analysis branch for VRP and Formant-SPL:

- `analysis_refactor_v2.py`: frame-level extraction (Pitch/Intensity/Formant), QC, VRP envelope, soft/loud anchors, CSV export.
- `artifacts_refactor_v2.py`: VRP scatter+envelope chart and expanded F1/F2/F3 vs SPL chart.
- `refactor_config.py`: branch switch config helper.

Branch switch environment variable:

- `ONLINE_PRAAT_ANALYSIS_PIPELINE=v2` (default): use refactored pipeline.
- `ONLINE_PRAAT_ANALYSIS_PIPELINE=legacy`: use original pipeline.

> Note: Step 4 is interpreted as loudness anchors in v2 (`4_1.wav` => `soft_a`, `4_2.wav` => `loud_a`).

---

## 2. API Endpoints

The function is triggered by API Gateway and routes requests based on the HTTP method and path.

### `POST /sessions`

- **Description**: Initializes a new voice test session.
- **Authentication**: Required (expects a JWT token from Cognito).
- **Request Body**: (empty)
- **Success Response (201)**:
  ```json
  {
    "sessionId": "a-unique-session-id-string"
  }
  ```
- **Error Response (401)**: If the user is not authenticated.
- **Error Response (500)**: If the session fails to be created in DynamoDB.

### `POST /uploads`

- **Description**: Generates a pre-signed S3 URL for a client to upload an audio file.
- **Authentication**: Required.
- **Request Body**:
  ```json
  {
    "sessionId": "string",
    "step": "string", // e.g., "sustained_vowel", "reading"
    "fileName": "string", // e.g., "recording.wav"
    "contentType": "string" // e.g., "audio/wav"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "putUrl": "https://s3-presigned-url-for-upload",
    "objectKey": "voice-tests/sessionId/raw/step/fileName"
  }
  ```
- **Error Response (400)**: If the request body is missing required parameters.
- **Error Response (500)**: If the URL generation fails.

### `POST /analyze`

- **Description**: Triggers the backend analysis pipeline for a given session. This is an asynchronous-style endpoint; it queues the analysis and returns immediately.
- **Authentication**: Required.
- **Request Body**:
  ```json
  {
    "sessionId": "string"
  }
  ```
- **Success Response (202 - Accepted)**:
  ```json
  {
    "status": "queued",
    "sessionId": "string"
  }
  ```
- **Error Response (400)**: If `sessionId` is missing.
- **Error Response (500)**: If the analysis pipeline fails to start.

### `GET /results/{sessionId}`

- **Description**: Retrieves the status and results of a voice test session.
- **Authentication**: Required.
- **Path Parameter**: `sessionId` (string).
- **Success Response (200)**:
  - The response body is the full DynamoDB item for the session. The structure depends on the `status`.
  - If `status` is `processing`:
    ```json
    {
      "sessionId": "string",
      "status": "processing",
      // ... other metadata
    }
    ```
  - If `status` is `done`:
    ```json
    {
      "sessionId": "string",
      "status": "done",
      "metrics": { /*...
See data_structures.md for details
...*/ },
      "charts": {
        "timeSeries": "s3://bucket/path/to/chart.png"
      },
      "reportPdf": "s3://bucket/path/to/report.pdf",
      // ... other metadata
    }
    ```
- **Error Response (404)**: If the session is not found.
- **Error Response (500)**: If the data fetch from DynamoDB fails.

---

## 3. Deployment Steps

1.  **Build the Docker Image**:
    Navigate to this directory (`lambda-functions/online-praat-analysis`) and run the build command:
    ```bash
    docker build \
      --build-arg PARSELMOUTH_SOURCE_REPOSITORY=https://github.com/YannickJadoul/Parselmouth.git \
      --build-arg PARSELMOUTH_SOURCE_COMMIT=0a0594265823f5c3fdaa661a05c887cdf02ec143 \
      -t online-praat-analysis .
    ```

    构建会先安装 `requirements-test.txt` 中的隔离测试依赖并运行 `python -m pytest tests`。任一声学、处理程序或 AWS 模拟测试失败都会停止构建；最终运行阶段不安装 pytest/moto，并移除测试源码。

2.  **Push to Amazon ECR**:
    Tag the image and push it to your ECR repository.
    ```bash
    aws ecr get-login-password --region <your-aws-region> | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.<your-aws-region>.amazonaws.com
    docker tag online-praat-analysis:latest <your-aws-account-id>.dkr.ecr.<your-aws-region>.amazonaws.com/online-praat-analysis:latest
    docker push <your-aws-account-id>.dkr.ecr.<your-aws-region>.amazonaws.com/online-praat-analysis:latest
    ```

3.  **Create/Update the Lambda Function**:
    - In the AWS Lambda console, create a new function or update the existing one.
    - Choose "Container image" as the type.
    - Browse for the ECR image you just pushed.
    - Configure the function settings, including memory, timeout, and the environment variables listed below.
    - Assign the appropriate IAM role.

---

## 4. Environment Variables

- **`DDB_TABLE`**: The name of the DynamoDB table used to store voice test session data (e.g., `VoiceTests`).
- **`BUCKET`**: The name of the S3 bucket used for storing raw audio files and generated artifacts (e.g., `vfs-tracker-test-data`).
- **`ONLINE_PRAAT_ANALYSIS_PIPELINE`**: Branch switch, `v2` (default) or `legacy`.

### LocalStack / Custom Endpoint (Optional)

For local integration testing, you can point AWS SDK calls to LocalStack (or any custom endpoint).

- **`USE_LOCALSTACK`**: `true/false`. When `true`, default endpoint becomes `LOCALSTACK_ENDPOINT`.
- **`LOCALSTACK_ENDPOINT`**: default `http://localhost:4566`.
- **`AWS_ENDPOINT_URL`**: shared endpoint for all AWS services used by this Lambda.
- **`AWS_S3_ENDPOINT_URL`**: service-specific override for S3.
- **`AWS_DYNAMODB_ENDPOINT_URL`**: service-specific override for DynamoDB.
- **`AWS_LAMBDA_ENDPOINT_URL`**: service-specific override for Lambda invoke client.

Priority:

1. `AWS_{SERVICE}_ENDPOINT_URL`
2. `AWS_ENDPOINT_URL`
3. `LOCALSTACK_ENDPOINT` (only when `USE_LOCALSTACK=true`)

### 本地安装 filtered autocorrelation 版本

本地运行 v2 Python 管线前，先安装 `requirements.txt`，再从仓库根目录使用与生产镜像相同的固定源码提交安装 Parselmouth：

```bash
python -m pip install -r lambda-functions/online-praat-analysis/requirements.txt
python scripts/install_parselmouth_dev.py
```

脚本通过 pip 克隆完整子模块、从源码构建并安装，随后直接执行 filtered autocorrelation 探针。Windows 源码构建需要 Visual Studio 2022 C++ 工具链；Linux/macOS 需要 CMake 与 C/C++ 编译器。更新版本时显式传入完整提交 SHA，并同步更新生产工作流中的固定值。

### CI 构建 Parselmouth filtered autocorrelation 版本

v2 默认管线直接依赖 `To Pitch (filtered autocorrelation)`，PyPI 稳定版 0.4.7 不提供该命令，因此 `requirements.txt` 不声明稳定版，也不存在稳定版回退路径。后端镜像工作流从 `PARSELMOUTH_SOURCE_COMMIT` 指定的上游提交及其固定子模块构建 ARM64 wheel；Dockerfile 会在运行完整测试前直接调用该命令，缺少能力时停止构建。该镜像工作流只能由统一后端发布工作流调用；它同时刷新模板兼容的 `latest` 标签并输出不可变 SHA 地址，统一工作流在 SAM 成功后才明确将该 SHA 地址发布到 Lambda。

外部 GitHub Actions artifact 只有有限保留期，不能作为可重复构建来源。升级 Parselmouth 时必须修改 `.github/workflows/build-python-lambda.yml` 中的固定提交，重新通过 filtered autocorrelation 探针和完整 Lambda 测试，再更新本节记录。

---

## 5. IAM Role Permissions

The Lambda function's execution role requires the following permissions:

- **CloudWatch Logs**:
  - `logs:CreateLogGroup`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`

- **Amazon S3**:
  - `s3:GetObject` (to download raw audio files for analysis)
  - `s3:PutObject` (to upload generated charts and PDF reports)

- **Amazon DynamoDB**:
  - `dynamodb:PutItem` (to create new session records)
  - `dynamodb:GetItem` (to retrieve session results)
  - `dynamodb:UpdateItem` (to update session status and results)

---

## 6. Data Flow

1.  **Initiation**: The frontend calls `POST /sessions` to get a unique `sessionId`.
2.  **Upload**: For each recording step, the frontend calls `POST /uploads` to get a pre-signed URL, then `PUT`s the audio file directly to S3.
3.  **Analysis Trigger**: After all files are uploaded, the frontend calls `POST /analyze`.
4.  **Backend Processing**:
    a. The Lambda function downloads the relevant raw audio files from S3 to its temporary storage.
    b. It runs the acoustic analysis functions from `analysis.py`.
    c. It generates chart and PDF artifacts using `artifacts.py`.
    d. It uploads these artifacts back to a different prefix in the S3 bucket.
    e. It updates the session's record in DynamoDB with the status `done`, along with all the calculated metrics and artifact URLs.
5.  **Result Polling**: The frontend periodically calls `GET /results/{sessionId}`. Initially, it sees a `processing` status. Once the analysis is complete, it receives the final `done` status and all the associated data, which it then displays to the user.
