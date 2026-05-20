import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PitchDetector } from 'pitchy';
import Soundfont from 'soundfont-player';
import { createDisplayPitchSmoother } from '../utils/pitchEval.js';
import modesConfig from '../config/scaleModes.json';
import { buildBeatTimeline, deriveModePitchMeta, planBeatSchedule } from '../utils/scaleModes.js';
import { calcMedian, detectEarlyVoicing, evaluateNoteStability } from '../utils/scalePracticeEval.js';
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
    .sort((a, b) => {
      const da = order[a.difficulty] ?? 999;
      const db = order[b.difficulty] ?? 999;
      if (da === db) return 0;
      return da - db;
    });
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

// 起始音相对 C4 的半音偏移上下限，避免移调到不可发声的极端音高
const MIN_SEMITONE_OFFSET = -36; // C1
const MAX_SEMITONE_OFFSET = 36;  // C7

// 模块级 Soundfont 缓存。注意：piano 实例内部会持有创建它的 AudioContext 的引用，
// 一旦那个 ctx 被 close()（用户离开页面 → 组件卸载 → cleanupAudio 关 ctx），整个 piano 就报废了：
// 再用它会产生 "Construction of GainNode is not useful when context is closed" 等报错。
// 所以缓存必须**以 ctx 实例本身**为 key（不是 sampleRate），并在 ctx 关掉时主动失效。
let cachedPiano = null;
let cachedPianoCtx = null;

const loadPianoInstrument = async (ctx) => {
  // 命中条件：必须是同一个 ctx 且仍处于活动状态。
  if (cachedPiano && cachedPianoCtx === ctx && ctx.state !== 'closed') {
    return cachedPiano;
  }
  cachedPiano = null;
  cachedPianoCtx = null;
  const inst = await Soundfont.instrument(ctx, 'acoustic_grand_piano');
  cachedPiano = inst;
  cachedPianoCtx = ctx;
  return inst;
};

const invalidatePianoCacheFor = (ctx) => {
  if (cachedPianoCtx === ctx) {
    cachedPiano = null;
    cachedPianoCtx = null;
  }
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
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [startOffset, setStartOffset] = useState(0); // 起始音相对C4的半音数
  const [beat, setBeat] = useState(0);
  const [beatLabel, setBeatLabel] = useState('');
  const [indicatorRange, setIndicatorRange] = useState({ min: 0, max: 0 });
  const [ladderNotes, setLadderNotes] = useState([]);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);
  const [modes] = useState(() => sortModesByDifficulty(modesConfig?.modes ?? []));
  const [selectedModeId, setSelectedModeId] = useState(() => {
    const sorted = sortModesByDifficulty(modesConfig?.modes ?? []);
    return sorted[0]?.id ?? '';
  });
  const [modeError, setModeError] = useState('');
  const [cycleBeats, setCycleBeats] = useState(() => {
    try {
      const sorted = sortModesByDifficulty(modesConfig?.modes ?? []);
      return sorted[0] ? buildBeatTimeline(sorted[0]).length : 8;
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
  const [rateLimitMessage, setRateLimitMessage] = useState(null);  // 限速消息

  // --- 音频与分析相关引用 ---
  const audioCtxRef = useRef(null);
  const audioSourceRef = useRef(null); // MediaStreamSource，多个分析路径共用一个
  const inputGainRef = useRef(null);   // 输入端软件增益：source → inputGain → analyser
  const analyserRef = useRef(null);
  const detectorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);
  const pianoRef = useRef(null); // 采样钢琴音色
  // 预分配的 pitchLoop 输入缓冲区，避免每帧 new Float32Array(2048) 制造 ~1 MB/s 的 GC 垃圾。
  // initAudio / reinitAnalyserForPitch 在 fftSize 变化时重建。
  const pitchInputBufferRef = useRef(null);

  // --- 练习参数与缓存 ---
  const baselineRmsRef = useRef(0);
  const tolerance = 75; // 允许的音差（cents）
  const stableWindowMs = 250; // 判定所需的稳定时间（与拍长取较小值的60%）
  // 显示和评分都用 0.45：换声区（女声 A#4 附近）clarity 常常跌到 0.4-0.6，0.6 会把这部分信号
  // 全部过滤掉。0.45 让换声区也被检测；噪声方面有能量门限（deltaDb=12）+ 稳定窗口（250ms）
  // + smoother 的中值/八度锁存兜底，false positive 不会影响最终判定。
  const clarityTheta = 0.45;
  const deltaDb = 12;
  const paddingCents = 150; // 音高指示器上下留白（cents）
  const baseQuarterMs = 600; // 基准四分音符时长，后续按模式缩放
  // 轨迹的最大点数：在 60Hz 下大约能保留 ~5 秒（覆盖一整个 cycle）。超出后按时间滚动丢弃最老的。
  const MAX_TRAIL_POINTS = 320;
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
  const [, setTrailVersion] = useState(0); // 用于触发轨迹重绘

  // 用于在 RAF 循环中读取最新 indicatorRange 而不用重建 pitchLoop
  const indicatorRangeRef = useRef({ min: 0, max: 0 });
  useEffect(() => { indicatorRangeRef.current = indicatorRange; }, [indicatorRange]);

  // 取消递归 setTimeout 链 + 中止当前正在运行的 runCycle
  const cycleTimeoutRef = useRef(null);
  const cycleAbortedRef = useRef(false);
  // 当前 cycle 的总时长（毫秒），轨迹采样需要据此计算 X 位置
  const cycleTotalDurationRef = useRef(0);
  // 最近一次 setCurrentF0 的值与时间，用于节流再渲染
  const lastF0PostedRef = useRef(0);
  // 当前 cycle 的音高轨迹（视图坐标 0..100）
  // 用环形缓冲：超过 MAX_TRAIL_POINTS 时按 push/shift 滚动，限制内存与渲染成本。
  const trailRef = useRef([]);
  const lastTrailRenderRef = useRef(0);
  // 缓存上次序列化结果，trail 长度未变时直接复用，避免每次重渲染都做 300 次 .map().join()。
  const trailPointsCacheRef = useRef({ length: 0, points: '' });

  // F0 显示平滑器：滚动中值 + 八度跳跃锁存，专门抑制 UI 上的视觉抖动
  const displaySmootherRef = useRef(null);
  if (!displaySmootherRef.current) {
    displaySmootherRef.current = createDisplayPitchSmoother();
  }

  // 削波（clipping）连续帧计数 → 一旦持续若干帧削波，提示用户降低音量
  const clipNoticeRef = useRef(0);
  const [clippingNotice, setClippingNotice] = useState(false);

  // 软件麦克风增益（线性 0.1–2.0；0.5 = -6 dB；1.0 = 0 dB；2.0 = +6 dB）
  const [micGain, setMicGain] = useState(1.0);
  // 当 micGain 状态变化时把值写到 GainNode；audioCtx 还没建好就先存着
  useEffect(() => {
    if (inputGainRef.current && audioCtxRef.current) {
      inputGainRef.current.gain.setTargetAtTime(
        micGain,
        audioCtxRef.current.currentTime,
        0.02
      );
    }
  }, [micGain]);

  // ============== 诊断日志 ==============
  // 设计思路：避免高频 setState 拖慢 pitchLoop（60Hz 渲染会卡）。
  // - 每帧把数据写到 ref（最新帧 + 累计计数）；
  // - 每 100ms 才 setState 触发一次面板重绘；
  // - 同时维护一个最多 30 条的环形 history，方便看转换瞬间。
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [, setDiagVersion] = useState(0);
  const diagLatestRef = useRef(null);
  const diagHistoryRef = useRef([]);
  const lastDiagRenderRef = useRef(0);
  const makeEmptyCounters = () => ({
    total: 0,
    strictHit: 0,        // K=0.9 直接命中
    fallbackHit: 0,      // K=0.9 失败，K=0.6 命中
    bothFail: 0,         // 两次都返回 [0,0]
    clippedFrames: 0,    // 削波帧数（不再 reject，仅统计 + UI 提示）
    rejectRange: 0,      // pitch 越界 (≤50 或 ≥2000)
    rejectClarity: 0,    // clarity 不达 clarityTheta
    visible: 0,          // 通过所有 gate
    smoothedZero: 0,     // smoother 输出 0
    smoothedNonZero: 0   // smoother 输出非 0
  });
  const diagCountersRef = useRef(makeEmptyCounters());
  const resetDiagnostics = () => {
    diagCountersRef.current = makeEmptyCounters();
    diagHistoryRef.current = [];
    diagLatestRef.current = null;
    setDiagVersion(v => (v + 1) & 0xffff);
  };

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
    // 新一轮 cycle 开始：清空轨迹 + 重置平滑器（避免上一 cycle 的尾音影响新 cycle 的冷启动）
    trailRef.current = [];
    trailPointsCacheRef.current = { length: 0, points: '' };
    setTrailVersion(v => (v + 1) & 0xffff);
    if (displaySmootherRef.current) displaySmootherRef.current.reset();
    clipNoticeRef.current = 0;
    setClippingNotice(false);
    if (!beatDurations.length) {
      setBeatCenters([]);
      cycleTotalDurationRef.current = 0;
      progressStartRef.current = 0;
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
    cycleTotalDurationRef.current = total;
    const tick = () => {
      const elapsed = Math.min(performance.now() - progressStartRef.current, total);
      const next = total ? elapsed / total : 0;
      // 阈值放宽到 ~0.001（约 1 像素差异），保证视觉上更连续
      if (Math.abs(next - lastProgressRef.current) > 0.001) {
        lastProgressRef.current = next;
        setTimelineProgress(next);
      }
      if (elapsed < total) {
        progressRafRef.current = requestAnimationFrame(tick);
      }
    };
    progressRafRef.current = requestAnimationFrame(tick);
  }, [stopProgressAnimation]);

  // --- 取消正在调度的下一轮 cycle（递归 setTimeout 链）---
  const cancelPendingCycle = useCallback(() => {
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }
    cycleAbortedRef.current = true;
    collectingRef.current = false;
  }, []);

  // --- 音频初始化与清理 ---
  const cleanupAudio = useCallback(() => {
    cancelPendingCycle();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      const ctxToClose = audioCtxRef.current;
      // 在 close() 之前先失效 piano 模块缓存，避免下次 mount 拿到指向已死 ctx 的旧 piano
      invalidatePianoCacheFor(ctxToClose);
      ctxToClose.close().catch(() => {});
      audioCtxRef.current = null;
    }
    audioSourceRef.current = null;
    inputGainRef.current = null;
    analyserRef.current = null;
    detectorRef.current = null;
    pitchInputBufferRef.current = null;
    pianoRef.current = null;
    trailRef.current = [];
    trailPointsCacheRef.current = { length: 0, points: '' };
    cycleTotalDurationRef.current = 0;
    progressStartRef.current = 0;
    if (displaySmootherRef.current) displaySmootherRef.current.reset();
    clipNoticeRef.current = 0;
    setClippingNotice(false);
    stopProgressAnimation(true);
  }, [cancelPendingCycle, stopProgressAnimation]);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const pitchLoop = useCallback(() => {
    if (!detectorRef.current || !analyserRef.current || !audioCtxRef.current) return;
    // 复用预分配的缓冲区。第一次进入或 fftSize 变化时按需重建。
    let input = pitchInputBufferRef.current;
    const expectedLen = detectorRef.current.inputLength;
    if (!input || input.length !== expectedLen) {
      input = new Float32Array(expectedLen);
      pitchInputBufferRef.current = input;
    }
    analyserRef.current.getFloatTimeDomainData(input);

    // 同时算 RMS / peak / "贴轨样本数"
    // 之前用 peak >= 0.985 判削波过于敏感——大声 chest voice、强假声的瞬时 peak 都能到 0.99，
    // 但其实没有真正削波。真正的削波是：信号被驱动顶在 ±1，连续多个样本 saturate 成同一个值。
    // 改用"贴轨样本占比"——绝大多数样本超过 0.999 才认为真在削波。
    const RAIL = 0.999;
    let sumSq = 0;
    let peak = 0;
    let railCount = 0;
    for (let i = 0; i < input.length; i++) {
      const s = input[i];
      sumSq += s * s;
      const a = s < 0 ? -s : s;
      if (a > peak) peak = a;
      if (a >= RAIL) railCount += 1;
    }
    const rms = Math.sqrt(sumSq / input.length);
    const railRatio = railCount / input.length;
    // 阈值 1%：input.length=2048 时需要 ≥ 20 个样本贴轨。
    // 假声 / 大声 chest voice 即使 peak=0.99 也基本只有 0~3 个偶发尖点，不会触发；
    // 真正被设备压扁的削波信号会有连续大段贴轨，远超 1%。
    const clipped = railRatio > 0.01;

    // 自适应 pitchy 内部 clarityThreshold：
    // - 先用严格 0.9（默认）
    // - 失败（[0,0]）再降到 0.6 fallback
    const detector = detectorRef.current;
    detector.clarityThreshold = 0.9;
    let [pitch, clarity] = detector.findPitch(input, audioCtxRef.current.sampleRate);
    const attempt1Pitch = pitch;
    const attempt1Clarity = clarity;
    let usedFallback = false;
    if (pitch === 0) {
      detector.clarityThreshold = 0.6;
      [pitch, clarity] = detector.findPitch(input, audioCtxRef.current.sampleRate);
      usedFallback = true;
    }
    const now = performance.now();

    // 持续削波时弹出提示（连续 ~10 帧 ≈ 170ms）
    if (clipped) {
      clipNoticeRef.current += 1;
      if (clipNoticeRef.current === 10) setClippingNotice(true);
    } else if (clipNoticeRef.current > 0) {
      clipNoticeRef.current = Math.max(0, clipNoticeRef.current - 2);
      if (clipNoticeRef.current === 0) setClippingNotice(false);
    }

    if (collectingRef.current) {
      // 帧上同时携带 clipped，评估端会据此过滤
      currentFramesRef.current.push({ pitch, clarity, rms, t: now, clipped });
    }

    // 显示链 gate（每条 reject 原因都暴露给诊断面板）
    // 注意：clipped 帧不再在这里拒绝——削波只触发 UI 提示，仍送 smoother / 评估，
    // 让用户能继续看到音高（自相关对削波有一定鲁棒性）。
    let rejectReason = null;
    let rawVisible = false;
    if (!Number.isFinite(pitch) || pitch === 0) {
      rejectReason = 'pitchy返回0';
    } else if (pitch <= 50 || pitch >= 2000) {
      rejectReason = `范围外(${pitch.toFixed(0)}Hz)`;
    } else if (clarity < clarityTheta) {
      rejectReason = `clarity低(${clarity.toFixed(2)})`;
    } else {
      rawVisible = true;
    }
    const smoothed = displaySmootherRef.current.push(rawVisible ? pitch : 0);

    // 节流：smoothed F0 变化 > 1 Hz 才触发重渲染
    if (
      Math.abs(smoothed - lastF0PostedRef.current) > 1 ||
      (smoothed === 0) !== (lastF0PostedRef.current === 0)
    ) {
      lastF0PostedRef.current = smoothed;
      setCurrentF0(smoothed);
    }

    // 轨迹采用 smoothed pitch（轨迹本身就是给用户看的"我的基频"），保证视觉连续。
    const startMs = progressStartRef.current;
    const totalMs = cycleTotalDurationRef.current;
    const range = indicatorRangeRef.current;
    if (smoothed > 0 && startMs && totalMs > 0 && range && range.min > 0 && range.max > range.min) {
      const elapsed = now - startMs;
      if (elapsed >= 0 && elapsed <= totalMs) {
        const xPct = (elapsed / totalMs) * 100;
        const yRatio = freqToPercent(smoothed, range);
        const yPct = (1 - yRatio) * 100; // SVG 视图：0=top, 100=bottom
        const trail = trailRef.current;
        trail.push({ x: xPct, y: yPct });
        // 环形容量保护，避免极端情况下（比如长 cycle、慢 GC 后追赶推送）无限增长
        if (trail.length > MAX_TRAIL_POINTS) trail.shift();
        if (now - lastTrailRenderRef.current > 33) {
          lastTrailRenderRef.current = now;
          setTrailVersion(v => (v + 1) & 0xffff);
        }
      }
    }

    // ==== 诊断日志：每帧都写 ref，~10Hz 触发一次 React 重绘 ====
    const counters = diagCountersRef.current;
    counters.total += 1;
    if (attempt1Pitch > 0) counters.strictHit += 1;
    else if (pitch > 0) counters.fallbackHit += 1;
    else counters.bothFail += 1;
    if (clipped) counters.clippedFrames += 1;
    if (rejectReason && rejectReason.startsWith('范围外')) counters.rejectRange += 1;
    else if (rejectReason && rejectReason.startsWith('clarity低')) counters.rejectClarity += 1;
    if (rawVisible) counters.visible += 1;
    if (smoothed > 0) counters.smoothedNonZero += 1;
    else counters.smoothedZero += 1;

    const entry = {
      t: now,
      rms,
      peak,
      railRatio,
      clipped,
      attempt1: { pitch: attempt1Pitch, clarity: attempt1Clarity },
      attempt2: usedFallback ? { pitch, clarity } : null,
      rejectReason,
      rawVisible,
      pitchToSmoother: rawVisible ? pitch : 0,
      smoothed,
      smootherDisplayed: displaySmootherRef.current.value
    };
    diagLatestRef.current = entry;
    const history = diagHistoryRef.current;
    history.push(entry);
    if (history.length > 30) history.shift();
    if (now - lastDiagRenderRef.current > 100) {
      lastDiagRenderRef.current = now;
      setDiagVersion(v => (v + 1) & 0xffff);
    }

    rafRef.current = requestAnimationFrame(pitchLoop);
  }, []);

  const initAudio = useCallback(async () => {
    // 关闭浏览器侧的 AGC / 降噪 / 回声消除，这些 DSP 会非线性地修改输入信号、扰乱基频检测
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    mediaStreamRef.current = stream;
    // 尝试固化 sampleRate=48000，消除设备/驱动差异（Bluetooth 16kHz 等会让低频检测劣化）。
    // 部分 Safari 不接受指定 sampleRate，捕获后退回默认。
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx;
    try {
      ctx = new AudioCtx({ sampleRate: 48000 });
    } catch {
      ctx = new AudioCtx();
    }
    audioCtxRef.current = ctx;
    let pianoLoaded = false;
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        pianoRef.current = await loadPianoInstrument(ctx);
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
    audioSourceRef.current = source;
    // 在 source → analyser 中间插入一个软件 GainNode，让用户可调节"输入灵敏度"。
    // 浏览器没有提供直接调节 mic gain 的 API（OS 层），但软件衰减能避免硬削波之外
    // 的"信号过热"问题，并给 analyser/pitchy 一个合理动态范围。
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0; // 初始 0 dB；下面 micGain useEffect 会同步用户调过的值
    source.connect(inputGain);
    inputGainRef.current = inputGain;

    const analyser = ctx.createAnalyser();
    // 默认 2048（≈42 ms @48 kHz），覆盖大多数用户。
    // 校准完成后若发现起始音 < 100 Hz，会通过 reinitAnalyserForPitch() 切换到 4096。
    analyser.fftSize = 2048;
    inputGain.connect(analyser);
    analyserRef.current = analyser;
    detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
    // 不在这里固定 clarityThreshold——pitchLoop 会按帧动态切换：先用严格 0.9 试，
    // 拿不到（[0,0]）再降到 0.6 fallback（针对假声 / 弱基频）。
    // 注意：此值不再用作"稳定窗口累加 dt"——评估改为按帧时间戳计算。
    // 仍保留以防其他逻辑兜底使用（取 RAF 的近似间隔，约 16.7 ms）。
    frameDurationRef.current = 1000 / 60;
    pitchLoop();
  }, [pitchLoop]);

  /**
   * @zh 根据目标基频动态调整 analyser/detector 的 fftSize。
   * - 目标 < 100 Hz：4096（≈85 ms @48 kHz，给低频留 8+ 个周期，提升稳定性）；
   * - 否则：2048（时间分辨率更高，反应更敏捷）。
   * 当 fftSize 已经满足要求时直接返回，避免重复重建。
   */
  const reinitAnalyserForPitch = useCallback((targetFreq) => {
    const ctx = audioCtxRef.current;
    const inputGain = inputGainRef.current;
    if (!ctx || !inputGain) return;
    const desired = targetFreq > 0 && targetFreq < 100 ? 4096 : 2048;
    const current = analyserRef.current?.fftSize ?? 0;
    if (current === desired) return;
    try {
      analyserRef.current?.disconnect();
    } catch { /* ignore */ }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = desired;
    inputGain.connect(analyser); // analyser 接在 inputGain 之后，软件增益依然生效
    analyserRef.current = analyser;
    detectorRef.current = PitchDetector.forFloat32Array(desired);
    // clarityThreshold 由 pitchLoop 按帧动态切换，不在这里固定
    // 让 pitchLoop 下次自动重分配 input buffer
    pitchInputBufferRef.current = null;
  }, []);

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
    setPermissionGranted(false);
    try {
      await initAudio();
      setPermissionMsg('已成功获取麦克风权限，请戴上耳机');
      setPermissionGranted(true);
    } catch (err) {
      console.error(err);
      setPermissionMsg('');
      setPermissionGranted(false);
      setPermissionError('无法获取麦克风权限，请确认已授予浏览器麦克风访问权限。');
    }
  }, [initAudio]);

  // --- Step1: 耳机检测 ---
  // 测试音始终走振荡器（不依赖钢琴 soundfont 是否加载、不依赖网络），增益设为 4，
  // 判定阈值放宽到 6 dB，降低假阴性率（用户没戴耳机却被判通过）。
  const handleHeadphoneCheck = async () => {
    setStep('headphone');
    setMessage('请保持安静，我们正在检测环境噪音...');
    const baselineRms = await measureRms(800);
    baselineRmsRef.current = baselineRms;
    const baselineDb = await measureFreqDb(1000, 2000);
    setMessage('现在播放 1 kHz 标准音，请确认不会被麦克风录到');
    const testPromise = measureFreqDb(1000, 2000);
    await playTone(1000, 2000, false, 4); // 强制振荡器 + 增大音量
    const testDb = await testPromise;
    if (testDb > baselineDb + 6) {
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
    await playTone(1000, 300, false, 4); // 嘀声同样强制振荡器
    collectingRef.current = true;
    await new Promise(r => setTimeout(r, 3000));
    collectingRef.current = false;
    const valid = currentFramesRef.current.filter(f => f.pitch > 50 && f.pitch < 2000 && f.clarity >= clarityTheta);
    const f0s = valid.map(f => f.pitch);
    const sff = calcMedian(f0s);
    if (!Number.isFinite(sff) || sff <= 0 || valid.length < 5) {
      // 没有捕捉到有效发声：保留校准步骤，提示重试，避免静默落到极端起始音
      setMessage('没有检测到清晰的发声，请确认麦克风工作并保持稳定的 /a/ 音，再试一次。');
      setStep('calibration');
      return;
    }
    let idx = Math.round(12 * Math.log2(sff / 261.63)) - 2;
    if (idx > MAX_SEMITONE_OFFSET) idx = MAX_SEMITONE_OFFSET;
    if (idx < MIN_SEMITONE_OFFSET) idx = MIN_SEMITONE_OFFSET;
    // setup 滑块范围仍为 ±12，使用 12 作为软边界
    if (idx > 12) idx = 12;
    if (idx < -12) idx = -12;
    setStartOffset(idx);
    // 根据校准音的最低点动态调整 fftSize（低音区用 4096 提升稳定性）
    const calibratedLow = 261.63 * Math.pow(semitoneRatio, idx);
    reinitAnalyserForPitch(calibratedLow);
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
    cycleAbortedRef.current = false;
    const baseIndex = direction === 'ascending'
      ? rootIndexRef.current
      : descendingIndexRef.current;

    // 上下界保护：防止持续移调到不可发声的极端音高
    if (baseIndex > MAX_SEMITONE_OFFSET || baseIndex < MIN_SEMITONE_OFFSET) {
      setMessage('已到达本练习的音域上限/下限，自动结束当前阶段。');
      stopProgressAnimation(true);
      setStep(direction === 'ascending' ? 'ascendFail' : 'descendFail');
      return;
    }

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
    indicatorRangeRef.current = modeRange; // pitchLoop 立即可见，避免轨迹首帧丢失
    setLadderNotes(modeLadder);

    setStep(isDemo ? 'demoLoop' : direction);
    startProgressAnimation(beatDurations);
    const beatData = [];
    const noteSteps = timeline
      .map((item, idx) => (item.type === 'note' ? { ...item, beatIdx: idx } : null))
      .filter(Boolean);
    const firstNoteIdx = noteSteps.length ? noteSteps[0].beatIdx : timeline.length;
    for (let i = 0; i < timeline.length; i++) {
      if (cycleAbortedRef.current) {
        stopProgressAnimation(true);
        return;
      }
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

    if (cycleAbortedRef.current) {
      stopProgressAnimation(true);
      return;
    }

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

    // "切入过早"检测：要求示例 / 空拍阶段累计连续发声时长超过阈值才判定。
    // 阈值取 min(250 ms, beatDur*0.5)：beatDur 越短（八分音符 / 十六分音符模式）阈值越小，
    // 但单帧 / 短瞬态（漏音、咔哒声、清嗓子）始终不会触发。
    const earlyVoicingThresholdMs = Math.min(250, beatDur * 0.5);
    const earlyResult = detectEarlyVoicing({
      beatData,
      firstNoteIdx,
      baselineRms: baselineRmsRef.current,
      deltaDb,
      clarityTheta,
      thresholdMs: earlyVoicingThresholdMs
    });
    const earlyVoicing = earlyResult.early;

    if (isDemo) {
      let resultMsg = '演示结束，做得很好！';
      if (earlyVoicing) {
        resultMsg = '切入太早，应该和系统播放的目标音同时切入';
      } else if (!evaluation.passed) {
        resultMsg = formatFailMessage(evaluation.failedNote);
      }
      setMessage(resultMsg);
      setStep('demoEnd');
      stopProgressAnimation(true);
      return;
    }

    // 正式练习中：切入过早视为本轮失败
    if (earlyVoicing) {
      setMessage('切入过早：请等待示范音播完、空拍结束后再发声。');
      stopProgressAnimation(true);
      setStep(direction === 'ascending' ? 'ascendFail' : 'descendFail');
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
      setHighestHz(prev => Math.max(prev, cycleHigh));
      rootIndexRef.current += currentMode.transposeStep ?? 1;
      cycleTimeoutRef.current = setTimeout(() => {
        cycleTimeoutRef.current = null;
        if (!cycleAbortedRef.current) runCycle('ascending');
      }, 800);
    } else {
      setStep('descending');
      const cycleLow = baseFreq * Math.pow(semitoneRatio, minOffset);
      setLowestHz(prev => {
        const floorFreq = lowestFloorRef.current || computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
        const baseLow = prev === 0 ? cycleLow : Math.min(prev, cycleLow);
        return floorFreq ? Math.min(baseLow, floorFreq) : baseLow;
      });
      descendingIndexRef.current -= currentMode.transposeStep ?? 1;
      cycleTimeoutRef.current = setTimeout(() => {
        cycleTimeoutRef.current = null;
        if (!cycleAbortedRef.current) runCycle('descending');
      }, 800);
    }
  };

  const handleDemoStart = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    // 起始音可能在 setup 页被滑动调整过，重新评估 fftSize
    reinitAnalyserForPitch(computeModeFloorFreq(currentMode, startOffset, semitoneRatio));
    rootIndexRef.current = startOffset;
    runCycle('ascending', true);
  };

  const handlePracticeStart = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    // 记录当前起始音下可达到的最低参考频率，用于结果页兜底
    lowestFloorRef.current = computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
    reinitAnalyserForPitch(lowestFloorRef.current);
    rootIndexRef.current = startOffset;
    runCycle('ascending');
  };

  const handleRetryAscend = () => {
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    setMessage('再试一次');
    runCycle('ascending');
  };

  const handleStartDescending = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    // 下降练习从爬升练习最后一轮的起始音开始
    descendingIndexRef.current = rootIndexRef.current - (currentMode?.transposeStep ?? 1);
    runCycle('descending');
  };

  /**
   * @zh 强制通过上行失败：以本轮的目标音作为已达成最高音并推进到下一轮。
   */
  const handleForcePassAscend = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    const baseIndex = rootIndexRef.current;
    const baseFreq = 261.63 * Math.pow(semitoneRatio, baseIndex);
    const offsets = currentMode?.patternOffsets ?? [];
    const maxOffset = offsets.length ? Math.max(...offsets, 0) : 0;
    const cycleHigh = baseFreq * Math.pow(semitoneRatio, maxOffset);
    setHighestHz(prev => Math.max(prev, cycleHigh));
    setMessage('已强制通过本轮上行判定，进入下一个音阶。');
    setStep('ascending');
    rootIndexRef.current += currentMode?.transposeStep ?? 1;
    cycleTimeoutRef.current = setTimeout(() => {
      cycleTimeoutRef.current = null;
      if (!cycleAbortedRef.current) runCycle('ascending');
    }, 800);
  };

  const handleRetryDescend = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    setMessage('再试一次');
    runCycle('descending');
  };

  /**
   * @zh 强制通过下降失败：以本轮的目标低音作为已达成最低音并推进到下一轮。
   */
  const handleForcePassDescend = () => {
    if (!ensureModeReady()) return;
    cancelPendingCycle();
    cycleAbortedRef.current = false;
    const baseIndex = descendingIndexRef.current;
    const baseFreq = 261.63 * Math.pow(semitoneRatio, baseIndex);
    const offsets = currentMode?.patternOffsets ?? [];
    const minOffset = offsets.length ? Math.min(...offsets, 0) : 0;
    const cycleLow = baseFreq * Math.pow(semitoneRatio, minOffset);
    setLowestHz(prev => (prev === 0 ? cycleLow : Math.min(prev, cycleLow)));
    setMessage('已强制通过本轮下降判定，进入下一个音阶。');
    setStep('descending');
    descendingIndexRef.current -= currentMode?.transposeStep ?? 1;
    cycleTimeoutRef.current = setTimeout(() => {
      cycleTimeoutRef.current = null;
      if (!cycleAbortedRef.current) runCycle('descending');
    }, 800);
  };

  /**
   * @zh 中途结束练习，直接进入结果页。可在 demoLoop / ascending / descending / *Fail 任意阶段触发。
   */
  const handleEndPractice = () => {
    cancelPendingCycle();
    stopProgressAnimation(true);
    // 兜底：若上行从未通过任意一轮，至少把"起始音处的目标最高音"记入最高音；
    // 同理下行未通过时使用 floorFreq（与 handleFinishPractice 兜底一致）。
    if (currentMode) {
      const offsets = currentMode.patternOffsets ?? [];
      const maxOffset = offsets.length ? Math.max(...offsets, 0) : 0;
      const startBaseFreq = 261.63 * Math.pow(semitoneRatio, startOffset);
      const startHigh = startBaseFreq * Math.pow(semitoneRatio, maxOffset);
      setHighestHz(prev => (prev > 0 ? prev : startHigh));
    }
    const floorFreq = lowestFloorRef.current || computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
    setLowestHz(prev => {
      if (!floorFreq) return prev;
      if (prev === 0 || prev > floorFreq) return floorFreq;
      return prev;
    });
    setStep('result');
  };

  const handleFinishPractice = () => {
    cancelPendingCycle();
    cleanupAudio();
    const floorFreq = lowestFloorRef.current || computeModeFloorFreq(currentMode, startOffset, semitoneRatio);
    setLowestHz(prev => {
      if (!floorFreq) return prev;
      if (prev === 0 || prev > floorFreq) return floorFreq;
      return prev;
    });
    if (currentMode && highestHz === 0) {
      const offsets = currentMode.patternOffsets ?? [];
      const maxOffset = offsets.length ? Math.max(...offsets, 0) : 0;
      const startBaseFreq = 261.63 * Math.pow(semitoneRatio, startOffset);
      setHighestHz(startBaseFreq * Math.pow(semitoneRatio, maxOffset));
    }
    stopProgressAnimation(true);
    setStep('result');
  };

  // --- 获取歌曲推荐 ---
  const handleGetRecommendations = async () => {
    setIsGenerating(true);
    setRecommendationError(null);
    setRecommendations([]);
    setRateLimitMessage(null);

    try {
      const lowestNote = frequencyToNoteName(lowestHz);
      const highestNote = frequencyToNoteName(highestHz);
      const result = await getSongRecommendations({ lowestNote, highestNote });
      
      // 处理限速响应
      if (result.rateLimited) {
        setRateLimitMessage(result.message);
      }
      setRecommendations(result.recommendations || []);
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

  // --- 音高指示器 ---
  // 设计要点：
  // 1. 频率越高 → 视觉上越靠上。指示线 (label) 与小圆点统一使用 `bottom: P%`
  //    （P = freqToPercent(f) * 100）。圆点用 translate(-50%, 50%) 把"贴底参考点"提
  //    到圆点中心，这样圆点中心对齐 P%；指示线用 translate-y-1/2 (translateY(50%))
  //    向下推 0.5×行高，使行高的中心也对齐 P%。两者中心点在同一 frequency 上严格重合。
  // 2. 圆点的 X 位置从 0% 到 100% 线性映射 timelineProgress（之前的 [3,97] 钳制会
  //    在两端形成"停顿"区间，是导致"运动不均匀"的主要原因，已移除）。
  // 3. 通过 SVG `<polyline>` 绘制 cycle 内的音高轨迹（trailRef 在 pitchLoop 中实时
  //    采样），让用户能直观看到自己的音高变化。SVG viewBox 0..100，y 用
  //    (1 - freqToPercent) * 100 做翻转，与 div bottom 对齐。
  const renderPitchIndicator = () => {
    if (!indicatorRange.min || !indicatorRange.max || !ladderNotes.length) return null;
    const sortedNotes = [...new Set(ladderNotes)].sort((a, b) => a - b);
    const dotBottomPct = Math.max(0, Math.min(100, freqToPercent(currentF0, indicatorRange) * 100));
    const dotLeftPct = Math.max(0, Math.min(100, timelineProgress * 100));
    // trail 长度未变化时复用缓存的 points 字符串，避免每次 render 都跑 .map().join() 制造垃圾。
    // 长度变化时重算（因为 push 总是 append，老点位置不会变；shift 会改变点序列但仍要重算）。
    const trail = trailRef.current;
    const cache = trailPointsCacheRef.current;
    let trailPoints;
    if (cache.length === trail.length) {
      trailPoints = cache.points;
    } else {
      trailPoints = trail
        .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(' ');
      trailPointsCacheRef.current = { length: trail.length, points: trailPoints };
    }

    return (
      <div className="relative bg-gray-100 rounded mb-4 overflow-hidden h-[32rem]">
        <div className="absolute inset-4">
          {/* 拍中心虚线辅助 */}
          <div className="absolute inset-0 pointer-events-none">
            {beatCenters.map((center, idx) => (
              <div
                key={`center-${idx}`}
                className="absolute top-0 bottom-0 border-l border-dashed border-pink-200"
                style={{ left: `${center}%`, zIndex: 6 }}
              >
                <div className="absolute bottom-1/2 translate-y-1/2 -translate-x-1/2 w-2 h-2 bg-pink-200 rounded-full opacity-80"></div>
              </div>
            ))}
          </div>
          {/* 参考音区间（容差色带）+ 标签线 */}
          {sortedNotes.map((f, idx) => {
            const lowerF = f * Math.pow(2, -tolerance / 1200);
            const upperF = f * Math.pow(2, tolerance / 1200);
            const lowerPct = Math.max(0, Math.min(100, freqToPercent(lowerF, indicatorRange) * 100));
            const upperPct = Math.max(0, Math.min(100, freqToPercent(upperF, indicatorRange) * 100));
            const centerPct = Math.max(0, Math.min(100, freqToPercent(f, indicatorRange) * 100));
            const bandHeight = Math.max(0, upperPct - lowerPct);
            return (
              <React.Fragment key={`${f}-${idx}`}>
                <div
                  className="absolute inset-x-0 bg-pink-200 opacity-40"
                  style={{ bottom: `${lowerPct}%`, height: `${bandHeight}%`, zIndex: 5 }}
                ></div>
                <div
                  className="absolute inset-x-0 translate-y-1/2 flex items-center justify-between text-xs text-gray-700"
                  style={{ bottom: `${centerPct}%`, zIndex: 10 }}
                >
                  <span className="bg-white/80 px-1 rounded">{frequencyToNoteName(f)}</span>
                  <div className="flex-1 h-px bg-pink-500 mx-2"></div>
                  <span className="bg-white/80 px-1 rounded">{f.toFixed(1)} Hz</span>
                </div>
              </React.Fragment>
            );
          })}
          {/* 音高轨迹（SVG）。preserveAspectRatio="none" 让 0..100 线性铺满。
              y = (1 - freqToPercent) * 100 — 与 div bottom 视觉一致。 */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ zIndex: 12 }}
          >
            {trailPoints && (
              <polyline
                points={trailPoints}
                stroke="rgba(236, 72, 153, 0.55)"
                strokeWidth="1.5"
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          {/* 当前音高指示圆点：水平 0..100% 完全跟随进度（无钳制、无 CSS 过渡） */}
          {currentF0 > 0 && (
            <div
              className="absolute w-3 h-3 bg-pink-500 rounded-full shadow-md"
              style={{
                bottom: `${dotBottomPct}%`,
                left: `${dotLeftPct}%`,
                zIndex: 15,
                transform: 'translate(-50%, 50%)',
                pointerEvents: 'none'
              }}
            ></div>
          )}
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

      {/* ============== 麦克风音量监视 + 增益控制 ============== */}
      {permissionGranted && step !== 'intro' && step !== 'permission' && (() => {
        const stats = diagLatestRef.current;
        const rms = stats?.rms ?? 0;
        const peak = stats?.peak ?? 0;
        const railRatio = stats?.railRatio ?? 0;
        // 把线性 RMS 映射到条宽：常见说话 RMS 约 0.05–0.2，唱歌可到 0.3–0.5
        // ×200 → 0.5 RMS 满刻度。实战足够。
        const rmsBarPct = Math.min(100, rms * 200);
        const peakBarPct = Math.min(100, peak * 100);
        const dB = 20 * Math.log10(Math.max(0.001, micGain));
        const isClippingNow = railRatio > 0.01;
        return (
          <div className="bg-white p-3 rounded-lg shadow-sm mb-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-700 font-medium">麦克风音量</span>
                {isClippingNow && (
                  <span className="text-red-600 font-semibold">⚠ 削波中（贴轨 {(railRatio * 100).toFixed(1)}%）</span>
                )}
              </div>
              <div className="relative h-3 bg-gray-200 rounded overflow-hidden">
                {/* RMS 主条 */}
                <div
                  className={`absolute left-0 top-0 bottom-0 transition-[width] duration-75 ${
                    peak >= 0.99 ? 'bg-red-500' : peak >= 0.85 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${rmsBarPct}%` }}
                />
                {/* 警戒区底色（85%-100%）*/}
                <div className="absolute top-0 bottom-0 right-0 w-[15%] bg-red-100 opacity-40 pointer-events-none" />
                {/* 瞬时 peak 标线 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-700"
                  style={{ left: `${peakBarPct}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                rms={rms.toFixed(3)} · peak={peak.toFixed(3)}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <label className="text-gray-700">软件增益</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={micGain}
                onChange={e => setMicGain(parseFloat(e.target.value))}
                className="w-32"
                aria-label="麦克风软件增益"
              />
              <span className="text-gray-600 w-16 text-right tabular-nums">
                {dB >= 0 ? '+' : ''}{dB.toFixed(1)} dB
              </span>
              <button
                onClick={() => setMicGain(1.0)}
                className="text-xs text-gray-500 hover:text-gray-800 px-2 py-0.5 border border-gray-300 rounded"
                title="重置为 0 dB"
              >
                重置
              </button>
            </div>
          </div>
        );
      })()}

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
          {permissionGranted && (
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
          {clippingNotice && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 inline-block">
              ⚠ 录音音量已触顶（削波），请稍微远离麦克风或降低音量，否则基频检测会失真。
            </p>
          )}
          {step !== 'demoLoop' && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleEndPractice}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
              >
                结束练习并查看结果
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'ascendFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex flex-wrap gap-3 justify-center">
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
            <button
              onClick={handleForcePassAscend}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              强制通过
            </button>
            <button
              onClick={handleEndPractice}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              结束并查看结果
            </button>
          </div>
        </div>
      )}

      {step === 'descendFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex flex-wrap gap-3 justify-center">
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
            <button
              onClick={handleForcePassDescend}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              强制通过
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">练习结果</h2>
          <p className="mb-2 text-gray-700">
            最高音：{highestHz > 0 ? `${frequencyToNoteName(highestHz)} (${highestHz.toFixed(1)} Hz)` : '未测得'}
          </p>
          <p className="mb-4 text-gray-700">
            最低音：{lowestHz > 0 ? `${frequencyToNoteName(lowestHz)} (${lowestHz.toFixed(1)} Hz)` : '未测得'}
          </p>
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
            {/* 限速提示消息 */}
            {rateLimitMessage && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-amber-700">{rateLimitMessage}</p>
                </div>
              </div>
            )}
            {recommendations.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3 text-center">
                  {rateLimitMessage ? '上次的歌曲推荐' : '歌曲推荐'}
                </h3>
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

      {/* ==================== 诊断日志面板 ==================== */}
      <div className="mt-8 border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowDiagnostics(v => !v)}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            {showDiagnostics ? '隐藏诊断日志' : '显示诊断日志（用于排查检测问题）'}
          </button>
          {showDiagnostics && (
            <button
              onClick={resetDiagnostics}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
            >
              重置计数
            </button>
          )}
        </div>
        {showDiagnostics && (() => {
          const latest = diagLatestRef.current;
          const counters = diagCountersRef.current;
          const history = diagHistoryRef.current;
          const fmt = (n, d = 2) => (n == null || !Number.isFinite(n) ? '--' : n.toFixed(d));
          const pct = (n, total) => total > 0 ? `${(n / total * 100).toFixed(1)}%` : '0%';
          const ctxSr = audioCtxRef.current?.sampleRate ?? '?';
          const fft = analyserRef.current?.fftSize ?? '?';
          return (
            <div className="bg-gray-900 text-green-300 font-mono text-xs p-3 rounded space-y-3">
              <div className="text-yellow-200">
                AudioContext: sampleRate={ctxSr} Hz | analyser.fftSize={fft} | clarityTheta(外部)={clarityTheta} | pitch range=(50, 2000)
              </div>

              <div className="border border-gray-700 rounded p-2">
                <div className="text-cyan-200 mb-1">▼ 最新一帧（{latest ? `t=${fmt(latest.t, 0)}ms` : '无数据'}）</div>
                {latest ? (
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-gray-400">输入</span>: rms={fmt(latest.rms, 4)} peak={fmt(latest.peak, 4)} 贴轨={fmt((latest.railRatio ?? 0) * 100, 2)}% {latest.clipped && <span className="text-red-400">⚠ CLIPPED</span>}
                    </div>
                    <div>
                      <span className="text-gray-400">pitchy K=0.9</span>: pitch={fmt(latest.attempt1.pitch, 1)}Hz clarity={fmt(latest.attempt1.clarity, 3)} {latest.attempt1.pitch === 0 && <span className="text-orange-400">→ 触发 fallback</span>}
                    </div>
                    {latest.attempt2 && (
                      <div>
                        <span className="text-gray-400">pitchy K=0.6</span>: pitch={fmt(latest.attempt2.pitch, 1)}Hz clarity={fmt(latest.attempt2.clarity, 3)}
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">gate</span>: {latest.rawVisible
                        ? <span className="text-green-400">✓ visible (送 smoother)</span>
                        : <span className="text-red-400">✗ rejected: {latest.rejectReason}</span>}
                    </div>
                    <div>
                      <span className="text-gray-400">smoother</span>: input={fmt(latest.pitchToSmoother, 1)} → output={fmt(latest.smoothed, 1)}Hz {latest.smoothed > 0 && latest.pitchToSmoother > 0 && Math.abs(latest.smoothed - latest.pitchToSmoother) > 5 && <span className="text-orange-400">(被锁存/中值修改)</span>}
                    </div>
                  </div>
                ) : <div className="text-gray-500">等待 pitchLoop 启动...</div>}
              </div>

              <div className="border border-gray-700 rounded p-2">
                <div className="text-cyan-200 mb-1">▼ 累计统计（共 {counters.total} 帧）</div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div>严格 K=0.9 命中: <span className="text-green-300">{counters.strictHit}</span> ({pct(counters.strictHit, counters.total)})</div>
                  <div>fallback 命中: <span className="text-yellow-300">{counters.fallbackHit}</span> ({pct(counters.fallbackHit, counters.total)})</div>
                  <div>双档失败 [0,0]: <span className="text-red-300">{counters.bothFail}</span> ({pct(counters.bothFail, counters.total)})</div>
                  <div>通过 gate: <span className="text-green-300">{counters.visible}</span> ({pct(counters.visible, counters.total)})</div>
                  <div>削波帧（仍计入）: <span className="text-amber-300">{counters.clippedFrames}</span></div>
                  <div>越界拒绝: {counters.rejectRange}</div>
                  <div>clarity 低拒绝: <span className="text-orange-300">{counters.rejectClarity}</span></div>
                  <div>smoother 输出 0: <span className="text-red-300">{counters.smoothedZero}</span></div>
                  <div>smoother 输出非零: <span className="text-green-300">{counters.smoothedNonZero}</span></div>
                </div>
              </div>

              <div className="border border-gray-700 rounded p-2">
                <div className="text-cyan-200 mb-1">▼ 最近 30 帧轨迹</div>
                <div className="max-h-48 overflow-y-auto">
                  {history.length === 0 && <div className="text-gray-500">无</div>}
                  {history.slice().reverse().map((e, i) => {
                    let color = 'text-gray-300';
                    if (!e.rawVisible) color = 'text-red-400';
                    else if (e.attempt2) color = 'text-yellow-300';
                    else color = 'text-green-300';
                    return (
                      <div key={i} className={color}>
                        {fmt(e.t, 0)}ms |
                        K0.9:{e.attempt1.pitch === 0 ? '---' : fmt(e.attempt1.pitch, 0)}({fmt(e.attempt1.clarity, 2)})
                        {e.attempt2 ? ` K0.6:${e.attempt2.pitch === 0 ? '---' : fmt(e.attempt2.pitch, 0)}(${fmt(e.attempt2.clarity, 2)})` : ''}
                        {' '}→ {e.rawVisible ? `out=${fmt(e.smoothed, 0)}` : `✗${e.rejectReason}`}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-gray-500 text-[10px]">
                提示：唱假声时观察这个面板。如果"严格命中"很低、"双档失败"很多 → pitchy 完全没找到周期信号；
                如果"fallback 命中"高但"smoother 输出 0" → smoother 把它锁了；
                如果"clarity 低拒绝"高 → 可以再降 clarityTheta。
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ScalePractice;
