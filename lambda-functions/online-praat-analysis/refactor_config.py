"""
[CN] Online Praat Analysis 重构分支配置。

该模块集中管理 v2 重构管线的开关与参数来源，确保配置读取逻辑唯一且可测试。
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AnalysisBranchConfig:
    """[CN] 分析分支配置。"""
    pipeline: str
    use_refactor_v2: bool


def load_analysis_branch_config() -> AnalysisBranchConfig:
    """
    [CN] 从环境变量读取分析分支配置。

    规则：
    - 默认使用 v2（重构分支）
    - ONLINE_PRAAT_ANALYSIS_PIPELINE 可选：v2 / legacy

    :return: AnalysisBranchConfig
    """
    pipeline = (os.getenv('ONLINE_PRAAT_ANALYSIS_PIPELINE', 'v2') or 'v2').strip().lower()
    use_refactor_v2 = pipeline in ('v2', 'new', 'refactor', 'refactor_v2')
    return AnalysisBranchConfig(pipeline=pipeline, use_refactor_v2=use_refactor_v2)
