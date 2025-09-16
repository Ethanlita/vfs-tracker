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
    from scipy.signal import find_peaks
except ImportError:
    find_peaks = None

try:
    from scipy import signal as scisignal
except ImportError:
    scisignal = None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Start of New Robust Formant Analysis Implementation ---

def _calculate_confidence(f0_hz: float, hnr: float, bandwidth: float) -> float:
    """Calculates a confidence score for a single formant candidate."""
    periodicity_score = 1.0 if f0_hz > 0 else 0.0
    hnr_score = min(1.0, max(0.0, (hnr - 5) / 20)) # HNR values from 5-25 are good
    if 80 <= bandwidth <= 500: # Slightly wider acceptance for bandwidth
        bw_score = 1.0
    else:
        deviation = min(abs(bandwidth - 80), abs(bandwidth - 500))
        bw_score = max(0.0, 1.0 - deviation / 500)

    # Re-weighted without prominence. Periodicity and HNR are most important.
    confidence = (
        0.50 * periodicity_score + 0.35 * hnr_score +
        0.15 * bw_score
    )
    return confidence


def _get_formant_candidates(
    sound_frame: parselmouth.Sound, params: Dict, f0_hz: float, hnr: float
) -> List[Tuple[float, float, float]]:
    """
    Extracts formant candidates from a sound frame using parselmouth's high-level functions.
    The 'confidence' score is now the third element in the returned tuple.
    """
    candidates = []
    try:
        # Use the object-oriented method, which is more robust.
        # time_step=None means we analyze the whole sound_frame as a single window.
        formants = sound_frame.to_formant_burg(
            time_step=None,
            max_number_of_formants=5,
            maximum_formant=params['max_formant'],
            pre_emphasis_from=50.0
        )

        # We analyze at the center of the frame
        frame_center_time = sound_frame.duration / 2.0
        num_formants_found = formants.get_number_of_formants_at_time(frame_center_time)

        for i in range(1, num_formants_found + 1):
            freq = formants.get_value_at_time(formant_number=i, time=frame_center_time)
            if np.isnan(freq) or freq == 0 or freq > params['max_formant']:
                continue

            bw = formants.get_bandwidth_at_time(formant_number=i, time=frame_center_time)
            if np.isnan(bw):
                continue

            confidence = _calculate_confidence(f0_hz, hnr, bw)

            # The third element was prominence, now it's confidence
            candidates.append((freq, bw, confidence))

        return sorted(candidates)  # Sort by frequency

    except Exception as e:
        # This can happen if a frame is unvoiced or too short
        logger.debug(f"Could not get formant candidates for frame: {e}")
        return []


def _analyze_formant_structure(
    sound: parselmouth.Sound, f0min: int, f0max: int,
    max_formant: int
) -> Dict:
    """Core analysis function with frame-by-frame analysis and confidence scoring."""
    time_step = 0.01
    window_length = 0.025
    min_continuous_frames = 5

    pitch = sound.to_pitch(time_step=time_step, pitch_floor=f0min, pitch_ceiling=f0max)
    harmonicity = sound.to_harmonicity_cc(time_step=time_step, minimum_pitch=f0min)

    formant_tracks = {1: [], 2: [], 3: []}

    for t in pitch.xs():
        f0_hz = call(pitch, "Get value at time", t, "Hertz", "Linear")
        if f0_hz == 0 or np.isnan(f0_hz): continue

        hnr = call(harmonicity, "Get value at time", t, "Linear")
        frame_sound = sound.extract_part(from_time=t - window_length/2, to_time=t + window_length/2, preserve_times=False)
        if frame_sound.get_total_duration() < window_length * 0.9: continue

        candidates = _get_formant_candidates(frame_sound, {'max_formant': max_formant}, f0_hz, hnr)

        formants_found = {}
        last_freq = 0
        # Unpack freq, bandwidth, and the new confidence score
        for freq, bw, confidence in candidates:
            if len(formants_found) >= 3: break
            # Basic check to ensure formants are in ascending order
            if freq <= last_freq: continue

            if confidence > 0.35: # Use the confidence score directly (relaxed threshold)
                formant_num = len(formants_found) + 1
                formants_found[formant_num] = (freq, confidence)
                last_freq = freq

        for i in range(1, 4):
            if i in formants_found:
                formant_tracks[i].append((t, formants_found[i][0], formants_found[i][1]))

    final_formants = {}
    for i in range(1, 4):
        track = formant_tracks[i]
        if len(track) < min_continuous_frames:
            final_formants[f'F{i}'] = 0.0
            continue

        high_conf_values = [val for t, val, conf in track if conf >= 0.6]
        if not high_conf_values or len(high_conf_values) < min_continuous_frames:
            final_formants[f'F{i}'] = 0.0
        else:
            final_formants[f'F{i}'] = round(float(np.median(high_conf_values)), 2)

    if all(v == 0.0 for v in final_formants.values()):
        return {'error': 'Analysis failed', 'reason': 'Could not find any stable, high-confidence formant tracks.'}

    return final_formants

def analyze_note_file_robust(path: str, f0min: int = 75, f0max: int = 1200) -> Dict:
    """Controller function for robust formant analysis with fallback for gliding notes."""
    sound = parselmouth.Sound(path)
    param_sets = [
        {'max_formant': 5500},
        {'max_formant': 5000},
        {'max_formant': 6000},
    ]

    final_results = {}
    for params in param_sets:
        logger.info(f"Attempting formant analysis with params: {params}")
        results = _analyze_formant_structure(sound, f0min, f0max, **params)
        if 'error' not in results:
            final_results = results
            break

    if not final_results or 'error' in final_results:
        return {'F1': 0, 'F2': 0, 'F3': 0, 'f0_mean': 0, 'spl_dbA_est': 0, 'error_details': 'Analysis failed', 'reason': 'Failed to find formants even with multiple parameter sets.'}

    y, sr = _load_mono(path)
    spl = _rms_spl(y)
    pitch = sound.to_pitch(time_step=0.01, pitch_floor=f0min, pitch_ceiling=f0max)
    f0_vals = pitch.selected_array['frequency']
    f0_vals = f0_vals[(f0_vals > 0) & np.isfinite(f0_vals)]
    f0_mean = round(float(np.median(f0_vals)), 2) if f0_vals.size else 0.0

    final_results['f0_mean'] = f0_mean
    final_results['spl_dbA_est'] = spl

    return final_results

def analyze_sustained_vowel(local_paths: list, f0_min: int = 75, f0_max: int = 800) -> Dict:
    """
    Analyzes a list of sustained vowel recordings, picks the best one based on stability,
    and returns a comprehensive analysis dictionary.
    """
    best_file = None
    min_stability_score = float('inf')

    # First, find the most stable file
    for file_path in local_paths:
        if not file_path or not os.path.exists(file_path):
            continue
        try:
            sound = parselmouth.Sound(file_path)
            point_process = call(sound, "To PointProcess (periodic, cc)", f0_min, f0_max)
            jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
            shimmer = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
            # Use a simple stability score; lower is better. Penalize NaN.
            stability_score = (jitter * 100 if not np.isnan(jitter) else 100) + \
                              (shimmer * 100 if not np.isnan(shimmer) else 100)

            if stability_score < min_stability_score:
                min_stability_score = stability_score
                best_file = file_path
        except Exception as e:
            logger.warning(f"Could not perform stability check on {file_path}: {e}")
            continue

    if not best_file:
        return {'metrics': {'error': 'No suitable sustained vowel file found for analysis.'}}

    # Now, perform a full analysis on the best file
    try:
        sound = parselmouth.Sound(best_file)
        y, sr = librosa.load(best_file, sr=None, mono=True)

        # MPT based on voiced segments
        non_silent_intervals = librosa.effects.split(y, top_db=40)
        voiced_duration = sum([(end - start) / sr for start, end in non_silent_intervals])

        # Standard metrics
        pitch = sound.to_pitch(pitch_floor=f0_min, pitch_ceiling=f0_max)
        f0_mean = call(pitch, "Get mean", 0, 0, "Hertz")
        point_process = call(sound, "To PointProcess (periodic, cc)", f0_min, f0_max)
        jitter_local = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3) * 100
        shimmer_local = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6) * 100
        harmonicity = sound.to_harmonicity_cc(0.01, f0_min, 0.1, 1.0)
        hnr_db = call(harmonicity, "Get mean", 0, 0)

        # Formant analysis
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

        # Get LPC Spectrum
        lpc_spectrum = get_lpc_spectrum(best_file)

        return {
            'metrics': metrics,
            'chosen_file': best_file,
            'lpc_spectrum': lpc_spectrum
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

def get_lpc_spectrum(file_path: str, max_formant: int = 5500):
    """
    Get a spectrum of an audio file for plotting.
    NOTE: This returns a standard FFT spectrum, not an LPC spectrum,
    due to persistent issues with robust LPC generation in this environment.
    This is a pragmatic choice to prevent crashes and ensure a chart is always generated.
    """
    logger.info(f"Getting FFT spectrum for {file_path} (fallback method)")
    try:
        sound = parselmouth.Sound(file_path)
        # Analyze the middle 100ms of the sound
        from_time = sound.duration / 2 - 0.05
        to_time = sound.duration / 2 + 0.05
        if from_time < 0: from_time = 0
        if to_time > sound.duration: to_time = sound.duration

        if from_time >= to_time:
             logger.warning(f"Sound duration for spectrum is too short for {file_path}")
             return None

        sound_part = sound.extract_part(from_time=from_time, to_time=to_time, preserve_times=False)

        spectrum = sound_part.to_spectrum()

        freqs = spectrum.xs()
        # spectrum.values is a 2D numpy array (n_frames, n_freq_bins).
        # For a single frame spectrum from an extracted sound, we take the first row.
        spl_values = spectrum.values[0, :]

        if max_formant:
            valid_indices = freqs <= max_formant
            freqs = freqs[valid_indices]
            spl_values = spl_values[valid_indices]

        return {"frequencies": freqs.tolist(), "spl_values": spl_values.tolist()}

    except Exception as e:
        logger.error(f"Could not get spectrum for {file_path}: {e}", exc_info=True)
        return None
