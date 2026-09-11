"""从固定源码提交安装 VFS 分析所需的 Parselmouth。

[CN] v2 管线依赖尚未进入 PyPI 稳定版的 filtered autocorrelation。
本脚本与生产镜像使用相同的上游仓库和提交，不再下载会过期的 Actions artifact。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from typing import Sequence


DEFAULT_REPOSITORY = "https://github.com/YannickJadoul/Parselmouth.git"
DEFAULT_COMMIT = "0a0594265823f5c3fdaa661a05c887cdf02ec143"


def _run_command(command: Sequence[str]) -> None:
    """[CN] 执行命令并在失败时立即停止安装。"""
    subprocess.run(list(command), check=True)


def _validate_commit(commit: str) -> str:
    """[CN] 只接受完整 Git SHA，避免本地安装随分支移动。"""
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Parselmouth commit 必须是 40 位小写十六进制 Git SHA")
    return commit


def _install_from_source(repository: str, commit: str) -> None:
    """[CN] 通过 pip 从固定提交及其子模块构建并安装 wheel。"""
    requirement = f"git+{repository}@{_validate_commit(commit)}"
    _run_command([
        sys.executable,
        "-m",
        "pip",
        "install",
        "--force-reinstall",
        requirement,
    ])


def _verify_filtered_autocorrelation() -> None:
    """[CN] 直接调用生产算法所需命令，防止安装了不兼容的稳定版。"""
    import numpy as np
    import parselmouth
    from parselmouth.praat import call

    sample_rate = 16000
    times = np.arange(sample_rate, dtype=np.float64) / sample_rate
    sound = parselmouth.Sound(np.sin(2 * np.pi * 180 * times), sample_rate)
    call(
        sound,
        "To Pitch (filtered autocorrelation)",
        0.01,
        50,
        800,
        15,
        "no",
        0.03,
        0.09,
        0.5,
        0.055,
        0.35,
        0.14,
    )
    print(f"PARSELMOUTH_VERSION={parselmouth.__version__}")
    print(f"PRAAT_VERSION={getattr(parselmouth, 'PRAAT_VERSION', '<missing>')}")
    print("FILTERED_AUTOCORRELATION=available")


def main() -> int:
    """[CN] 解析固定源码参数、安装并验证所需 Praat 能力。"""
    parser = argparse.ArgumentParser(
        description="从固定源码提交安装支持 filtered autocorrelation 的 Parselmouth",
    )
    parser.add_argument("--repository", default=DEFAULT_REPOSITORY)
    parser.add_argument("--commit", default=DEFAULT_COMMIT)
    args = parser.parse_args()

    _install_from_source(args.repository, args.commit)
    _verify_filtered_autocorrelation()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
