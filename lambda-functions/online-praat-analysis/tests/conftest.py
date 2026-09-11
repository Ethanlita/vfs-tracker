import pytest
import numpy as np
import soundfile as sf

def generate_realistic_vowel(path, f0, duration=2, sr=44100, jitter=0.005, shimmer=0.05, formants=None):
    """生成确定性的声源—滤波器元音测试音频。

    周期脉冲列提供覆盖目标共振峰的谐波激励；每个声门周期分别施加
    jitter 与 shimmer，再由二阶全极点滤波器塑造声道共振峰。这样测试中
    声明的 F1/F2 会真实存在于频谱中，并且所有环境都走相同生成路径。

    :param path: 输出 WAV 文件路径。
    :param f0: 基频，单位 Hz。
    :param duration: 音频时长，单位秒。
    :param sr: 采样率，单位 Hz。
    :param jitter: 相邻周期长度的相对标准差。
    :param shimmer: 相邻周期幅度的相对标准差。
    :param formants: ``(频率, 带宽)`` 元组列表；省略时使用默认元音参数。
    :return: 写入完成的文件路径。
    """
    from scipy.signal import lfilter

    sample_count = int(sr * duration)
    excitation = np.zeros(sample_count, dtype=float)
    random = np.random.default_rng(20260912)
    sample_position = 0.0

    # [CN] 每个脉冲代表一次声门闭合；周期和幅度扰动直接对应 jitter/shimmer。
    while round(sample_position) < sample_count:
        sample_index = round(sample_position)
        amplitude = max(0.05, 1.0 + float(random.normal(0.0, shimmer)))
        excitation[sample_index] = amplitude
        period_scale = max(0.2, 1.0 + float(random.normal(0.0, jitter)))
        sample_position += sr / f0 * period_scale

    if formants is None:
        formants = [(500, 80), (1500, 120), (2500, 150)]

    wav = excitation
    for frequency, bandwidth in formants:
        radius = np.exp(-np.pi * bandwidth / sr)
        theta = 2 * np.pi * frequency / sr
        wav = lfilter([1], [1, -2 * radius * np.cos(theta), radius**2], wav)

    peak = np.max(np.abs(wav))
    if peak > 0:
        wav = wav / peak * 0.9
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
