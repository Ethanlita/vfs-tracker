import logging
import numpy as np
import parselmouth
from parselmouth.praat import call
import soundfile as sf
import librosa
import math
from dataclasses import dataclass

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def analyze_sustained_wav(file_path, f0min=75, f0max=600):
    """
    Analyzes a sustained vowel recording using Parselmouth.

    Args:
        file_path (str): The local path to the .wav file.
        f0min (int): Minimum pitch frequency for analysis.
        f0max (int): Maximum pitch frequency for analysis.

    Returns:
        dict: A dictionary containing key acoustic metrics.
              Returns None if the analysis fails.
    """
    logger.info(f"Analyzing sustained vowel at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        duration = sound.get_total_duration()
        point_process = call(sound, "To PointProcess (periodic, cc)", f0min, f0max)
        f0_mean = call(point_process, "Get mean", 0, 0, "Hertz")
        # 计算 f0 序列与标准差
        pitch_obj = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        f0_vals_all = pitch_obj.selected_array['frequency']
        f0_voiced = f0_vals_all[(f0_vals_all>0) & np.isfinite(f0_vals_all)]
        f0_sd = float(np.std(f0_voiced)) if f0_voiced.size else 0.0
        jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer_local = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        harmonicity = call(sound, "To Harmonicity (cc)", 0.01, f0min, 0.1, 1.0)
        hnr_db = call(harmonicity, "Get mean", 0, 0)
        y, sr = librosa.load(file_path, sr=None)
        rms = np.sqrt(np.mean(y**2))
        spl_dbA_est = 20 * np.log10(rms / 1.0) + 94
        metrics = {
            'mpt_s': round(duration, 2),
            'f0_mean': round(f0_mean, 2) if not np.isnan(f0_mean) else 0,
            'f0_sd': round(f0_sd, 2),
            'jitter_local_percent': round(jitter_local, 2) if not np.isnan(jitter_local) else 0,
            'shimmer_local_percent': round(shimmer_local, 2) if not np.isnan(shimmer_local) else 0,
            'hnr_db': round(hnr_db, 2) if not np.isnan(hnr_db) else 0,
            'spl_dbA_est': round(spl_dbA_est, 2)
        }
        logger.info(f"Sustained vowel analysis successful for {file_path}: {metrics}")
        return metrics
    except Exception as e:
        logger.error(f"Could not analyze sustained vowel file {file_path}. Error: {e}")
        return None

def analyze_speech_flow(file_path, f0min=75, f0max=600):
    """
    Analyzes a speech flow recording (e.g., reading passage).

    Args:
        file_path (str): The local path to the .wav file.
        f0min (int): Minimum pitch frequency for analysis.
        f0max (int): Maximum pitch frequency for analysis.

    Returns:
        dict: A dictionary containing speech flow metrics.
              Returns None if analysis fails.
    """
    logger.info(f"Analyzing speech flow at {file_path} with F0 range {f0min}-{f0max} Hz")
    try:
        sound = parselmouth.Sound(file_path)
        pitch = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        
        # Get F0 stats
        f0_values = pitch.selected_array['frequency']
        f0_values = f0_values[f0_values != 0] # Remove unvoiced frames
        
        if len(f0_values) > 0:
            f0_stats = {
                'p10': round(np.percentile(f0_values, 10), 2),
                'median': round(np.median(f0_values), 2),
                'p90': round(np.percentile(f0_values, 90), 2)
            }
        else:
            f0_stats = {'p10': 0, 'median': 0, 'p90': 0}

        # Get duration, voiced ratio, and pause count using librosa
        y, sr = librosa.load(file_path, sr=None)
        duration_s = librosa.get_duration(y=y, sr=sr)
        
        # Voiced ratio
        voiced_frames = np.where(f0_values > 0)[0]
        voiced_ratio = len(voiced_frames) / len(pitch.xs()) if len(pitch.xs()) > 0 else 0
        
        # Pause count (simple silence-based detection)
        non_silent_intervals = librosa.effects.split(y, top_db=40)
        pause_count = len(non_silent_intervals) - 1 if len(non_silent_intervals) > 0 else 0

        metrics = {
            'duration_s': round(duration_s, 2),
            'voiced_ratio': round(voiced_ratio, 2),
            'pause_count': pause_count,
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
    return 20 * np.log10(rms) + 94.0  # 94dB 参考（占位/未校准）

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
        for idx,(t,f0) in enumerate(zip(times, f0_vals)):
            if f0 <= 0 or math.isnan(f0):
                continue
            start = int(t*sr)
            end = int((t+time_step)*sr)
            if end > len(y):
                end = len(y)
            seg = y[start:end]
            if seg.size == 0:
                continue
            spl = _rms_spl(seg)
            frames.append(PitchSplFrame(time=float(t), f0=float(f0), spl=float(spl)))
        return frames
    except Exception as e:
        logger.error(f'extract_pitch_spl_series failed for {path}: {e}')
        return []

def analyze_glide_files(local_paths):
    """聚合多条滑音文件，生成 VRP (半音 bins) 数据。"""
    all_frames = []
    for p in local_paths:
        all_frames.extend(extract_pitch_spl_series(p))
    if not all_frames:
        return {'error': 'no_frames'}
    f0s = np.array([f.f0 for f in all_frames])
    spls = np.array([f.spl for f in all_frames])
    f0_min = float(np.min(f0s)); f0_max = float(np.max(f0s))
    # 半音分箱
    def hz_to_semitone(f):
        return 12 * np.log2(f / 440.0) + 69  # MIDI note number 标度
    semis = hz_to_semitone(f0s)
    semi_min = int(np.floor(np.min(semis)))
    semi_max = int(np.ceil(np.max(semis)))
    bins = []
    for n in range(semi_min, semi_max + 1):
        mask = (semitones := semis) >= n - 0.5
        mask &= semitones < n + 0.5
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
    vrp = {
        'f0_min': f0_min,
        'f0_max': f0_max,
        'spl_min': float(np.min(spls)),
        'spl_max': float(np.max(spls)),
        'bins': bins
    }
    return vrp

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
            try:
                return float(call(formant, "Get value at time", n, tmid, 'Hertz', 'Linear'))
            except Exception:
                return 0.0
        f1 = get_form(1); f2 = get_form(2); f3 = get_form(3)
        y, sr = _load_mono(path)
        spl = _rms_spl(y)
        return {'f0_mean': f0_mean, 'F1': f1, 'F2': f2, 'F3': f3, 'spl_dbA_est': spl}
    except Exception as e:
        logger.error(f'analyze_note_file failed for {path}: {e}')
        return {'error': str(e)}
