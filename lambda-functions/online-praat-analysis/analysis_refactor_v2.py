"""
[CN] Online Praat Analysis v2 重构分析管线。

设计目标：
1) 统一帧级 CSV 数据出口（可重现）
2) VRP：glissando 帧级散点 + 半音分箱包络 + soft/loud 锚点
3) Formant–SPL：以 soft/loud 稳态为主，read/free 仅探索性补充
4) 默认使用 filtered autocorrelation + Formant(burg)
"""
from __future__ import annotations

import csv
import json
import logging
import math
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import parselmouth  # type: ignore
from parselmouth.praat import call  # type: ignore

from analysis import analyze_speech_flow
from artifacts import create_pdf_report, create_formant_chart, create_placeholder_chart, create_time_series_chart
from artifacts_refactor_v2 import create_formant_spl_expanded_chart_v2, create_vrp_chart_v2

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@dataclass
class Params:
    """[CN] v2 管线参数配置。"""
    time_step: float = 0.01

    # Pitch
    pitch_method: str = 'filtered_ac'
    pitch_floor: float = 50.0
    pitch_top: float = 800.0
    max_candidates: int = 15
    very_accurate: bool = False
    attenuation_at_top: float = 0.03
    silence_threshold: float = 0.09
    voicing_threshold: float = 0.50
    octave_cost: float = 0.055
    octave_jump_cost: float = 0.35
    voiced_unvoiced_cost: float = 0.14

    # Raw AC (optional)
    pitch_ceiling_raw: float = 600.0
    silence_threshold_raw: float = 0.03
    voicing_threshold_raw: float = 0.45
    octave_cost_raw: float = 0.01

    # Intensity
    intensity_pitch_floor: float = 50.0
    subtract_mean: bool = True

    # Formant (burg)
    n_formants: float = 5.0
    formant_ceiling: float = 8000.0
    window_length: float = 0.025
    pre_emphasis_from: float = 50.0

    # QC
    qc_voicing_prob_min: float = 0.60
    qc_f0_high_risk_hz: float = 200.0


@dataclass
class Calibration:
    """[CN] SPL 校准配置。"""
    mode: str = 'relative'  # absolute / relative
    noise_spl_db: Optional[float] = None
    calibration_offset_db: float = 0.0
    spl_kind: str = 'relative'


def _safe_float(x) -> float:
    """[CN] 将输入安全转为 float，不可用则 NaN。"""
    try:
        v = float(x)
        return v if np.isfinite(v) else np.nan
    except Exception:
        return np.nan


def _build_pitch(sound: parselmouth.Sound, p: Params):
    """[CN] 构建 Pitch 对象。"""
    if p.pitch_method == 'filtered_ac':
        return call(
            sound,
            'To Pitch (filtered autocorrelation)',
            p.time_step,
            p.pitch_floor,
            p.pitch_top,
            p.max_candidates,
            'yes' if p.very_accurate else 'no',
            p.attenuation_at_top,
            p.silence_threshold,
            p.voicing_threshold,
            p.octave_cost,
            p.octave_jump_cost,
            p.voiced_unvoiced_cost,
        )
    if p.pitch_method == 'raw_ac':
        return call(
            sound,
            'To Pitch (raw autocorrelation)',
            p.time_step,
            p.pitch_floor,
            p.pitch_ceiling_raw,
            p.max_candidates,
            'yes' if p.very_accurate else 'no',
            p.silence_threshold_raw,
            p.voicing_threshold_raw,
            p.octave_cost_raw,
            p.octave_jump_cost,
            p.voiced_unvoiced_cost,
        )
    raise ValueError(f'Unknown pitch_method: {p.pitch_method}')


def _compute_calibration_offset(noise_intensity_db: float, calib: Calibration) -> Calibration:
    """[CN] 计算 calibration_offset_db。返回新的 Calibration 实例，不修改输入。

    :param noise_intensity_db: 噪声录音的平均强度 (dB)。
    :param calib: 原始校准配置（不会被修改）。
    :return: 带有计算后 offset 的新 Calibration 实例。
    """
    if calib.mode == 'absolute':
        if calib.noise_spl_db is None:
            raise ValueError('absolute calibration requires noise_spl_db')
        return Calibration(
            mode=calib.mode,
            noise_spl_db=calib.noise_spl_db,
            calibration_offset_db=float(calib.noise_spl_db - noise_intensity_db),
            spl_kind='absolute',
        )
    else:
        return Calibration(
            mode=calib.mode,
            noise_spl_db=calib.noise_spl_db,
            calibration_offset_db=float(-noise_intensity_db),
            spl_kind='relative',
        )


def _estimate_noise_intensity_db(noise_wav: str, p: Params) -> float:
    """[CN] 估计噪声录音均值强度。"""
    snd = parselmouth.Sound(noise_wav)
    if snd.n_channels > 1:
        snd = snd.convert_to_mono()
    intensity = call(snd, 'To Intensity', p.intensity_pitch_floor, p.time_step, 'yes' if p.subtract_mean else 'no')
    mean_db = _safe_float(call(intensity, 'Get mean', snd.xmin, snd.xmax, 'energy'))
    return float(mean_db)


def _task_from_s3_key(s3_key: str) -> str:
    """
    [CN] 由 S3 key 推断任务标签。

    规则（单路径）：
    - step 4 强制解释为 soft/loud：4_1 => soft_a, 4_2 => loud_a
    """
    if not s3_key:
        return 'unknown'

    parts = s3_key.split('/')
    try:
        step_id = parts[-2]
    except Exception:
        return 'unknown'

    file_name = os.path.basename(s3_key)

    if step_id == '1':
        if file_name.startswith('1_1'):
            return 'noise'
        if file_name.startswith('1_2'):
            return 'calibration_read'
        return 'step1_other'
    if step_id == '2':
        return 'vowel_mpt'
    if step_id == '3':
        if file_name.startswith('3_1') or file_name.startswith('3_2'):
            return 'glide_up'
        if file_name.startswith('3_3') or file_name.startswith('3_4'):
            return 'glide_down'
        return 'glide_unknown'
    if step_id == '4':
        if file_name.startswith('4_1'):
            return 'soft_a'
        if file_name.startswith('4_2'):
            return 'loud_a'
        return 'step4_unmapped'
    if step_id == '5':
        return 'read'
    if step_id == '6':
        return 'free'
    return 'unknown'


def _extract_frames(
    sound: parselmouth.Sound,
    p: Params,
    calib: Calibration,
    file_id: str,
    task: str,
) -> List[Dict]:
    """[CN] 提取统一帧级特征。"""
    if sound.n_channels > 1:
        sound = sound.convert_to_mono()

    pitch = _build_pitch(sound, p)
    intensity = call(sound, 'To Intensity', p.intensity_pitch_floor, p.time_step, 'yes' if p.subtract_mean else 'no')
    formant = call(
        sound,
        'To Formant (burg)',
        p.time_step,
        p.n_formants,
        p.formant_ceiling,
        p.window_length,
        p.pre_emphasis_from,
    )

    pitch_arr = pitch.selected_array
    pitch_freq = pitch_arr['frequency']

    # [CN] 兼容不同 Parselmouth 版本下 `selected_array` 的结构：
    # - 可能是 dict-like
    # - 也可能是 numpy structured array（需从 dtype.names 判断字段）
    pitch_has_strength = False
    try:
        if isinstance(pitch_arr, dict):
            pitch_has_strength = 'strength' in pitch_arr
        else:
            dtype_names = getattr(getattr(pitch_arr, 'dtype', None), 'names', None)
            pitch_has_strength = bool(dtype_names and ('strength' in dtype_names))
    except Exception:
        pitch_has_strength = False

    pitch_strength = pitch_arr['strength'] if pitch_has_strength else np.full_like(pitch_freq, np.nan)

    n = int(call(intensity, 'Get number of frames'))
    rows: List[Dict] = []

    prev_f1 = np.nan
    prev_f2 = np.nan

    for i in range(1, n + 1):
        t = _safe_float(call(intensity, 'Get time from frame number', i))
        inten = _safe_float(call(intensity, 'Get value in frame', i))
        spl = inten + calib.calibration_offset_db

        pf = _safe_float(call(pitch, 'Get frame number from time', t))
        pf_i = int(round(pf)) if np.isfinite(pf) else -1

        f0 = np.nan
        vprob = np.nan
        if 1 <= pf_i <= len(pitch_freq):
            f0 = _safe_float(pitch_freq[pf_i - 1])
            if f0 == 0.0:
                f0 = np.nan
            vprob = _safe_float(pitch_strength[pf_i - 1])

        f1 = _safe_float(call(formant, 'Get value at time', 1, t, 'Hertz', 'Linear'))
        f2 = _safe_float(call(formant, 'Get value at time', 2, t, 'Hertz', 'Linear'))
        f3 = _safe_float(call(formant, 'Get value at time', 3, t, 'Hertz', 'Linear'))
        b1 = _safe_float(call(formant, 'Get bandwidth at time', 1, t, 'Hertz', 'Linear'))
        b2 = _safe_float(call(formant, 'Get bandwidth at time', 2, t, 'Hertz', 'Linear'))
        b3 = _safe_float(call(formant, 'Get bandwidth at time', 3, t, 'Hertz', 'Linear'))

        qc_flags = []
        if np.isfinite(vprob) and vprob < p.qc_voicing_prob_min:
            qc_flags.append('low_voicing_prob')
        if np.isfinite(f1) and not (150.0 <= f1 <= 1200.0):
            qc_flags.append('formant_out_of_range_f1')
            f1 = np.nan
        if np.isfinite(f2) and not (500.0 <= f2 <= 3500.0):
            qc_flags.append('formant_out_of_range_f2')
            f2 = np.nan
        if np.isfinite(f3) and not (1500.0 <= f3 <= 4500.0):
            qc_flags.append('formant_out_of_range_f3')
            f3 = np.nan
        if np.isfinite(b1) and not (20.0 <= b1 <= 1200.0):
            qc_flags.append('bandwidth_out_of_range_b1')
            b1 = np.nan
        if np.isfinite(b2) and not (20.0 <= b2 <= 1600.0):
            qc_flags.append('bandwidth_out_of_range_b2')
            b2 = np.nan
        if np.isfinite(b3) and not (20.0 <= b3 <= 2000.0):
            qc_flags.append('bandwidth_out_of_range_b3')
            b3 = np.nan
        if np.isfinite(f0) and f0 > p.qc_f0_high_risk_hz:
            qc_flags.append('high_f0_risk')

        if np.isfinite(prev_f1) and np.isfinite(f1) and abs(f1 - prev_f1) > 300:
            qc_flags.append('jump_f1')
            f1 = np.nan
        if np.isfinite(prev_f2) and np.isfinite(f2) and abs(f2 - prev_f2) > 500:
            qc_flags.append('jump_f2')
            f2 = np.nan

        prev_f1 = f1 if np.isfinite(f1) else prev_f1
        prev_f2 = f2 if np.isfinite(f2) else prev_f2

        rows.append(
            {
                'file': file_id,
                'task': task,
                'time_s': float(t) if np.isfinite(t) else np.nan,
                'f0_hz': float(f0) if np.isfinite(f0) else np.nan,
                'voicing_prob': float(vprob) if np.isfinite(vprob) else np.nan,
                'f1_hz': float(f1) if np.isfinite(f1) else np.nan,
                'f2_hz': float(f2) if np.isfinite(f2) else np.nan,
                'f3_hz': float(f3) if np.isfinite(f3) else np.nan,
                'b1_hz': float(b1) if np.isfinite(b1) else np.nan,
                'b2_hz': float(b2) if np.isfinite(b2) else np.nan,
                'b3_hz': float(b3) if np.isfinite(b3) else np.nan,
                'spl_db': float(spl) if np.isfinite(spl) else np.nan,
                'calibration_offset_db': float(calib.calibration_offset_db),
                'spl_kind': calib.spl_kind,
                'sr_hz': float(sound.sampling_frequency),
                'params_json': '',
                'qc_flags': '|'.join(qc_flags) if qc_flags else '',
            }
        )

    return rows


def _mad_filtered(values: np.ndarray) -> np.ndarray:
    """[CN] 基于 MAD 的稳健去极值。"""
    if values.size < 5:
        return values
    med = np.nanmedian(values)
    mad = np.nanmedian(np.abs(values - med))
    if not np.isfinite(mad) or mad == 0:
        return values
    return values[np.abs(values - med) <= 3.0 * mad]


def _compute_vrp(glide_rows: List[Dict]) -> Dict:
    """[CN] 计算 VRP 包络与摘要指标。"""
    if not glide_rows:
        return {'error': 'no_glide_rows'}

    f0 = np.asarray([r.get('f0_hz', np.nan) for r in glide_rows], dtype=float)
    spl = np.asarray([r.get('spl_db', np.nan) for r in glide_rows], dtype=float)
    vp = np.asarray([r.get('voicing_prob', np.nan) for r in glide_rows], dtype=float)

    # [CN] voicing_prob 来自 Praat Pitch 对象的 strength 通道。使用 filtered_autocorrelation
    # 时该通道始终存在；voicing_prob 为 NaN 仅在帧索引越界（静默段、极短音频）时出现。
    # 若极端情况下 strength 通道整体缺失（版本兼容），降级为仅依赖 f0+spl 过滤。
    has_any_finite_vp = np.any(np.isfinite(vp))
    if has_any_finite_vp:
        valid = np.isfinite(f0) & np.isfinite(spl) & np.isfinite(vp) & (vp >= 0.60)
    else:
        logger.warning('voicing_prob 全部为 NaN，降级为仅 f0+spl 过滤')
        valid = np.isfinite(f0) & np.isfinite(spl)
    f0 = f0[valid]
    spl = spl[valid]
    if f0.size == 0:
        return {'error': 'no_valid_voiced_glide_frames'}

    semi = 69.0 + 12.0 * np.log2(f0 / 440.0)
    semi_i = np.round(semi).astype(int)

    bins: List[Dict] = []
    for n in range(int(np.nanmin(semi_i)), int(np.nanmax(semi_i)) + 1):
        m = semi_i == n
        if np.sum(m) < 5:
            continue
        spl_sel = spl[m]
        spl_sel = spl_sel[np.isfinite(spl_sel)]
        if spl_sel.size < 5:
            continue
        spl_sel = _mad_filtered(spl_sel)
        if spl_sel.size < 5:
            continue

        bins.append(
            {
                'semi': int(n),
                'f0_center_hz': float(440.0 * 2.0 ** ((n - 69) / 12.0)),
                'spl_min': float(np.nanpercentile(spl_sel, 5)),
                'spl_max': float(np.nanpercentile(spl_sel, 95)),
                'spl_mean': float(np.nanmean(spl_sel)),
                'count': int(spl_sel.size),
            }
        )

    return {
        'f0_min': float(np.nanpercentile(f0, 10)),
        'f0_max': float(np.nanpercentile(f0, 90)),
        'spl_min': float(np.nanpercentile(spl, 10)),
        'spl_max': float(np.nanpercentile(spl, 90)),
        'bins': bins,
        'envelope_kind': 'q05_q95',
        'interpretation': 'observed_task_induced_range_not_physiological_max',
    }


def _extract_anchor(rows: List[Dict], task_name: str, file_selection: str = 'first') -> Dict:
    """[CN] 提取任务稳态锚点（中段稳态窗口）。

    :param rows: 全部帧级行。
    :param task_name: 任务名，例如 `soft_a` / `loud_a` / `vowel_mpt`。
    :param file_selection: 文件选择策略：
      - `first`: 选该任务的首个文件（默认，保持 step4 语义）
      - `max_voiced`: 选发声帧最多的文件（用于持续元音）
    """
    sel = [r for r in rows if r.get('task') == task_name]
    if not sel:
        return {'task': task_name, 'error': 'no_rows'}

    file_name = sel[0].get('file', '')
    if file_selection == 'max_voiced':
        score_by_file: Dict[str, Tuple[int, int]] = {}
        for r in sel:
            fn = str(r.get('file', '') or '')
            if not fn:
                continue
            cur_voiced, cur_total = score_by_file.get(fn, (0, 0))
            f0 = _safe_float(r.get('f0_hz', np.nan))
            vp = _safe_float(r.get('voicing_prob', np.nan))
            is_voiced = int(np.isfinite(f0) and (not np.isfinite(vp) or vp >= 0.60))
            score_by_file[fn] = (cur_voiced + is_voiced, cur_total + 1)

        if score_by_file:
            file_name = sorted(score_by_file.items(), key=lambda x: (x[1][0], x[1][1], x[0]), reverse=True)[0][0]

    file_rows = [r for r in sel if r.get('file') == file_name]
    if not file_rows:
        return {'task': task_name, 'error': 'no_file_rows'}

    ts = np.asarray([r.get('time_s', np.nan) for r in file_rows], dtype=float)
    tmin, tmax = np.nanmin(ts), np.nanmax(ts)
    if not np.isfinite(tmin) or not np.isfinite(tmax) or tmax <= tmin:
        return {'task': task_name, 'error': 'invalid_time_range'}

    # 稳态窗：中间 50%（避免起止边缘）
    left = tmin + (tmax - tmin) * 0.25
    right = tmin + (tmax - tmin) * 0.75

    stable = []
    for r in file_rows:
        t = r.get('time_s', np.nan)
        vp = r.get('voicing_prob', np.nan)
        if not np.isfinite(t) or t < left or t > right:
            continue
        if np.isfinite(vp) and vp < 0.60:
            continue
        stable.append(r)

    if len(stable) < 5:
        return {'task': task_name, 'error': 'insufficient_stable_frames'}

    def med(key):
        vals = np.asarray([x.get(key, np.nan) for x in stable], dtype=float)
        vals = vals[np.isfinite(vals)]
        return float(np.nanmedian(vals)) if vals.size else np.nan

    spl_vals = np.asarray([x.get('spl_db', np.nan) for x in stable], dtype=float)
    spl_vals = spl_vals[np.isfinite(spl_vals)]
    spl_mad = float(np.nanmedian(np.abs(spl_vals - np.nanmedian(spl_vals)))) if spl_vals.size else np.nan

    return {
        'task': task_name,
        'file': file_name,
        'f0_hz': med('f0_hz'),
        'f1_hz': med('f1_hz'),
        'f2_hz': med('f2_hz'),
        'f3_hz': med('f3_hz'),
        'b1_hz': med('b1_hz'),
        'b2_hz': med('b2_hz'),
        'b3_hz': med('b3_hz'),
        'spl_db': med('spl_db'),
        'spl_mad_db': spl_mad,
        'n_frames': len(stable),
    }


def _compute_sustained_quality_metrics(local_wav: Optional[str], p: Params) -> Dict:
    """[CN] 以 v2 路径计算持续元音的抖动/振幅微扰/HNR。"""
    if not local_wav or (not os.path.exists(local_wav)):
        return {
            'jitter_local_percent': 0.0,
            'shimmer_local_percent': 0.0,
            'hnr_db': 0.0,
        }

    try:
        snd = parselmouth.Sound(local_wav)
        point_process = call(snd, 'To PointProcess (periodic, cc)', p.pitch_floor, p.pitch_top)
        jitter_local = _safe_float(call(point_process, 'Get jitter (local)', 0, 0, 0.0001, 0.02, 1.3)) * 100.0
        shimmer_local = _safe_float(call([snd, point_process], 'Get shimmer (local)', 0, 0, 0.0001, 0.02, 1.3, 1.6)) * 100.0
        harmonicity = snd.to_harmonicity_cc(0.01, p.pitch_floor, 0.1, 1.0)
        hnr_db = _safe_float(call(harmonicity, 'Get mean', 0, 0))

        return {
            'jitter_local_percent': round(float(jitter_local), 2) if np.isfinite(jitter_local) else 0.0,
            'shimmer_local_percent': round(float(shimmer_local), 2) if np.isfinite(shimmer_local) else 0.0,
            'hnr_db': round(float(hnr_db), 2) if np.isfinite(hnr_db) else 0.0,
        }
    except Exception as exc:
        logger.warning(f'sustained quality metrics failed on {local_wav}: {exc}')
        return {
            'jitter_local_percent': 0.0,
            'shimmer_local_percent': 0.0,
            'hnr_db': 0.0,
        }


def _rows_to_csv(path: str, rows: List[Dict], params_json: str):
    """[CN] 输出帧级 CSV。"""
    fields = [
        'file', 'task', 'time_s', 'f0_hz', 'voicing_prob',
        'f1_hz', 'f2_hz', 'f3_hz', 'b1_hz', 'b2_hz', 'b3_hz',
        'spl_db', 'calibration_offset_db', 'spl_kind', 'sr_hz', 'params_json', 'qc_flags'
    ]
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in rows:
            out = dict(r)
            out['params_json'] = params_json
            writer.writerow(out)


def _upload_bytes(s3_client, bucket: str, key: str, buf, content_type: str):
    """[CN] 上传内存缓冲到 S3。"""
    s3_client.upload_fileobj(buf, bucket, key, ExtraArgs={'ContentType': content_type})


def _upload_file(s3_client, bucket: str, key: str, local_path: str, content_type: str):
    """[CN] 上传本地文件到 S3。"""
    s3_client.upload_file(local_path, bucket, key, ExtraArgs={'ContentType': content_type})


def _build_legacy_formant_block(anchor: Dict) -> Dict:
    """
    [CN] 将 soft/loud 锚点映射为 legacy 的 formant 字段结构。

    说明：为保持 DynamoDB 结构与旧链路兼容，统一输出 F1/F2/F3、f0_mean、spl_dbA_est、reason、error_details 等键。
    """
    has_error = bool(anchor.get('error'))
    return {
        'F1': anchor.get('f1_hz'),
        'B1': anchor.get('b1_hz'),
        'F2': anchor.get('f2_hz'),
        'B2': anchor.get('b2_hz'),
        'F3': anchor.get('f3_hz'),
        'B3': anchor.get('b3_hz'),
        'f0_mean': anchor.get('f0_hz'),
        'spl_dbA_est': anchor.get('spl_db'),
        'source_file': anchor.get('file'),
        'reason': anchor.get('error', 'SUCCESS'),
        'error_details': anchor.get('error', ''),
        'best_segment_time': None,
        'is_high_pitch': False,
    }


def _ensure_legacy_metrics_structure(metrics: Dict, soft_anchor: Dict, loud_anchor: Dict):
    """
    [CN] 补齐并规范 v2 的 legacy 结构，确保旧前端、事件写入和 PDF 读取路径不变。
    """
    sustained = metrics.setdefault('sustained', {})
    if not isinstance(sustained, dict):
        metrics['sustained'] = {}
        sustained = metrics['sustained']

    # 兼容：顶层 formants_low/high（保留旧键名）
    metrics['formants_low'] = _build_legacy_formant_block(soft_anchor)
    metrics['formants_high'] = _build_legacy_formant_block(loud_anchor)

    # 同步到 sustained 节点（旧展示代码从 sustained 读取）
    sustained['formants_low'] = dict(metrics['formants_low'])
    sustained['formants_high'] = dict(metrics['formants_high'])

    # 兼容状态字段
    reason_low = metrics['formants_low'].get('reason', '') or ''
    reason_high = metrics['formants_high'].get('reason', '') or ''

    sustained.setdefault('formants_sustained', sustained.get('formants_sustained', {}))
    sustained['formant_analysis_reason_low'] = '' if reason_low == 'SUCCESS' else str(reason_low)
    sustained['formant_analysis_reason_high'] = '' if reason_high == 'SUCCESS' else str(reason_high)

    sustained_formant_reason = ''
    if isinstance(sustained.get('formants_sustained'), dict):
        sustained_formant_reason = sustained['formants_sustained'].get('reason', '') or ''
    sustained['formant_analysis_reason_sustained'] = '' if sustained_formant_reason == 'SUCCESS' else str(sustained_formant_reason)

    sustained['formant_analysis_failed'] = bool(
        sustained['formant_analysis_reason_low']
        or sustained['formant_analysis_reason_high']
        or sustained['formant_analysis_reason_sustained']
    )

    # v2 语义字段（新字段，不影响旧链路）
    metrics['formants_soft'] = {
        'F1': soft_anchor.get('f1_hz'),
        'B1': soft_anchor.get('b1_hz'),
        'F2': soft_anchor.get('f2_hz'),
        'B2': soft_anchor.get('b2_hz'),
        'F3': soft_anchor.get('f3_hz'),
        'B3': soft_anchor.get('b3_hz'),
        'f0_mean': soft_anchor.get('f0_hz'),
        'spl_dbA_est': soft_anchor.get('spl_db'),
        'source_file': soft_anchor.get('file'),
        'reason': soft_anchor.get('error', 'SUCCESS'),
    }
    metrics['formants_loud'] = {
        'F1': loud_anchor.get('f1_hz'),
        'B1': loud_anchor.get('b1_hz'),
        'F2': loud_anchor.get('f2_hz'),
        'B2': loud_anchor.get('b2_hz'),
        'F3': loud_anchor.get('f3_hz'),
        'B3': loud_anchor.get('b3_hz'),
        'f0_mean': loud_anchor.get('f0_hz'),
        'spl_dbA_est': loud_anchor.get('spl_db'),
        'source_file': loud_anchor.get('file'),
        'reason': loud_anchor.get('error', 'SUCCESS'),
    }


def perform_full_analysis_v2(
    session_id: str,
    audio_groups: Dict[str, List[str]],
    safe_download,
    artifact_prefix: str,
    bucket: str,
    s3_client,
    forms: Optional[dict] = None,
    userInfo: Optional[dict] = None,
) -> Tuple[Dict, Dict, str]:
    """
    [CN] 执行 v2 重构分析流程。

    :return: (metrics, charts, report_url)
    """
    p = Params()
    calib = Calibration(mode='relative', noise_spl_db=None)

    metrics: Dict = {}
    charts: Dict = {}
    debug_info_collection: Dict = {}
    local_by_file: Dict[str, str] = {}

    # 1) 兼容指标：阅读 / 自发语音（暂沿用现有逻辑）

    reading_keys = audio_groups.get('5', [])
    reading_local = [safe_download(k) for k in reading_keys[:10] if k.endswith('.wav')]
    reading_file = reading_local[0] if reading_local else None
    metrics['reading'] = analyze_speech_flow(reading_file) if reading_file else {'error': 'no_reading_audio'}

    free_keys = audio_groups.get('6', [])
    free_local = [safe_download(k) for k in free_keys[:10] if k.endswith('.wav')]
    free_file = free_local[0] if free_local else None
    metrics['spontaneous'] = analyze_speech_flow(free_file) if free_file else {'error': 'no_spontaneous_audio'}

    # 2) 构建 v2 帧级数据集
    all_rows: List[Dict] = []
    downloaded: List[Tuple[str, str]] = []  # (s3_key, local_path)
    for step_id, keys in audio_groups.items():
        for key in keys[:10]:
            if not key.endswith('.wav'):
                continue
            local_path = safe_download(key)
            if not local_path:
                continue
            downloaded.append((key, local_path))
            local_by_file[os.path.basename(local_path)] = local_path

    # 校准先找 noise
    noise_local = None
    for s3_key, local_path in downloaded:
        if _task_from_s3_key(s3_key) == 'noise':
            noise_local = local_path
            break

    if noise_local:
        noise_mean_db = _estimate_noise_intensity_db(noise_local, p)
        calib = _compute_calibration_offset(noise_mean_db, calib)

    for s3_key, local_path in downloaded:
        task = _task_from_s3_key(s3_key)
        snd = parselmouth.Sound(local_path)
        file_id = os.path.basename(local_path)
        rows = _extract_frames(snd, p, calib, file_id, task)
        all_rows.extend(rows)

    # 3) 持续元音（v2 单路径）：主文件选择 + 稳态锚点 + 质量指标
    sustained_anchor = _extract_anchor(all_rows, 'vowel_mpt', file_selection='max_voiced')
    sustained_file_name = sustained_anchor.get('file')
    sustained_local_path = local_by_file.get(sustained_file_name) if isinstance(sustained_file_name, str) else None

    if sustained_local_path:
        ts_buf = create_time_series_chart(sustained_local_path)
        if ts_buf:
            key = artifact_prefix + 'timeSeries.png'
            _upload_bytes(s3_client, bucket, key, ts_buf, 'image/png')
            charts['timeSeries'] = f's3://{bucket}/{key}'

    sustained_rows = [
        r for r in all_rows
        if r.get('task') == 'vowel_mpt' and (not sustained_file_name or r.get('file') == sustained_file_name)
    ]
    f0_vals = np.asarray([_safe_float(r.get('f0_hz', np.nan)) for r in sustained_rows], dtype=float)
    f0_vals = f0_vals[np.isfinite(f0_vals)]
    spl_vals = np.asarray([_safe_float(r.get('spl_db', np.nan)) for r in sustained_rows], dtype=float)
    spl_vals = spl_vals[np.isfinite(spl_vals)]

    voiced_frames = 0
    for r in sustained_rows:
        f0 = _safe_float(r.get('f0_hz', np.nan))
        vp = _safe_float(r.get('voicing_prob', np.nan))
        if np.isfinite(f0) and (not np.isfinite(vp) or vp >= 0.60):
            voiced_frames += 1

    sustained_quality = _compute_sustained_quality_metrics(sustained_local_path, p)
    sustained_formants = _build_legacy_formant_block(sustained_anchor)

    metrics['sustained'] = {
        'mpt_s': round(float(voiced_frames * p.time_step), 2),
        'f0_mean': round(float(np.nanmedian(f0_vals)), 2) if f0_vals.size else 0.0,
        'jitter_local_percent': sustained_quality['jitter_local_percent'],
        'shimmer_local_percent': sustained_quality['shimmer_local_percent'],
        'hnr_db': sustained_quality['hnr_db'],
        'spl_dbA_est': round(float(np.nanmedian(spl_vals)), 2) if spl_vals.size else 0.0,
        'formants_sustained': sustained_formants,
    }
    sustained_reason = sustained_formants.get('reason', '') or ''
    metrics['sustained']['formant_analysis_reason_sustained'] = '' if sustained_reason == 'SUCCESS' else str(sustained_reason)

    # 4) VRP + soft/loud anchors + formant-spl
    glide_rows = [r for r in all_rows if r.get('task') in ('glide_up', 'glide_down')]
    vrp = _compute_vrp(glide_rows)
    metrics['vrp'] = vrp

    soft_anchor = _extract_anchor(all_rows, 'soft_a')
    loud_anchor = _extract_anchor(all_rows, 'loud_a')
    anchors = {'soft_a': soft_anchor, 'loud_a': loud_anchor}

    # 统一补齐 legacy 结构，确保 DynamoDB / PDF / 前端兼容
    _ensure_legacy_metrics_structure(metrics, soft_anchor, loud_anchor)

    # 5) 图表
    if isinstance(vrp, dict) and 'error' not in vrp:
        vrp_buf = create_vrp_chart_v2(glide_rows, vrp.get('bins', []), anchors)
        if vrp_buf:
            key = artifact_prefix + 'vrp.png'
            _upload_bytes(s3_client, bucket, key, vrp_buf, 'image/png')
            charts['vrp'] = f's3://{bucket}/{key}'

    # formant F1/F2 二维图仍输出，兼容 PDF 章节
    f_chart_buf = create_formant_chart(metrics['formants_low'], metrics['formants_high'])
    if f_chart_buf:
        key = artifact_prefix + 'formant.png'
        _upload_bytes(s3_client, bucket, key, f_chart_buf, 'image/png')
        charts['formant'] = f's3://{bucket}/{key}'

    exploratory_points = [r for r in all_rows if r.get('task') in ('read', 'free') and np.isfinite(r.get('f0_hz', np.nan))]
    stable_points = [
        {'task': 'soft_a', 'f1_hz': soft_anchor.get('f1_hz'), 'f2_hz': soft_anchor.get('f2_hz'), 'f3_hz': soft_anchor.get('f3_hz'), 'spl_db': soft_anchor.get('spl_db')},
        {'task': 'loud_a', 'f1_hz': loud_anchor.get('f1_hz'), 'f2_hz': loud_anchor.get('f2_hz'), 'f3_hz': loud_anchor.get('f3_hz'), 'spl_db': loud_anchor.get('spl_db')},
    ]
    fs_buf = create_formant_spl_expanded_chart_v2(stable_points, exploratory_points)
    if fs_buf:
        key = artifact_prefix + 'formant_spl_spectrum.png'
        _upload_bytes(s3_client, bucket, key, fs_buf, 'image/png')
        charts['formant_spl_spectrum'] = f's3://{bucket}/{key}'
    else:
        ph = create_placeholder_chart('Formant-SPL (v2)', 'No valid data for expanded formant-SPL chart.')
        if ph:
            key = artifact_prefix + 'formant_spl_spectrum.png'
            _upload_bytes(s3_client, bucket, key, ph, 'image/png')
            charts['formant_spl_spectrum'] = f's3://{bucket}/{key}'

    # 6) 可重现输出 CSV / run_config
    run_cfg = {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'params': asdict(p),
        'calibration': asdict(calib),
    }
    params_json = json.dumps(run_cfg, ensure_ascii=False, separators=(',', ':'))

    all_csv_local = f'/tmp/{session_id}.ALL.frames.csv'
    _rows_to_csv(all_csv_local, all_rows, params_json)

    run_cfg_local = f'/tmp/{session_id}.run_config.json'
    with open(run_cfg_local, 'w', encoding='utf-8') as f:
        json.dump(run_cfg, f, ensure_ascii=False, indent=2)

    all_csv_key = artifact_prefix + 'ALL.frames.csv'
    run_cfg_key = artifact_prefix + 'run_config.json'
    _upload_file(s3_client, bucket, all_csv_key, all_csv_local, 'text/csv')
    _upload_file(s3_client, bucket, run_cfg_key, run_cfg_local, 'application/json')

    metrics['reproducibility'] = {
        'all_frames_csv': f's3://{bucket}/{all_csv_key}',
        'run_config_json': f's3://{bucket}/{run_cfg_key}',
        'csv_fields': [
            'file', 'task', 'time_s', 'f0_hz', 'voicing_prob',
            'f1_hz', 'f2_hz', 'f3_hz', 'b1_hz', 'b2_hz', 'b3_hz', 'spl_db',
            'calibration_offset_db', 'spl_kind', 'sr_hz', 'params_json', 'qc_flags'
        ],
    }

    # 7) 问卷
    if forms:
        processed_scores = {}
        rbh = forms.get('rbh')
        if rbh and isinstance(rbh, dict):
            processed_scores['RBH'] = {k: v for k, v in rbh.items() if v is not None}

        ovhs9 = forms.get('ovhs9')
        if ovhs9 and isinstance(ovhs9, list):
            valid_scores = [s for s in ovhs9 if isinstance(s, int)]
            if len(valid_scores) == 9:
                processed_scores['OVHS-9 Total'] = sum(valid_scores)

        tvqg = forms.get('tvqg')
        if tvqg and isinstance(tvqg, list):
            valid_scores = [s for s in tvqg if isinstance(s, int)]
            if len(valid_scores) == 12:
                total = sum(valid_scores)
                processed_scores['TVQ-G Total'] = total
                processed_scores['TVQ-G Percent'] = f"{total * 100 / 48:.0f}%"

        if processed_scores:
            metrics['questionnaires'] = processed_scores

    # 7) PDF
    report_key = f'voice-tests/{session_id}/report.pdf'
    pdf_buf = create_pdf_report(session_id, metrics, charts, debug_info=debug_info_collection, userInfo=userInfo)
    if pdf_buf:
        _upload_bytes(s3_client, bucket, report_key, pdf_buf, 'application/pdf')
    report_url = f's3://{bucket}/{report_key}'

    return metrics, charts, report_url
