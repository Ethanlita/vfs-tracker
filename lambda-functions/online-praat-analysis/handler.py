import json
import logging
import os
import uuid
import base64
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
from io import BytesIO

# Configure logging
log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
logger = logging.getLogger()
logger.setLevel(log_level)

# AWS Clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Environment variables
DDB_TABLE = os.environ.get('DDB_TABLE')
BUCKET = os.environ.get('BUCKET')
EVENTS_TABLE = os.environ.get('EVENTS_TABLE', 'VoiceFemEvents')

table = dynamodb.Table(DDB_TABLE) if DDB_TABLE else None
events_table = dynamodb.Table(EVENTS_TABLE) if EVENTS_TABLE else None

# --- CORS Headers --- 
# Define CORS headers here to be reused in all responses
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', # For development. In production, use a specific origin like 'http://localhost:4173'
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
}

def _decode_jwt_no_verify(token: str) -> Optional[dict]:
    """本地解析JWT Payload（不做签名校验，仅用于提取sub/nickname等基本字段）。"""
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None
        payload_b64 = parts[1] + '=='  # 补齐padding
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        return json.loads(payload_json)
    except Exception as e:
        logger.debug(f"_decode_jwt_no_verify: 解析失败: {e}")
        return None

def extract_user_id(event) -> Optional[str]:
    """尽可能从多种来源提取 userId(sub)。
    优先顺序：
    1. HTTP API JWT Authorizer: event.requestContext.authorizer.jwt.claims.sub
    2. 其它 Authorizer:          event.requestContext.authorizer.claims.sub
    3. 直接解析 Authorization: Bearer <ID Token>
    """
    rc = event.get('requestContext', {})
    # 路径1：HTTP API JWT Authorizer
    sub = rc.get('authorizer', {}).get('jwt', {}).get('claims', {}).get('sub')
    if sub:
        logger.debug('extract_user_id: 使用 http.authorizer.jwt.claims.sub')
        return sub
    # 路径2：REST / 自定义 Lambda Authorizer 兼容
    sub = rc.get('authorizer', {}).get('claims', {}).get('sub')
    if sub:
        logger.debug('extract_user_id: 使用 authorizer.claims.sub')
        return sub
    # 路径3：解析 Authorization 头
    headers = event.get('headers', {}) or {}
    auth_header = headers.get('Authorization') or headers.get('authorization')
    if auth_header and auth_header.lower().startswith('bearer '):
        token = auth_header.split(' ', 1)[1].strip()
        payload = _decode_jwt_no_verify(token)
        if payload and payload.get('token_use') in ('id', 'access') and payload.get('sub'):
            logger.debug('extract_user_id: 通过解析JWT获得sub')
            return payload.get('sub')
    logger.warning('extract_user_id: 未找到用户sub')
    return None

def handle_create_session(event):
    logger.info("handle_create_session: Received request to create a new session.")
    user_id = extract_user_id(event)
    if not user_id:
        logger.error("handle_create_session: User not authenticated. No userId extracted.")
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'User not authenticated'})}
    
    session_id = str(uuid.uuid4())
    try:
        logger.info(f"handle_create_session: Creating session {session_id} for user {user_id}.")
        table.put_item(
            Item={
                'sessionId': session_id,
                'userId': user_id,
                'status': 'created',
                'createdAt': int(datetime.utcnow().timestamp())
            }
        )
        logger.info(f"handle_create_session: Successfully created session {session_id}.")
        return {'statusCode': 201, 'headers': CORS_HEADERS, 'body': json.dumps({'sessionId': session_id})}
    except ClientError as e:
        logger.error(f"handle_create_session: DynamoDB ClientError. Error: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not create session'})}

def handle_get_upload_url(event):
    logger.info("handle_get_upload_url: Received request to generate a pre-signed URL.")
    body = json.loads(event.get('body', '{}'))
    if not all(k in body for k in ['sessionId', 'step', 'fileName']):
        logger.warning("handle_get_upload_url: Missing required parameters.")
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing required parameters'})}

    object_key = f"voice-tests/{body['sessionId']}/raw/{body['step']}/{body['fileName']}"
    try:
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': BUCKET, 'Key': object_key, 'ContentType': body.get('contentType', 'audio/wav')},
            ExpiresIn=3600
        )
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'putUrl': url, 'objectKey': object_key})}
    except ClientError as e:
        logger.error(f"handle_get_upload_url: S3 ClientError. Error: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not generate upload URL'})}

STEP_MAP = {
    '1': 'calibration',   # 设备与环境校准（可能含静音/标准句）
    '2': 'sustained',     # MPT + 稳定元音 (/a/ 两次)
    '3': 'glide',         # 上/下滑音
    '4': 'notes',         # note_low / note_high
    '5': 'reading',       # 朗读
    '6': 'spontaneous'    # 自由说话
}

RAW_PREFIX_TEMPLATE = 'voice-tests/{sessionId}/raw/'
ARTIFACT_PREFIX_TEMPLATE = 'voice-tests/{sessionId}/artifacts/'
REPORT_KEY_TEMPLATE = 'voice-tests/{sessionId}/report.pdf'

MAX_DOWNLOAD_FILES_PER_STEP = 10  # 安全限制，防止过多文件
TMP_BASE = '/tmp'


def list_session_audio_keys(session_id: str):
    """列出该 session 下所有 raw 音频 S3 Key，按 step 文件夹分组。
    返回: dict(stepId(str) -> [keys])
    """
    prefix = RAW_PREFIX_TEMPLATE.format(sessionId=session_id)
    paginator = s3_client.get_paginator('list_objects_v2')
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
    """下载 S3 对象到 /tmp 并返回本地路径。"""
    local_path = os.path.join(TMP_BASE, key.replace('/', '_'))
    try:
        s3_client.download_file(BUCKET, key, local_path)
        return local_path
    except Exception as e:
        logger.error(f'safe_download: 下载失败 key={key} err={e}')
        return ''


def pick_longest_file(local_paths):
    """从本地文件列表中挑选时长最长的 wav（用于 sustained 等）。"""
    import wave
    best = None
    best_dur = -1
    for p in local_paths:
        if not p:
            continue
        try:
            with wave.open(p, 'rb') as w:
                frames = w.getnframes()
                rate = w.getframerate()
                dur = frames / float(rate) if rate else 0
            if dur > best_dur:
                best = p; best_dur = dur
        except Exception as e:
            logger.warning(f'pick_longest_file: 无法读取 {p}: {e}')
    return best


def perform_full_analysis(session_id: str, calibration: dict | None = None, forms: dict | None = None):
    """执行完整分析：
    1. 列出所有原始音频
    2. 按步骤下载并调用具体分析函数
    3. 生成图表与 PDF
    返回: metrics(dict), chart_s3_urls(dict), report_s3_url(str)
    """
    from analysis import analyze_sustained_wav, analyze_speech_flow, analyze_glide_files, analyze_note_file
    from artifacts import create_time_series_chart, create_vrp_chart, create_pdf_report

    audio_groups = list_session_audio_keys(session_id)
    logger.info(f'perform_full_analysis: 列出音频分组 { {k: len(v) for k,v in audio_groups.items()} }')

    metrics = {}
    chart_urls = {}
    artifact_prefix = ARTIFACT_PREFIX_TEMPLATE.format(sessionId=session_id)

    calib_offset = 0.0
    calib_used = False
    if calibration and calibration.get('hasExternal') and isinstance(calibration.get('calibOffsetDb'), (int, float)):
        calib_offset = float(calibration.get('calibOffsetDb'))
        calib_used = True

    # 1) Sustained (step 2)
    sustained_keys = audio_groups.get('2', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    sustained_local = [safe_download(k) for k in sustained_keys if k.endswith('.wav')]
    chosen_sustained = pick_longest_file(sustained_local)
    if chosen_sustained:
        sus_metrics = analyze_sustained_wav(chosen_sustained) or {}
        if sus_metrics and 'spl_dbA_est' in sus_metrics:
            sus_metrics['spl_dbA'] = round(sus_metrics['spl_dbA_est'] + calib_offset, 2)
            sus_metrics['spl_calibrated'] = calib_used
        metrics['sustained'] = sus_metrics
        # 生成时间序列图
        ts_buf = create_time_series_chart(chosen_sustained)
        if ts_buf:
            ts_key = artifact_prefix + 'timeSeries.png'
            s3_client.upload_fileobj(ts_buf, BUCKET, ts_key, ExtraArgs={'ContentType': 'image/png'})
            chart_urls['timeSeries'] = f's3://{BUCKET}/{ts_key}'
    else:
        metrics['sustained'] = {'error': 'no_sustained_audio'}

    # 2) Reading (step 5)
    reading_keys = audio_groups.get('5', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    reading_local = [safe_download(k) for k in reading_keys if k.endswith('.wav')]
    chosen_reading = pick_longest_file(reading_local)
    if chosen_reading:
        r_metrics = analyze_speech_flow(chosen_reading) or {}
        metrics['reading'] = r_metrics
    else:
        metrics['reading'] = {'error': 'no_reading_audio'}

    # 3) Spontaneous (step 6)
    spontaneous_keys = audio_groups.get('6', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    spont_local = [safe_download(k) for k in spontaneous_keys if k.endswith('.wav')]
    chosen_spont = pick_longest_file(spont_local)
    if chosen_spont:
        s_metrics = analyze_speech_flow(chosen_spont) or {}
        metrics['spontaneous'] = s_metrics
    else:
        metrics['spontaneous'] = {'error': 'no_spontaneous_audio'}

    # 4) VRP / glide (step 3) 真实基础实现
    glide_keys = audio_groups.get('3', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    if glide_keys:
        glide_local = [safe_download(k) for k in glide_keys if k.endswith('.wav')]
        vrp_data = analyze_glide_files(glide_local)
        if isinstance(vrp_data, dict) and 'error' not in vrp_data:
            vrp_buf = create_vrp_chart(vrp_data)
            if vrp_buf:
                vrp_key = artifact_prefix + 'vrp.png'
                s3_client.upload_fileobj(vrp_buf, BUCKET, vrp_key, ExtraArgs={'ContentType': 'image/png'})
                chart_urls['vrp'] = f's3://{BUCKET}/{vrp_key}'
        metrics['vrp'] = vrp_data
    else:
        metrics['vrp'] = {'error': 'no_glide_audio'}

    # 5) Notes (step 4) 分析两个或多个稳定音，按f0排序低/高
    note_keys = audio_groups.get('4', [])[:MAX_DOWNLOAD_FILES_PER_STEP]
    if note_keys:
        note_local = [safe_download(k) for k in note_keys if k.endswith('.wav')]
        analyzed = []
        for p in note_local:
            res = analyze_note_file(p)
            if res and 'f0_mean' in res:
                if calib_used and 'spl_dbA_est' in res:
                    res['spl_dbA'] = round(res['spl_dbA_est'] + calib_offset, 2)
                    res['spl_calibrated'] = True
                analyzed.append(res)
        analyzed.sort(key=lambda x: x.get('f0_mean', 0))
        if len(analyzed) >= 2:
            metrics['notes'] = {'low': analyzed[0], 'high': analyzed[-1], 'count': len(analyzed)}
        elif analyzed:
            metrics['notes'] = {'only': analyzed[0], 'count': 1}
        else:
            metrics['notes'] = {'error': 'analysis_failed'}
    else:
        metrics['notes'] = {'error': 'no_note_audio'}

    # 6) Calibration (step 1) 简单记录文件数
    calib_keys = audio_groups.get('1', [])
    metrics['calibration'] = {'files': len(calib_keys), 'externalOffsetDb': calib_offset, 'externalUsed': calib_used} if calib_keys or calib_used else {'error': 'no_calibration_audio'}

    # 7) DSI 计算（依赖 sustained / vrp ）
    try:
        mpt = metrics.get('sustained', {}).get('mpt_s') or 0
        f0_high = metrics.get('vrp', {}).get('f0_max') or metrics.get('notes', {}).get('high', {}).get('f0_mean') or 0
        I_low = metrics.get('vrp', {}).get('spl_min') or metrics.get('sustained', {}).get('spl_dbA') or 0
        jitter = metrics.get('sustained', {}).get('jitter_local_percent') or 0
        dsi = 0.13 * mpt + 0.0053 * f0_high - 0.26 * I_low - 1.18 * jitter + 12.4
        metrics['dsi'] = {'value': round(dsi, 2), 'mpt': mpt, 'f0_high': f0_high, 'I_low': I_low, 'jitter_percent': jitter}
    except Exception as e:
        metrics['dsi'] = {'error': str(e)}

    # 8) forms (问卷) 原样存储
    if forms:
        metrics['forms'] = forms

    # PDF 报告
    report_key = REPORT_KEY_TEMPLATE.format(sessionId=session_id)
    pdf_buf = create_pdf_report(session_id, metrics, chart_urls)
    if pdf_buf:
        s3_client.upload_fileobj(pdf_buf, BUCKET, report_key, ExtraArgs={'ContentType': 'application/pdf'})
        report_s3_url = f's3://{BUCKET}/{report_key}'
    else:
        report_s3_url = f's3://{BUCKET}/{report_key}'  # 即使失败也占位

    return metrics, chart_urls, report_s3_url

def handle_analyze(event):
    # 替换为真正的分析调用
    logger.info("handle_analyze: Received request to analyze a session.")
    body = json.loads(event.get('body', '{}'))
    session_id = body.get('sessionId')
    if not session_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing sessionId'})}

    calibration = body.get('calibration') or {}
    forms = body.get('forms') or {}

    try:
        metrics, chart_urls, report_s3_url = perform_full_analysis(session_id, calibration=calibration, forms=forms)

        # 更新 session
        table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression="SET #st=:st, metrics=:m, charts=:c, reportPdf=:r, updatedAt=:u",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={
                ':st': 'done',
                ':m': metrics,
                ':c': chart_urls,
                ':r': report_s3_url,
                ':u': int(datetime.utcnow().timestamp())
            }
        )

        # 写入事件
        try:
            event_id = str(uuid.uuid4())
            now_iso = datetime.utcnow().isoformat() + 'Z'
            events_table.put_item(Item={
                'userId': user_id,
                'eventId': event_id,
                'type': '自我测试',
                'date': now_iso,
                'details': 'VFS Tracker Voice Analysis Tools 自动生成报告',
                'status': 'pending',
                'attachments': [
                    {'fileUrl': report_s3_url, 'fileType': 'application/pdf', 'fileName': 'voice_test_report.pdf'}
                ],
                'createdAt': now_iso,
                'updatedAt': now_iso
            })
        except Exception as e:
            logger.error(f'handle_analyze: 创建事件失败: {e}')

        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'status': 'done', 'sessionId': session_id, 'reportPdf': report_s3_url, 'charts': chart_urls, 'metrics': metrics})}
    except Exception as e:
        logger.error(f"handle_analyze: Analysis pipeline FAILED. Error: {e}")
        try:
            table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression="SET #st=:st, errorMessage=:e, updatedAt=:u",
                ExpressionAttributeNames={'#st': 'status'},
                ExpressionAttributeValues={
                    ':st': 'failed',
                    ':e': str(e),
                    ':u': int(datetime.utcnow().timestamp())
                }
            )
        except Exception as ee:
            logger.error(f"handle_analyze: 更新失败状态时出错: {ee}")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Analysis failed'})}

def handle_get_results(event):
    logger.info("handle_get_results: Received request to fetch results.")
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Missing sessionId'})}
    
    try:
        response = table.get_item(Key={'sessionId': session_id})
        item = response.get('Item')
        if not item:
            return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Session not found'})}
        
        # Convert DynamoDB Decimal to Python int/float
        item = {k: (float(v) if isinstance(v, boto3.dynamodb.types.Decimal) else v) for k, v in item.items()}
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(item, default=str)}
    except ClientError as e:
        logger.error(f"handle_get_results: DynamoDB ClientError. Error: {e}")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Could not fetch results'})}

# 辅助：规范化路径，去掉 stage 前缀（如 /dev/xxx -> /xxx）
def _normalize_path(path_val: str, stage: Optional[str]) -> str:
    if not path_val:
        return path_val
    if stage and path_val.startswith(f'/{stage}/'):
        return path_val[len(stage)+1:]  # 保留前导斜杠后的部分
    if stage and path_val == f'/{stage}':
        return '/'  # 访问根
    return path_val

# 事件日志函数：输出关键字段（避免过长且可后期扩展）
def log_incoming_event(event):
    try:
        rc = event.get('requestContext', {}) or {}
        http_ctx = rc.get('http', {}) or {}
        stage = rc.get('stage')
        # 方法多渠道
        method = http_ctx.get('method') or event.get('httpMethod') or rc.get('httpMethod')
        # 路径多渠道
        raw_path = event.get('rawPath') or http_ctx.get('path') or event.get('path') or rc.get('resourcePath') or rc.get('path') or rc.get('requestPath')
        norm_path = _normalize_path(raw_path, stage)
        # claims 多渠道
        jwt_claims = rc.get('authorizer', {}).get('jwt', {}).get('claims', {}) or {}
        direct_claims = rc.get('authorizer', {}).get('claims', {}) or {}
        merged_keys = list({*jwt_claims.keys(), *direct_claims.keys()})
        headers = event.get('headers', {}) or {}
        auth_present = any(h.lower() == 'authorization' for h in headers.keys())
        body_len = len(event.get('body', '') or '')
        logger.info(json.dumps({
            'logType': 'IncomingEvent',
            'stage': stage,
            'method': method,
            'rawPath': raw_path,
            'normalizedPath': norm_path,
            'hasAuthorizationHeader': auth_present,
            'claimKeys': merged_keys,
            'bodyLength': body_len,
            'pathParameters': event.get('pathParameters') or {},
            'queryStringParameters': event.get('queryStringParameters') or {}
        }, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"log_incoming_event: 记录事件时出错: {e}")

def handler(event, context):
    logger.info(f"Handler started. Request ID: {context.aws_request_id}")
    # 完整事件（可能较大，可调LOG_LEVEL控制）
    logger.debug('Full event dump start')
    logger.debug(json.dumps(event))
    log_incoming_event(event)  # INFO级别事件快照

    if not all([DDB_TABLE, BUCKET, table]):
        logger.critical("FATAL: Environment variables are not set.")
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Server misconfiguration'})}

    rc = event.get('requestContext', {}) or {}
    http_ctx = rc.get('http', {}) or {}
    stage = rc.get('stage')
    http_method = http_ctx.get('method') or event.get('httpMethod') or rc.get('httpMethod')
    raw_path = event.get('rawPath') or http_ctx.get('path') or event.get('path') or rc.get('resourcePath') or rc.get('path')
    path = _normalize_path(raw_path, stage)

    logger.info(f"Routing request: Method={http_method}, RawPath={raw_path}, NormalizedPath={path}")

    # Handle OPTIONS pre-flight requests sent by browsers
    if http_method == 'OPTIONS':
        logger.info("Responding to OPTIONS pre-flight request")
        return {'statusCode': 204, 'headers': CORS_HEADERS, 'body': ''}

    if http_method == 'POST' and path == '/sessions':
        return handle_create_session(event)
    elif http_method == 'POST' and path == '/uploads':
        return handle_get_upload_url(event)
    elif http_method == 'POST' and path == '/analyze':
        return handle_analyze(event)
    elif http_method == 'GET' and path and path.startswith('/results/'):
        return handle_get_results(event)
    else:
        logger.warning(f"Route not found for Method={http_method}, NormalizedPath={path} (RawPath={raw_path}).")
        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not Found'})}
