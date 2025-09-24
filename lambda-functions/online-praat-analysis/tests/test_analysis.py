import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import numpy as np
import soundfile as sf
from analysis import analyze_sustained_vowel, analyze_speech_flow, analyze_note_file_robust

from .conftest import generate_realistic_vowel

def test_analyze_sustained_vowel_selects_best_file(tmp_path):
    """
    Tests that analyze_sustained_vowel correctly selects the more stable file
    and returns a full analysis dictionary.
    """
    stable_file = tmp_path / "stable.wav"
    unstable_file = tmp_path / "unstable.wav"

    # Create a stable sound (low jitter/shimmer) and an unstable one
    generate_realistic_vowel(str(stable_file), f0=150, jitter=0.001, shimmer=0.01)
    generate_realistic_vowel(str(unstable_file), f0=150, jitter=0.05, shimmer=0.5)

    results = analyze_sustained_vowel([str(stable_file), str(unstable_file)])

    assert 'metrics' in results
    assert 'chosen_file' in results
    assert 'lpc_spectrum' in results

    # Check that the more stable file was chosen
    assert results['chosen_file'] == str(stable_file)

    # Check that the metrics dictionary is well-formed
    metrics = results['metrics']
    assert 'error' not in metrics
    assert 'mpt_s' in metrics
    assert 'jitter_local_percent' in metrics
    assert 'formants_sustained' in metrics
    assert isinstance(metrics['formants_sustained'], dict)

def test_analyze_sustained_vowel_handles_no_valid_files():
    """
    Tests that analyze_sustained_vowel returns an error when no valid files are provided.
    """
    results = analyze_sustained_vowel([])
    assert 'metrics' in results
    assert 'error' in results['metrics']

    results_nonexistent = analyze_sustained_vowel(["non_existent_file.wav"])
    assert 'metrics' in results_nonexistent
    assert 'error' in results_nonexistent['metrics']

def test_analyze_speech_flow_returns_dict(tmp_path):
    """Tests if analyze_speech_flow returns a dictionary with expected structure."""
    # Create a dummy speech file with a pause
    sr = 44100
    duration = 1.2
    t = np.linspace(0., duration, int(sr * duration))
    wav1 = 0.5 * np.sin(2 * np.pi * 120 * t)
    pause = np.zeros(int(sr * 0.2))
    wav2 = 0.5 * np.sin(2 * np.pi * 120 * t)
    full_wav = np.concatenate([wav1, pause, wav2])
    speech_path = tmp_path / "speech.wav"
    sf.write(speech_path, full_wav, sr, 'PCM_16')

    result = analyze_speech_flow(str(speech_path))

    assert isinstance(result, dict)
    expected_keys = ['duration_s', 'voiced_ratio', 'pause_count', 'f0_stats']
    for key in expected_keys:
        assert key in result
    assert isinstance(result['f0_stats'], dict)
    assert 'median' in result['f0_stats']
    assert 2.5 < result['duration_s'] < 2.7
    assert result['pause_count'] >= 1

def test_robust_formant_detection_returns_zero_for_unvoiced(tmp_path):
    """
    Tests that formant detection returns 0s for unvoiced (noise) audio.
    """
    test_file = tmp_path / "noise.wav"
    sr = 44100
    duration = 2
    noise = np.random.normal(0, 0.5, int(sr * duration))
    sf.write(str(test_file), noise, sr, subtype='PCM_16')

    results = analyze_note_file_robust(str(test_file))

    assert results is not None
    assert results.get('F1', -1) == 0.0
    assert results.get('F2', -1) == 0.0
    assert results.get('F3', -1) == 0.0

def test_analyze_sustained_vowel_selects_longest_voiced_time(tmp_path):
    """
    Tests that analyze_sustained_vowel selects the file with the longest
    *voiced* duration, not the longest *total* duration.
    """
    from .conftest import create_test_vowel_with_silence

    # File 1: Short total duration, but all voiced
    short_but_voiced_file = tmp_path / "short_voiced.wav"
    create_test_vowel_with_silence(short_but_voiced_file, f0=150, voiced_duration=2.0) # 2s voiced

    # File 2: Long total duration, but mostly silence
    long_but_silent_file = tmp_path / "long_silent.wav"
    create_test_vowel_with_silence(long_but_silent_file, f0=150, voiced_duration=1.0, silence_before=1.5, silence_after=1.5) # 1s voiced, 4s total

    results = analyze_sustained_vowel([str(short_but_voiced_file), str(long_but_silent_file)])

    assert 'chosen_file' in results
    assert results['chosen_file'] == str(short_but_voiced_file)

    # Check that the MPT is calculated from the chosen file's voiced duration
    assert 'mpt_s' in results['metrics']
    assert 1.9 < results['metrics']['mpt_s'] < 2.1
