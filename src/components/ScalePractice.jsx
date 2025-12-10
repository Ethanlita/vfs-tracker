import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PitchDetector } from 'pitchy';
import Soundfont from 'soundfont-player';
import {
  accumulateStableWindow,
  gateByEnergy,
  gateByStability
} from '../utils/pitchEval.js';
import modesConfig from '../config/scaleModes.json';
import { buildBeatTimeline, deriveModePitchMeta, planBeatSchedule } from '../utils/scaleModes.js';
import { calcMedian, evaluateNoteStability } from '../utils/scalePracticeEval.js';
import { getSongRecommendations } from '../api.js'; // Import the new API function
import { ensureAppError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/**
 * @zh 将给定的频率（Hz）转换为最接近的音乐音名。
 * @param {number} frequency - 要转换的频率值。
 * @returns {string} 音乐音名，例如 "A4"。
 */
const frequencyToNoteName = (frequency) => {
  if (!frequency || frequency <= 0) return '--';
  const A4 = 440;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
  const midi = 69 + halfStepsFromA4; // MIDI 69 对应 A4
  const note = noteNames[(midi + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

/**
 * @zh 根据失败原因生成提示文案。
 * @param {{ idx: number, freq: number, type: 'miss'|'high'|'low'|'unstable'|'invalidFrame', requiredMs?: number, stableMs?: number }} fail 失败信息
 * @returns {string} 用户可读提示
 */
const formatFailMessage = (fail) => {
  if (!fail) return '未达到目标音，是否重试？';
  const noteLabel = frequencyToNoteName(fail.freq);
  switch (fail.type) {
    case 'miss':
      return `第${fail.idx}个音${noteLabel}未检测到`;
    case 'high':
      return `第${fail.idx}个音${noteLabel}不够低`;
    case 'low':
      return `第${fail.idx}个音${noteLabel}不够高`;
    case 'unstable':
      return `第${fail.idx}个音${noteLabel}保持不足${Math.round(fail.requiredMs ?? 0)}ms`;
    case 'invalidFrame':
      return '录音数据异常，请检查麦克风输入或刷新页面后重试';
    default:
      return '未达到目标音，是否重试？';
  }
};

// 将频率映射为指示器的垂直百分比位置
const freqToPercent = (f, range) => {
  if (!range.max || !range.min || f <= 0) return 0;
  const { min, max } = range;
  const ratio = Math.log2(f / min) / Math.log2(max / min);
  return Math.min(1, Math.max(0, ratio));
};

/**
 * @zh 按难度对练习模式排序，便于用户从易到难选择。
 * @param {Array<Object>} modeList 模式列表
 * @returns {Array<Object>} 排序后的模式列表
 */
const sortModesByDifficulty = (modeList = []) => {
  const order = { '入门': 0, '简单': 1, '一般': 2, '高级': 3 };
  return [...modeList]
    .map((mode, idx) => ({ ...mode, _idx: idx }))
    .sort((a, b) => {
      const da = order[a.difficulty] ?? 999;
      const db = order[b.difficulty] ?? 999;
      if (da === db) return a._idx - b._idx;
      return da - db;
    })
    .map(({ _idx, ...rest }) => rest);
};

/**
 * @zh 计算当前模式在给定起始音下的最低参考频率，确保结果页的最低音不高于练习起点。
 * @param {Object} mode 当前模式
 * @param {number} startOffsetVal 起始音相对 C4 的半音偏移
 * @param {number} semitoneRatioVal 半音比值
 * @returns {number} 最低参考频率（Hz）
 */
const computeModeFloorFreq = (mode, startOffsetVal, semitoneRatioVal) => {
  const base = 261.63;
  if (!mode || !Array.isArray(mode.patternOffsets) || mode.patternOffsets.length === 0) {
    return base * Math.pow(semitoneRatioVal, startOffsetVal);
  }
  const minOffset = Math.min(...mode.patternOffsets, 0);
  return base * Math.pow(semitoneRatioVal, startOffsetVal + minOffset);
};

/**
 * @zh ScalePractice 组件用于配置化的音阶练习与音域测定。
 * 流程：权限与耳机检测 → 演示 → 爬升练习 → 下降练习 → 结果展示。
 * 练习节奏与目标音由 JSON 模式定义驱动，便于扩展不同音阶套路。
 */
const ScalePractice = () => {
  // 设置页面 meta 标签
  useDocumentMeta({
    title: '音阶练习',
    description: '跟随示范音练习不同音阶模式，并实时检测音高精准度，辅助提升发声控制力。'
  });

  const navigate = useNavigate();

  // --- 向导步骤状态 ---
  const [step, setStep] = useState('intro');
  const [message, setMessage] = useState('');
  const [syllable, setSyllable] = useState('a');
  const [permissionError, setPermissionError] = useState('');
  const [permissionMsg, setPermissionMsg] = useState('');
  const [startOffset, setStartOffset] = useState(0); // 起始音相对C4的半音数
  const [beat, setBeat] = useState(0);
  const [beatLabel, setBeatLabel] = useState('');
  const [indicatorRange, setIndicatorRange] = useState({ min: 0, max: 0 });
  const [ladderNotes, setLadderNotes] = useState([]);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [modes] = useState(() => sortModesByDifficulty(modesConfig?.modes ?? []));
  const [selectedModeId, setSelectedModeId] = useState(() => modesConfig?.modes?.[0]?.id ?? '');
  const [modeError, setModeError] = useState('');
  const [cycleBeats, setCycleBeats] = useState(() => {
    try {
      return modesConfig?.modes?.[0] ? buildBeatTimeline(modesConfig.modes[0]).length : 8;
    } catch {
      return 8;
    }
  });
  const currentMode = useMemo(
    () => modes.find(mode => mode.id === selectedModeId),
    [modes, selectedModeId]
  );

  // --- 练习结果 ---
  const [highestHz, setHighestHz] = useState(0);
  const [lowestHz, setLowestHz] = useState(0);

  // --- 歌曲推荐状态 ---
  const [recommendations, setRecommendations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recommendationError, setRecommendationError] = useState(null);

  // --- 音频与分析相关引用 ---
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const detectorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);
  const pianoRef = useRef(null); // 采样钢琴音色

  // --- 练习参数与缓存 ---
  const baselineRmsRef = useRef(0);
  const tolerance = 75; // 允许的音差（cents）
  const stableWindowMs = 250; // 判定所需的稳定时间（与拍长取较小值的60%）
  const clarityTheta = 0.6;
  const deltaDb = 12;
  const paddingCents = 150; // 音高指示器上下留白（cents）
  const baseQuarterMs = 600; // 基准四分音符时长，后续按模式缩放
  const currentFramesRef = useRef([]);
  const collectingRef = useRef(false);
  const frameDurationRef = useRef(0);
  const semitoneRatio = Math.pow(2, 1 / 12);
  const rootIndexRef = useRef(0); // 起始音相对C4的半音数
  const descendingIndexRef = useRef(0);
  const progressRafRef = useRef(null);
  const progressStartRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lowestFloorRef = useRef(0); // 记录起始音可达的最低参考频率，避免结果页低于起点

  // 当前实时 F0，用于 UI 显示
  const [currentF0, setCurrentF0] = useState(0);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [beatCenters, setBeatCenters] = useState([]);

  // 预计算当前模式的拍数分布
  const modeStats = useMemo(() => {
    if (!currentMode) return { examples: 0, rests: 0, notes: 0, total: 0, beatUnit: 'quarter' };
    try {
      const { timeline, beatUnit } = planBeatSchedule(currentMode, baseQuarterMs);
      return {
        examples: timeline.filter(t => t.type === 'example').length,
        rests: timeline.filter(t => t.type === 'rest').length,
        notes: timeline.filter(t => t.type === 'note').length,
        total: timeline.length,
        beatUnit
      };
    } catch {
      return { examples: 0, rests: 0, notes: 0, total: 0, beatUnit: 'quarter' };
    }
  }, [currentMode, baseQuarterMs]);

  // --- 模式校验与拍数同步 ---
  useEffect(() => {
    if (!modes.length) {
      setModeError('未找到可用的音阶模式，请补充配置文件。');
      return;
    }
    if (!currentMode) {
      setModeError('请选择一个音阶模式后再开始练习。');
      return;
    }
    try {
      const { timeline } = planBeatSchedule(currentMode);
      setCycleBeats(timeline.length);
      setModeError('');
    } catch (err) {
      setModeError(err.message);
    }
    setHighestHz(0);
    setLowestHz(0);
    lowestFloorRef.current = 0;
    setBeat(0);
  }, [currentMode, modes]);

  // --- 水平进度动画 ---
  const stopProgressAnimation = useCallback((reset = false) => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    if (reset) {
      lastProgressRef.current = 0;
      setTimelineProgress(0);
    }
  }, []);

  const startProgressAnimation = useCallback((beatDurations = []) => {
    stopProgressAnimation();
    lastProgressRef.current = 0;
    setTimelineProgress(0);
    if (!beatDurations.length) {
      setBeatCenters([]);
      return;
    }
    const total = beatDurations.reduce((sum, cur) => sum + cur, 0);
    let acc = 0;
    const centers = beatDurations.map(dur => {
      const center = (acc + dur / 2) / total;
      acc += dur;
      return center * 100;
    });
    setBeatCenters(centers);
    progressStartRef.current = performance.now();
    const tick = () => {
      const elapsed = Math.min(performance.now() - progressStartRef.current, total);
      const next = total ? elapsed / total : 0;
      if (Math.abs(next - lastProgressRef.current) > 0.003) {
        lastProgressRef.current = next;
        setTimelineProgress(next);
      }
      if (elapsed < total) {
        progressRafRef.current = requestAnimationFrame(tick);
      }
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }, [stopProgressAnimation]);

  // --- 音频初始化与清理 ---
  const cleanupAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    stopProgressAnimation(true);
  }, [stopProgressAnimation]);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const pitchLoop = useCallback(() => {
    if (!detectorRef.current || !analyserRef.current || !audioCtxRef.current) return;
    const input = new Float32Array(detectorRef.current.inputLength);
    analyserRef.current.getFloatTimeDomainData(input);
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    const [pitch, clarity] = detectorRef.current.findPitch(input, audioCtxRef.current.sampleRate);
    if (collectingRef.current) {
      currentFramesRef.current.push({ pitch, clarity, rms });
    }
    if (clarity > 0.95 && pitch > 50 && pitch < 1200) {
      setCurrentF0(pitch);
    } else {
      setCurrentF0(0);
    }
    rafRef.current = requestAnimationFrame(pitchLoop);
  }, []);

  const initAudio = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    let pianoLoaded = false;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        pianoRef.current = await Soundfont.instrument(ctx, 'acoustic_grand_piano');
        pianoLoaded = true;
        setShowOfflineNotice(false);
      } catch (instrumentError) {
        console.warn('无法加载钢琴音色，使用振荡器兜底', instrumentError);
      }
    }

    if (!pianoLoaded) {
      pianoRef.current = null;
      setShowOfflineNotice(true);
    }
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;
    detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
    frameDurationRef.current = (detectorRef.current.inputLength / ctx.sampleRate) * 1000;
    pitchLoop();
  }, [pitchLoop]);

  // --- 工具函数：播放一个音 ---
  // 增大默认增益，使钢琴声音更清晰
  const playTone = (freq, duration = 700, usePiano = true, gainValue = 4) => {
    return new Promise(resolve => {
      const shouldUsePiano = usePiano && pianoRef.current;
      if (shouldUsePiano) {
        // soundfont-player 需要音名或 MIDI 号，这里将频率转换为最近的音名
        const note = frequencyToNoteName(freq);
        pianoRef.current.play(note, audioCtxRef.current.currentTime, {
          duration: duration / 1000,
          gain: gainValue
        });
        setTimeout(resolve, duration);
      } else {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const now = audioCtxRef.current.currentTime;
        const stopAt = now + duration / 1000;
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.35 * (gainValue / 4), now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
        osc.start(now);
        osc.stop(stopAt);
        setTimeout(resolve, duration);
      }
    });
  };

  // --- 工具函数：测量 RMS，用于耳机检测 ---
  const measureRms = (duration = 1000) => {
    return new Promise(resolve => {
      const samples = [];
      const end = performance.now() + duration;
      const collect = () => {
        const buffer = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        samples.push(Math.sqrt(sum / buffer.length));
        if (performance.now() < end) {
          requestAnimationFrame(collect);
        } else {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          resolve(avg);
        }
      };
      collect();
    });
  };

  // --- 测量指定频率处的能量（dB） ---
  const measureFreqDb = (freq, duration = 800) => {
    return new Promise(resolve => {
      const analyser = analyserRef.current;
      const buffer = new Float32Array(analyser.frequencyBinCount);
      const index = Math.round((freq / audioCtxRef.current.sampleRate) * analyser.fftSize);
      const samples = [];
      const end = performance.now() + duration;
      const collect = () => {
        analyser.getFloatFrequencyData(buffer);
        samples.push(buffer[index]);
        if (performance.now() < end) {
          requestAnimationFrame(collect);
        } else {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          resolve(avg);
        }
      };
      collect();
    });
  };

  // --- Step0: 申请权限 ---
  const requestPermission = useCallback(async () => {
    setPermissionMsg('正在申请麦克风权限...');
    setPermissionError('');
    try {
      await initAudio();
      setPermissionMsg('已成功获取麦克风权限，请戴上耳机');
    } catch (err) {
      console.error(err);
      setPermissionMsg('');
      setPermissionError('无法获取麦克风权限，请确认已授予浏览器麦克风访问权限。');
    }
  }, [initAudio]);

  // --- Step1: 耳机检测 ---
  const handleHeadphoneCheck = async () => {
    setStep('headphone');
    setMessage('请保持安静，我们正在检测环境噪音...');
    const baselineRms = await measureRms(800);
    baselineRmsRef.current = baselineRms;
    const baselineDb = await measureFreqDb(1000, 800);
    setMessage('现在播放1kHz标准音，请确认不会被麦克风录到');
    const testPromise = measureFreqDb(1000, 800);
    await playTone(1000, 800, false, 1);
    const testDb = await testPromise;
    if (testDb > baselineDb + 3) {
      setMessage('似乎未佩戴耳机，建议佩戴耳机以获得更佳效果。');
      setStep('headphoneFail');
    } else {
      setMessage('耳机检测通过！');
      setTimeout(() => setStep('calibration'), 500);
    }
  };

  // --- 校准：获取舒适音高并推荐起始音 ---
  const handleCalibrationStart = async () => {
    setStep('calibrating');
    setMessage('正在录音，请在听到嘀声后以舒适的音高发 /a/ 音');
    currentFramesRef.current = [];
    await playTone(1000, 300, false, 1);
    collectingRef.current = true;
    await new Promise(r => setTimeout(r, 3000));
    collectingRef.current = false;
    const valid = currentFramesRef.current.filter(f => f.pitch > 50 && f.pitch < 1200);
    const f0s = valid.map(f => f.pitch);
    const sff = calcMedian(f0s);
    let idx = Math.round(12 * Math.log2(sff / 261.63)) - 2;
    if (idx > 12) idx = 12;
    if (idx < -12) idx = -12;
    setStartOffset(idx);
    setStep('setup');
  };

  // --- 切换练习模式 ---
  const handleModeChange = (modeId) => {
    setSelectedModeId(modeId);
    setMessage('');
    setBeat(0);
    rootIndexRef.current = startOffset;
    descendingIndexRef.current = startOffset;
  };

  // --- 模式可用性校验 ---
  const ensureModeReady = useCallback(() => {
    if (!currentMode || !currentMode.patternOffsets?.length) {
      setModeError('请选择一个包含音阶序列的模式后再开始。');
      return false;
    }
    try {
      planBeatSchedule(currentMode, baseQuarterMs);
    } catch (err) {
      setModeError(err.message);
      return false;
    }
    return true;
  }, [currentMode]);

  // --- 节拍循环与练习逻辑 ---
  /**
   * @zh 执行一轮节拍播放与音高采集，依据模式配置决定节奏与音高序列。
   * @param {'ascending' | 'descending'} direction 练习方向，决定音阶走向。
   * @param {boolean} [isDemo=false] 是否为演示模式（仅播放示例，不计结果）。
   * @returns {Promise<void>}
   */
  const runCycle = async (direction, isDemo = false) => {
    if (!ensureModeReady()) return;
    const baseIndex = direction === 'ascending'
      ? rootIndexRef.current
      : descendingIndexRef.current;
    const baseFreq = 261.63 * Math.pow(semitoneRatio, baseIndex);

    let timeline;
    let beatDur;
    try {
      const plan = planBeatSchedule(currentMode, baseQuarterMs);
      timeline = plan.timeline;
      beatDur = plan.beatMs; // 使用模式规划的拍长，避免硬编码节奏偏差
      setCycleBeats(timeline.length);
    } catch (err) {
      setModeError(err.message);
      return;
    }
    const beatDurations = timeline.map(item =>
      typeof item.durationMs === 'number' && item.durationMs > 0 ? item.durationMs : beatDur
    );

    const {
      indicatorRange: modeRange,
      ladderNotes: modeLadder,
      minOffset,
      maxOffset
    } = deriveModePitchMeta(currentMode, baseFreq, semitoneRatio, direction, paddingCents);

    setIndicatorRange(modeRange);
    setLadderNotes(modeLadder);

    setStep(isDemo ? 'demoLoop' : direction);
    startProgressAnimation(beatDurations);
    const beatData = [];
    const noteSteps = timeline
      .map((item, idx) => (item.type === 'note' ? { ...item, beatIdx: idx } : null))
      .filter(Boolean);
    const firstNoteIdx = noteSteps.length ? noteSteps[0].beatIdx : timeline.length;
    for (let i = 0; i < timeline.length; i++) {
      currentFramesRef.current = [];
      collectingRef.current = true;
      const beatNumber = i + 1;
      setBeat(beatNumber);
      let freq = null;
      const beatInfo = timeline[i];
      if (beatInfo.type === 'example') {
        const exampleOffset = beatInfo.offset ?? 0;
        freq = baseFreq * Math.pow(semitoneRatio, exampleOffset);
        setBeatLabel(`演示 ${frequencyToNoteName(freq)}`);
      } else if (beatInfo.type === 'rest') {
        setBeatLabel('空拍');
      } else if (beatInfo.type === 'note') {
        const offset = beatInfo.offset ?? 0;
        freq = baseFreq * Math.pow(semitoneRatio, offset);
        setBeatLabel(`${isDemo ? '演示' : '练习'} ${frequencyToNoteName(freq)}`);
      }
      if (freq) {
        await playTone(freq, beatDur);
      } else {
        await new Promise(r => setTimeout(r, beatDur));
      }
      collectingRef.current = false;
      beatData.push([...currentFramesRef.current]);
    }

    const gateFrames = (frames) => frames.filter(f =>
      f.pitch > 50 &&
      f.pitch < 1200 &&
      gateByEnergy(f.rms, baselineRmsRef.current, deltaDb) &&
      gateByStability(f.clarity, clarityTheta)
    );

    const evaluation = evaluateNoteStability({
      beatData,
      noteSteps,
      baseFreq,
      semitoneRatio,
      tolerance,
      baselineRms: baselineRmsRef.current,
      deltaDb,
      clarityTheta,
      frameDuration: frameDurationRef.current,
      stableWindowMs,
      beatDurations
    });

    if (isDemo) {
      let resultMsg = '演示结束，做得很好！';
      const early = beatData
        .slice(0, firstNoteIdx)
        .some(frames => gateFrames(frames).length);
      if (early) {
        resultMsg = '切入太早，应该和系统播放的目标音同时切入';
      } else if (!evaluation.passed) {
        resultMsg = formatFailMessage(evaluation.failedNote);
      }
      setMessage(resultMsg);
      setStep('demoEnd');
      stopProgressAnimation(true);
      return;
    }

    if (!evaluation.passed) {
      const failMsg = formatFailMessage(evaluation.failedNote);
      setMessage(failMsg);
      stopProgressAnimation(true);
      setStep(direction === 'ascending' ? 'ascendFail' : 'descendFail');
      return;
    }

    if (direction === 'ascending') {
      setStep('ascending');
      const cycleHigh = baseFreq * Math.pow(semitoneRatio, maxOffset);
      setHighestHz(Math.max(highestHz, cycleHigh));
      rootIndexRef.current += currentMode.transposeStep ?? 1;
      setTimeout(() => runCycle('ascending'), 800);
    } else {
      setStep('descending');
      const cycleLow = baseFreq * Math.pow(semitoneRatio, minOffset);
      setLowestHz(prev => {
        const floorFreq = lowestFloorRef.current || computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
        const baseLow = prev === 0 ? cycleLow : Math.min(prev, cycleLow);
        return floorFreq ? Math.min(baseLow, floorFreq) : baseLow;
      });
      descendingIndexRef.current -= currentMode.transposeStep ?? 1;
      setTimeout(() => runCycle('descending'), 800);
    }
  };

  const handleDemoStart = () => {
    if (!ensureModeReady()) return;
    rootIndexRef.current = startOffset;
    runCycle('ascending', true);
  };

  const handlePracticeStart = () => {
    if (!ensureModeReady()) return;
    // 记录当前起始音下可达到的最低参考频率，用于结果页兜底
    lowestFloorRef.current = computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
    rootIndexRef.current = startOffset;
    runCycle('ascending');
  };

  const handleRetryAscend = () => {
    setMessage('再试一次');
    runCycle('ascending');
  };

  const handleStartDescending = () => {
    if (!ensureModeReady()) return;
    // 下降练习从爬升练习最后一轮的起始音开始
    descendingIndexRef.current = rootIndexRef.current - 1;
    runCycle('descending');
  };

  const handleRetryDescend = () => {
    if (!ensureModeReady()) return;
    setMessage('再试一次');
    runCycle('descending');
  };

  const handleFinishPractice = () => {
    cleanupAudio();
    const floorFreq = lowestFloorRef.current || computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
    if (lowestHz === 0) {
      setLowestHz(floorFreq);
    } else if (lowestHz > floorFreq) {
      setLowestHz(Math.min(lowestHz, floorFreq));
    }
    stopProgressAnimation(true);
    setStep('result');
  };

  // --- 获取歌曲推荐 ---
  const handleGetRecommendations = async () => {
    setIsGenerating(true);
    setRecommendationError(null);
    setRecommendations([]);

    try {
      const lowestNote = frequencyToNoteName(lowestHz);
      const highestNote = frequencyToNoteName(highestHz);
      const result = await getSongRecommendations({ lowestNote, highestNote });
      setRecommendations(result);
    } catch (err) {
      console.error('Failed to get song recommendations:', err);
      setRecommendationError(ensureAppError(err, {
        message: '获取推荐失败，请稍后再试。',
        requestMethod: 'POST',
        requestPath: '/recommend-songs'
      }));
    }

    setIsGenerating(false);
  };

  // --- 音高指示器（重构版，带标注与安全边界） ---
  const renderPitchIndicator = () => {
    if (!indicatorRange.min || !indicatorRange.max || !ladderNotes.length) return null;
    const sortedNotes = [...new Set(ladderNotes)].sort((a, b) => a - b);
    const dotPercent = Math.max(0, Math.min(100, freqToPercent(currentF0, indicatorRange) * 100));
    const dotPercentX = Math.max(0, Math.min(100, timelineProgress * 100));
    const safeDotX = Math.max(3, Math.min(97, dotPercentX));

    return (
      <div className="relative bg-gray-100 rounded mb-4 overflow-hidden h-[32rem]">
        <div className="absolute inset-4">
          <div className="absolute inset-0 pointer-events-none">
            {beatCenters.map((center, idx) => (
              <div
                key={`center-${idx}`}
                className="absolute top-4 bottom-4 border-l border-dashed border-pink-200"
                style={{ left: `${center}%`, zIndex: 6 }}
              >
                <div className="absolute bottom-1/2 translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-pink-200 rounded-full opacity-80"></div>
              </div>
            ))}
          </div>
          {sortedNotes.map((f, idx) => {
            const center = freqToPercent(f, indicatorRange) * 100;
            const lowerRaw = freqToPercent(f * Math.pow(2, -tolerance / 1200), indicatorRange) * 100;
            const upperRaw = freqToPercent(f * Math.pow(2, tolerance / 1200), indicatorRange) * 100;
            const halfBand = Math.max(0, (upperRaw - lowerRaw) / 2);
            const top = Math.max(0, center - halfBand);
            const bottom = Math.min(100, center + halfBand);
            const bandHeight = Math.max(0, bottom - top);
            return (
              <React.Fragment key={`${f}-${idx}`}>
                <div
                  className="absolute inset-x-0 bg-pink-200 opacity-40"
                  style={{ top: `${top}%`, height: `${bandHeight}%`, zIndex: 5 }}
                ></div>
                <div
                  className="absolute inset-x-0 -translate-y-1/2 flex items-center justify-between text-xs text-gray-700"
                  style={{ top: `${center}%`, zIndex: 10 }}
                >
                  <span className="bg-white/80 px-1 rounded">{frequencyToNoteName(f)}</span>
                  <div className="flex-1 h-px bg-pink-500 mx-2"></div>
                  <span className="bg-white/80 px-1 rounded">{f.toFixed(1)} Hz</span>
                </div>
              </React.Fragment>
            );
          })}
          <div
            className="absolute w-3 h-3 bg-pink-500 rounded-full shadow-md transition-[left] duration-150 ease-linear"
            style={{
              bottom: `${dotPercent}%`,
              left: `${safeDotX}%`,
              zIndex: 15,
              transform: 'translate(-50%, 50%)'
            }}
          ></div>
        </div>
      </div>
    );
  };

  // 绘制钢琴键盘并标注声域范围
  const renderRangeKeyboard = () => {
    if (!highestHz || !lowestHz) return null;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
    const lowMidi = Math.floor(freqToMidi(lowestHz));
    const highMidi = Math.ceil(freqToMidi(highestHz));

    // 绘制标准的88键钢琴 (A0-C8)
    const startMidi = 21; // A0
    const endMidi = 109; // C8 + 1

    const whiteWidth = 12;
    const whiteHeight = 80;
    const blackWidth = whiteWidth * 0.6;
    const blackHeight = whiteHeight * 0.6;

    let whiteCount = 0;
    const whites = [];
    const blacks = [];
    for (let m = startMidi; m < endMidi; m++) {
      const note = noteNames[m % 12];
      const isBlack = note.includes('#');
      if (!isBlack) {
        const x = whiteCount * whiteWidth;
        const inRange = m >= lowMidi && m <= highMidi;
        whites.push(
          <rect
            key={`w${m}`}
            x={x}
            y={0}
            width={whiteWidth}
            height={whiteHeight}
            fill={inRange ? '#fbcfe8' : '#fff'}
            stroke="#000"
          />
        );
        whiteCount++;
      } else {
        const x = whiteCount * whiteWidth - blackWidth / 2;
        const inRange = m >= lowMidi && m <= highMidi;
        blacks.push(
          <rect
            key={`b${m}`}
            x={x}
            y={0}
            width={blackWidth}
            height={blackHeight}
            fill={inRange ? '#f472b6' : '#000'}
          />
        );
      }
    }
    const svgWidth = whiteCount * whiteWidth;
    return (
      <svg width={svgWidth} height={whiteHeight} className="mx-auto mb-4">
        {whites}
        {blacks}
      </svg>
    );
  };

  // --- 渲染 ---
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <div className="relative mb-8 text-center">
        <button
          onClick={() => navigate('/mypage')}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors duration-300"
        >
          &larr; 返回
        </button>
        <h1 className="text-4xl font-bold text-pink-600">音阶练习</h1>
      </div>

      {permissionError && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900" role="alert">
          <div className="font-semibold">{permissionError}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestPermission}
              className="inline-flex items-center rounded bg-yellow-500 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-1"
            >
              重新尝试获取权限
            </button>
          </div>
        </div>
      )}
      {showOfflineNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>当前未联网或音色资源加载失败，已切换为本地合成器（Oscillator），音色效果将不够理想。</span>
          <button
            onClick={() => setShowOfflineNotice(false)}
            className="self-start sm:self-auto bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded-md text-sm font-medium transition-colors"
          >
            我知道了
          </button>
        </div>
      )}

      {step === 'intro' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🎶</div>
            <div className="text-left text-gray-700 space-y-3">
              <h2 className="text-2xl font-semibold text-gray-900">音阶练习说明</h2>
              <p>音阶练习是一种在声乐练习中最常见的练习形式，用于训练音准、气息和换声。通常这一练习需要声乐教师和练习者配合完成，声乐教师会弹奏钢琴提供引导，并且判断练习者的发声是否达标。VFS Tracker将在此扮演声乐教师的角色，提供示范音并进行实时检测。请在开始前阅读以下提示：</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>请在安静环境、佩戴耳机进行练习，避免外放回录。</li>
                <li>麦克风仅用于本次实时检测，不会上传音频。</li>
                <li>确保浏览器已授权麦克风权限；若系统提示，请点击“允许”。</li>
                <li>练习过程包含上行/下行多轮移调，可随时在失败时选择结束。</li>
              </ul>
              <p>接下来的训练步骤如下：</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>VFS Tracker将会申请麦克风权限，请戴上耳机并允许访问麦克风。</li>
                <li>VFS Tracker将会通过检测漏音的方式判断你是否有戴好耳机。</li>
                <li>你需要点击开始录音按钮，并在听到嘀声后以最舒适的音高发 /a/ 音进行校准。VFS Tracker将会为你选择一个起始音，你也可以调整这个起始音。</li>
                <li>你需要选择练习模式，然后你可以直接开始练习，或者先在模拟练习中熟悉操作。模拟练习可以重复进行直到你觉得你已经准备好了。</li>
                <li>你需要进行多轮练习，每一轮练习后如果系统判定达标，将会自动进行下一轮练习。如果系统判定不达标，你可以选择结束或重试。</li>
                <li>结束后你可以查看练习报告，了解自己的表现和进步。此时你也可以调用AI基于你的练习数据为你推荐适合的歌曲。</li>
                <li>建议常来练习，这样才可以持续进步哦！</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('permission');
                    requestPermission();
                  }}
                  className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  我已知晓，开始
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {step === 'permission' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <div className="text-6xl mb-4 animate-bounce">🎧</div>
          <p className="text-gray-700 mb-4">{permissionMsg || '正在申请麦克风权限，请允许浏览器访问。'}</p>
          {permissionMsg.includes('成功') && (
            <button
              onClick={handleHeadphoneCheck}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              进入耳机检测
            </button>
          )}
        </div>
      )}

      {step === 'headphone' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="text-gray-700 mb-2">{message}</p>
          <p className="text-sm text-gray-500">当前F0: {currentF0 > 0 ? currentF0.toFixed(1) : '--'} Hz</p>
        </div>
      )}

      {step === 'headphoneFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="text-gray-700 mb-4">{message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleHeadphoneCheck}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              重试
            </button>
            <button
              onClick={() => setStep('calibration')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              继续
            </button>
          </div>
        </div>
      )}

      {step === 'calibration' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">
            点击开始录音后你将会听到嘀声，请在听到后以最舒适的音高发 /a/ 音。
          </p>
          <button
            onClick={handleCalibrationStart}
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            开始录音
          </button>
        </div>
      )}

      {step === 'calibrating' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">正在录音...</p>
        </div>
      )}

      {step === 'setup' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">
            请选择练习模式与音节，系统会按模式节拍播放示范并实时检测音高。
          </p>
          {modeError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {modeError}
            </div>
          )}
          <div className="mb-4 text-left">
            <p className="text-gray-700 mb-2">选择练习模式：</p>
            <select
              value={selectedModeId}
              onChange={e => handleModeChange(e.target.value)}
              className="border rounded px-2 py-1 w-full sm:w-auto"
            >
              {modes.map(mode => (
                <option key={mode.id} value={mode.id}>{mode.name}</option>
              ))}
            </select>
            {currentMode && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                <div className="font-semibold mb-1">{currentMode.name}</div>
                <p className="mb-1">{currentMode.description}</p>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-600">难度：</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      currentMode.difficulty === '入门'
                        ? 'bg-green-100 text-green-700'
                        : currentMode.difficulty === '简单'
                          ? 'bg-blue-100 text-blue-700'
                          : currentMode.difficulty === '一般'
                            ? 'bg-amber-100 text-amber-700'
                            : currentMode.difficulty === '高级'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {currentMode.difficulty || '未标注'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  每轮拍数：{modeStats.total}（示范 {modeStats.examples} 拍 / 空拍 {modeStats.rests} 拍 / 音符 {modeStats.notes} 拍），节奏单位：{modeStats.beatUnit === 'quarter' ? '四分音符' : modeStats.beatUnit === 'eighth' ? '八分音符' : '十六分音符'}
                </p>
              </div>
            )}
          </div>
          <p className="mb-2 text-gray-700">
            请选择练习音节。不同音节可以练习不同的共鸣位置。
          </p>
          <div className="bg-blue-100 rounded-lg p-4 text-left text-gray-700 mb-4">
              <p>
                  热身与寻找共鸣: 首选闭口哼鸣 [m]，感受面部振动。
              </p>
              <p>
                  建立稳定、连贯的声音: 用 [mi] 找到集中的高位置感，然后用 [mɑ] 在保持该位置的同时练习口腔打开。
              </p>
              <p>
                  提升咬字清晰度与舌头灵活性: 可考虑用 [lɑ]。
              </p>
          </div>
          <select
            value={syllable}
            onChange={e => setSyllable(e.target.value)}
            className="border rounded px-2 py-1 mb-4"
          >
            <option value="a">a</option>
            <option value="i">i</option>
            <option value="ne">ne</option>
            <option value="mei">mei</option>
            <option value="na">na</option>
          </select>
          <div className="mb-4">
            <p className="text-gray-700 mb-2">起始音：{frequencyToNoteName(261.63 * Math.pow(semitoneRatio, startOffset))}（可调整）</p>
            <input
              type="range"
              min="-12"
              max="12"
              value={startOffset}
              onChange={e => setStartOffset(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-center gap-4 mt-2">
              <button
                onClick={() => playTone(261.63 * Math.pow(semitoneRatio, startOffset))}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
              >
                试听
              </button>
            </div>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleDemoStart}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              熟悉操作
            </button>
            <button
              onClick={handlePracticeStart}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              开始练习
            </button>
          </div>
        </div>
      )}

      {step === 'demoEnd' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleDemoStart}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              再来一次
            </button>
            <button
              onClick={handlePracticeStart}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              开始练习
            </button>
          </div>
        </div>
      )}

      {['demoLoop', 'ascending', 'descending'].includes(step) && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          {step === 'demoLoop' && (
            <div className="bg-blue-100 rounded-lg p-4 text-left text-gray-700 mb-4">
              <p className="mb-3 text-gray-700">
                演示说明：本模式每轮 {cycleBeats} 拍，示范 {modeStats.examples} 拍、空拍 {modeStats.rests} 拍、练习音 {modeStats.notes} 拍。
              </p>
              <p className="mb-2">
                演示周期结束后会显示提示信息；正式练习周期如果通过，会自动移调进入下一轮。
              </p>
              <p>
                建议在示范与空拍阶段吸气，在首个练习音拍同时进入发声，与系统保持同拍。
              </p>
              </div>
          )}
          {renderPitchIndicator()}
          <div className="flex flex-col items-center mb-2">
            <div className="flex justify-center mb-2">
              {Array.from({ length: Math.max(cycleBeats, 1) }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center mx-1">
                  <span className="text-xs text-gray-500 mb-1">{idx + 1}</span>
                  <div
                    className={`w-3 h-3 rounded-full ${beat === idx + 1 ? 'bg-pink-500' : 'bg-gray-300'}`}
                  ></div>
                </div>
              ))}
            </div>
            <p className="text-gray-700">第{beat}/{Math.max(cycleBeats, 1)}拍 {beatLabel}</p>
          </div>
          <p className="text-sm text-gray-500">当前F0: {currentF0 > 0 ? currentF0.toFixed(1) : '--'} Hz</p>
        </div>
      )}

      {step === 'ascendFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRetryAscend}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              重试
            </button>
            <button
              onClick={handleStartDescending}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              开始下降练习
            </button>
          </div>
        </div>
      )}

      {step === 'descendFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRetryDescend}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              重试
            </button>
            <button
              onClick={handleFinishPractice}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              结束
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">练习结果</h2>
          <p className="mb-2 text-gray-700">最高音：{frequencyToNoteName(highestHz)} ({highestHz.toFixed(1)} Hz)</p>
          <p className="mb-4 text-gray-700">最低音：{frequencyToNoteName(lowestHz)} ({lowestHz.toFixed(1)} Hz)</p>
          {renderRangeKeyboard()}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => navigate('/mypage')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              返回
            </button>
            <button
              onClick={handleGetRecommendations}
              disabled={isGenerating}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-pink-300 disabled:cursor-not-allowed"
            >
              {isGenerating ? '生成中...' : '获取歌曲推荐'}
            </button>
          </div>

          {/* Recommendation Section */}
          <div className="mt-6 text-left">
            {isGenerating && (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                <span className="ml-3 text-gray-600">正在为您寻找合适的歌曲...</span>
              </div>
            )}
            {recommendationError && (
              <ApiErrorNotice
                error={recommendationError}
                onRetry={handleGetRecommendations}
                compact
              />
            )}
            {recommendations.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">歌曲推荐</h3>
                <ul className="space-y-4">
                  {recommendations.map((song, index) => (
                    <li key={index} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                      <p className="font-bold text-pink-600">{song.songName}</p>
                      <p className="text-sm text-gray-600 mb-1">Cover:  {song.artist}</p>
                      <p className="text-sm text-gray-700">推荐理由: {song.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScalePractice;
