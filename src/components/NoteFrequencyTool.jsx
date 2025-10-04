import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Soundfont from 'soundfont-player';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_BASES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const KEYBOARD_RANGE = { min: 21, max: 108 };
const WHITE_KEY_WIDTH = 46;
const BLACK_KEY_OFFSET = 0.64;

/**
 * @en Convert a MIDI number to its note name representation (e.g. 69 -> A4).
 * @zh 将 MIDI 数字转换为对应的音名表示（例如 69 -> A4）。
 * @param {number} midi - MIDI note number.
 * @returns {string} Canonical note name.
 */
const midiToNoteName = (midi) => {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
};

/**
 * @en Convert a MIDI number to frequency in Hz.
 * @zh 将 MIDI 音符编号转换为 Hz 频率。
 * @param {number} midi - MIDI note number.
 * @returns {number} Frequency in Hz.
 */
const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * @en Clamp a value between min and max.
 * @zh 将数值限制在给定的最小值和最大值之间。
 * @param {number} value - Input value.
 * @param {number} min - Minimum allowed value.
 * @param {number} max - Maximum allowed value.
 * @returns {number} Clamped value.
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * @en Parse note text (e.g. "A4", "C#5") into canonical MIDI information.
 * @zh 将音名字符串（例如 “A4”、“C#5”）解析为标准 MIDI 信息。
 * @param {string} raw - Raw user input.
 * @returns {{ midi: number, label: string, display: string }|{ error: string }} Parsed result or error info.
 */
const parseNoteInput = (raw) => {
  if (!raw || typeof raw !== 'string') {
    return { error: '请输入有效的音名，例如 A4。' };
  }

  const sanitized = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');

  const match = sanitized.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) {
    return { error: '音名格式不正确，请输入例如 C4、F#3、Bb5 的格式。' };
  }

  let [, letter, accidental = '', octaveStr] = match;
  letter = letter.toUpperCase();
  const octave = parseInt(octaveStr, 10);
  const base = NOTE_BASES[letter];
  if (typeof base !== 'number' || Number.isNaN(octave)) {
    return { error: '无法识别的音名，请重新输入。' };
  }

  let semitone = base;
  if (accidental === '#') {
    semitone += 1;
  } else if (accidental === 'b') {
    semitone -= 1;
  }

  let adjustedOctave = octave;
  if (semitone < 0) {
    semitone += 12;
    adjustedOctave -= 1;
  } else if (semitone > 11) {
    semitone -= 12;
    adjustedOctave += 1;
  }

  const midi = semitone + (adjustedOctave + 1) * 12;
  const canonical = `${NOTE_NAMES[semitone]}${adjustedOctave}`;

  return {
    midi,
    label: canonical,
    display: `${letter}${accidental}${octave}`,
  };
};

/**
 * @en Build metadata for the 88-key piano layout.
 * @zh 构建 88 键钢琴键盘的元数据，包含键位在键盘中的相对位置。
 * @returns {{ keys: Array, whiteKeyCount: number }} Keyboard metadata.
 */
const generatePianoKeys = () => {
  const keys = [];
  let whiteIndex = 0;

  for (let midi = KEYBOARD_RANGE.min; midi <= KEYBOARD_RANGE.max; midi += 1) {
    const label = midiToNoteName(midi);
    const base = label.replace(/\d+/g, '');
    const isSharp = base.includes('#');

    if (isSharp) {
      const position = whiteIndex - 1 + BLACK_KEY_OFFSET;
      keys.push({
        midi,
        label,
        isSharp: true,
        position,
        base,
        showLabel: true,
      });
    } else {
      const position = whiteIndex;
      keys.push({
        midi,
        label,
        isSharp: false,
        position,
        base,
        showLabel: true,
      });
      whiteIndex += 1;
    }
  }

  return { keys, whiteKeyCount: whiteIndex };
};

/**
 * @en Format frequency with two decimal places while trimming trailing zeros.
 * @zh 将频率格式化为两位小数，同时去掉无意义的尾随零。
 * @param {number} value - Frequency value.
 * @returns {string} Formatted frequency.
 */
const formatFrequency = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return value.toFixed(2).replace(/\.00$/, '');
};

/**
 * @en Hz-note conversion tool with an interactive 88-key piano.
 * @zh 带有 88 键钢琴交互的 Hz-音符转换工具页面。
 * @returns {JSX.Element} Page component.
 */
const NoteFrequencyTool = () => {
  const { keys, whiteKeyCount } = useMemo(() => generatePianoKeys(), []);
  const [frequencyInput, setFrequencyInput] = useState('440');
  const [noteInput, setNoteInput] = useState('A4');
  const [frequencyError, setFrequencyError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [frequencyResult, setFrequencyResult] = useState(null);
  const [noteResult, setNoteResult] = useState(null);
  const [activeMidi, setActiveMidi] = useState(69);
  const [analysis, setAnalysis] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const audioContextRef = useRef(null);
  const instrumentRef = useRef(null);
  const unmountedRef = useRef(false);

  /**
   * @en Lazily create or resume an AudioContext instance.
   * @zh 惰性创建或恢复 AudioContext 实例。
   * @returns {Promise<AudioContext|null>} Audio context or null in SSR.
   */
  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  /**
   * @en Play the specified MIDI note using soundfont when online or oscillator offline fallback.
   * @zh 在线时优先使用 soundfont 播放指定的 MIDI 音，离线时使用振荡器兜底。
   * @param {number} midi - MIDI note number.
   */
  const playMidiNote = useCallback(async (midi) => {
    try {
      const ctx = await ensureAudioContext();
      if (!ctx) return;

      const noteName = midiToNoteName(midi);
      const frequency = midiToFrequency(midi);

      if (instrumentRef.current === null && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          instrumentRef.current = await Soundfont.instrument(ctx, 'acoustic_grand_piano');
          setIsUsingFallback(false);
        } catch (loadError) {
          console.warn('无法加载钢琴音色，改用合成器兜底', loadError);
          instrumentRef.current = undefined;
          setIsUsingFallback(true);
        }
      }

      if (instrumentRef.current && instrumentRef.current !== undefined) {
        instrumentRef.current.play(noteName, ctx.currentTime, {
          duration: 1.2,
          gain: 3.2,
        });
        setIsUsingFallback(false);
        return;
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 1.2);
      setIsUsingFallback(true);
    } catch (error) {
      console.error('播放音频失败:', error);
    }
  }, [ensureAudioContext]);

  /**
   * @en Convert frequency input to the closest piano note.
   * @zh 将频率转换为最接近的钢琴音符。
   * @param {React.FormEvent<HTMLFormElement>} event - Submit event.
   */
  const handleFrequencySubmit = useCallback((event) => {
    event.preventDefault();
    if (unmountedRef.current) return;

    const parsed = Number.parseFloat(frequencyInput.replace(/,/g, '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFrequencyError('请输入大于 0 的频率值，例如 440。');
      setFrequencyResult(null);
      return;
    }

    const rawMidi = 69 + 12 * Math.log2(parsed / 440);
    const nearestMidi = Math.round(rawMidi);
    const clampedMidi = clamp(nearestMidi, KEYBOARD_RANGE.min, KEYBOARD_RANGE.max);
    const noteName = midiToNoteName(clampedMidi);
    const baseFrequency = midiToFrequency(clampedMidi);
    const centsDiff = Math.round(1200 * Math.log2(parsed / baseFrequency));
    const outOfRange = nearestMidi !== clampedMidi;

    setFrequencyError(outOfRange ? '频率超出了 88 键钢琴范围，已显示最近的音。' : '');
    setFrequencyResult({
      inputHz: parsed,
      midi: clampedMidi,
      note: noteName,
      cents: centsDiff,
      baseHz: baseFrequency,
      outOfRange,
    });
    setActiveMidi(clampedMidi);
    setAnalysis({
      midi: clampedMidi,
      note: noteName,
      frequency: parsed,
      baseFrequency,
      cents: centsDiff,
      source: 'frequency',
      outOfRange,
    });
    setNoteInput(noteName);
    void playMidiNote(clampedMidi);
  }, [frequencyInput, playMidiNote]);

  /**
   * @en Convert note input to frequency.
   * @zh 将音名转换为对应频率。
   * @param {React.FormEvent<HTMLFormElement>} event - Submit event.
   */
  const handleNoteSubmit = useCallback((event) => {
    event.preventDefault();
    if (unmountedRef.current) return;

    const parsed = parseNoteInput(noteInput);
    if (parsed.error) {
      setNoteError(parsed.error);
      setNoteResult(null);
      return;
    }

    const { midi, label } = parsed;
    const clampedMidi = clamp(midi, KEYBOARD_RANGE.min, KEYBOARD_RANGE.max);
    const baseFrequency = midiToFrequency(clampedMidi);
    const outOfRange = midi !== clampedMidi;

    setNoteError(outOfRange ? '该音名超出了 88 键钢琴范围，已显示最近的音。' : '');
    setNoteResult({
      midi: clampedMidi,
      note: label,
      frequency: baseFrequency,
      outOfRange,
    });
    setActiveMidi(clampedMidi);
    setAnalysis({
      midi: clampedMidi,
      note: midiToNoteName(clampedMidi),
      frequency: baseFrequency,
      baseFrequency,
      cents: 0,
      source: 'note',
      outOfRange,
    });
    setFrequencyInput(formatFrequency(baseFrequency));
    setNoteInput(midiToNoteName(clampedMidi));
    void playMidiNote(clampedMidi);
  }, [noteInput, playMidiNote]);

  /**
   * @en Handle piano key interactions.
   * @zh 处理钢琴键被点击时的逻辑。
   * @param {object} key - Keyboard metadata.
   */
  const handleKeyClick = useCallback((key) => {
    setActiveMidi(key.midi);
    const frequency = midiToFrequency(key.midi);
    setFrequencyInput(formatFrequency(frequency));
    setNoteInput(key.label);
    setFrequencyResult({
      inputHz: frequency,
      midi: key.midi,
      note: key.label,
      cents: 0,
      baseHz: frequency,
      outOfRange: false,
    });
    setNoteResult({
      midi: key.midi,
      note: key.label,
      frequency,
      outOfRange: false,
    });
    setAnalysis({
      midi: key.midi,
      note: key.label,
      frequency,
      baseFrequency: frequency,
      cents: 0,
      source: 'keyboard',
      outOfRange: false,
    });
    playMidiNote(key.midi);
  }, [playMidiNote]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  useEffect(() => {
    const defaultMidi = clamp(69, KEYBOARD_RANGE.min, KEYBOARD_RANGE.max);
    const defaultNote = midiToNoteName(defaultMidi);
    const defaultFrequency = midiToFrequency(defaultMidi);
    setFrequencyResult({
      inputHz: defaultFrequency,
      midi: defaultMidi,
      note: defaultNote,
      cents: 0,
      baseHz: defaultFrequency,
      outOfRange: false,
    });
    setNoteResult({
      midi: defaultMidi,
      note: defaultNote,
      frequency: defaultFrequency,
      outOfRange: false,
    });
    setAnalysis({
      midi: defaultMidi,
      note: defaultNote,
      frequency: defaultFrequency,
      baseFrequency: defaultFrequency,
      cents: 0,
      source: 'note',
      outOfRange: false,
    });
    setActiveMidi(defaultMidi);
  }, []);

  useEffect(() => () => {
    unmountedRef.current = true;
    if (instrumentRef.current && instrumentRef.current.stop) {
      try {
        instrumentRef.current.stop();
      } catch (error) {
        console.warn('停止钢琴音色失败', error);
      }
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (frequencyError) {
      const timer = setTimeout(() => setFrequencyError(''), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [frequencyError]);

  useEffect(() => {
    if (noteError) {
      const timer = setTimeout(() => setNoteError(''), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [noteError]);

  useEffect(() => {
    if (isOnline) {
      if (instrumentRef.current === undefined) {
        instrumentRef.current = null;
      }
      if (!instrumentRef.current) {
        setIsUsingFallback(false);
      }
    } else {
      setIsUsingFallback(true);
    }
  }, [isOnline]);

  const currentSource = analysis?.source || null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 sm:p-8 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-pink-600 mb-4">Hz-音符转换器</h1>
        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
          输入频率或音名即可获得对应的琴键，并在下方 88 键钢琴上以粉色高亮显示。
          无需登录即可使用，在线时采用钢琴音色，离线时自动切换为合成器播放。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <form onSubmit={handleFrequencySubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Hz → 音名</h2>
            <p className="text-sm text-gray-600">输入频率后点击转换，系统会找到最接近的钢琴键并显示音名。</p>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">频率（Hz）</span>
            <input
              type="text"
              value={frequencyInput}
              onChange={(event) => setFrequencyInput(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              placeholder="例如 440"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-500 text-white px-4 py-2 font-semibold hover:bg-pink-600 transition-colors"
          >
            立即转换
          </button>
          {frequencyError ? (
            <p className="text-sm text-red-500">{frequencyError}</p>
          ) : null}
          {frequencyResult ? (
            <div className="rounded-lg bg-pink-50 border border-pink-100 px-4 py-3 text-sm text-pink-700">
              <div>
                {formatFrequency(frequencyResult.inputHz)} Hz ≈ {frequencyResult.note}
                {frequencyResult.cents ? (
                  <span className="ml-1">（偏差 {frequencyResult.cents > 0 ? '+' : ''}{frequencyResult.cents} cents）</span>
                ) : null}
              </div>
              {frequencyResult.outOfRange ? (
                <div className="mt-1 text-xs text-pink-600">提示：已为您锁定 88 键范围内最近的琴键。</div>
              ) : null}
            </div>
          ) : null}
        </form>

        <form onSubmit={handleNoteSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">音名 → Hz</h2>
            <p className="text-sm text-gray-600">支持带升降号的音名（如 C#4、Bb3），返回的频率始终落在 88 键范围内。</p>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">音名</span>
            <input
              type="text"
              value={noteInput}
              onChange={(event) => setNoteInput(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              placeholder="例如 A4 或 C#5"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-500 text-white px-4 py-2 font-semibold hover:bg-pink-600 transition-colors"
          >
            立即转换
          </button>
          {noteError ? (
            <p className="text-sm text-red-500">{noteError}</p>
          ) : null}
          {noteResult ? (
            <div className="rounded-lg bg-pink-50 border border-pink-100 px-4 py-3 text-sm text-pink-700">
              <div>
                {noteResult.note} = {formatFrequency(noteResult.frequency)} Hz
              </div>
              {noteResult.outOfRange ? (
                <div className="mt-1 text-xs text-pink-600">提示：音名超出范围，已对齐最近的琴键。</div>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">当前选中</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-500">音名</div>
            <div className="text-lg font-semibold text-gray-900">{analysis?.note || '--'}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-500">频率</div>
            <div className="text-lg font-semibold text-gray-900">{analysis?.frequency ? `${formatFrequency(analysis.frequency)} Hz` : '--'}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-500">偏差 (cents)</div>
            <div className="text-lg font-semibold text-gray-900">{analysis && Number.isFinite(analysis.cents) ? `${analysis.cents > 0 ? '+' : ''}${analysis.cents}` : '--'}</div>
          </div>
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-500">来源</div>
            <div className="text-lg font-semibold text-gray-900">
              {currentSource === 'frequency' ? 'Hz 输入' : currentSource === 'note' ? '音名输入' : currentSource === 'keyboard' ? '钢琴按键' : '--'}
            </div>
          </div>
        </div>
        {analysis?.outOfRange ? (
          <p className="mt-3 text-sm text-pink-600">提示：原始输入超出了 88 键范围，已定位到最近的琴键。</p>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-900">88 键钢琴</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-3 py-1 text-pink-600 border border-pink-100">粉色 = 当前音</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-600 border border-gray-200">
              {isOnline ? (isUsingFallback ? '在线（使用合成器音色）' : '在线（钢琴音色）') : '离线模式'}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto touch-pan-x pb-4">
          <div
            className="relative h-48 min-w-full"
            style={{ width: `${whiteKeyCount * WHITE_KEY_WIDTH}px` }}
          >
            <div className="absolute inset-0 flex">
              {keys.filter((key) => !key.isSharp).map((key) => {
                const isActive = key.midi === activeMidi;
                return (
                  <button
                    key={key.midi}
                    type="button"
                    onClick={() => handleKeyClick(key)}
                    className={`relative flex-1 flex flex-col items-center justify-end border border-gray-300 transition-colors ${
                      isActive ? 'bg-pink-200 border-pink-500 shadow-inner' : 'bg-white hover:bg-pink-50'
                    }`}
                    style={{ width: `${WHITE_KEY_WIDTH}px` }}
                    aria-label={`${key.label} 键`}
                  >
                    {key.showLabel ? (
                      <span className={`text-[10px] sm:text-xs mb-2 ${isActive ? 'text-pink-700 font-semibold' : 'text-gray-500'}`}>
                        {key.label}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="absolute inset-0 pointer-events-none">
              {keys.filter((key) => key.isSharp).map((key) => {
                const isActive = key.midi === activeMidi;
                return (
                  <button
                    key={key.midi}
                    type="button"
                    onClick={() => handleKeyClick(key)}
                    className={`absolute top-0 h-28 sm:h-32 rounded-b-lg text-xs transition-colors pointer-events-auto ${
                      isActive ? 'bg-pink-500 text-white shadow-lg border border-pink-600' : 'bg-gray-900 hover:bg-gray-700 text-gray-200 border border-gray-900'
                    }`}
                    style={{
                      left: `${key.position * WHITE_KEY_WIDTH}px`,
                      width: `${WHITE_KEY_WIDTH * 0.62}px`,
                      transform: 'translateX(-50%)',
                    }}
                    aria-label={`${key.label} 黑键`}
                  >
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs ${isActive ? 'text-white font-semibold' : 'text-gray-200'}`}>
                      {key.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          点击任意琴键即可听到对应的音高，同时上方会显示音名与频率。若处于离线环境，系统会自动启用振荡器以确保可用性。
        </p>
      </div>
    </div>
  );
};

export default NoteFrequencyTool;
