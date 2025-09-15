import logging
import numpy as np
import parselmouth
from parselmouth.praat import call
import librosa
import math
from dataclasses import dataclass
from typing import Optional, Dict
try:
    from scipy import signal as _scisignal
except Exception:
    _scisignal = None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def analyze_sustained_wav(file_path, f0min=75, f0max=600):
    """分析持续元音录音，提取基频、抖动、闪烁、HNR、估计 SPL 等指标。
    修复：避免对 PointProcess 调用不存在的 "Get mean"，改用 Pitch 对象获取 f0 均值。
    更新：MPT(mpt_s) 现在计算的是有效发声时长，而非文件总长。
    返回 dict（失败返回 None）。"""
    logger.info(f"Analyzing sustained vowel at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)

        # Load with librosa to calculate voiced duration for MPT
        y, sr = librosa.load(file_path, sr=None)
        non_silent_intervals = librosa.effects.split(y, top_db=40)
        voiced_duration = sum([(end - start) / sr for start, end in non_silent_intervals])

        pitch_obj = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        try:
            f0_mean = call(pitch_obj, "Get mean", 0, 0, "Hertz")
        except Exception as fe:
            logger.warning(f"Fallback computing f0_mean via numpy due to: {fe}")
            arr = pitch_obj.selected_array['frequency']
            voiced = arr[(arr>0) & np.isfinite(arr)]
            f0_mean = float(np.mean(voiced)) if voiced.size else 0.0

        point_process = call(sound, "To PointProcess (periodic, cc)", f0min, f0max)
        f0_vals_all = pitch_obj.selected_array['frequency']
        f0_voiced = f0_vals_all[(f0_vals_all>0) & np.isfinite(f0_vals_all)]
        f0_sd = float(np.std(f0_voiced)) if f0_voiced.size else 0.0

        jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer_local = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        harmonicity = call(sound, "To Harmonicity (cc)", 0.01, f0min, 0.1, 1.0)
        hnr_db = call(harmonicity, "Get mean", 0, 0)

        rms = np.sqrt(np.mean(y**2) + 1e-12)
        spl_dbA_est = 20 * np.log10(rms / 1.0) + 94

        metrics = {
            'mpt_s': round(float(voiced_duration), 2),
            'f0_mean': round(float(f0_mean), 2) if not np.isnan(f0_mean) else 0,
            'f0_sd': round(float(f0_sd), 2),
            'jitter_local_percent': round(float(jitter_local), 2) if not np.isnan(jitter_local) else 0,
            'shimmer_local_percent': round(float(shimmer_local), 2) if not np.isnan(shimmer_local) else 0,
            'hnr_db': round(float(hnr_db), 2) if not np.isnan(hnr_db) else 0,
            'spl_dbA_est': round(float(spl_dbA_est), 2)
        }
        logger.info(f"Sustained vowel analysis successful for {file_path}: {metrics}")
        return metrics
    except Exception as e:
        logger.error(f"Could not analyze sustained vowel file {file_path}. Error: {e}")
        return None

def analyze_speech_flow(file_path, f0min=75, f0max=600):
    """
    分析朗读/自由说话音频，输出时长、发声占比、停顿数及 F0 统计。
    新增：增加返回 f0_mean 和 f0_sd。
    失败返回 None。
    """
    logger.info(f"Analyzing speech flow at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        pitch = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        f0_values_all = pitch.selected_array['frequency']
        f0_values = f0_values_all[(f0_values_all > 0) & np.isfinite(f0_values_all)]

        if f0_values.size:
            f0_mean = float(np.mean(f0_values))
            f0_sd = float(np.std(f0_values))
            f0_stats = {
                'p10': round(float(np.percentile(f0_values, 10)), 2),
                'median': round(float(np.median(f0_values)), 2),
                'p90': round(float(np.percentile(f0_values, 90)), 2)
            }
        else:
            f0_mean = 0.0
            f0_sd = 0.0
            f0_stats = {'p10': 0, 'median': 0, 'p90': 0}

        y, sr = librosa.load(file_path, sr=None)
        duration_s = librosa.get_duration(y=y, sr=sr)
        voiced_ratio = (len(f0_values) / len(pitch.xs())) if len(pitch.xs()) > 0 else 0
        non_silent = librosa.effects.split(y, top_db=40)
        pause_count = len(non_silent) - 1 if len(non_silent) > 0 else 0

        metrics = {
            'duration_s': round(float(duration_s), 2),
            'voiced_ratio': round(float(voiced_ratio), 2),
            'pause_count': int(pause_count),
            'f0_mean': round(f0_mean, 2),
            'f0_sd': round(f0_sd, 2),
            'f0_stats': f0_stats
        }
        logger.info(f"Speech flow analysis successful for {file_path}: {metrics}")
        return metrics
    except Exception as e:
        logger.error(f"Could not analyze speech flow file {file_path}. Error: {e}")
        return None

def _load_mono(path):
    y, sr = librosa.load(path, sr=None, mono=True)
    return y, sr

def _rms_spl(y):
    rms = np.sqrt(np.mean(y ** 2) + 1e-12)
    return 20 * np.log10(rms) + 94.0

@dataclass
class PitchSplFrame:
    time: float
    f0: float
    spl: float

def extract_pitch_spl_series(path, f0min=75, f0max=1200):
    try:
        y, sr = _load_mono(path)
        snd = parselmouth.Sound(path)
        pitch_obj = snd.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals = pitch_obj.selected_array['frequency']
        times = pitch_obj.xs()
        time_step = times[1]-times[0] if len(times) > 1 else 0.01
        frames = []
        for t,f0 in zip(times, f0_vals):
            if f0 <= 0 or math.isnan(f0):
                continue
            start = int(t*sr)
            end = int((t+time_step)*sr)
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
    """聚合多条滑音文件生成 VRP 数据，使用10/90百分位计算F0和SPL范围。"""
    all_frames=[]
    for p in local_paths:
        all_frames.extend(extract_pitch_spl_series(p))
    if not all_frames:
        return {'error':'no_frames'}
    
    f0s = np.array([f.f0 for f in all_frames])
    spls = np.array([f.spl for f in all_frames])

    if f0s.size == 0 or spls.size == 0:
        return {
            'error': 'no_voiced_frames_in_glides',
            'f0_min': 0.0, 'f0_max': 0.0,
            'spl_min': 0.0, 'spl_max': 0.0,
            'bins': []
        }

    def hz_to_semitone(f): return 12*np.log2(f/440.0)+69
    semis = hz_to_semitone(f0s)
    semi_min = int(np.floor(np.min(semis)))
    semi_max = int(np.ceil(np.max(semis)))
    bins=[]
    for n in range(semi_min, semi_max+1):
        mask = (semis >= n-0.5) & (semis < n+0.5)
        sel = spls[mask]
        if sel.size:
            bins.append({
                'semi': n,
                'f0_center_hz': float(440.0 * 2 ** ((n - 69)/12)),
                'spl_min': float(np.min(sel)),
                'spl_max': float(np.max(sel)),
                'spl_mean': float(np.mean(sel)),
                'count': int(sel.size)
            })
    return {
        'f0_min': float(np.percentile(f0s, 10)),
        'f0_max': float(np.percentile(f0s, 90)),
        'spl_min': float(np.percentile(spls, 10)),
        'spl_max': float(np.percentile(spls, 90)),
        'bins': bins
    }

def _get_robust_formants(
    sound: parselmouth.Sound,
    f0min: int = 75,
    f0max: int = 1200,
    max_formant: int = 5500,
    time_step: float = 0.01,
    window_length: float = 0.025,
    pre_emphasis_from: float = 50.0,
    intensity_threshold_db: float = -25.0,
    hnr_threshold_db: float = 2.0,
    min_continuous_frames: int = 10
) -> Dict:
    """
    A robust method to extract F1, F2, F3 formants and the stable segment time.
    """
    try:
        pitch = sound.to_pitch(time_step=time_step, pitch_floor=f0min, pitch_ceiling=f0max)
        all_times = pitch.xs()

        # Initialize analysis objects outside the loop
        intensity = sound.to_intensity(minimum_pitch=f0min, time_step=time_step)
        max_intensity = call(intensity, "Get maximum", 0, 0, "parabolic")
        min_intensity_db = max_intensity + intensity_threshold_db
        harmonicity = sound.to_harmonicity_cc(time_step=time_step, minimum_pitch=f0min)

        frame_results = []
        for i, t in enumerate(all_times):
            is_voiced = call(pitch, "Get value at time", t, "Hertz", "Linear") > 0
            if not is_voiced:
                frame_results.append(None)
                continue

            intensity_db = call(intensity, "Get value at time", t, "Cubic")
            hnr = call(harmonicity, "Get value at time", t, "Linear")

            if not (hnr >= hnr_threshold_db and intensity_db >= min_intensity_db):
                frame_results.append(None)
                continue

            frame_sound = sound.extract_part(from_time=t - window_length/2, to_time=t + window_length/2, preserve_times=False)
            if frame_sound.get_total_duration() == 0:
                frame_results.append(None)
                continue

            formants = frame_sound.to_formant_burg(max_number_of_formants=5, maximum_formant=max_formant, window_length=window_length, pre_emphasis_from=pre_emphasis_from)
            frame_f = [0.0] * 3
            for j in range(1, 4):
                f = call(formants, "Get value at time", j, 0, 'Hertz', 'Linear')
                bw = call(formants, "Get bandwidth at time", j, 0, 'Hertz', 'Linear')
                if 50 < bw < 700:
                    frame_f[j-1] = f

            f1, f2, f3 = frame_f
            if f1 > 0 and f2 > 0 and f1 < f2 and (f2 - f1) >= 150:
                if f3 > 0 and (f2 >= f3 or (f3 - f2) < 200):
                    f3 = 0.0
                frame_results.append({'f1': f1, 'f2': f2, 'f3': f3})
            else:
                frame_results.append(None)

    except Exception as e:
        logger.warning(f"Exception during formant frame analysis: {e}")
        return {'error': 'Exception in formant analysis'}

    # Find the longest continuous segment of valid frames
    longest_segment_info = {'start_index': -1, 'end_index': -1, 'length': 0}
    current_segment_start = -1
    for i, result in enumerate(frame_results):
        if result is not None:
            if current_segment_start == -1:
                current_segment_start = i
        elif current_segment_start != -1:
            current_length = i - current_segment_start
            if current_length > longest_segment_info['length']:
                longest_segment_info.update(start_index=current_segment_start, end_index=i - 1, length=current_length)
            current_segment_start = -1

    # Final check in case the longest segment is at the very end of the file
    if current_segment_start != -1:
        current_length = len(frame_results) - current_segment_start
        if current_length > longest_segment_info['length']:
            longest_segment_info.update(start_index=current_segment_start, end_index=len(frame_results) - 1, length=current_length)

    if longest_segment_info['length'] < min_continuous_frames:
        return {'error': f'No stable segment of {min_continuous_frames * time_step * 1000:.0f}ms found'}

    start_idx, end_idx = longest_segment_info['start_index'], longest_segment_info['end_index']
    stable_segment_frames = [res for res in frame_results[start_idx:end_idx+1] if res]

    final_results = {
        'segment_start_s': all_times[start_idx],
        'segment_end_s': all_times[end_idx]
    }
    for i in range(1, 4):
        fn = f'f{i}'
        track = np.array([frame[fn] for frame in stable_segment_frames if frame.get(fn, 0) > 0])
        final_results[f'F{i}'] = round(float(np.median(track)), 2) if len(track) > 0 else 0.0

    return final_results

def analyze_note_file(path, f0min=75, f0max=1200):
    try:
        snd = parselmouth.Sound(path)

        # New robust formant analysis, returns formants and stable segment times
        analysis_results = _get_robust_formants(snd, f0min=f0min, f0max=f0max)

        if 'error' in analysis_results:
            return {'F1': 0, 'F2': 0, 'F3': 0, 'f0_mean': 0, 'spl_dbA_est': 0, 'error_details': analysis_results['error']}

        f1 = analysis_results.get('F1', 0.0)
        f2 = analysis_results.get('F2', 0.0)
        f3 = analysis_results.get('F3', 0.0)

        # Calculate F0 and SPL on the *same stable segment* used for formants
        start_s = analysis_results.get('segment_start_s')
        end_s = analysis_results.get('segment_end_s')

        if end_s <= start_s:
            # Fallback to whole audio if segment is invalid
            segment_for_f0 = snd
            y, sr = _load_mono(path)
        else:
            segment_for_f0 = snd.extract_part(from_time=start_s, to_time=end_s, preserve_times=False)
            y, sr = snd.as_array()
            start_sample, end_sample = int(start_s * sr), int(end_s * sr)
            y = y[start_sample:end_sample]

        pitch = segment_for_f0.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals = pitch.selected_array['frequency']
        f0_vals = f0_vals[(f0_vals > 0) & np.isfinite(f0_vals)]
        f0_mean = round(float(np.median(f0_vals)), 2) if f0_vals.size else 0.0

        # SPL of the segment
        spl = _rms_spl(y)

        result = {'f0_mean': f0_mean, 'F1': f1, 'F2': f2, 'F3': f3, 'spl_dbA_est': spl}
        return result

    except Exception as e:
        logger.error(f'analyze_note_file failed for {path}: {e}', exc_info=True)
        return {'error': str(e)}

def get_lpc_spectrum(file_path: str):
    """
    计算音频中段的 LPC 频谱包络，用于“共振峰-SPL（LPC）”图。

    返回:
        dict: { 'frequencies': List[float], 'spl_values': List[float] }，失败返回 None。
    说明:
        - 采用 librosa.lpc 估计 LPC 系数，再用 scipy.signal.freqz 计算频率响应，转为 dB。
        - 避免误用 Parselmouth 的 to_lpc_burg 参数导致的运行时错误。
    """
    logger.info(f"Getting LPC spectrum for {file_path}")
    try:
        # 加载单声道
        y, sr = librosa.load(file_path, sr=None, mono=True)
        if y is None or y.size == 0:
            return None
        # 取中间 1/3 片段以避免起止端不稳定
        n = len(y)
        start = int(n * 0.33)
        end = int(n * 0.66)
        if end <= start:
            start, end = 0, n
        seg = y[start:end]
        if seg.size < int(0.1 * sr):  # 至少 100ms
            seg = y
        # 预加重，有助于高频建模
        pre_emph = 0.97
        seg = np.append(seg[0], seg[1:] - pre_emph * seg[:-1])
        # 选择 LPC 阶数：常用经验 2 + 2 * (sr/1000)
        order = max(8, int(2 + 2 * (sr / 1000)))
        # librosa.lpc 需要数值稳定的输入
        if np.allclose(np.std(seg), 0.0):
            return None
        try:
            a = librosa.lpc(seg, order=order)
        except Exception as e:
            logger.warning(f"librosa.lpc failed (order={order}), fallback to lower order: {e}")
            order = max(8, int(2 + (sr / 1000)))
            a = librosa.lpc(seg, order=order)
        # 计算频率响应
        worN = 4096
        if _scisignal is not None:
            # 优先使用 scipy.signal.freqz（若可用）
            w, h = _scisignal.freqz(b=[1.0], a=a, worN=worN, fs=sr)
            freqs = w  # Hz
        else:
            # 回退：使用 numpy 直接计算频率响应，避免在缺少 scipy 时返回 None
            logger.warning("scipy.signal not available; falling back to numpy freq response")
            w = np.linspace(0, np.pi, worN)
            # 由于 b=[1.0]，分子恒为1，这里仅计算分母多项式
            exp = np.exp(-1j * np.outer(w, np.arange(len(a))))
            h = 1.0 / (exp @ a)
            freqs = w * sr / (2 * np.pi)

        mag = np.abs(h)
        mag[mag <= 1e-12] = 1e-12
        spl_db = 20.0 * np.log10(mag)
        # 仅保留 0 ~ 5500 Hz
        mask = freqs <= 5500.0
        return {
            "frequencies": freqs[mask].astype(float).tolist(),
            "spl_values": spl_db[mask].astype(float).tolist()
        }
    except Exception as e:
        logger.error(f"Could not get LPC spectrum for {file_path}. Error: {e}")
        return None
