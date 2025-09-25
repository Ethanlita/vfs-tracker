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

def _calculate_confidence(f0, hnr, bw):
    """Computes a confidence score for a formant candidate."""
    p_score = 1.0 if f0 > 0 else 0.0
    hnr_score = min(1.0, max(0.0, (hnr - 5) / 20))
    bw_dev = min(abs(bw - 80), abs(bw - 500))
    bw_score = max(0.0, 1.0 - bw_dev / 500)
    confidence = 0.5 * p_score + 0.35 * hnr_score + 0.15 * bw_score
    return {
        "confidence": confidence, "p_score": p_score, "hnr_score": hnr_score, "bw_score": bw_score
    }

def analyze_note_file_robust(path: str, f0min: int = 75, f0max: int = 1200) -> Dict:
    """
    Analyzes all voiced segments, calculates confidence for each frame, and returns
    the data from the frame with the highest confidence.
    """
    try:
        sound = parselmouth.Sound(path)
        y, sr = _load_mono(path)

        pitch_for_f0_check = sound.to_pitch()
        f0_median_values = [f for f in pitch_for_f0_check.selected_array['frequency'] if f > 0]
        f0_median = np.median(f0_median_values) if f0_median_values else 0
        is_high_pitch = f0_median > 175.0
        max_formant_freq = 8000 if is_high_pitch else 5500
        logger.info(f"Analyzing note with F0 median={f0_median:.2f} Hz. High pitch mode: {is_high_pitch}. Max formant: {max_formant_freq} Hz.")

        voiced_intervals = librosa.effects.split(y, top_db=40, frame_length=2048, hop_length=512)
        if voiced_intervals.size == 0:
            raise ValueError("No voiced segments detected.")

        all_frames_data = []
        harmonicity = sound.to_harmonicity_cc(time_step=0.01, minimum_pitch=f0min)

        for start_sample, end_sample in voiced_intervals:
            start_time, end_time = start_sample / sr, end_sample / sr
            if (end_time - start_time) < 0.05: continue

            segment = sound.extract_part(from_time=start_time, to_time=end_time, preserve_times=False)
            logger.info(f"Analyzing segment from {start_time:.3f}s to {end_time:.3f}s (duration: {segment.duration:.3f}s, RMS: {segment.get_rms():.4f})")

            window_length = 0.01 if is_high_pitch else 0.025
            formants = segment.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=max_formant_freq, window_length=window_length, pre_emphasis_from=50.0)
            pitch = segment.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)

            for t in pitch.xs():
                f0 = pitch.get_value_at_time(t)
                if np.isnan(f0) or f0 <= 0: continue

                hnr = harmonicity.get_value(time=start_time + t)
                if np.isnan(hnr): continue

                frame_data = {'time': start_time + t, 'f0': f0, 'hnr': hnr}

                f1 = formants.get_value_at_time(1, t)
                b1 = formants.get_bandwidth_at_time(1, t)
                if not np.isnan(f1) and not np.isnan(b1):
                    conf_data = _calculate_confidence(f0, hnr, b1)
                    frame_data.update({'f1': f1, 'b1': b1, 'conf1': conf_data['confidence'], **{f'c1_{k}': v for k,v in conf_data.items()}})

                f2 = formants.get_value_at_time(2, t)
                b2 = formants.get_bandwidth_at_time(2, t)
                if not np.isnan(f2) and not np.isnan(b2):
                    conf_data = _calculate_confidence(f0, hnr, b2)
                    frame_data.update({'f2': f2, 'b2': b2, 'conf2': conf_data['confidence'], **{f'c2_{k}': v for k,v in conf_data.items()}})

                f3 = formants.get_value_at_time(3, t)
                b3 = formants.get_bandwidth_at_time(3, t)
                if not np.isnan(f3) and not np.isnan(b3):
                    frame_data.update({'f3': f3, 'b3': b3})

                all_frames_data.append(frame_data)

        if not all_frames_data:
            raise ValueError("No valid analysis frames found.")

        best_frame = max(all_frames_data, key=lambda x: x.get('conf1', 0) + x.get('conf2', 0))

        spl = _rms_spl(y)

        return {
            'F1': round(float(best_frame.get('f1', 0)), 2), 'B1': round(float(best_frame.get('b1', 0)), 2),
            'F2': round(float(best_frame.get('f2', 0)), 2), 'B2': round(float(best_frame.get('b2', 0)), 2),
            'F3': round(float(best_frame.get('f3', 0)), 2), 'B3': round(float(best_frame.get('b3', 0)), 2),
            'f0_mean': round(float(best_frame.get('f0', 0)), 2),
            'spl_dbA_est': spl,
            'best_segment_time': best_frame.get('time', 0),
            'debug_info': {'frames': all_frames_data}
        }

    except Exception as e:
        logger.error(f"Robust analysis failed for {path}: {e}", exc_info=True)
        return {'F1': 0, 'F2': 0, 'F3': 0, 'f0_mean': 0, 'spl_dbA_est': 0, 'error_details': 'Analysis failed', 'reason': str(e), 'best_segment_time': None}


def analyze_sustained_vowel(local_paths: list, f0_min: int = 75, f0_max: int = 800) -> Dict:
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

        formant_results = analyze_note_file_robust(best_file, f0min=f0_min, f0max=f0_max)

        metrics = {
            'mpt_s': round(float(voiced_duration), 2),
            'f0_mean': round(float(f0_mean), 2) if not np.isnan(f0_mean) else 0,
            'jitter_local_percent': round(float(jitter_local), 2) if not np.isnan(jitter_local) else 0,
            'shimmer_local_percent': round(float(shimmer_local), 2) if not np.isnan(shimmer_local) else 0,
            'hnr_db': round(float(hnr_db), 2) if not np.isnan(hnr_db) else 0,
            'spl_dbA_est': round(float(_rms_spl(y)), 2),
            'formants_sustained': formant_results,
        }
        if formant_results.get('reason'):
            metrics['formant_analysis_reason_sustained'] = formant_results['reason']

        best_segment_time = formant_results.get('best_segment_time')
        lpc_spectrum = get_lpc_spectrum(best_file, analysis_time=best_segment_time)

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
    """Finds the segment of a sound with the highest energy (RMS)."""
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

def get_lpc_spectrum(file_path: str, max_formant: int = 5500, analysis_time: Optional[float] = None):
    """
    Get a smooth LPC (Linear Predictive Coding) spectrum of an audio file.
    This version uses librosa and scipy, which is more stable than the parselmouth LPC methods.
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

        order = max(8, int(2 + 2 * (sr / 1000)))
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