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
    docker build -t online-praat-analysis . 
    ```

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

### Install Parselmouth dev wheel (Windows/macOS/Linux)

If you need `To Pitch (filtered autocorrelation)` before an official release, install a development wheel:

1. Download wheel artifacts from the Parselmouth Actions run (or use `gh run download`).
2. Run the cross-platform installer script in this repository:

```bash
python scripts/install_parselmouth_dev.py --run-id 21285172527
```

The script will:

- Auto-select artifact name by platform (Windows/macOS/Linux)
- Recursively find compatible `praat_parselmouth-*.whl`
- Match against current interpreter tags
- Install selected wheel into current environment and print `PARSELMOUTH_VERSION` and `PRAAT_VERSION`

Optional parameters:

- `--wheel-dir <path>`: Use local wheel cache directory
- `--artifact-name <name>`: Force artifact name (e.g., `wheels-manylinux_aarch64`)
- `--version-fragment 0.5.0.dev0`: Limit candidate version

### CI auto-install Parselmouth dev wheel (optional)

The backend image workflow `.github/workflows/build-python-lambda.yml` supports Parselmouth dev wheel injection:

- Current default is enabled in workflow env.
- CI downloads the wheel artifact first, then overrides the package during Docker build.

Current workflow defaults are defined directly in the workflow `env` block:

- `PARSELMOUTH_DEV_WHEEL_ENABLED`: `true`/`false`, current `true`
- `PARSELMOUTH_DEV_WHEEL_RUN_ID`: Actions run id that produced wheel artifacts (default example `21285172527`)
- `PARSELMOUTH_DEV_WHEEL_REPO`: source repository (default `YannickJadoul/Parselmouth`)
- `PARSELMOUTH_DEV_WHEEL_ARTIFACT`: artifact name (default `wheels-manylinux_aarch64`)
- `PARSELMOUTH_DEV_WHEEL_FILENAME`: exact wheel filename (default `praat_parselmouth-0.5.0.dev0-cp313-cp313-manylinux2014_aarch64.manylinux_2_17_aarch64.whl`)
- `PARSELMOUTH_DEV_WHEEL_SHA256`: optional integrity check value (if set, CI verifies hash)

If you need to change source/version, update those env values in `.github/workflows/build-python-lambda.yml`.

For current production Lambda (`linux/arm64 + python3.13`), use a compatible wheel (`cp313` + `manylinux_aarch64`).

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
