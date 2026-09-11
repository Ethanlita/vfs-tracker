import os
import sys
import importlib

import numpy as np
import parselmouth

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def test_branch_config_default_to_v2(monkeypatch):
    """默认应启用 v2 重构分支。"""
    monkeypatch.delenv('ONLINE_PRAAT_ANALYSIS_PIPELINE', raising=False)
    import refactor_config
    importlib.reload(refactor_config)

    cfg = refactor_config.load_analysis_branch_config()
    assert cfg.pipeline == 'v2'
    assert cfg.use_refactor_v2 is True


def test_branch_config_can_switch_to_legacy(monkeypatch):
    """显式配置 legacy 时应关闭 v2。"""
    monkeypatch.setenv('ONLINE_PRAAT_ANALYSIS_PIPELINE', 'legacy')
    import refactor_config
    importlib.reload(refactor_config)

    cfg = refactor_config.load_analysis_branch_config()
    assert cfg.pipeline == 'legacy'
    assert cfg.use_refactor_v2 is False


def test_task_mapping_step4_soft_loud():
    """Step 4 必须按响度锚点映射，不再按高低音语义映射。"""
    from analysis_refactor_v2 import _task_from_s3_key

    base = 'voice-tests/session-a/raw/4/'
    assert _task_from_s3_key(base + '4_1.wav') == 'soft_a'
    assert _task_from_s3_key(base + '4_2.wav') == 'loud_a'


def test_task_mapping_glide_up_down():
    """Step 3 必须按上传序号映射上/下滑音。"""
    from analysis_refactor_v2 import _task_from_s3_key

    base = 'voice-tests/session-a/raw/3/'
    assert _task_from_s3_key(base + '3_1.wav') == 'glide_up'
    assert _task_from_s3_key(base + '3_2.wav') == 'glide_up'
    assert _task_from_s3_key(base + '3_3.wav') == 'glide_down'
    assert _task_from_s3_key(base + '3_4.wav') == 'glide_down'


def test_filtered_autocorrelation_command_is_available():
    """[CN] 生产 v2 单路径依赖的 filtered autocorrelation 必须真实可调用。"""
    from analysis_refactor_v2 import Params, _build_pitch

    sample_rate = 16000
    times = np.arange(sample_rate, dtype=np.float64) / sample_rate
    sound = parselmouth.Sound(np.sin(2 * np.pi * 180 * times), sample_rate)

    pitch = _build_pitch(sound, Params())
    frequencies = pitch.selected_array['frequency']

    assert np.any(frequencies > 0)
