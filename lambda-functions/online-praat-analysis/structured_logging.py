"""
在线语音分析 Lambda 的结构化日志工具。

日志只输出单行 JSON，并递归清理可能携带用户内容、身份、对象键或签名地址的字段。
异常只保留类型和有限的机器错误码，避免第三方异常正文或堆栈进入 CloudWatch。
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any


_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARN": logging.WARNING,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
}
_SENSITIVE_KEY = re.compile(
    r"authorization|cookie|token|secret|password|api.?key|body|prompt|response|payload|content|"
    r"email|uri|url|file|attachment|session|user|path|name",
    re.IGNORECASE,
)
_SAFE_AGGREGATE_SUFFIX = re.compile(r"(?:count|length|size|hash)$", re.IGNORECASE)


def fingerprint_identifier(value: Any) -> str | None:
    """将内部标识转换为稳定且不可逆的十二位短指纹。"""
    if not isinstance(value, str) or not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def _is_sensitive_key(key: str, value: Any) -> bool:
    """识别敏感字段；纯数字聚合计数可以保留用于运行监控。"""
    if not _SENSITIVE_KEY.search(key):
        return False
    is_safe_number = isinstance(value, (int, float)) and not isinstance(value, bool)
    is_safe_hash = isinstance(value, str) and key.lower().endswith("hash") and bool(re.fullmatch(r"[a-f0-9]{12}", value))
    return not ((is_safe_number or is_safe_hash) and _SAFE_AGGREGATE_SUFFIX.search(key))


def sanitize_metadata(value: Any, depth: int = 0) -> Any:
    """递归限制日志元数据的字段数、深度、字符串长度并清理敏感键。"""
    if depth > 3:
        return "[TRUNCATED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return re.sub(r"[\r\n\t]", " ", value[:256])
    if isinstance(value, (list, tuple)):
        return [sanitize_metadata(item, depth + 1) for item in value[:20]]
    if isinstance(value, dict):
        cleaned = {}
        for key, item in list(value.items())[:30]:
            text_key = str(key)
            cleaned[text_key] = "[REDACTED]" if _is_sensitive_key(text_key, item) else sanitize_metadata(item, depth + 1)
        return cleaned
    return str(type(value).__name__)


def describe_error(error: BaseException) -> dict[str, Any]:
    """提取安全的异常分类，不记录异常正文、参数或 traceback。"""
    metadata: dict[str, Any] = {"errorType": type(error).__name__}
    code = getattr(error, "response", {}).get("Error", {}).get("Code") if isinstance(getattr(error, "response", None), dict) else None
    if code:
        metadata["errorCode"] = code
    status = getattr(error, "status_code", None)
    if isinstance(status, int):
        metadata["errorStatus"] = status
    return metadata


class StructuredLogger:
    """以固定服务名输出结构化、已清理的应用日志。"""

    def __init__(self, service: str, logger: logging.Logger | None = None) -> None:
        """创建日志器，并按 ``LOG_LEVEL`` 配置最低输出级别。"""
        self.service = service
        self.logger = logger or logging.getLogger(service)
        configured = _LEVELS.get(os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
        self.logger.setLevel(configured)

    def _write(self, level: int, event: str, metadata: dict[str, Any] | None = None) -> None:
        """序列化一条单行 JSON 日志。"""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": logging.getLevelName(level),
            "service": self.service,
            "event": event,
            **sanitize_metadata(metadata or {}),
        }
        self.logger.log(level, json.dumps(entry, ensure_ascii=False, separators=(",", ":")))

    def debug(self, event: str, metadata: dict[str, Any] | None = None) -> None:
        """输出 DEBUG 事件。"""
        self._write(logging.DEBUG, event, metadata)

    def info(self, event: str, metadata: dict[str, Any] | None = None) -> None:
        """输出 INFO 事件。"""
        self._write(logging.INFO, event, metadata)

    def warning(self, event: str, metadata: dict[str, Any] | None = None) -> None:
        """输出 WARNING 事件。"""
        self._write(logging.WARNING, event, metadata)

    def error(self, event: str, metadata: dict[str, Any] | None = None) -> None:
        """输出 ERROR 事件。"""
        self._write(logging.ERROR, event, metadata)


def create_structured_logger(service: str) -> StructuredLogger:
    """创建指定服务使用的结构化日志器。"""
    return StructuredLogger(service)
