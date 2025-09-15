import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
import numpy as np
import soundfile as sf
from scipy.signal import lfilter
from analysis import analyze_sustained_wav, analyze_speech_flow, analyze_note_file

def test_analyze_sustained_wav_handles_error():
    """Tests if the function returns None for a non-existent file."""
    assert analyze_sustained_wav("non_existent_file.wav") is None

def test_analyze_speech_flow_returns_dict(dummy_wav_files):
    """Tests if analyze_speech_flow returns a dictionary with expected structure."""
    _, speech_path = dummy_wav_files
    result = analyze_speech_flow(speech_path)

    assert isinstance(result, dict)
    expected_keys = ['duration_s', 'voiced_ratio', 'pause_count', 'f0_stats']
    for key in expected_keys:
        assert key in result
    assert isinstance(result['f0_stats'], dict)
    assert 'median' in result['f0_stats']
    assert 2.4 < result['duration_s'] < 2.6
    assert result['pause_count'] == 1

# ---- New tests for Formant Analysis ----
def test_robust_formant_detection_returns_zero_for_unvoiced(tmp_path):
    """
    Tests that formant detection returns 0s for unvoiced (noise) audio.
    """
    test_file = tmp_path / "noise.wav"
    sr = 44100
    duration = 2
    noise = np.random.normal(0, 0.5, int(sr * duration))
    sf.write(str(test_file), noise, sr, subtype='PCM_16')

    results = analyze_note_file(str(test_file))

    assert results is not None
    assert results.get('F1', -1) == 0.0
    assert results.get('F2', -1) == 0.0
    assert results.get('F3', -1) == 0.0
