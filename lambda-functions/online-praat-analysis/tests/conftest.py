import pytest
import numpy as np
import soundfile as sf
from scipy.signal import lfilter

def generate_vowel_sound(
    path,
    samplerate=44100,
    duration=3.0,
    f0=150.0,
    formants=None
):
    """
    Generates a synthetic vowel sound with specified formants and saves it as a WAV file.
    This is used for testing the formant analysis specifically.
    """
    if formants is None:
        formants = [(500, 80), (1500, 100), (2500, 120)]

    num_samples = int(samplerate * duration)
    t = np.linspace(0, duration, num_samples, endpoint=False)
    pulse_period = int(samplerate / f0)
    source_signal = np.zeros(num_samples)
    source_signal[::pulse_period] = 1.0

    signal = source_signal
    for freq, bw in formants:
        r = np.exp(-np.pi * bw / samplerate)
        theta = 2 * np.pi * freq / samplerate
        a = [1, -2 * r * np.cos(theta), r**2]
        b = [1]
        signal = lfilter(b, a, signal)

    fade_len = int(samplerate * 0.05)
    if len(signal) > fade_len * 2:
        fade_in = np.linspace(0, 1, fade_len)
        fade_out = np.linspace(1, 0, fade_len)
        signal[:fade_len] *= fade_in
        signal[-fade_len:] *= fade_out

    # Apply a high-pass filter to remove low-frequency noise/drift
    from scipy.signal import butter, sosfilt
    sos = butter(4, 80, 'hp', fs=samplerate, output='sos')
    signal = sosfilt(sos, signal)

    max_amp = np.iinfo(np.int16).max
    signal = signal / np.max(np.abs(signal)) * (max_amp * 0.8)
    sf.write(path, signal.astype(np.int16), samplerate)
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
