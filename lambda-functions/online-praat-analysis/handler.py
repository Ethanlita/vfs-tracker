import json
import logging
import os
import uuid
import base64
from typing import Optional, Dict
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone
from decimal import Decimal
import math
import numpy as np

# ---- Environment and Cache Setup ----
os.environ.setdefault('LOG_LEVEL', 'INFO')
os.environ.setdefault('MPLCONFIGDIR', '/tmp/mplconfig')
os.environ.setdefault('LIBROSA_CACHE_DIR', '/tmp/librosa_cache')
os.environ.setdefault('NUMBA_CACHE_DIR', '/tmp/numba_cache')
os.environ.setdefault('LIBROSA_CACHE_DISABLE', '1')
for d in ('/tmp/mplconfig', '/tmp/librosa_cache', '/tmp/numba_cache'):
    try:
        os.makedirs(d, exist_ok=True)
    except Exception:
        pass

logger = logging.getLogger()
logger.setLevel(os.environ['LOG_LEVEL'].upper())

# ---- AWS Clients & Globals ----
_s3_client = None
_dynamodb = None
_lambda_client = None
_table = None
_events_table = None

# ---- Environment Variables ----
DDB_TABLE = os.environ.get('DDB_TABLE')
BUCKET = os.environ.get('BUCKET')
EVENTS_TABLE = os.environ.get('EVENTS_TABLE', 'VoiceFemEvents')
FUNCTION_NAME = os.environ.get('AWS_LAMBDA_FUNCTION_NAME')

def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client('s3')
    return _s3_client

def get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource('dynamodb')
    return _dynamodb

def get_lambda_client():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client('lambda')
    return _lambda_client

def get_table():
    global _table
    if _table is None and DDB_TABLE:
        _table = get_dynamodb().Table(DDB_TABLE)
    return _table

def get_events_table():
    global _events_table
    if _events_table is None and EVENTS_TABLE:
        _events_table = get_dynamodb().Table(EVENTS_TABLE)
    return _events_table

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
}

# ---------- Serialization Helpers ----------
def _to_dynamo(v):
    if isinstance(v, (np.floating,)):
        if np.isnan(v) or np.isinf(v):
            return Decimal('0')
        return Decimal(str(round(float(v), 6)))
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return Decimal('0')
        return Decimal(str(round(v, 6)))
    if isinstance(v, np.ndarray):
        return [_to_dynamo(x.item() if isinstance(x, (np.floating, np.integer)) else x) for x in v.tolist()]
    if isinstance(v, dict):
        return {k: _to_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_to_dynamo(x) for x in v]
    return v

def _from_dynamo(v):
    if isinstance(v, Decimal):
        return int(v) if v % 1 == 0 else float(v)
    if isinstance(v, dict):
        return {k: _from_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_from_dynamo(x) for x in v]
    return v

# ---------- JWT Helper ----------
def extract_user_info(event) -> Dict[str, Optional[str]]:
    """Extracts user ID and username from JWT token."""
    info = {'userId': None, 'userName': 'Anonymous'}

    # First try the easy way via API Gateway authorizer context
    rc = event.get('requestContext', {}) or {}
    claims = rc.get('authorizer', {}).get('jwt', {}).get('claims', {})
    if claims.get('sub'):
        info['userId'] = claims.get('sub')
        info['userName'] = claims.get('username') or claims.get('name') or 'N/A'
        return info

    # Fallback to manual decoding of Authorization header
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization')
    if auth_header and auth_header.lower().startswith('bearer '):
        try:
            token = auth_header.split(' ')[1]
            payload_b64 = token.split('.')[1]
            payload_b64 += '=' * (-len(payload_b64) % 4) # Add padding
            payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())

            info['userId'] = payload.get('sub')
            info['userName'] = payload.get('username') or payload.get('name') or 'N/A'
        except Exception as e:
            logger.warning(f"Could not decode auth header manually: {e}")
            # Return default info with no userId
            return {'userId': None, 'userName': 'Anonymous'}

    return info

# ---------- Constants ----------
RAW_PREFIX_TEMPLATE = 'voice-tests/{sessionId}/raw/'
ARTIFACT_PREFIX_TEMPLATE = 'voice-tests/{sessionId}/artifacts/'
REPORT_KEY_TEMPLATE = 'voice-tests/{sessionId}/report.pdf'
MAX_DOWNLOAD_FILES_PER_STEP = 10
TMP_BASE = '/tmp'

# ---------- Analysis Logic ----------
def perform_full_analysis(session_id: str, calibration: dict = None, forms: dict = None, userInfo: dict = None):
    from analysis import analyze_sustained_vowel, analyze_speech_flow, analyze_glide_files, analyze_note_file_robust, get_lpc_spectrum
    from artifacts import create_time_series_chart, create_vrp_chart, create_pdf_report, create_formant_chart, create_formant_spl_chart, create_placeholder_chart

    audio_groups = list_session_audio_keys(session_id)
    logger.info(f'perform_full_analysis: Audio groups found: { {k:len(v) for k,v in audio_groups.items()} }')

    metrics = {}
    charts = {}
    artifact_prefix = ARTIFACT_PREFIX_TEMPLATE.format(sessionId=session_id)

    # Sustained Vowel (Step 2)
    sustained_keys = audio_groups.get('2', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    sustained_local = [safe_download(k) for k in sustained_keys if k.endswith('.wav')]

    sustained_analysis_results = analyze_sustained_vowel(sustained_local)
    metrics['sustained'] = sustained_analysis_results.get('metrics', {'error': 'Analysis failed for all sustained vowel recordings.'})
    spectrum_sustained = sustained_analysis_results.get('lpc_spectrum')
    chosen_sustained_path = sustained_analysis_results.get('chosen_file')
    if chosen_sustained_path:
        metrics['sustained']['source_file'] = os.path.basename(chosen_sustained_path)

    if chosen_sustained_path:
        buf = create_time_series_chart(chosen_sustained_path)
        if buf:
            ts_key = artifact_prefix + 'timeSeries.png'
            get_s3_client().upload_fileobj(buf, BUCKET, ts_key, ExtraArgs={'ContentType': 'image/png'})
            charts['timeSeries'] = f's3://{BUCKET}/{ts_key}'

    # Formant analysis from Step 4
    note_keys = audio_groups.get('4', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    note_local = [safe_download(k) for k in note_keys if k.endswith('.wav')]
    formant_low_metrics, formant_high_metrics = None, None
    spectrum_low, spectrum_high = None, None
    formant_analysis_failed = False

    if len(note_local) >= 1:
        formant_low_metrics = analyze_note_file_robust(note_local[0])
        metrics.setdefault('sustained', {})['formants_low'] = formant_low_metrics
        if 'error_details' in formant_low_metrics:
            formant_analysis_failed = True
        spectrum_low = get_lpc_spectrum(note_local[0])

    if len(note_local) >= 2:
        formant_high_metrics = analyze_note_file_robust(note_local[1])
        metrics.setdefault('sustained', {})['formants_high'] = formant_high_metrics
        if 'error_details' in formant_high_metrics:
            formant_analysis_failed = True
        spectrum_high = get_lpc_spectrum(note_local[1])

    # Create formant charts if data is available, otherwise create placeholders
    if formant_low_metrics or formant_high_metrics:
        formant_buf = create_formant_chart(formant_low_metrics, formant_high_metrics)
        if formant_buf:
            formant_key = artifact_prefix + 'formant.png'
            get_s3_client().upload_fileobj(formant_buf, BUCKET, formant_key, ExtraArgs={'ContentType': 'image/png'})
            charts['formant'] = f's3://{BUCKET}/{formant_key}'
    else:
        # This case handles when both formant analyses fail
        placeholder_buf = create_placeholder_chart('F1-F2 Vowel Space', 'Formant analysis failed for all inputs.')
        if placeholder_buf:
            formant_key = artifact_prefix + 'formant.png'
            get_s3_client().upload_fileobj(placeholder_buf, BUCKET, formant_key, ExtraArgs={'ContentType': 'image/png'})
            charts['formant'] = f's3://{BUCKET}/{formant_key}'

    if spectrum_low or spectrum_high or spectrum_sustained:
        formant_spl_buf = create_formant_spl_chart(spectrum_low, spectrum_high, spectrum_sustained)
        if formant_spl_buf:
            formant_spl_key = artifact_prefix + 'formant_spl_spectrum.png'
            get_s3_client().upload_fileobj(formant_spl_buf, BUCKET, formant_spl_key, ExtraArgs={'ContentType': 'image/png'})
            charts['formant_spl_spectrum'] = f's3://{BUCKET}/{formant_spl_key}'
    else:
        # 无频谱数据时也必须生成占位图，避免PDF缺失该图表
        reason_msg = 'Formant analysis failed.\nSee notes in report for details.' if formant_analysis_failed else '共振峰分析失败了。可能的原因包括：1. 发声问题：气声过重、声门不稳或发音不清晰，会让共振峰模糊。2. 个体特征：儿童、高音女声或极低音男声的共振峰频率分布特殊，容易超出软件默认参数范围。3.  病理因素：声带小结、麻痹等嗓音疾病，会使信号失真。4. 录音条件差：背景噪音、设备采样率不足、麦克风质量不佳。'
        placeholder_buf = create_placeholder_chart('Formant-SPL Spectrum (LPC)', reason_msg)
        if placeholder_buf:
            formant_spl_key = artifact_prefix + 'formant_spl_spectrum.png'
            get_s3_client().upload_fileobj(placeholder_buf, BUCKET, formant_spl_key, ExtraArgs={'ContentType': 'image/png'})
            charts['formant_spl_spectrum'] = f's3://{BUCKET}/{formant_spl_key}'

    if formant_analysis_failed:
        metrics.setdefault('sustained', {})['formant_analysis_failed'] = True

    # Reading (Step 5)
    reading_keys = audio_groups.get('5', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    reading_local=[safe_download(k) for k in reading_keys if k.endswith('.wav')]
    chosen_reading=pick_longest_file(reading_local)
    metrics['reading'] = analyze_speech_flow(chosen_reading) if chosen_reading else {'error':'no_reading_audio'}

    # Spontaneous (Step 6)
    spont_keys = audio_groups.get('6', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    spont_local=[safe_download(k) for k in spont_keys if k.endswith('.wav')]
    chosen_spont=pick_longest_file(spont_local)
    metrics['spontaneous'] = analyze_speech_flow(chosen_spont) if chosen_spont else {'error':'no_spontaneous_audio'}

    # Glide / VRP (Step 3)
    glide_keys = audio_groups.get('3', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    if glide_keys:
        glide_local=[safe_download(k) for k in glide_keys if k.endswith('.wav')]
        vrp = analyze_glide_files(glide_local)
        metrics['vrp']=vrp
        if isinstance(vrp, dict) and 'error' not in vrp:
            vrp_buf = create_vrp_chart(vrp)
            if vrp_buf:
                vrp_key = artifact_prefix+'vrp.png'
                get_s3_client().upload_fileobj(vrp_buf, BUCKET, vrp_key, ExtraArgs={'ContentType':'image/png'})
                charts['vrp']=f's3://{BUCKET}/{vrp_key}'
    else:
        metrics['vrp']={'error':'no_glide_audio'}

    # Process and add questionnaire scores
    if forms:
        processed_scores = {}
        rbh = forms.get('rbh')
        if rbh and isinstance(rbh, dict):
            processed_scores['RBH'] = {k: v for k, v in rbh.items() if v is not None}

        ovhs9 = forms.get('ovhs9')
        if ovhs9 and isinstance(ovhs9, list):
            # OVHS-9: 9 questions, scale 0-4. Max score 36.
            valid_scores = [s for s in ovhs9 if isinstance(s, int)]
            if len(valid_scores) == 9:
                processed_scores['OVHS-9 Total'] = sum(valid_scores)

        tvqg = forms.get('tvqg')
        if tvqg and isinstance(tvqg, list):
            # TVQ-G: 12 questions, scale 0-4. Max score 48.
            valid_scores = [s for s in tvqg if isinstance(s, int)]
            if len(valid_scores) == 12:
                total = sum(valid_scores)
                processed_scores['TVQ-G Total'] = total
                processed_scores['TVQ-G Percent'] = f"{total * 100 / 48:.0f}%"

        if processed_scores:
            metrics['questionnaires'] = processed_scores

    # PDF Report
    report_key = REPORT_KEY_TEMPLATE.format(sessionId=session_id)
    pdf_buf = create_pdf_report(session_id, metrics, charts, userInfo=userInfo)
    if pdf_buf:
        get_s3_client().upload_fileobj(pdf_buf, BUCKET, report_key, ExtraArgs={'ContentType': 'application/pdf'})
    report_url = f's3://{BUCKET}/{report_key}'

    return metrics, charts, report_url

# ---------- API Handlers ----------
def handle_create_session(event):
    userInfo = extract_user_info(event)
    user_id = userInfo.get('userId')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'User not authenticated'})}
    session_id = str(uuid.uuid4())
    try:
        get_table().put_item(Item={
            'sessionId': session_id,
            'userId': user_id,
            'status': 'created',
            'createdAt': int(datetime.utcnow().timestamp())
        })
        return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': json.dumps({'sessionId': session_id})}
    except ClientError as e:
        logger.error(f'create_session ddb error: {e}')
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not create session'})}

def handle_get_upload_url(event):
    userInfo = extract_user_info(event)
    user_id = userInfo.get('userId')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'User not authenticated'})}

    body = json.loads(event.get('body', '{}'))
    session_id = body.get('sessionId')
    if not all([session_id, body.get('step'), body.get('fileName')]):
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing required parameters'})}

    try:
        resp = get_table().get_item(Key={'sessionId': session_id})
        item = resp.get('Item')
        if not item or item.get('userId') != user_id:
            logger.warning(f"Forbidden upload attempt: user {user_id} to session {session_id}")
            return {'statusCode': 403, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Forbidden'})}

        object_key = f"voice-tests/{session_id}/raw/{body['step']}/{body['fileName']}"
        url = get_s3_client().generate_presigned_url('put_object', Params={
            'Bucket': BUCKET,
            'Key': object_key,
            'ContentType': body.get('contentType', 'audio/wav')
        }, ExpiresIn=3600)
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'putUrl': url, 'objectKey': object_key})}
    except ClientError as e:
        logger.error(f'handle_get_upload_url error: {e}')
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not generate upload URL'})}

def handle_analyze_trigger(event):
    body = json.loads(event.get('body', '{}'))
    session_id = body.get('sessionId')
    if not session_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing sessionId'})}

    async_payload = {
        'task': 'analyze',
        'sessionId': session_id,
        'body': body,
        'userInfo': extract_user_info(event)
    }

    try:
        get_table().update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET #st = :st, updatedAt = :u',
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':st': 'processing', ':u': int(datetime.utcnow().timestamp())}
        )

        get_lambda_client().invoke(
            FunctionName=FUNCTION_NAME,
            InvocationType='Event',  # Asynchronous invocation
            Payload=json.dumps(async_payload)
        )

        return {'statusCode': 202, 'headers': CORS_HEADERS, 'body': json.dumps({'status': 'queued', 'sessionId': session_id})}
    except Exception as e:
        logger.error(f'handle_analyze_trigger failed: {e}')
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Failed to queue analysis'})}

def generate_presigned_url_from_s3_uri(s3_uri: str, expiration: int = 3600) -> Optional[str]:
    """Parses an S3 URI and generates a presigned GET URL."""
    if not s3_uri or not s3_uri.startswith('s3://'):
        return None
    try:
        bucket_name, key = s3_uri[5:].split('/', 1)
        url = get_s3_client().generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': key},
            ExpiresIn=expiration
        )
        return url
    except (ValueError, ClientError) as e:
        logger.error(f"Failed to generate presigned URL for {s3_uri}: {e}")
        return None

def handle_get_results(event):
    userInfo = extract_user_info(event)
    user_id = userInfo.get('userId')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'User not authenticated'})}

    session_id = (event.get('pathParameters') or {}).get('sessionId')
    if not session_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing sessionId'})}

    try:
        resp = get_table().get_item(Key={'sessionId': session_id})
        item = resp.get('Item')
        if not item or item.get('userId') != user_id:
            logger.warning(f"Forbidden results access attempt: user {user_id} for session {session_id}")
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Session not found'})}

        # If analysis is done, convert S3 URIs to presigned URLs
        if item.get('status') == 'done':
            if 'charts' in item and isinstance(item['charts'], dict):
                for key, s3_uri in item['charts'].items():
                    item['charts'][key] = generate_presigned_url_from_s3_uri(s3_uri) or s3_uri

            if 'reportPdf' in item and isinstance(item['reportPdf'], str):
                item['reportPdf'] = generate_presigned_url_from_s3_uri(item['reportPdf']) or item['reportPdf']

        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(_from_dynamo(item), ensure_ascii=False)}
    except ClientError as e:
        logger.error(f'get_results ddb error: {e}')
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not fetch results'})}

# ---------- Async Task Handler ----------
def handle_analyze_task(event):
    session_id = event.get('sessionId')
    body = event.get('body', {})
    userInfo = event.get('userInfo', {'userId': None, 'userName': 'N/A'})
    user_id = userInfo.get('userId')
    logger.info(f"Starting async analysis for session {session_id}")

    try:
        metrics, charts, report_url = perform_full_analysis(
            session_id,
            calibration=body.get('calibration'),
            forms=body.get('forms'),
            userInfo=userInfo
        )

        get_table().update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET #st=:st, #mt=:m, #ch=:c, reportPdf=:r, updatedAt=:u',
            ExpressionAttributeNames={'#st': 'status', '#mt': 'metrics', '#ch': 'charts'},
            ExpressionAttributeValues={
                ':st': 'done',
                ':m': _to_dynamo(metrics),
                ':c': _to_dynamo(charts),
                ':r': report_url,
                ':u': int(datetime.utcnow().timestamp())
            }
        )

        if user_id and get_events_table():
            try:
                event_id = str(uuid.uuid4())
                now_iso = datetime.utcnow().isoformat() + 'Z'

                # 从 S3 URI 中提取对象键
                report_key = report_url.replace(f's3://{BUCKET}/', '') if report_url.startswith('s3://') else report_url

                # 准备 details 对象，严格遵循现有的数据结构，但修正数据源
                spontaneous_metrics = metrics.get('spontaneous', {})
                sustained_metrics = metrics.get('sustained', {})
                vrp_metrics = metrics.get('vrp', {})

                event_details = {
                    'notes': 'VFS Tracker Voice Analysis Tools 自动生成报告',
                    'appUsed': 'VFS Tracker Online Analysis',

                    # 修正：根据用户的精确要求，为顶层指标设置正确的数据源
                    'fundamentalFrequency': spontaneous_metrics.get('f0_mean'), # 来自自发语音
                    'jitter': sustained_metrics.get('jitter_local_percent'),     # 来自持续元音
                    'shimmer': sustained_metrics.get('shimmer_local_percent'),   # 来自持续元音
                    'hnr': sustained_metrics.get('hnr_db'),                      # 来自持续元音
                }

                # 保持顶层 formants 对象的现有结构
                formants_low = sustained_metrics.get('formants_low', {})
                if formants_low:
                    event_details['formants'] = {
                        'f1': formants_low.get('F1'),
                        'f2': formants_low.get('F2'),
                        'f3': formants_low.get('F3'),
                    }

                # 保持顶层 pitch 对象的现有结构
                if vrp_metrics and 'error' not in vrp_metrics:
                    event_details['pitch'] = {
                        'max': vrp_metrics.get('f0_max'),
                        'min': vrp_metrics.get('f0_min'),
                    }

                # 保持完整的 full_metrics 对象，以确保向后兼容
                event_details['full_metrics'] = metrics

                get_events_table().put_item(Item={
                    'userId': user_id,
                    'eventId': event_id,
                    'type': 'self_test',
                    'date': now_iso,
                    'details': _to_dynamo(event_details),
                    'status': 'pending',
                    'attachments': [{'fileUrl': report_key, 'fileType': 'application/pdf', 'fileName': 'voice_test_report.pdf'}],
                    'createdAt': now_iso,
                    'updatedAt': now_iso
                })
            except Exception as ee:
                logger.error(f'create event failed: {ee}')

    except Exception as e:
        logger.error(f'handle_analyze_task failed: {e}', exc_info=True)
        try:
            get_table().update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET #st=:st, errorMessage=:e, updatedAt=:u',
                ExpressionAttributeNames={'#st': 'status'},
                ExpressionAttributeValues={':st': 'failed', ':e': str(e), ':u': int(datetime.utcnow().timestamp())}
            )
        except Exception as ee:
            logger.error(f'Failed to update status to failed: {ee}')

# ---------- Main Handler & Router ----------
def handler(event, context):
    logger.info(f'Handler started. Request ID: {getattr(context, "aws_request_id", "N/A")}')

    if 'task' in event and event['task'] == 'analyze':
        handle_analyze_task(event)
        return {'status': 'ok', 'message': 'Analysis task finished.'}

    if not all([DDB_TABLE, BUCKET, get_table(), FUNCTION_NAME]):
        logger.error("Server misconfiguration: Missing critical environment variables.")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Server misconfiguration'})}

    rc = event.get('requestContext', {}) or {}
    http_ctx = rc.get('http', {}) or {}
    method = http_ctx.get('method') or event.get('httpMethod')
    path = (event.get('rawPath') or http_ctx.get('path') or event.get('path', '')).split('?')[0]

    if method == 'OPTIONS':
        return {'statusCode': 204, 'headers': CORS_HEADERS, 'body': ''}
    if method == 'POST' and path.endswith('/sessions'):
        return handle_create_session(event)
    if method == 'POST' and path.endswith('/uploads'):
        return handle_get_upload_url(event)
    if method == 'POST' and path.endswith('/analyze'):
        return handle_analyze_trigger(event)
    if method == 'GET' and '/results/' in path:
        return handle_get_results(event)

    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not Found'})}

# Helper functions from original code that are still needed
def list_session_audio_keys(session_id: str):
    prefix = RAW_PREFIX_TEMPLATE.format(sessionId=session_id)
    paginator = get_s3_client().get_paginator('list_objects_v2')
    groups = {}
    for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
        for obj in page.get('Contents', []) or []:
            key = obj['Key']
            parts = key[len(prefix):].split('/')
            if len(parts) < 2:
                continue
            step_id = parts[0]
            groups.setdefault(step_id, []).append(key)
    return groups

def safe_download(key: str) -> str:
    local_path = os.path.join(TMP_BASE, key.replace('/', '_'))
    try:
        get_s3_client().download_file(BUCKET, key, local_path)
        return local_path
    except Exception as e:
        logger.error(f'safe_download: Failed to download key={key} err={e}')
        return ''

def pick_longest_file(local_paths):
    import wave
    best_path, max_duration = None, -1
    for p in local_paths:
        if not p: continue
        try:
            with wave.open(p, 'rb') as w:
                duration = w.getnframes() / float(w.getframerate())
            if duration > max_duration:
                best_path, max_duration = p, duration
        except Exception as e:
            logger.warning(f'pick_longest_file: Could not read {p}: {e}')
    return best_path
