import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def test_v2_legacy_metrics_structure_is_present():
    """v2 输出必须补齐 legacy 结构，保证 DynamoDB/前端/PDF 兼容。"""
    from analysis_refactor_v2 import _ensure_legacy_metrics_structure

    metrics = {
        'sustained': {
            'formants_sustained': {
                'F1': 700,
                'F2': 1300,
                'F3': 2600,
                'reason': 'SUCCESS',
            }
        }
    }
    soft_anchor = {
        'file': '4_1.wav',
        'f0_hz': 180.0,
        'f1_hz': 680.0,
        'f2_hz': 1200.0,
        'f3_hz': 2550.0,
        'spl_db': 62.0,
    }
    loud_anchor = {
        'file': '4_2.wav',
        'f0_hz': 185.0,
        'f1_hz': 700.0,
        'f2_hz': 1250.0,
        'f3_hz': 2600.0,
        'spl_db': 70.0,
    }

    _ensure_legacy_metrics_structure(metrics, soft_anchor, loud_anchor)

    # 顶层 legacy 键
    assert 'formants_low' in metrics
    assert 'formants_high' in metrics

    # sustained 下 legacy 键
    assert 'formants_low' in metrics['sustained']
    assert 'formants_high' in metrics['sustained']

    # 兼容状态键
    assert 'formant_analysis_failed' in metrics['sustained']
    assert 'formant_analysis_reason_low' in metrics['sustained']
    assert 'formant_analysis_reason_high' in metrics['sustained']
    assert 'formant_analysis_reason_sustained' in metrics['sustained']

    # v2 新语义键
    assert 'formants_soft' in metrics
    assert 'formants_loud' in metrics


def test_v2_legacy_structure_carries_reason_and_error_fields():
    """当锚点异常时，legacy 结构中的 reason/error_details 必须可用。"""
    from analysis_refactor_v2 import _ensure_legacy_metrics_structure

    metrics = {'sustained': {}}
    soft_anchor = {'error': 'insufficient_stable_frames'}
    loud_anchor = {'error': 'no_rows'}

    _ensure_legacy_metrics_structure(metrics, soft_anchor, loud_anchor)

    assert metrics['formants_low']['reason'] == 'insufficient_stable_frames'
    assert metrics['formants_low']['error_details'] == 'insufficient_stable_frames'
    assert metrics['formants_high']['reason'] == 'no_rows'
    assert metrics['formants_high']['error_details'] == 'no_rows'
    assert metrics['sustained']['formant_analysis_failed'] is True


def test_pdf_report_accepts_v2_compatible_metrics():
    """PDF 生成应能消费 v2 兼容结构，避免新链路写入后报告失败。"""
    from artifacts import create_pdf_report

    metrics = {
        'sustained': {
            'f0_mean': 195.0,
            'hnr_db': 16.5,
            'jitter_local_percent': 0.9,
            'shimmer_local_percent': 3.1,
            'mpt_s': 11.2,
            'spl_dbA_est': 67.5,
            'formant_analysis_failed': False,
            'formant_analysis_reason_low': '',
            'formant_analysis_reason_high': '',
            'formant_analysis_reason_sustained': '',
            'formants_sustained': {
                'F1': 710,
                'F2': 1280,
                'F3': 2600,
                'B1': 80,
                'B2': 120,
                'B3': 150,
                'reason': 'SUCCESS',
            },
            'formants_low': {'F1': 690, 'F2': 1230, 'F3': 2550, 'reason': 'SUCCESS'},
            'formants_high': {'F1': 730, 'F2': 1320, 'F3': 2660, 'reason': 'SUCCESS'},
        },
        'reading': {'duration_s': 20.0, 'f0_mean': 190.0, 'f0_sd': 15.0, 'pause_count': 3, 'voiced_ratio': 0.7},
        'spontaneous': {'duration_s': 30.0, 'f0_mean': 188.0, 'f0_sd': 18.0, 'pause_count': 6, 'voiced_ratio': 0.65},
        'vrp': {'f0_min': 150.0, 'f0_max': 290.0, 'spl_min': 58.0, 'spl_max': 80.0, 'bins': []},
        'formants_low': {'F1': 690, 'F2': 1230, 'F3': 2550, 'reason': 'SUCCESS', 'error_details': ''},
        'formants_high': {'F1': 730, 'F2': 1320, 'F3': 2660, 'reason': 'SUCCESS', 'error_details': ''},
        'questionnaires': {'OVHS-9 Total': 10},
    }

    pdf_buf = create_pdf_report('session-test-v2-compat', metrics, chart_urls={}, debug_info={}, userInfo={'userName': 'tester'})
    assert pdf_buf is not None
    payload = pdf_buf.getvalue()
    assert isinstance(payload, (bytes, bytearray))
    assert len(payload) > 1000
