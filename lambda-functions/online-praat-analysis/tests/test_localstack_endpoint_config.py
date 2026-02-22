"""LocalStack endpoint configuration tests.

[CN] 本文件验证在线 Praat Lambda 在本地集成测试场景下的端点解析优先级，
确保 LocalStack 配置不会破坏默认生产配置。
"""

import importlib
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import handler


def test_endpoint_resolution_priority(monkeypatch):
    """`AWS_S3_ENDPOINT_URL` should take highest priority for S3."""
    monkeypatch.setenv('USE_LOCALSTACK', 'true')
    monkeypatch.setenv('LOCALSTACK_ENDPOINT', 'http://localhost:4566')
    monkeypatch.setenv('AWS_ENDPOINT_URL', 'http://shared-endpoint:4566')
    monkeypatch.setenv('AWS_S3_ENDPOINT_URL', 'http://s3-only-endpoint:4566')

    importlib.reload(handler)
    assert handler._resolve_service_endpoint('s3') == 'http://s3-only-endpoint:4566'


def test_endpoint_resolution_shared_fallback(monkeypatch):
    """`AWS_ENDPOINT_URL` should be used when no service-specific override exists."""
    monkeypatch.delenv('AWS_S3_ENDPOINT_URL', raising=False)
    monkeypatch.setenv('AWS_ENDPOINT_URL', 'http://shared-endpoint:4566')
    monkeypatch.setenv('USE_LOCALSTACK', 'false')

    importlib.reload(handler)
    assert handler._resolve_service_endpoint('s3') == 'http://shared-endpoint:4566'
    assert handler._resolve_service_endpoint('dynamodb') == 'http://shared-endpoint:4566'


def test_endpoint_resolution_localstack_fallback(monkeypatch):
    """`LOCALSTACK_ENDPOINT` should be used when `USE_LOCALSTACK=true` and no explicit endpoints."""
    monkeypatch.delenv('AWS_S3_ENDPOINT_URL', raising=False)
    monkeypatch.delenv('AWS_ENDPOINT_URL', raising=False)
    monkeypatch.setenv('USE_LOCALSTACK', 'true')
    monkeypatch.setenv('LOCALSTACK_ENDPOINT', 'http://localhost:4566')

    importlib.reload(handler)
    assert handler._resolve_service_endpoint('s3') == 'http://localhost:4566'
    assert handler._resolve_service_endpoint('lambda') == 'http://localhost:4566'


def test_endpoint_resolution_none_by_default(monkeypatch):
    """No endpoint variables should keep boto3 default endpoint behavior."""
    monkeypatch.delenv('AWS_S3_ENDPOINT_URL', raising=False)
    monkeypatch.delenv('AWS_ENDPOINT_URL', raising=False)
    monkeypatch.delenv('LOCALSTACK_ENDPOINT', raising=False)
    monkeypatch.setenv('USE_LOCALSTACK', 'false')

    importlib.reload(handler)
    assert handler._resolve_service_endpoint('s3') is None
