"""
[CN] 该文件包含用于在线 Praat 分析服务的所有核心语音处理和声学分析逻辑。
它利用 parselmouth、librosa 和 numpy 等库来计算各种声学指标。
"""
import logging
import numpy as np
import parselmouth
from parselmouth.praat import call
import librosa
import math
from dataclasses import dataclass
from typing import Optional, Dict, List, Tuple
import os
import tempfile

try:
    from scipy import signal as scisignal
except ImportError:
    scisignal = None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- New Robust Analysis Helper Functions (based on user guidance) ---

def pick_params(f0_median: float) -> (int, float):
    """
    [CN] 根据声音的基频中位数选择分析参数。
    :param f0_median: 基频的中位数（Hz）。
    :return: 一个包含 (max_formant, window_length) 的元组。
    """
    if f0_median < 220:
        max_formant = 5000
        win_len = 0.025
    elif f0_median < 280:
        max_formant = 5500
        win_len = 0.03
    else:
        max_formant = 5500
        win_len = 0.035
    return max_formant, win_len


def true_envelope_db(frame: np.ndarray, sr: int, lifter_ms: float = 2.8):
    """
    [CN] 通过倒谱低通提升（cepstral liftering）来计算平滑的“真实谱包络”（单位dB）。
    :param frame: 音频帧的 numpy 数组。
    :param sr: 采样率。
    :param lifter_ms: 倒谱提升的截止时间（毫秒）。
    :return: 一个包含 (envelope_db, frequencies) 的元组。
    """
    x = np.asarray(frame, dtype=np.float64)
    if x.size == 0:
        return None, None
    # 汉宁窗以减小泄漏
    win = np.hanning(x.size)
    xw = x * win

    # NFFT：留出冗余提高频率分辨率
    nfft = int(2 ** np.ceil(np.log2(xw.size) + 1))
    nfft = min(nfft, 131072)  # cap，48kHz 下约 2.7s 音频也足够用了
    S = np.abs(np.fft.rfft(xw, n=nfft)) + 1e-12
    logS = np.log(S)
    ceps = np.fft.irfft(logS, n=nfft)

    # 低倒谱 liftering（< lifter_ms）
    q_cut = int((lifter_ms * 1e-3) * sr)
    ceps[q_cut + 1:] = 0.0

    env = np.exp(np.fft.rfft(ceps, n=nfft))
    env_db = 20.0 * np.log10(np.maximum(env, 1e-12))
    freqs = np.fft.rfftfreq(nfft, d=1.0 / sr)
    return env_db, freqs

def peak_prominence_db(env_db: np.ndarray, idx: int, freq_bins: Optional[np.ndarray], win_hz: float = 150.0) -> float:
    """
    [CN] 计算频谱包络中一个峰值的显著性（prominence）。
    显著性定义为峰值与其两侧最近的深谷之间的垂直距离。
    :param env_db: 频谱包络（dB）。
    :param idx: 峰值的索引。
    :param freq_bins: 频率轴。
    :param win_hz: 搜索深谷的窗口宽度（Hz）。
    :return: 峰值的显著性（dB）。
    """
    if idx <= 1 or idx >= len(env_db) - 2:
        return 0.0
    if freq_bins is None or len(freq_bins) < 2:
        left_bins = right_bins = 20
    else:
        bin_hz = max(1e-9, freq_bins[1] - freq_bins[0])
        k = max(1, int(win_hz / bin_hz))
        left_bins = right_bins = k
    l0 = max(0, idx - left_bins)
    r0 = min(len(env_db), idx + right_bins + 1)
    peak = env_db[idx]
    try:
        valley = max(np.min(env_db[l0:idx]), np.min(env_db[idx+1:r0]))
        return float(peak - valley)
    except ValueError:
        return 0.0

def _calculate_confidence(
    freq_hz: float, bw_hz: float, f0: float,
    lpc_spectrum: Optional[np.ndarray] = None,
    true_envelope: Optional[np.ndarray] = None,
    freq_bins: Optional[np.ndarray] = None
) -> (float, float):
    """
    [CN] 为一个共振峰候选者计算一个稳健的置信度分数。
    该分数综合考虑了带宽、峰值显著性和与谐波的接近程度。
    :param freq_hz: 候选共振峰的频率。
    :param bw_hz: 候选共振峰的带宽。
    :param f0: 当前帧的基频。
    :param true_envelope: (可选) 真实谱包络。
    :param freq_bins: (可选) 频率轴。
    :return: 一个包含 (confidence_score, prominence_db) 的元组。
    """
    # Bandwidth score
    bw_score = 1.0 if 80 <= bw_hz <= 600 else max(0.0, 1.0 - (abs(bw_hz - 340) / 500))

    # Prominence score from true envelope
    prom_score = 0.5 # Default if no true envelope is provided
    prom_db = 0.0
    if true_envelope is not None and freq_bins is not None:
        idx = np.argmin(np.abs(freq_bins - freq_hz))
        prom_db = peak_prominence_db(true_envelope, idx, freq_bins, win_hz=150.0)
        prom_score = 1.0 if prom_db >= 6 else (0.0 if prom_db < 3 else (prom_db - 3) / 3)

    # Harmonic proximity penalty
    harm_penalty = 0.0
    if f0 > 0:
        harm = round(freq_hz / f0)
        harm_dist_rel = abs(freq_hz - harm * f0) / freq_hz
        if harm_dist_rel < 0.03 and prom_db < 6: # It's very close to a harmonic and not very prominent
            harm_penalty = 0.2

    # Final weighted score
    score = 0.6 * prom_score + 0.4 * bw_score - harm_penalty
    return max(0.0, score), prom_db

def analyze_note_file_robust(path: str, f0min: int = 75, f0max: int = 1200) -> Dict:
    """
    [CN] 对单个音符音频文件进行稳健的共振峰分析。
    流程：遍历所有发声片段 -> 帧级筛选（F0/HNR）-> Praat(Burg) + 真谱包络联合评分 -> 非交叉/最小间距约束 -> 在最佳时间窗口内取中位数。
    :param path: 音频文件的本地路径。
    :param f0min: 最低基频搜索范围。
    :param f0max: 最高基频搜索范围。
    :return: 包含共振峰、基频等指标的字典。
    """
    try:
        sound = parselmouth.Sound(path)
        y, sr = _load_mono(path)

        # 全局 F0 中位数，选择 Praat 参数
        pitch_global = sound.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals_g = pitch_global.selected_array['frequency']
        f0_median = float(np.median(f0_vals_g[f0_vals_g > 0])) if np.any(f0_vals_g > 0) else 0.0
        max_formant_freq, window_length = pick_params(f0_median)   # <== 用你的函数
        is_high_pitch = f0_median >= 280.0  # 仅用于 debug/explain

        logger.info(f"[robust] F0_median={f0_median:.1f} Hz, max_formant={max_formant_freq}, win_len={window_length}")

        # 能量门限切分（近似“有声区”），随后还会用HNR再筛
        voiced_intervals = librosa.effects.split(y, top_db=40, frame_length=2048, hop_length=512)
        if voiced_intervals.size == 0:
            raise ValueError("No voiced segments detected.")

        all_frames = []
        for start_sample, end_sample in voiced_intervals:
            start_time, end_time = start_sample / sr, end_sample / sr
            if (end_time - start_time) < 0.08:  # 片段太短跳过
                continue

            segment = sound.extract_part(from_time=start_time, to_time=end_time, preserve_times=False)
            seg_sr = int(segment.sampling_frequency)
            seg_arr = segment.as_array().astype(np.float64).ravel()

            # 段内 Pitch/HNR（帧时长 10ms）
            pitch = segment.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
            harm = segment.to_harmonicity_cc(time_step=0.01, minimum_pitch=f0min)

            # 段级真谱包络（一次即可）
            q_ms = 2.8
            if f0_median > 0:
                q_ms = min(3.0, max(1.5, 0.8 * (1000.0 / f0_median)))
            env_db, freqs = true_envelope_db(seg_arr, seg_sr, lifter_ms=q_ms)
            # Praat(Burg)
            max_formant_eff = min(max_formant_freq, 0.9 * seg_sr / 2.0)  # Nyquist 安全
            formants = segment.to_formant_burg(
                time_step=0.01, max_number_of_formants=5,
                maximum_formant=max_formant_eff,
                window_length=window_length, pre_emphasis_from=50.0
            )

            strengths = None
            try:
                strengths = pitch.selected_array.get('strength', None)
            except Exception:
                strengths = None

            times = pitch.xs()
            for k, t in enumerate(times):
                f0 = pitch.get_value_at_time(t)
                if not (np.isfinite(f0) and f0 > 0):
                    continue

                if strengths is not None:
                    s = strengths[k] if k < len(strengths) and np.isfinite(strengths[k]) else 1.0
                    if s < 0.6:   # 经验阈值，可调
                        continue

                hnr = harm.get_value(time=t)
                if not (np.isfinite(hnr) and hnr >= 8.0):   # <== 有声稳定帧 gating
                    continue

                # 读取共振峰
                f1 = formants.get_value_at_time(1, t); b1 = formants.get_bandwidth_at_time(1, t)
                f2 = formants.get_value_at_time(2, t); b2 = formants.get_bandwidth_at_time(2, t)
                f3 = formants.get_value_at_time(3, t); b3 = formants.get_bandwidth_at_time(3, t)

                fr = {'time': start_time + t, 'f0': float(f0), 'hnr': float(hnr)}

                # 为 F1/F2 计算联合置信度（包络参与 + 谐波邻近惩罚 + 带宽）
                if np.isfinite(f1) and not np.iscomplexobj(f1) and np.isfinite(b1) and not np.iscomplexobj(b1):
                    s1, p1 = _calculate_confidence(f1, b1, f0, true_envelope=env_db, freq_bins=freqs)
                    fr.update({'f1': float(f1), 'b1': float(b1), 'conf1': float(s1), 'prom1_db': float(p1)})
                if np.isfinite(f2) and not np.iscomplexobj(f2) and np.isfinite(b2) and not np.iscomplexobj(b2):
                    s2, p2 = _calculate_confidence(f2, b2, f0, true_envelope=env_db, freq_bins=freqs)
                    fr.update({'f2': float(f2), 'b2': float(b2), 'conf2': float(s2), 'prom2_db': float(p2)})
                if np.isfinite(f3) and not np.iscomplexobj(f3) and np.isfinite(b3) and not np.iscomplexobj(b3):
                    fr.update({'f3': float(f3), 'b3': float(b3)})

                # 轻量“非交叉/最小间距”约束（若同时有F1/F2）
                if 'f1' in fr and 'f2' in fr:
                    if not (fr['f1'] < fr['f2'] and (fr['f2'] - fr['f1'] >= 150.0)):
                        # 若不满足，给很低的合分，避免进Top窗口
                        fr['conf1'] = fr.get('conf1', 0.0) * 0.2
                        fr['conf2'] = fr.get('conf2', 0.0) * 0.2

                # 带宽硬阈（异常大带宽剔除）
                if ('b1' in fr and fr['b1'] > 700) or ('b2' in fr and fr['b2'] > 700):
                    # 依然保留记录用于 debug，但不作为候选
                    fr['conf1'] = fr.get('conf1', 0.0) * 0.2
                    fr['conf2'] = fr.get('conf2', 0.0) * 0.2

                if 'f2' in fr and 'f3' in fr:
                    if not (fr['f2'] < fr['f3'] and (fr['f3'] - fr['f2'] >= 200.0)):
                        fr['conf2'] = fr.get('conf2', 0.0) * 0.2

                all_frames.append(fr)

        if not all_frames:
            raise ValueError("No valid analysis frames found.")

        # 选“最佳时间窗口”：窗口宽 W，最大化 Σ(conf1+conf2) 与帧数
        frames = sorted(all_frames, key=lambda x: x['time'])
        W = 0.25  # 250 ms 窗口
        MIN_FRAMES = 8
        best_sum, best_i, best_j = -1.0, 0, 0
        n = len(frames)
        j = 0
        for i in range(n):
            t0 = frames[i]['time']
            while j < n and frames[j]['time'] - t0 <= W:
                j += 1
            window = frames[i:j]
            score_sum = sum(f.get('conf1', 0.0) + f.get('conf2', 0.0) for f in window)
            # 组合目标：得分优先，其次窗口内帧数，且要满足最少帧数
            if (score_sum > best_sum and (j - i) >= MIN_FRAMES) or \
               (math.isclose(score_sum, best_sum) and (j - i) > (best_j - best_i)):
                best_sum, best_i, best_j = score_sum, i, j

        best_window = frames[best_i:best_j] if best_j > best_i else frames

        def median_or_zero(key):
            vals = [f[key] for f in best_window if key in f and np.isfinite(f[key])]
            return float(np.median(vals)) if vals else 0.0

        F1 = median_or_zero('f1')
        F2 = median_or_zero('f2')
        F3 = median_or_zero('f3')
        B1 = median_or_zero('b1')
        B2 = median_or_zero('b2')
        B3 = median_or_zero('b3')
        f0_mean = median_or_zero('f0')
        best_time = float(np.median([f['time'] for f in best_window])) if best_window else None
        spl = _rms_spl(y)

        def median_conf(key):
            vv = [f[key] for f in best_window if key in f and np.isfinite(f[key])]
            return float(np.median(vv)) if vv else 0.0

        conf1_med = median_conf('conf1')
        conf2_med = median_conf('conf2')

        result = {
            'F1': round(F1, 2), 'B1': round(B1, 2),
            'F2': round(F2, 2), 'B2': round(B2, 2),
            'F3': round(F3, 2), 'B3': round(B3, 2),
            'f0_mean': round(f0_mean, 2),
            'spl_dbA_est': spl,
            'best_segment_time': best_time,
            'debug_info': {'best_window_frames': best_window[:100]},
            'is_high_pitch': bool(is_high_pitch)
        }
        # 仅当需要时才暴露可用性/原因码（不会破坏旧字段）
        if F1 == 0.0 or conf1_med < 0.5:
            result['F1_available'] = False
            result.setdefault('reason', 'LOW_PROMINENCE')
        else:
            result['F1_available'] = True
        if F2 == 0.0 or conf2_med < 0.5:
            result['F2_available'] = False
            result.setdefault('reason', 'LOW_PROMINENCE')
        else:
            result['F2_available'] = True

        return result

    except Exception as e:
        logger.error(f"Robust analysis failed for {path}: {e}", exc_info=True)
        return {
            'F1': 0, 'F2': 0, 'F3': 0, 'B1': 0, 'B2': 0, 'B3': 0,
            'f0_mean': 0, 'spl_dbA_est': 0,
            'error_details': 'Analysis failed', 'reason': str(e),
            'best_segment_time': None, 'is_high_pitch': False
        }


def analyze_sustained_vowel(local_paths: list, f0_min: int = 75, f0_max: int = 800) -> Dict:
    """
    [CN] 分析一个持续元音录音列表，根据最长发声时长（MPT）选择最佳录音，
    并返回一个包含其声学指标（包括共振峰）的综合分析字典。
    :param local_paths: 持续元音文件的本地路径列表。
    :param f0_min: 最低基频搜索范围。
    :param f0_max: 最高基频搜索范围。
    :return: 包含 'metrics', 'chosen_file', 'lpc_spectrum' 的字典。
    """
    best_file = None
    max_voiced_duration = -1.0

    for file_path in local_paths:
        if not file_path or not os.path.exists(file_path) or not file_path.endswith('.wav'):
            continue
        try:
            y, sr = _load_mono(file_path)
            non_silent_intervals = librosa.effects.split(y, top_db=40)
            voiced_duration = sum([(end - start) / sr for start, end in non_silent_intervals])

            if voiced_duration > max_voiced_duration:
                max_voiced_duration = voiced_duration
                best_file = file_path
        except Exception as e:
            logger.warning(f"Could not calculate voiced duration for {file_path}: {e}")
            continue

    if not best_file:
        return {'metrics': {'error': 'No suitable sustained vowel file found for analysis.'}}

    try:
        sound = parselmouth.Sound(best_file)
        y, sr = librosa.load(best_file, sr=None, mono=True)

        non_silent_intervals = librosa.effects.split(y, top_db=40)
        voiced_duration = sum([(end - start) / sr for start, end in non_silent_intervals])

        pitch = sound.to_pitch(pitch_floor=f0_min, pitch_ceiling=f0_max)
        f0_mean = call(pitch, "Get mean", 0, 0, "Hertz")
        point_process = call(sound, "To PointProcess (periodic, cc)", f0_min, f0_max)
        jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer_local = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        harmonicity = sound.to_harmonicity_cc(0.01, f0_min, 0.1, 1.0)
        hnr_db = call(harmonicity, "Get mean", 0, 0)

        # Restore independent formant analysis for the sustained vowel
        formant_results = analyze_note_file_robust(best_file, f0min=f0_min, f0max=f0_max)

        metrics = {
            'mpt_s': round(float(voiced_duration), 2),
            'f0_mean': round(float(f0_mean), 2) if not np.isnan(f0_mean) else 0,
            'jitter_local_percent': round(float(jitter_local), 2) if not np.isnan(jitter_local) else 0,
            'shimmer_local_percent': round(float(shimmer_local), 2) if not np.isnan(shimmer_local) else 0,
            'hnr_db': round(float(hnr_db), 2) if not np.isnan(hnr_db) else 0,
            'spl_dbA_est': round(float(_rms_spl(y)), 2),
            'formants_sustained': formant_results, # Correctly store under its own key
        }
        if formant_results.get('reason'):
            metrics['formant_analysis_reason_sustained'] = formant_results['reason']

        # Get LPC for the sustained vowel itself for plotting
        best_segment_time = formant_results.get('best_segment_time')
        is_high_pitch = formant_results.get('is_high_pitch', False)
        lpc_spectrum = get_lpc_spectrum(best_file, analysis_time=best_segment_time, is_high_pitch=is_high_pitch)

        debug_info = formant_results.pop('debug_info', None)

        return {
            'metrics': metrics,
            'chosen_file': best_file,
            'lpc_spectrum': lpc_spectrum,
            'debug_info': debug_info
        }

    except Exception as e:
        logger.error(f"Full analysis failed for the chosen sustained vowel file {best_file}. Error: {e}", exc_info=True)
        return {'metrics': {'error': 'Analysis failed for the chosen file.', 'reason': str(e)}}

def analyze_speech_flow(file_path, f0min=75, f0max=600):
    """
    [CN] 分析一段连续语音（如朗读或自发语音）的声学特征。
    计算并返回时长、发声比例、停顿次数以及基频的均值、标准差和统计数据。
    :param file_path: 音频文件的本地路径。
    :param f0min: 最低基频搜索范围。
    :param f0max: 最高基频搜索范围。
    :return: 包含分析指标的字典，如果失败则返回 None。
    """
    logger.info(f"Analyzing speech flow at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        pitch = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        f0_values = pitch.selected_array['frequency']
        f0_values = f0_values[(f0_values > 0) & np.isfinite(f0_values)]
        if f0_values.size:
            f0_mean = float(np.mean(f0_values))
            f0_sd = float(np.std(f0_values))
            f0_stats = {'p10': round(float(np.percentile(f0_values, 10)), 2), 'median': round(float(np.median(f0_values)), 2), 'p90': round(float(np.percentile(f0_values, 90)), 2)}
        else:
            f0_mean, f0_sd, f0_stats = 0.0, 0.0, {'p10': 0, 'median': 0, 'p90': 0}
        y, sr = librosa.load(file_path, sr=None)
        duration_s = librosa.get_duration(y=y, sr=sr)
        voiced_ratio = (len(f0_values) / len(pitch.xs())) if len(pitch.xs()) > 0 else 0
        non_silent = librosa.effects.split(y, top_db=40)
        pause_count = len(non_silent) - 1 if len(non_silent) > 0 else 0
        metrics = {'duration_s': round(float(duration_s), 2), 'voiced_ratio': round(float(voiced_ratio), 2), 'pause_count': int(pause_count), 'f0_mean': round(f0_mean, 2), 'f0_sd': round(f0_sd, 2), 'f0_stats': f0_stats}
        return metrics
    except Exception as e:
        logger.error(f"Could not analyze speech flow file {file_path}. Error: {e}")
        return None

def _load_mono(path):
    """
    [CN] 加载一个音频文件并将其转换为单声道。
    :param path: 音频文件的路径。
    :return: 一个包含 (y, sr) 的元组，其中 y 是音频时间序列，sr 是采样率。
    """
    y, sr = librosa.load(path, sr=None, mono=True)
    return y, sr

def _rms_spl(y):
    """
    [CN] 计算音频信号的估计声压级（SPL in dBA）。
    :param y: 音频时间序列。
    :return: 估计的 dBA 声压级。
    """
    rms = np.sqrt(np.mean(y ** 2) + 1e-12)
    return 20 * np.log10(rms) + 94.0

@dataclass
class PitchSplFrame:
    """[CN] 用于存储单个时间帧的音高和声压级的数据类。"""
    time: float
    f0: float
    spl: float

def extract_pitch_spl_series(path, f0min=75, f0max=1200):
    """
    [CN] 从音频文件中提取音高（F0）和声压级（SPL）的时间序列。
    :param path: 音频文件的本地路径。
    :param f0min: 最低基频搜索范围。
    :param f0max: 最高基频搜索范围。
    :return: 一个 PitchSplFrame 对象的列表。
    """
    try:
        y, sr = _load_mono(path)
        snd = parselmouth.Sound(path)
        pitch_obj = snd.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals = pitch_obj.selected_array['frequency']
        times = pitch_obj.xs()
        time_step = times[1]-times[0] if len(times) > 1 else 0.01
        frames = []
        for t,f0 in zip(times, f0_vals):
            if f0 <= 0 or math.isnan(f0): continue
            start, end = int(t*sr), int((t+time_step)*sr)
            if end > len(y): end = len(y)
            seg = y[start:end]
            if seg.size == 0: continue
            spl = _rms_spl(seg)
            frames.append(PitchSplFrame(time=float(t), f0=float(f0), spl=float(spl)))
        return frames
    except Exception as e:
        logger.error(f'extract_pitch_spl_series failed for {path}: {e}')
        return []

def analyze_glide_files(local_paths):
    """
    [CN] 分析一组滑音（glide）录音，以构建一个音域图（Voice Range Profile, VRP）。
    它从所有文件中提取 F0-SPL 数据点，并按半音进行分箱，计算每个半音的 SPL 范围。
    :param local_paths: 滑音文件的本地路径列表。
    :return: 包含 VRP 数据的字典。
    """
    all_frames=[]
    for p in local_paths:
        all_frames.extend(extract_pitch_spl_series(p))
    if not all_frames: return {'error':'no_frames'}
    f0s = np.array([f.f0 for f in all_frames])
    spls = np.array([f.spl for f in all_frames])
    if f0s.size == 0 or spls.size == 0: return {'error': 'no_voiced_frames_in_glides', 'f0_min': 0.0, 'f0_max': 0.0, 'spl_min': 0.0, 'spl_max': 0.0, 'bins': []}
    def hz_to_semitone(f): return 12*np.log2(f/440.0)+69
    semis = hz_to_semitone(f0s)
    semi_min, semi_max = int(np.floor(np.min(semis))), int(np.ceil(np.max(semis)))
    bins=[]
    for n in range(semi_min, semi_max+1):
        mask = (semis >= n-0.5) & (semis < n+0.5)
        sel = spls[mask]
        if sel.size: bins.append({'semi': n, 'f0_center_hz': float(440.0 * 2 ** ((n - 69)/12)), 'spl_min': float(np.min(sel)), 'spl_max': float(np.max(sel)), 'spl_mean': float(np.mean(sel)), 'count': int(sel.size)})
    return {'f0_min': float(np.percentile(f0s, 10)), 'f0_max': float(np.percentile(f0s, 90)), 'spl_min': float(np.percentile(spls, 10)), 'spl_max': float(np.percentile(spls, 90)), 'bins': bins}

def _find_loudest_segment(sound: parselmouth.Sound, duration: float = 0.1) -> parselmouth.Sound:
    """
    [CN] 找到声音中能量（RMS）最高的片段。
    :param sound: parselmouth Sound 对象。
    :param duration: 片段的时长。
    :return: 能量最高的 parselmouth Sound 片段。
    """
    if sound.duration < duration:
        return sound

    best_segment = None
    max_rms = -1.0

    step = duration / 2
    current_time = 0.0
    while current_time + duration <= sound.duration:
        segment = sound.extract_part(from_time=current_time, to_time=current_time + duration, preserve_times=False)
        rms = segment.get_rms()
        if rms > max_rms:
            max_rms = rms
            best_segment = segment
        current_time += step

    return best_segment if best_segment is not None else sound.extract_part(from_time=0, to_time=duration, preserve_times=False)

def get_lpc_spectrum(file_path: str, max_formant: int = 5500, analysis_time: Optional[float] = None, is_high_pitch: bool = False):
    """
    [CN] 获取音频文件的平滑 LPC（线性预测编码）频谱。
    该版本使用 librosa 和 scipy，比 parselmouth 的 LPC 方法更稳定。
    :param file_path: 音频文件的本地路径。
    :param max_formant: 要分析的最大共振峰频率。
    :param analysis_time: (可选) 进行分析的特定时间点（秒）。
    :param is_high_pitch: (可选) 是否为高音调声音的提示。
    :return: 包含 'frequencies' 和 'spl_values' 的字典，如果失败则返回 None。
    """
    logger.info(f"Getting LPC spectrum for {file_path}")
    try:
        y, sr = librosa.load(file_path, sr=None, mono=True)
        if y is None or y.size == 0:
            return None

        n = len(y)
        seg = None
        if analysis_time and 0 < analysis_time * sr < n:
            center_sample = int(analysis_time * sr)
            win_len_sample = int(0.1 * sr)
            start = max(0, center_sample - win_len_sample // 2)
            end = min(n, center_sample + win_len_sample // 2)
            if end > start:
                seg = y[start:end]

        if seg is None or len(seg) < int(0.05 * sr):
            start, end = int(n * 0.33), int(n * 0.66)
            if end <= start: start, end = 0, n
            seg = y[start:end]

        if seg.size < int(0.05 * sr):
            logger.warning(f"Segment too short for LPC analysis: {seg.size} samples")
            return None

        pre_emph = 0.97
        seg = np.append(seg[0], seg[1:] - pre_emph * seg[:-1])

        # Reverting to a fixed order as the adaptive logic is not working correctly.
        order = 16

        if np.allclose(np.std(seg), 0.0): return None

        a = librosa.lpc(seg, order=order)
        if scisignal is None:
            logger.error("scipy.signal not found, cannot generate LPC spectrum.")
            return None
        w, h = scisignal.freqz(b=[1.0], a=a, worN=4096, fs=sr)

        mag = np.abs(h)
        mag[mag <= 1e-12] = 1e-12
        spl_db = 20.0 * np.log10(mag)

        mask = w <= max_formant
        return {
            "frequencies": w[mask].astype(float).tolist(),
            "spl_values": spl_db[mask].astype(float).tolist()
        }
    except Exception as e:
        logger.error(f"Could not get LPC spectrum for {file_path}. Error: {e}", exc_info=True)
        return None