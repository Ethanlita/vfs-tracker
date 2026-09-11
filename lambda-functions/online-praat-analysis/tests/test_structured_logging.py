"""在线语音分析结构化日志的敏感数据边界测试。"""
import json
import logging
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from structured_logging import (
    create_structured_logger,
    describe_error,
    fingerprint_identifier,
)


class SyntheticServiceError(RuntimeError):
    """模拟异常正文含签名地址和用户内容的第三方服务错误。"""

    def __init__(self) -> None:
        """创建带 AWS 风格安全错误码的测试异常。"""
        super().__init__('token=secret https://private.example/audio.wav')
        self.response = {'Error': {'Code': 'AccessDenied', 'Message': 'private content'}}


class StructuredLoggingTests(unittest.TestCase):
    """验证日志输出和 Python 分析模块的静态隐私边界。"""

    def test_structured_logger_redacts_content_and_preserves_safe_aggregates(self):
        """日志应隐藏路径和异常正文，同时保留指纹、计数和错误分类。"""
        records: list[logging.LogRecord] = []
        capture = logging.Handler()
        capture.emit = records.append
        target = logging.getLogger('privacy-test')
        target.handlers = [capture]
        target.propagate = False
        logger = create_structured_logger('privacy-test')
        session_hash = fingerprint_identifier('session-private-123')

        logger.error('operation_failed', {
            'sessionHash': session_hash,
            'filePath': '/tmp/private-user.wav',
            'attachmentCount': 2,
            **describe_error(SyntheticServiceError()),
        })

        serialized = records[-1].getMessage()
        parsed = json.loads(serialized)
        self.assertNotIn('\n', serialized)
        self.assertNotIn('session-private-123', serialized)
        self.assertNotIn('private-user.wav', serialized)
        self.assertNotIn('token=secret', serialized)
        self.assertNotIn('private content', serialized)
        self.assertEqual(parsed['sessionHash'], session_hash)
        self.assertEqual(parsed['filePath'], '[REDACTED]')
        self.assertEqual(parsed['attachmentCount'], 2)
        self.assertEqual(parsed['errorType'], 'SyntheticServiceError')
        self.assertEqual(parsed['errorCode'], 'AccessDenied')

    def test_analysis_modules_do_not_emit_legacy_exception_or_path_logs(self):
        """运行代码不得重新引入 print、traceback 或插值后的文件与异常日志。"""
        root = Path(__file__).resolve().parents[1]
        sources = [
            root / 'handler.py',
            root / 'analysis.py',
            root / 'analysis_refactor_v2.py',
            root / 'artifacts.py',
            root / 'artifacts_refactor_v2.py',
        ]
        for source_path in sources:
            source = source_path.read_text(encoding='utf-8')
            self.assertNotIn('print(', source)
            self.assertNotIn('exc_info=', source)
            self.assertNotIn('logger.error(f', source)
            self.assertNotIn('logger.warning(f', source)
            self.assertNotIn('logger.info(f', source)


if __name__ == '__main__':
    unittest.main()
