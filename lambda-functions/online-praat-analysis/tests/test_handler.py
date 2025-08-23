
import os
import json
import boto3
import pytest
from moto import mock_aws
from .. import handler

# --- Test Fixtures ---

@pytest.fixture(scope='function')
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

@pytest.fixture(scope='function')
def mocked_aws_services(aws_credentials):
    """Set up mocked S3 and DynamoDB for the duration of a test function."""
    with mock_aws():
        # Mock S3
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket=handler.BUCKET)
        
        # Mock DynamoDB
        dynamodb = boto3.client('dynamodb', region_name='us-east-1')
        dynamodb.create_table(
            TableName=handler.DDB_TABLE,
            KeySchema=[{'AttributeName': 'sessionId', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'sessionId', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
        )
        yield s3, dynamodb

@pytest.fixture
def mock_api_gateway_event():
    """Creates a mock API Gateway event."""
    def _create_event(method, path, body=None, path_params=None):
        event = {
            'requestContext': {
                'http': {
                    'method': method,
                },
                'authorizer': { # Mock cognito authorizer
                    'jwt': {
                        'claims': {
                            'sub': 'mock-user-id-12345'
                        }
                    }
                }
            },
            'rawPath': path,
            'body': json.dumps(body) if body else None,
            'pathParameters': path_params if path_params else None
        }
        return event
    return _create_event

# --- Test Cases ---

def test_handle_create_session(mocked_aws_services, mock_api_gateway_event):
    """Test the POST /sessions endpoint."""
    s3, dynamodb = mocked_aws_services
    event = mock_api_gateway_event('POST', '/sessions')
    
    response = handler.handler(event, None)
    
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert 'sessionId' in body
    session_id = body['sessionId']

    # Verify item was created in DynamoDB
    table = boto3.resource('dynamodb').Table(handler.DDB_TABLE)
    item = table.get_item(Key={'sessionId': session_id}).get('Item')
    assert item is not None
    assert item['status'] == 'created'
    assert item['userId'] == 'mock-user-id-12345'

def test_handle_get_upload_url(mocked_aws_services, mock_api_gateway_event):
    """Test the POST /uploads endpoint."""
    event = mock_api_gateway_event('POST', '/uploads', body={
        'sessionId': 'test-session-123',
        'step': 'sustained_vowel',
        'fileName': 'test.wav',
        'contentType': 'audio/wav'
    })
    
    response = handler.handler(event, None)
    
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'putUrl' in body
    assert 'objectKey' in body
    assert 'voice-tests/test-session-123/raw/sustained_vowel/test.wav' in body['putUrl']

def test_full_analysis_pipeline(mocked_aws_services, mock_api_gateway_event, dummy_wav_file):
    """Test the entire analysis flow from /analyze to /results."""
    s3_client, _ = mocked_aws_services
    sustained_path, reading_path = dummy_wav_file
    session_id = 'full-pipeline-test'

    # 1. Manually set up the state as if files were uploaded
    sustained_key = f"voice-tests/{session_id}/raw/sustained_vowel/recording.wav"
    reading_key = f"voice-tests/{session_id}/raw/reading/recording.wav"
    s3_client.upload_file(sustained_path, handler.BUCKET, sustained_key)
    s3_client.upload_file(reading_path, handler.BUCKET, reading_key)

    table = boto3.resource('dynamodb').Table(handler.DDB_TABLE)
    table.put_item(Item={'sessionId': session_id, 'status': 'created'})

    # 2. Trigger analysis
    analyze_event = mock_api_gateway_event('POST', '/analyze', body={'sessionId': session_id})
    analyze_response = handler.handler(analyze_event, None)
    assert analyze_response['statusCode'] == 200

    # 3. Verify artifacts were created in S3
    artifacts_prefix = f"voice-tests/{session_id}/artifacts/"
    s3_objects = s3_client.list_objects_v2(Bucket=handler.BUCKET, Prefix=artifacts_prefix)
    assert len(s3_objects['Contents']) >= 2 # Should have at least time_series.png and report.pdf

    # 4. Poll for results
    results_event = mock_api_gateway_event('GET', f'/results/{session_id}', path_params={'sessionId': session_id})
    results_response = handler.handler(results_event, None)
    assert results_response['statusCode'] == 200
    
    body = json.loads(results_response['body'])
    assert body['status'] == 'done'
    assert 'metrics' in body
    assert 'charts' in body
    assert 'reportPdf' in body
    assert 'sustained' in body['metrics']
    assert 'reading' in body['metrics']
    assert body['metrics']['sustained']['f0_mean'] > 0
