import pytest
import numpy as np
import soundfile as sf

def generate_realistic_vowel(path, f0, duration=2, sr=44100, jitter=0.005, shimmer=0.05, formants=None):
    """
    Generates a more realistic synthetic vowel with some noise, jitter, and shimmer.
    This is more likely to be successfully analyzed by pitch detection algorithms.
    """
    t = np.linspace(0., duration, int(sr * duration), endpoint=False)

    # Source signal with jitter
    phase = 2 * np.pi * f0 * t
    if jitter > 0:
        phase_jitter = np.cumsum(np.random.randn(len(t)) * jitter * 10)
        phase += phase_jitter
    wav = np.sin(phase)

    # Add shimmer
    if shimmer > 0:
        wav *= (1 + (np.random.randn(len(t)) * shimmer))

    # Add harmonics
    wav += 0.5 * np.sin(2 * np.pi * (f0*2) * t)
    wav += 0.25 * np.sin(2 * np.pi * (f0*3) * t)

    # Apply formants if specified (simple filtering)
    if formants:
        from scipy.signal import lfilter
        signal = wav
        for freq, bw in formants:
            r = np.exp(-np.pi * bw / sr)
            theta = 2 * np.pi * freq / sr
            a = [1, -2 * r * np.cos(theta), r**2]
            b = [1]
            signal = lfilter(b, a, signal)
        wav = signal

    # Normalize and write to file
    wav = wav / np.max(np.abs(wav)) * 0.9
    sf.write(path, wav, sr, 'PCM_16')
    return path

@pytest.fixture(scope="session")
def dummy_wav_files(tmp_path_factory):
    """
    Creates simple, predictable dummy audio files for general pipeline testing.
    """
    tmp_path = tmp_path_factory.mktemp("data")
    sustained_file_path = tmp_path / "sustained.wav"
    speech_file_path = tmp_path / "speech.wav"
    sr = 44100
    duration = 3
    frequency = 220.0
    t = np.linspace(0., duration, int(sr * duration), endpoint=False)
    amplitude = np.iinfo(np.int16).max * 0.5
    data = amplitude * np.sin(2. * np.pi * frequency * t)

    # Add a small amount of noise to make it more realistic for analysis
    noise_amplitude = amplitude * 0.01
    noise = np.random.normal(0, 1, len(t)) * noise_amplitude
    data += noise

    # Write sustained file (a simple sine wave)
    sf.write(str(sustained_file_path), data.astype(np.int16), sr)

    # Write speech file (sine wave with a pause)
    segment1 = data[:sr]
    pause = np.zeros(int(sr * 0.5))
    segment2 = data[sr:sr*2]
    speech_data = np.concatenate([segment1, pause, segment2])
    sf.write(str(speech_file_path), speech_data.astype(np.int16), sr)

    return str(sustained_file_path), str(speech_file_path)


def create_test_vowel_with_silence(path, f0, voiced_duration, silence_before=0, silence_after=0, sr=44100):
    """
    Creates a test vowel with specified voiced duration surrounded by silence.
    """
    t = np.linspace(0., voiced_duration, int(sr * voiced_duration), endpoint=False)
    wav = 0.5 * np.sin(2 * np.pi * f0 * t)

    # Add harmonics to make it more 'voiced' for librosa.effects.split
    wav += 0.25 * np.sin(2 * np.pi * (f0*2) * t)

    silence1 = np.zeros(int(sr * silence_before))
    silence2 = np.zeros(int(sr * silence_after))

    full_wav = np.concatenate([silence1, wav, silence2])

    sf.write(path, full_wav, sr, 'PCM_16')
    return path
