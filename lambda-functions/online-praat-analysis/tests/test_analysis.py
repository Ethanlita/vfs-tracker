
import os
import pytest
import numpy as np
import soundfile as sf
from ..analysis import analyze_sustained_wav, analyze_speech_flow

# Pytest fixture to create a dummy WAV file for testing
@pytest.fixture(scope="module")
def dummy_wav_file(tmpdir_factory):
    # Create a temporary directory for our test files
    temp_dir = tmpdir_factory.mktemp("data")
    sustained_file_path = temp_dir.join("sustained_vowel.wav")
    speech_file_path = temp_dir.join("speech.wav")

    # --- Create a dummy sustained vowel file (e.g., 220 Hz sine wave) ---
    sr = 44100  # Sample rate
    duration = 3  # seconds
    frequency = 220.0  # Hz
    t = np.linspace(0., duration, int(sr * duration), endpoint=False)
    amplitude = np.iinfo(np.int16).max * 0.5
    data = amplitude * np.sin(2. * np.pi * frequency * t)
    sf.write(str(sustained_file_path), data.astype(np.int16), sr)

    # --- Create a dummy speech file (sine wave with pauses) ---
    segment1 = data[:sr] # 1 second of sound
    pause = np.zeros(int(sr * 0.5)) # 0.5 second of silence
    segment2 = data[sr:sr*2] # 1 second of sound
    speech_data = np.concatenate([segment1, pause, segment2])
    sf.write(str(speech_file_path), speech_data.astype(np.int16), sr)

    return str(sustained_file_path), str(speech_file_path)

def test_analyze_sustained_wav_returns_dict(dummy_wav_file):
    """
    Tests if analyze_sustained_wav returns a dictionary with expected keys.
    """
    sustained_path, _ = dummy_wav_file
    result = analyze_sustained_wav(sustained_path)
    
    assert isinstance(result, dict)
    expected_keys = ['mpt_s', 'f0_mean', 'jitter_local_percent', 'shimmer_local_percent', 'hnr_db', 'spl_dbA_est']
    for key in expected_keys:
        assert key in result
    
    # Check if f0 is close to the generated 220 Hz
    assert 215 < result['f0_mean'] < 225

def test_analyze_sustained_wav_handles_error():
    """
    Tests if the function returns None for a non-existent file.
    """
    result = analyze_sustained_wav("non_existent_file.wav")
    assert result is None

def test_analyze_speech_flow_returns_dict(dummy_wav_file):
    """
    Tests if analyze_speech_flow returns a dictionary with expected structure.
    """
    _, speech_path = dummy_wav_file
    result = analyze_speech_flow(speech_path)

    assert isinstance(result, dict)
    expected_keys = ['duration_s', 'voiced_ratio', 'pause_count', 'f0_stats']
    for key in expected_keys:
        assert key in result
        
    assert isinstance(result['f0_stats'], dict)
    assert 'median' in result['f0_stats']
    
    # Based on our dummy file (2s sound, 0.5s pause, total 2.5s)
    assert 2.4 < result['duration_s'] < 2.6
    assert result['pause_count'] == 1 # one pause was inserted
