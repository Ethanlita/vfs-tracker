"""Install Parselmouth development wheel in a cross-platform way.

[CN] 跨平台安装 Parselmouth dev wheel 的辅助脚本。
支持 Windows / macOS / Linux，并可选通过 GitHub CLI 自动下载指定 Actions run 的对应 artifact。

Usage examples:
  python scripts/install_parselmouth_dev.py --run-id 21285172527
  python scripts/install_parselmouth_dev.py --wheel-dir lambda-functions/online-praat-analysis/tmp/parselmouth-dev
"""

from __future__ import annotations

import argparse
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, List, Optional

from packaging import tags
from packaging.utils import parse_wheel_filename


def _recommended_artifact_name() -> str:
    """Infer GitHub Actions artifact name by current OS/arch.

    [CN] 根据当前操作系统与 CPU 架构推断推荐的 wheels artifact 名称。
    """
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "windows":
        return "wheels-win_amd64"
    if system == "darwin":
        if machine in {"arm64", "aarch64"}:
            return "wheels-macosx_arm64"
        return "wheels-macosx_x86_64"
    if system == "linux":
        if machine in {"arm64", "aarch64"}:
            return "wheels-manylinux_aarch64"
        if machine in {"x86_64", "amd64"}:
            return "wheels-manylinux_x86_64"
        raise RuntimeError(f"Unsupported Linux architecture for auto artifact selection: {machine}")

    raise RuntimeError(f"Unsupported platform: system={system}, machine={machine}")


def _run_command(command: List[str], cwd: Optional[Path] = None) -> None:
    """Run command and fail fast.

    [CN] 执行外部命令，失败时直接抛出异常并中断流程。
    """
    subprocess.run(command, cwd=str(cwd) if cwd else None, check=True)


def _download_artifact_with_gh(run_id: str, repo: str, artifact_name: str, wheel_dir: Path) -> None:
    """Download artifact via gh CLI.

    [CN] 使用 GitHub CLI 从指定 workflow run 下载 artifact 到 wheel 目录。
    """
    if shutil.which("gh") is None:
        raise RuntimeError("GitHub CLI (gh) is not installed or not in PATH")

    wheel_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "gh",
        "run",
        "download",
        run_id,
        "-R",
        repo,
        "-n",
        artifact_name,
        "-D",
        str(wheel_dir),
    ]
    _run_command(cmd)


def _find_candidate_wheels(wheel_dir: Path) -> Iterable[Path]:
    """Find candidate praat-parselmouth wheels recursively.

    [CN] 递归搜索 wheel 目录中的 praat-parselmouth 轮子文件。
    """
    for path in wheel_dir.rglob("*.whl"):
        if path.name.startswith("praat_parselmouth-"):
            yield path


def _select_best_wheel(wheels: Iterable[Path], expected_version_fragment: str) -> Path:
    """Select best wheel matching current interpreter tags.

    [CN] 基于当前解释器支持的 tags 选择最佳兼容 wheel。
    """
    supported_tags = list(tags.sys_tags())
    supported_index = {tag: idx for idx, tag in enumerate(supported_tags)}

    best_path: Optional[Path] = None
    best_rank = 10**9

    for wheel in wheels:
        if expected_version_fragment and expected_version_fragment not in wheel.name:
            continue

        try:
            name, version, _build, wheel_tags = parse_wheel_filename(wheel.name)
        except Exception:
            continue

        if str(name) not in {"praat-parselmouth", "praat_parselmouth"}:
            continue

        # [CN] rank 越小越优先（越贴近当前解释器首选 tag）
        compatible_positions = [supported_index[t] for t in wheel_tags if t in supported_index]
        if not compatible_positions:
            continue

        rank = min(compatible_positions)
        if rank < best_rank:
            best_rank = rank
            best_path = wheel

    if best_path is None:
        raise RuntimeError(
            "No compatible praat-parselmouth wheel found for current interpreter. "
            "Please verify wheel directory, platform artifact, and Python version."
        )

    return best_path


def _pip_install_wheel(wheel_path: Path) -> None:
    """Install wheel into current environment.

    [CN] 将选中的 wheel 安装到当前 Python 环境。
    """
    cmd = [sys.executable, "-m", "pip", "install", "--force-reinstall", str(wheel_path)]
    _run_command(cmd)


def _print_installed_version() -> None:
    """Print installed parselmouth and Praat versions.

    [CN] 打印安装后的 Parselmouth 与内置 Praat 版本，便于验收。
    """
    import parselmouth  # type: ignore

    print(f"PARSELMOUTH_VERSION={parselmouth.__version__}")
    print(f"PRAAT_VERSION={getattr(parselmouth, 'PRAAT_VERSION', '<missing>')}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Install Parselmouth dev wheel cross-platform")
    parser.add_argument(
        "--wheel-dir",
        default="lambda-functions/online-praat-analysis/tmp/parselmouth-dev",
        help="Directory containing downloaded wheels (recursive search)",
    )
    parser.add_argument(
        "--version-fragment",
        default="0.5.0.dev0",
        help="Filter wheel filename by version fragment",
    )
    parser.add_argument(
        "--run-id",
        default="",
        help="Optional GitHub Actions run id. If provided, script will download artifact via gh first.",
    )
    parser.add_argument(
        "--repo",
        default="YannickJadoul/Parselmouth",
        help="GitHub repository for gh run download",
    )
    parser.add_argument(
        "--artifact-name",
        default="",
        help="Optional artifact name override (e.g., wheels-manylinux_aarch64)",
    )

    args = parser.parse_args()
    wheel_dir = Path(args.wheel_dir).resolve()

    if args.run_id:
        artifact_name = args.artifact_name or _recommended_artifact_name()
        print(f"Downloading artifact: run={args.run_id} repo={args.repo} name={artifact_name}")
        _download_artifact_with_gh(args.run_id, args.repo, artifact_name, wheel_dir)

    wheels = list(_find_candidate_wheels(wheel_dir))
    if not wheels:
        raise RuntimeError(f"No praat_parselmouth*.whl found under: {wheel_dir}")

    selected = _select_best_wheel(wheels, args.version_fragment)
    print(f"Selected wheel: {selected}")
    _pip_install_wheel(selected)
    _print_installed_version()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
