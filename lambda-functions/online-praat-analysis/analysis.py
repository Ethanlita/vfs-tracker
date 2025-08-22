import logging
import numpy as np
import parselmouth
from parselmouth.praat import call
import librosa
import math
from dataclasses import dataclass

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def analyze_sustained_wav(file_path, f0min=75, f0max=600):
    """分析持续元音录音，提取基频、抖动、闪烁、HNR、估计 SPL 等指标。
    修复：避免对 PointProcess 调用不存在的 \"Get mean\"，改用 Pitch 对象获取 f0 均值。
    返回 dict（失败返回 None）。"""
    logger.info(f"Analyzing sustained vowel at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        duration = sound.get_total_duration()
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

        y, sr = librosa.load(file_path, sr=None)
        rms = np.sqrt(np.mean(y**2) + 1e-12)
        spl_dbA_est = 20 * np.log10(rms / 1.0) + 94

        metrics = {
            'mpt_s': round(float(duration), 2),
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
    """分析朗读/自由说话音频，输出时长、发声占比、停顿数及 F0 统计。失败返回 None。"""
    logger.info(f"Analyzing speech flow at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        pitch = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        f0_values_all = pitch.selected_array['frequency']
        f0_values = f0_values_all[(f0_values_all>0) & np.isfinite(f0_values_all)]

        if f0_values.size:
            f0_stats = {
                'p10': round(float(np.percentile(f0_values, 10)), 2),
                'median': round(float(np.median(f0_values)), 2),
                'p90': round(float(np.percentile(f0_values, 90)), 2)
            }
        else:
            f0_stats = {'p10':0, 'median':0, 'p90':0}

        y, sr = librosa.load(file_path, sr=None)
        duration_s = librosa.get_duration(y=y, sr=sr)
        voiced_ratio = (len(f0_values)/len(pitch.xs())) if len(pitch.xs())>0 else 0
        non_silent = librosa.effects.split(y, top_db=40)
        pause_count = len(non_silent)-1 if len(non_silent)>0 else 0

        metrics = {
            'duration_s': round(float(duration_s),2),
            'voiced_ratio': round(float(voiced_ratio),2),
            'pause_count': int(pause_count),
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

def analyze_note_file(path, f0min=75, f0max=1200):
    try:
        snd = parselmouth.Sound(path)
        total_dur = snd.get_total_duration()
        mid_start = total_dur * 0.33
        mid_end = total_dur * 0.66
        segment = snd.extract_part(from_time=mid_start, to_time=mid_end, preserve_times=False)
        pitch = segment.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals = pitch.selected_array['frequency']
        f0_vals = f0_vals[(f0_vals>0) & np.isfinite(f0_vals)]
        f0_mean = float(np.median(f0_vals)) if f0_vals.size else 0.0
        formant = segment.to_formant_burg()
        tmid = segment.get_total_duration()/2
        def get_form(n):
            try: return float(call(formant, "Get value at time", n, tmid, 'Hertz', 'Linear'))
            except Exception: return 0.0
        f1,f2,f3 = get_form(1),get_form(2),get_form(3)
        y, sr = _load_mono(path)
        spl = _rms_spl(y)
        return {'f0_mean': f0_mean, 'F1': f1, 'F2': f2, 'F3': f3, 'spl_dbA_est': spl}
    except Exception as e:
        logger.error(f'analyze_note_file failed for {path}: {e}')
        return {'error': str(e)}

def get_lpc_spectrum(file_path: str):
    """
    Analyzes a sound file to get its LPC spectrum.

    Args:
        file_path (str): The local path to the .wav file.

    Returns:
        dict: A dictionary with 'frequencies' and 'spl_values' lists, or None on failure.
    """
    logger.info(f"Getting LPC spectrum for {file_path}")
    try:
        sound = parselmouth.Sound(file_path)
        mid_start = sound.get_total_duration() * 0.33
        mid_end = sound.get_total_duration() * 0.66
        segment = sound.extract_part(from_time=mid_start, to_time=mid_end, preserve_times=False)
        
        lpc = segment.to_lpc_burg(time_step=0.01, max_formant=5500)
        spectrum = lpc.to_spectrum(maximum_frequency=5500)
        
        frequencies = spectrum.xs()
        spl_values = spectrum.values.T[0]

        return {
            "frequencies": frequencies.tolist(),
            "spl_values": spl_values.tolist()
        }
    except Exception as e:
        logger.error(f"Could not get LPC spectrum for {file_path}. Error: {e}")
        return None
