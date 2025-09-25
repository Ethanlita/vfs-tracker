import os
import json
import boto3
import pytest
from moto import mock_aws
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import handler
from handler import _from_dynamo

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
    os.environ['BUCKET'] = 'mock-bucket'
    os.environ['DDB_TABLE'] = 'mock-table'
    os.environ['EVENTS_TABLE'] = 'mock-events-table'
    os.environ['AWS_LAMBDA_FUNCTION_NAME'] = 'mock-function'

    import importlib
    importlib.reload(handler)

    with mock_aws():
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket=handler.BUCKET)
        
        dynamodb = boto3.client('dynamodb', region_name='us-east-1')
        dynamodb.create_table(
            TableName=handler.DDB_TABLE,
            KeySchema=[{'AttributeName': 'sessionId', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'sessionId', 'AttributeType': 'S'}],
            ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
        )
        dynamodb.create_table(
            TableName=handler.EVENTS_TABLE,
            KeySchema=[{'AttributeName': 'userId', 'KeyType': 'HASH'}, {'AttributeName': 'eventId', 'KeyType': 'RANGE'}],
            AttributeDefinitions=[
                {'AttributeName': 'userId', 'AttributeType': 'S'},
                {'AttributeName': 'eventId', 'AttributeType': 'S'}
            ],
            ProvisionedThroughput={'ReadCapacityUnits': 1, 'WriteCapacityUnits': 1}
        )
        yield s3, dynamodb

@pytest.fixture
def mock_api_gateway_event():
    """Creates a mock API Gateway event."""
    def _create_event(method, path, body=None, path_params=None):
        event = {
            'requestContext': { 'http': { 'method': method, },
                'authorizer': { 'jwt': { 'claims': { 'sub': 'mock-user-id-12345' } } }
            },
            'rawPath': path,
            'body': json.dumps(body) if body else None,
            'pathParameters': path_params if path_params else None
        }
        return event
    return _create_event

# --- Test Cases ---

def test_handle_create_session(mocked_aws_services, mock_api_gateway_event):
    s3, dynamodb = mocked_aws_services
    event = mock_api_gateway_event('POST', '/sessions')
    response = handler.handler(event, None)
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert 'sessionId' in body
    table = boto3.resource('dynamodb').Table(handler.DDB_TABLE)
    item = table.get_item(Key={'sessionId': body['sessionId']}).get('Item')
    assert item is not None
    assert item['status'] == 'created'

def test_handle_get_upload_url(mocked_aws_services, mock_api_gateway_event):
    table = boto3.resource('dynamodb').Table(handler.DDB_TABLE)
    table.put_item(Item={'sessionId': 'test-session-123', 'userId': 'mock-user-id-12345'})
    event = mock_api_gateway_event('POST', '/uploads', body={
        'sessionId': 'test-session-123', 'step': '2', 'fileName': 'test.wav'
    })
    response = handler.handler(event, None)
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'putUrl' in body

def test_end_to_end_with_known_audio(mocked_aws_services, tmp_path_factory):
    from .conftest import generate_realistic_vowel
    tmp_path = tmp_path_factory.mktemp("e2e_audio")

    # Create files for each step
    sustained_audio_path = tmp_path / "sustained_vowel.wav"
    generate_realistic_vowel(str(sustained_audio_path), f0=200.0, duration=4.0)

    low_note_f0 = 150.0
    low_note_formants = [(500, 80), (1500, 100)]
    low_note_audio_path = tmp_path / "low_note.wav"
    generate_realistic_vowel(str(low_note_audio_path), f0=low_note_f0, formants=low_note_formants)

    high_note_f0 = 300.0
    high_note_formants = [(600, 90), (1800, 110)]
    high_note_audio_path = tmp_path / "high_note.wav"
    generate_realistic_vowel(str(high_note_audio_path), f0=high_note_f0, formants=high_note_formants)

    s3_client, _ = mocked_aws_services
    session_id = 'e2e-test-session'

    s3_client.upload_file(sustained_audio_path, handler.BUCKET, f"voice-tests/{session_id}/raw/2/sustained.wav")
    # Upload both notes to step '4'
    s3_client.upload_file(low_note_audio_path, handler.BUCKET, f"voice-tests/{session_id}/raw/4/low_note.wav")
    s3_client.upload_file(high_note_audio_path, handler.BUCKET, f"voice-tests/{session_id}/raw/4/high_note.wav")

    table = boto3.resource('dynamodb').Table(handler.DDB_TABLE)
    table.put_item(Item={'sessionId': session_id, 'status': 'created', 'userId': 'mock-user-id-12345'})

    async_event = {
        'task': 'analyze', 'sessionId': session_id,
        'body': {'forms': {}, 'calibration': {}},
        'userInfo': {'userId': 'mock-user-id-12345', 'userName': 'Mock User'}
    }
    handler.handle_analyze_task(async_event)

    results_item = table.get_item(Key={'sessionId': session_id}).get('Item')
    assert results_item is not None
    assert results_item['status'] == 'done'

    # Check that the SPL chart was created even on failure
    artifact_prefix = f"voice-tests/{session_id}/artifacts/"
    s3_objects = s3_client.list_objects_v2(Bucket=handler.BUCKET, Prefix=artifact_prefix)
    artifact_keys = [obj['Key'] for obj in s3_objects.get('Contents', [])]
    assert (artifact_prefix + 'formant_spl_spectrum.png') in artifact_keys

    metrics = _from_dynamo(results_item['metrics'])

    sustained_metrics = metrics.get('sustained', {})
    assert 'error' not in sustained_metrics
    assert abs(sustained_metrics.get('mpt_s', 0) - 3.9) < 0.2
    assert abs(sustained_metrics.get('f0_mean', 0) - 200.0) < 10

    # Assert that the sustained vowel now has its own formant analysis
    formants_sustained = sustained_metrics.get('formants_sustained', {})
    assert 'error' not in formants_sustained and 'error_details' not in formants_sustained, \
        f"Sustained vowel formant analysis failed: {formants_sustained.get('reason')}"
    assert abs(formants_sustained.get('f0_mean', 0) - 200.0) < 10

    # Assert that the note formants are now at the top level of the metrics
    formants_low_actual = metrics.get('formants_low', {})
    assert 'error' not in formants_low_actual and 'error_details' not in formants_low_actual, \
        f"Low note formant analysis failed unexpectedly: {formants_low_actual.get('reason')}"
    assert abs(formants_low_actual.get('f0_mean', 0) - low_note_f0) < 10
    assert abs(formants_low_actual.get('F1', 0) - low_note_formants[0][0]) < 75
    assert abs(formants_low_actual.get('F2', 0) - low_note_formants[1][0]) < 150

    formants_high_actual = metrics.get('formants_high', {})
    assert 'error' not in formants_high_actual and 'error_details' not in formants_high_actual, \
        f"High note formant analysis failed unexpectedly: {formants_high_actual.get('reason')}"
    assert abs(formants_high_actual.get('f0_mean', 0) - high_note_f0) < 15
    assert abs(formants_high_actual.get('F1', 0) - high_note_formants[0][0]) < 75
    assert abs(formants_high_actual.get('F2', 0) - high_note_formants[1][0]) < 150


def test_sort_and_select_notes(tmp_path):
    """Tests the note selection logic based on creation time."""
    import time
    from handler import _sort_and_select_notes

    # Create files with a slight delay to ensure different ctimes
    file1 = tmp_path / "first.wav"
    file1.touch()
    time.sleep(0.01)
    file2 = tmp_path / "second.wav"
    file2.touch()
    time.sleep(0.01)
    file3 = tmp_path / "third.wav"
    file3.touch()

    paths = [str(file2), str(file3), str(file1)] # Unordered list

    low_note, high_note = _sort_and_select_notes(paths)

    # The function sorts alphabetically. 'first.wav' is returned as the high_note, 'second.wav' as the low_note.
    assert os.path.basename(high_note) == "first.wav"
    assert os.path.basename(low_note) == "second.wav"

    # Test with one file
    low_note, high_note = _sort_and_select_notes([str(file2)])
    assert high_note is not None and os.path.basename(high_note) == "second.wav"
    assert low_note is None

    # Test with empty list
    low_note, high_note = _sort_and_select_notes([])
    assert low_note is None
    assert high_note is None
