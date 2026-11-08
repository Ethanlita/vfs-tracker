import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Recorder from './Recorder';
import LiveEffectPreview from './LiveEffectPreview.jsx';
import { EFFECT_ALGORITHMS, emptyEffectResults, getEffectAlgorithm } from '../audio/effectAlgorithms.js';
import { getPitchParameters, estimateReferencePitch } from '../audio/pitchParameters.js';
import { processRecordedEffect } from '../audio/processRecordedEffect.js';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';
import { createTemporaryAudioContext } from '../utils/audioContextManager';
import { loadWorldJs } from '../utils/worldJsLoader.js';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { matchTdPsolaEnergy } from '../utils/tdPsolaEnergy.js';
import {
  resolvePitchMarkPosition,
  scorePitchPeriodCandidate,
} from '../utils/tdPsolaPitchMarks.js';

// 录音提示与计时上限共用同一个值，避免文案和实际限制不一致。
const PREVIEW_RECORDING_LIMIT_SECONDS = 15;

/**
 * @zh VFS效果预览组件
 *
 * 基于VFS的原理，对用户语音进行变调处理，让用户通过录音-处理-播放来感受不同变调程度的效果。
 *
 * 功能特点：
 * - 用户可以录制自己的声音
 * - 选择变调的程度（0-100Hz）
 * - 播放处理后的音频以预览效果
 * - 提供免责说明和原理说明
 *
 * 技术实现：
 * - 使用 MediaRecorder API 进行录音
 * - 使用 Web Audio API 进行音频变调处理
 * - 纯前端实现，无需后端Lambda
 *
 * @returns {JSX.Element} VFS效果预览组件
 */
const VFSEffectPreview = ({ initialProcessedBlobs = null } = {}) => {
  // 设置页面 meta 标签
  useDocumentMeta({
    title: 'VFS效果预览',
    description: '在线预览嗓音女性化变调效果，录制您的声音并试听不同程度的音高调整。'
  });

  const navigate = useNavigate();

  // 状态管理
  const [recordedBlob, setRecordedBlob] = useState(null); // 原始录音
  const [pitchShift, setPitchShift] = useState(50); // 变调量（Hz），默认50Hz
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('rubberband'); // 算法标识由统一目录校验
  const [isProcessing, setIsProcessing] = useState(false); // 处理中状态
  const [processingProgress, setProcessingProgress] = useState(0); // 处理进度 (0-1)
  const [isWorldJSLoaded, setIsWorldJSLoaded] = useState(false); // World.JS 加载状态
  const [worldLoadError, setWorldLoadError] = useState(false);

  // 多版本处理结果
  const [processedBlobs, setProcessedBlobs] = useState(() => ({
    ...emptyEffectResults(),
    ...(initialProcessedBlobs || {})
  }));

  const [isPlaying, setIsPlaying] = useState(false); // 播放状态
  const [playbackType, setPlaybackType] = useState(null); // 'original' | 'td-psola' | 'rubberband' | 'world'
  const [currentTime, setCurrentTime] = useState(0); // 播放进度
  const [duration, setDuration] = useState(0); // 音频总时长
  const [detectedF0, setDetectedF0] = useState(0); // 检测到的基频

  const [mode, setMode] = useState('recorded');
  const [referenceF0, setReferenceF0] = useState(150);
  const [isDetectingPitch, setIsDetectingPitch] = useState(false);
  const [isRecordingTake, setIsRecordingTake] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const operationRef = useRef(0);
  const recordingGenerationRef = useRef(0);
  const abortProcessingRef = useRef(null);
  const closeDecodeRef = useRef(null);
  const closePitchDecodeRef = useRef(null);
  const audioUrlRef = useRef(null);
  usePwaUpdateBlocker(isProcessing, '音频处理');

  // 引用
  const audioElementRef = useRef(null);
  const animationFrameRef = useRef(null);

  /** 进入效果预览路由后才加载 WORLD；主页、登录和其他工具不会下载或初始化它。 */
  useEffect(() => {
    let active = true;
    setWorldLoadError(false);
    loadWorldJs()
      .then(() => {
        if (!active) return;
        setIsWorldJSLoaded(true);
      })
      .catch(() => {
        if (active) setWorldLoadError(true);
      });
    return () => { active = false; };
  }, []);

  /** WORLD 下载失败时沿相同加载入口重试，不引入轮询或第二套回退实现。 */
  const retryWorldLoad = () => {
    setWorldLoadError(false);
    loadWorldJs()
      .then(() => setIsWorldJSLoaded(true))
      .catch(() => setWorldLoadError(true));
  };

  /**
   * @zh 录音完成回调
   * @param {Blob} blob - 录制的音频Blob
   */
  /** 新录音拥有独立代次，迟到的基频检测不得覆盖下一次录音。 */
  const handleRecordingComplete = useCallback((blob) => {
    const generation = ++recordingGenerationRef.current;
    setIsRecordingTake(false);
    setRecordedBlob(blob);
    setProcessedBlobs(emptyEffectResults());
    setDetectedF0(0);
    setReferenceF0(150);
    setProcessingError(null);
    setIsDetectingPitch(true);
    void (async () => {
      let closePitchContext;
      try {
        const bytes = await blob.arrayBuffer();
        if (generation !== recordingGenerationRef.current) return;
        const temporary = createTemporaryAudioContext();
        let closing;
        closePitchContext = () => closing ??= temporary.close().catch(() => undefined);
        closePitchDecodeRef.current = closePitchContext;
        const decoded = await temporary.context.decodeAudioData(bytes);
        if (generation !== recordingGenerationRef.current) return;
        const samples = decoded.getChannelData(0);
        const start = Math.max(0, Math.floor((samples.length - 8192) / 2));
        const detected = estimateReferencePitch(samples.subarray(start, start + 8192), decoded.sampleRate);
        if (detected) { setDetectedF0(Math.round(detected)); setReferenceF0(Math.round(detected)); }
      } catch {
        // 检测不可靠时保留可见、可编辑的 150 Hz 参考值，不改变变调定义。
      } finally {
        await closePitchContext?.();
        if (closePitchDecodeRef.current === closePitchContext) closePitchDecodeRef.current = null;
        if (generation === recordingGenerationRef.current) setIsDetectingPitch(false);
      }
    })();
  }, []);

  const hasAnyProcessedAudio = useMemo(() => Object.values(processedBlobs).some(Boolean), [processedBlobs]);

  /**
   * @zh 处理音频变调
   * 根据选择的算法使用不同的处理方法：
   * - TD-PSOLA: 我们自己实现的时域音高同步重叠相加算法
   * - RubberBand: 成熟的 RubberBand Library WASM 版本
   * - WORLD: WORLD Vocoder 算法，高质量语音分析合成
   */
  /** 按统一参考比例处理录音；完成前冻结参数，取消后丢弃旧结果。 */
  const processAudio = async () => {
    if (!recordedBlob || isProcessing || isDetectingPitch) return;
    const operation = ++operationRef.current;
    const abort = new AbortController();
    abortProcessingRef.current = abort;
    const algorithm = selectedAlgorithm;
    setIsProcessing(true); setProcessingError(null); setProcessingProgress(0);
    let closeContext = async () => {};
    try {
      const temporary = createTemporaryAudioContext();
      const audioContext = temporary.context;
      let closing;
      closeContext = () => closing ??= temporary.close().catch(() => undefined);
      closeDecodeRef.current = closeContext;
      getEffectAlgorithm(algorithm);
      const parameters = getPitchParameters(referenceF0, pitchShift);
      const sourceBuffer = await audioContext.decodeAudioData(await recordedBlob.arrayBuffer());
      if (operation !== operationRef.current) return;
      let processedBuffer;
      switch (algorithm) {
        case 'soundtouch':
        case 'rubberband': {
          const channels = await processRecordedEffect(sourceBuffer, algorithm, parameters, {
            signal: abort.signal,
            onProgress: progress => { if (operation === operationRef.current) setProcessingProgress(progress); },
          });
          if (operation !== operationRef.current) return;
          processedBuffer = audioContext.createBuffer(channels.length, channels[0].length, sourceBuffer.sampleRate);
          channels.forEach((channel, ch) => processedBuffer.copyToChannel(channel, ch));
          break;
        }
        case 'world': processedBuffer = await processAudioWithWorld(sourceBuffer, parameters.ratio); break;
        case 'td-psola': processedBuffer = await processAudioWithTDPSOLA(sourceBuffer, parameters.ratio, referenceF0); break;
        default: throw new Error('未知的处理算法');
      }
      if (operation !== operationRef.current) return;
      const wavBlob = await audioBufferToWav(processedBuffer);
      if (operation !== operationRef.current) return;
      setProcessedBlobs(previous => ({ ...previous, [algorithm]: wavBlob }));
    } catch (error) {
      if (operation === operationRef.current && error.name !== 'AbortError') setProcessingError(`音频处理失败：${error.message}`);
    } finally {
      await closeContext();
      if (closeDecodeRef.current === closeContext) closeDecodeRef.current = null;
      if (operation === operationRef.current) { setIsProcessing(false); setProcessingProgress(0); }
    }
  };

  /**
   * @zh TD-PSOLA 算法核心实现（改进版）
   * @param {AudioBuffer} sourceBuffer - 原始音频缓冲区
   * @param {number} pitchRatio - 音高比例（目标频率/原始频率）
   * @param {number} estimatedF0 - 估计的基频（Hz）
   * @returns {Promise<AudioBuffer>} 处理后的音频缓冲区
   */
  const processAudioWithTDPSOLA = async (sourceBuffer, pitchRatio, estimatedF0) => {
    const sampleRate = sourceBuffer.sampleRate;
    const channelData = sourceBuffer.getChannelData(0);



    // 步骤1: 检测基频标记点（返回包含浊音信息的标记点）
    const pitchMarks = detectPitchMarks(channelData, sampleRate, estimatedF0);

    if (pitchMarks.length < 2) {
      throw new Error('基频标记点太少（< 2），无法进行 PSOLA 处理。可能是信号太短或太弱。');
    }

    // 步骤2: 提取分析帧（保留原始信号）
    const analysisFrames = extractAnalysisFrames(channelData, pitchMarks, sampleRate);


    // 步骤3: 计算合成位置（智能处理浊音/无浊音）
    const synthesisPositions = calculateSynthesisPositions(pitchMarks, pitchRatio);


    // 步骤4: 重叠相加合成（在合成时应用窗函数）
    const synthesizedData = overlapAddSynthesis(
      analysisFrames,
      synthesisPositions,
      channelData.length,
      channelData
    );


    // 使用临时 AudioContext 创建 AudioBuffer
    const { context: audioContext, close: closeContext } = createTemporaryAudioContext();

    try {
      const outputBuffer = audioContext.createBuffer(
        sourceBuffer.numberOfChannels,
        synthesizedData.length,
        sampleRate
      );

      // 复制处理后的数据到输出缓冲区
      outputBuffer.getChannelData(0).set(synthesizedData);

      // 如果是立体声，复制到其他声道
      for (let i = 1; i < sourceBuffer.numberOfChannels; i++) {
        outputBuffer.getChannelData(i).set(synthesizedData);
      }

      return outputBuffer;
    } finally {
      // 确保关闭 AudioContext
      await closeContext();
    }
  };

  /**
   * @zh 检测基频标记点（高质量版本）
   *
   * 改进策略：
   * 1. 使用更小的hopSize提高标记点密度和准确性
   * 2. 严格的标记点间距控制，确保连续性
   * 3. 更准确的浊音检测
   *
   * @param {Float32Array} buffer - 音频数据
   * @param {number} sampleRate - 采样率
   * @param {number} estimatedF0 - 估计的基频
   * @returns {Array} 标记点信息数组
   */
  const detectPitchMarks = (buffer, sampleRate, estimatedF0) => {
    const marks = [];
    const estimatedPeriod = Math.round(sampleRate / estimatedF0);
    const windowSize = Math.min(estimatedPeriod * 3, 1536);
    const hopSize = Math.round(estimatedPeriod / 6); // 更密集的分析

    const energyThreshold = 0.0005; // 降低阈值，捕获更多信号
    const voicingThreshold = 0.35; // 稍微降低浊音阈值

    let position = 0;
    let expectedNextMark = 0; // 预期的下一个标记点位置

    while (position < buffer.length - windowSize) {
      const windowStart = position;
      const windowEnd = Math.min(position + windowSize, buffer.length);
      const window = buffer.slice(windowStart, windowEnd);

      // 计算能量
      let energy = 0;
      for (let i = 0; i < window.length; i++) {
        energy += window[i] * window[i];
      }
      energy = energy / window.length;

      // 检测周期
      const periodInfo = findLocalPeriodWithConfidence(window, sampleRate, estimatedF0);

      // 判断是否应该添加标记点
      const shouldAddMark = marks.length === 0 || position >= expectedNextMark - estimatedPeriod * 0.3;

      if (!shouldAddMark) {
        position += hopSize;
        continue;
      }

      if (energy < energyThreshold) {
        // 低能量：添加无浊音标记
        if (marks.length === 0 || position >= expectedNextMark - estimatedPeriod * 0.2) {
          marks.push({
            position: windowStart + Math.floor(window.length / 2),
            period: estimatedPeriod,
            isVoiced: false,
            energy: energy,
            confidence: 0
          });
          expectedNextMark = marks[marks.length - 1].position + estimatedPeriod;
        }
        position += Math.round(estimatedPeriod * 0.7);
        continue;
      }

      if (periodInfo && periodInfo.confidence > voicingThreshold) {
        // 浊音：精确定位标记点
        const preciseMark = findPrecisePitchMark(buffer, windowStart + Math.floor(window.length / 3), periodInfo.period);
        const resolvedMark = resolvePitchMarkPosition({
          candidate: preciseMark,
          previous: marks.length > 0 ? marks[marks.length - 1].position : null,
          expected: expectedNextMark,
          period: periodInfo.period,
          bufferLength: buffer.length,
        });

        if (resolvedMark === null) break;

        marks.push({
          position: resolvedMark,
          period: periodInfo.period,
          isVoiced: true,
          energy: energy,
          confidence: periodInfo.confidence
        });

        expectedNextMark = resolvedMark + periodInfo.period;
        position = Math.floor(resolvedMark + periodInfo.period * 0.6);
      } else {
        // 不确定或无浊音
        if (marks.length === 0 || position >= expectedNextMark - estimatedPeriod * 0.2) {
          const markPos = windowStart + Math.floor(window.length / 2);
          marks.push({
            position: markPos,
            period: estimatedPeriod,
            isVoiced: false,
            energy: energy,
            confidence: periodInfo ? periodInfo.confidence : 0
          });
          expectedNextMark = markPos + estimatedPeriod;
        }
        position += Math.round(estimatedPeriod * 0.7);
      }
    }

    // 后处理：平滑周期变化
    for (let i = 1; i < marks.length - 1; i++) {
      if (marks[i].isVoiced && marks[i - 1].isVoiced && marks[i + 1].isVoiced) {
        const prevPeriod = marks[i].position - marks[i - 1].position;
        const nextPeriod = marks[i + 1].position - marks[i].position;
        const avgPeriod = (prevPeriod + nextPeriod) / 2;

        // 如果当前周期与平均值差异很大，进行平滑
        if (Math.abs(marks[i].period - avgPeriod) > avgPeriod * 0.3) {
          marks[i].period = avgPeriod;
        }
      }
    }

    return marks;
  };

  /**
   * @zh 在窗口内寻找局部周期（带置信度）
   * @param {Float32Array} window - 分析窗口
   * @param {number} sampleRate - 采样率
   * @param {number} estimatedF0 - 估计的基频
   * @returns {{period: number, confidence: number}|null} 周期和置信度，找不到返回null
   */
  const findLocalPeriodWithConfidence = (window, sampleRate, estimatedF0) => {
    const minLag = Math.floor(sampleRate / (estimatedF0 * 1.5));
    const maxLag = Math.floor(sampleRate / (estimatedF0 * 0.5));

    if (minLag >= window.length / 2) return null;

    let maxCorrelation = -Infinity;
    let maxScore = -Infinity;
    let bestLag = 0;
    const estimatedPeriod = sampleRate / estimatedF0;

    // 计算归一化自相关（使用能量归一化）
    for (let lag = minLag; lag <= maxLag && lag < window.length / 2; lag++) {
      let correlation = 0;
      let energy1 = 0;
      let energy2 = 0;

      const effectiveLength = window.length - lag;

      for (let i = 0; i < effectiveLength; i++) {
        correlation += window[i] * window[i + lag];
        energy1 += window[i] * window[i];
        energy2 += window[i + lag] * window[i + lag];
      }

      if (energy1 > 0 && energy2 > 0) {
        // 归一化
        const normalizedCorrelation = correlation / Math.sqrt(energy1 * energy2);

        const score = scorePitchPeriodCandidate(normalizedCorrelation, lag, estimatedPeriod);
        if (score > maxScore) {
          maxScore = score;
          maxCorrelation = normalizedCorrelation;
          bestLag = lag;
        }
      }
    }

    // 如果相关性太低，返回null
    if (maxCorrelation < 0.3) {
      return null;
    }

    // 使用抛物线插值提高精度
    const lagIndex = bestLag - minLag;
    if (lagIndex > 0 && bestLag < maxLag) {
      // 重新计算相邻lag的相关性
      const correlations = [];
      for (let offset = -1; offset <= 1; offset++) {
        const lag = bestLag + offset;
        if (lag >= minLag && lag <= maxLag && lag < window.length / 2) {
          let corr = 0;
          let e1 = 0;
          let e2 = 0;
          const len = window.length - lag;
          for (let i = 0; i < len; i++) {
            corr += window[i] * window[i + lag];
            e1 += window[i] * window[i];
            e2 += window[i + lag] * window[i + lag];
          }
          correlations.push(e1 > 0 && e2 > 0 ? corr / Math.sqrt(e1 * e2) : 0);
        } else {
          correlations.push(0);
        }
      }

      // 抛物线插值
      if (correlations.length === 3 && correlations[1] > correlations[0] && correlations[1] > correlations[2]) {
        const [y0, y1, y2] = correlations;
        const delta = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2);
        if (!isNaN(delta) && Math.abs(delta) < 1) {
          bestLag += delta;
        }
      }
    }

    return {
      period: Math.round(bestLag),
      confidence: maxCorrelation
    };
  };

  /**
   * @zh 精确定位基频标记点
   *
   * 使用零相位过零点检测方法，寻找最接近周期起始的位置
   *
   * @param {Float32Array} buffer - 完整音频数据
   * @param {number} centerPos - 中心位置
   * @param {number} period - 周期长度
   * @returns {number} 标记点位置
   */
  const findPrecisePitchMark = (buffer, centerPos, period) => {
    const searchRange = Math.floor(period * 0.4);
    const start = Math.max(1, centerPos - searchRange);
    const end = Math.min(buffer.length - 1, centerPos + searchRange);

    // 方法1: 寻找最大正向过零点（从负到正）
    let bestZeroCrossing = -1;
    let maxSlope = 0;

    for (let i = start; i < end; i++) {
      if (buffer[i - 1] < 0 && buffer[i] >= 0) {
        const slope = buffer[i] - buffer[i - 1]; // 过零斜率
        if (slope > maxSlope) {
          maxSlope = slope;
          bestZeroCrossing = i;
        }
      }
    }

    // 如果找到了好的过零点，使用它
    if (bestZeroCrossing > 0 && maxSlope > 0.01) {
      return bestZeroCrossing;
    }

    // 方法2: 如果没有明显的过零点，寻找局部最大能量点
    let maxEnergy = 0;
    let energyPos = centerPos;
    const energyWindowSize = Math.max(3, Math.floor(period * 0.1));

    for (let i = start; i < end - energyWindowSize; i++) {
      let localEnergy = 0;
      for (let j = 0; j < energyWindowSize; j++) {
        localEnergy += buffer[i + j] * buffer[i + j];
      }
      if (localEnergy > maxEnergy) {
        maxEnergy = localEnergy;
        energyPos = i;
      }
    }

    return energyPos;
  };

  /**
   * @zh 提取分析帧（高质量版本）
   *
   * 关键策略：
   * 1. 使用相邻标记点间距确定帧长度（更准确）
   * 2. 帧长度为 2.5 个局部周期（确保足够重叠）
   * 3. 直接复制原始信号（不加窗）
   *
   * @param {Float32Array} buffer - 音频数据
   * @param {Array} pitchMarks - 基频标记点信息数组
   * @param {number} sampleRate - 采样率
   * @returns {Array} 分析帧数组
   */
  const extractAnalysisFrames = (buffer, pitchMarks, sampleRate) => {
    const frames = [];

    for (let i = 0; i < pitchMarks.length; i++) {
      const markInfo = pitchMarks[i];
      const mark = markInfo.position;
      const isVoiced = markInfo.isVoiced;

      // 计算局部平均周期
      let localPeriod;
      if (i > 0 && i < pitchMarks.length - 1) {
        // 使用前后标记点的平均间距
        const prevInterval = mark - pitchMarks[i - 1].position;
        const nextInterval = pitchMarks[i + 1].position - mark;
        localPeriod = (prevInterval + nextInterval) / 2;
      } else if (i > 0) {
        localPeriod = mark - pitchMarks[i - 1].position;
      } else if (i < pitchMarks.length - 1) {
        localPeriod = pitchMarks[i + 1].position - mark;
      } else {
        localPeriod = markInfo.period;
      }

      // 确保周期在合理范围内
      localPeriod = Math.max(
        sampleRate / 500, // 最小周期（500Hz）
        Math.min(sampleRate / 50, localPeriod) // 最大周期（50Hz）
      );

      // 帧长度策略
      let frameLength;
      if (isVoiced) {
        // 浊音：2.5 个周期（确保充分重叠）
        frameLength = Math.round(localPeriod * 2.5);
      } else {
        // 无浊音：使用相同的周期估计
        frameLength = Math.round(localPeriod * 2.0);
      }

      // 限制帧长度
      frameLength = Math.min(frameLength, Math.round(sampleRate * 0.05)); // 最大50ms
      frameLength = Math.max(frameLength, Math.round(sampleRate * 0.01)); // 最小10ms
      // 确保是偶数，方便后续处理
      if (frameLength % 2 !== 0) frameLength++;

      // 以标记点为中心提取帧
      const halfFrame = frameLength / 2;
      const start = Math.floor(mark - halfFrame);
      const end = Math.floor(mark + halfFrame);

      // 处理边界
      const clampedStart = Math.max(0, start);
      const clampedEnd = Math.min(buffer.length, end);
      const actualLength = clampedEnd - clampedStart;

      if (actualLength < frameLength * 0.5) {
        // 如果帧太短（接近边界），跳过
        continue;
      }

      // 复制数据
      const frameData = new Float32Array(actualLength);
      for (let j = 0; j < actualLength; j++) {
        frameData[j] = buffer[clampedStart + j];
      }

      frames.push({
        center: mark,
        data: frameData,
        originalStart: clampedStart,
        isVoiced: isVoiced,
        period: localPeriod,
        energy: markInfo.energy,
        confidence: markInfo.confidence || 0
      });
    }



    return frames;
  };

  /**
   * @zh 计算合成位置（改进版）
   *
   * 根据音高比例和浊音状态智能调整帧的位置。
   * 关键改进：
   * 1. 对浊音段应用音高变换
   * 2. 对无浊音段保持原始间距（不变调）
   * 3. 确保位置的平滑过渡
   *
   * @param {Array} pitchMarks - 原始基频标记点信息数组
   * @param {number} pitchRatio - 音高比例
   * @returns {number[]} 合成位置数组
   */
  const calculateSynthesisPositions = (pitchMarks, pitchRatio) => {
    const positions = [];

    if (pitchMarks.length === 0) return positions;

    // 第一个位置保持不变
    positions.push(pitchMarks[0].position);

    // 根据浊音状态和音高比例调整后续位置
    for (let i = 1; i < pitchMarks.length; i++) {
      const prevMark = pitchMarks[i - 1];
      const currMark = pitchMarks[i];

      const originalInterval = currMark.position - prevMark.position;

      let newInterval;
      if (currMark.isVoiced && prevMark.isVoiced) {
        // 两个都是浊音：应用音高变换
        newInterval = originalInterval / pitchRatio;
      } else {
        // 至少有一个是无浊音：保持原始间距
        newInterval = originalInterval;
      }

      const newPosition = positions[i - 1] + newInterval;
      positions.push(newPosition);
    }

    return positions;
  };

  /**
   * @zh 重叠相加合成（高质量版本）
   *
   * 使用 OLA (Overlap-Add) 方法合成音频，确保：
   * 1. 无能量损失
   * 2. 相位连续性
   * 3. 平滑的帧过渡
   *
   * @param {Array} analysisFrames - 分析帧数组
   * @param {number[]} synthesisPositions - 合成位置数组（可以是小数）
   * @param {number} outputLength - 建议的输出长度
   * @param {Float32Array} referenceSamples - 完整原始采样，用于统一尺度的响度匹配
   * @returns {Float32Array} 合成的音频数据
   */
  const overlapAddSynthesis = (analysisFrames, synthesisPositions, outputLength, referenceSamples) => {
    // 确定输出长度
    const lastSynthPos = synthesisPositions[synthesisPositions.length - 1];
    const lastFrameLength = analysisFrames[analysisFrames.length - 1].data.length;
    const calculatedLength = Math.ceil(lastSynthPos) + Math.floor(lastFrameLength / 2) + 2000;

    const finalLength = Math.max(outputLength, calculatedLength);

    const output = new Float32Array(finalLength);
    const windowSum = new Float32Array(finalLength);

    // 预计算汉宁窗（避免重复计算）
    const windowCache = new Map();

    for (let i = 0; i < analysisFrames.length; i++) {
      const frame = analysisFrames[i];
      const synthPos = synthesisPositions[i]; // 保持浮点精度
      const frameLength = frame.data.length;
      const halfFrame = frameLength / 2;

      // 获取或创建窗函数
      let window;
      const windowKey = `${frameLength}_${frame.isVoiced}`;
      if (windowCache.has(windowKey)) {
        window = windowCache.get(windowKey);
      } else {
        window = new Float32Array(frameLength);
        if (frame.isVoiced) {
          // 浊音：使用汉宁窗
          for (let j = 0; j < frameLength; j++) {
            window[j] = 0.5 * (1 - Math.cos(2 * Math.PI * j / frameLength));
          }
        } else {
          // 无浊音：使用三角窗（比矩形窗更平滑）
          for (let j = 0; j < frameLength; j++) {
            if (j < frameLength / 2) {
              window[j] = (2 * j) / frameLength;
            } else {
              window[j] = 2 - (2 * j) / frameLength;
            }
          }
        }
        windowCache.set(windowKey, window);
      }

      // 使用浮点位置进行线性插值添加
      // 这样可以避免整数舍入导致的相位不连续
      const startPos = synthPos - halfFrame;

      for (let j = 0; j < frameLength; j++) {
        const exactPos = startPos + j;
        const basePos = Math.floor(exactPos);
        const frac = exactPos - basePos;

        if (basePos >= 0 && basePos < finalLength - 1) {
          const windowedSample = frame.data[j] * window[j];

          // 线性插值到两个相邻采样点
          output[basePos] += windowedSample * (1 - frac);
          output[basePos + 1] += windowedSample * frac;

          windowSum[basePos] += window[j] * (1 - frac);
          windowSum[basePos + 1] += window[j] * frac;
        } else if (basePos >= 0 && basePos < finalLength) {
          output[basePos] += frame.data[j] * window[j];
          windowSum[basePos] += window[j];
        }
      }
    }

    // 归一化：保持能量
    // 关键：确保重叠区域的窗函数和接近1.0
    for (let i = 0; i < finalLength; i++) {
      if (windowSum[i] > 0.1) {
        output[i] /= windowSum[i];
      } else if (windowSum[i] > 0.001) {
        // 对于窗函数和很小的区域，应用渐变到0
        output[i] *= (windowSum[i] / 0.1);
      } else {
        output[i] = 0;
      }
    }

    // 输入与输出统一按每采样点均方能量比较，避免帧长度被误当成增益。
    matchTdPsolaEnergy(output, referenceSamples);

    // 应用平滑的淡入淡出
    const fadeLength = Math.min(1500, Math.floor(finalLength * 0.015));

    for (let i = 0; i < fadeLength; i++) {
      const fade = 0.5 * (1 - Math.cos(Math.PI * i / fadeLength)); // 余弦淡入
      output[i] *= fade;
    }

    for (let i = 0; i < fadeLength; i++) {
      const fadeOutPos = finalLength - 1 - i;
      if (fadeOutPos >= fadeLength) {
        const fade = 0.5 * (1 - Math.cos(Math.PI * i / fadeLength));
        output[fadeOutPos] *= fade;
      }
    }

    // 软限幅（使用 tanh）
    let peakValue = 0;
    for (let i = 0; i < finalLength; i++) {
      peakValue = Math.max(peakValue, Math.abs(output[i]));
    }

    if (peakValue > 1.0) {

      // 使用软限幅而不是硬截断
      const threshold = 0.9;
      for (let i = 0; i < finalLength; i++) {
        if (Math.abs(output[i]) > threshold) {
          const sign = output[i] >= 0 ? 1 : -1;
          const excess = Math.abs(output[i]) - threshold;
          output[i] = sign * (threshold + 0.1 * Math.tanh(excess * 5));
        }
      }
    }

    return output;
  };

  /**
   * @zh World.JS WORLD Vocoder 音高变换实现
   * 使用 WORLD 算法进行高质量的音高变换
   * @param {AudioBuffer} sourceBuffer - 原始音频缓冲区
   * @param {number} pitchRatio - 所有算法共用的固定参考变调比例
   * @param {number} estimatedF0 - 估计的基频（Hz）
   * @returns {Promise<AudioBuffer>} 处理后的音频缓冲区
   */
  const processAudioWithWorld = async (sourceBuffer, pitchRatio) => {
    // 确保 WorldJS Module 已加载
    if (!isWorldJSLoaded || typeof window.Module === 'undefined' || !window.Module.Dio_JS) {
      throw new Error('World.JS 模块未加载。请刷新页面或稍后重试。');
    }

    const Module = window.Module;

    const sampleRate = sourceBuffer.sampleRate;
    const channelData = sourceBuffer.getChannelData(0);


    try {
      // 步骤1: 转换为 Float64Array（World.JS 需要）
      const x = new Float64Array(channelData);
      const frame_period = 5.0; // 帧周期 (ms)

      // 步骤2: 使用 DIO 算法估计基频（F0）
      setProcessingProgress(0.2);

      const dioResult = Module.Dio_JS(x, sampleRate, frame_period);




      // 保持为 emscripten::val，不要转换为 Float64Array
      const f0 = dioResult.f0;
      const time_axis = dioResult.time_axis;

      // 获取长度（如果是 TypedArray）
      const f0_length = f0.length || f0.size();



      // 步骤3: 计算频谱包络（CheapTrick）
      setProcessingProgress(0.4);







      const cheapTrickResult = Module.CheapTrick_JS(x, f0, time_axis, sampleRate);



      // 注意：spectral 是 emscripten::val 对象，不要转换为 Float64Array
      // 保持原始的 val 对象以便传递给 Synthesis_JS
      const spectral = cheapTrickResult.spectral;
      const fft_size = cheapTrickResult.fft_size;




      // 步骤4: 计算非周期性指标（D4C）
      setProcessingProgress(0.6);








      const d4cResult = Module.D4C_JS(x, f0, time_axis, fft_size, sampleRate);



      // 同样保持 aperiodicity 为 emscripten::val 对象
      const aperiodicity = d4cResult.aperiodicity;




      // 步骤5: 修改 F0（音高变换）
      // 所有算法使用上层统一计算的固定参考比例。




      // 创建修改后的 F0 数组
      // 关键：需要先将 emscripten::val 转换为 JavaScript 数组，再修改
      let f0Array;
      if (f0 instanceof Float64Array) {
        f0Array = Array.from(f0);
      } else {
        // 如果是 emscripten::val，尝试转换
        {
          f0Array = [];
          for (let i = 0; i < f0_length; i++) {
            f0Array.push(f0.get ? f0.get(i) : f0[i]);
          }
        }
      }



      // 修改音高
      const modifiedF0Array = f0Array.map(f0Val => {
        if (f0Val > 0) {
          return f0Val * pitchRatio;
        }
        return 0;
      });

      // 转换回 Float64Array
      const modifiedF0 = new Float64Array(modifiedF0Array);



      // 步骤6: 合成音频（Synthesis）
      setProcessingProgress(0.8);










      // Synthesis_JS 的 frame_period 参数是 emscripten::val，直接传数值即可
      // Emscripten 会自动转换 JavaScript 数值为 emscripten::val
      const synthesisResult = Module.Synthesis_JS(
        modifiedF0,
        spectral,
        aperiodicity,
        fft_size,
        sampleRate,
        frame_period
      );




      // synthesisResult 可能直接就是 Float64Array，或者是 emscripten::val
      let y;
      if (synthesisResult instanceof Float64Array) {
        y = synthesisResult;
      } else if (synthesisResult.length !== undefined) {
        y = new Float64Array(synthesisResult);
      } else {
        // 可能是 emscripten::val，尝试转换

        const yLength = synthesisResult.size ? synthesisResult.size() : synthesisResult.length;
        y = new Float64Array(yLength);
        for (let i = 0; i < yLength; i++) {
          y[i] = synthesisResult.get ? synthesisResult.get(i) : synthesisResult[i];
        }
      }



      // 步骤7: 使用临时 AudioContext 创建 AudioBuffer
      const { context: audioContext, close: closeContext } = createTemporaryAudioContext();

      try {
        const outputBuffer = audioContext.createBuffer(
          1, // 单声道
          y.length,
          sampleRate
        );

        // 转换为 Float32Array
        const outputData = outputBuffer.getChannelData(0);
        for (let i = 0; i < y.length; i++) {
          outputData[i] = y[i];
        }

        setProcessingProgress(1.0);


        return outputBuffer;
      } finally {
        // 确保关闭 AudioContext
        await closeContext();
      }

    } catch (error) {

      throw new Error(`World.JS 处理失败: ${error.message}`);
    }
  };

  /**
   * @zh 将 AudioBuffer 转换为 WAV 格式的 Blob
   * @param {AudioBuffer} buffer - 要转换的音频缓冲区
   * @returns {Promise<Blob>} WAV格式的Blob
   */
  const audioBufferToWav = async (buffer) => {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample));
        data.push(intSample < 0 ? intSample * 0x8000 : intSample * 0x7FFF);
      }
    }

    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // 写入 WAV 文件头
    let offset = 0;
    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, bufferLength - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4; // fmt chunk size
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numberOfChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * blockAlign, true); offset += 4; // byte rate
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;
    writeString('data');
    view.setUint32(offset, dataLength, true); offset += 4;

    // 写入音频数据
    for (let i = 0; i < data.length; i++) {
      view.setInt16(offset, data[i], true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  /**
   * @zh 播放音频
   * @param {'original' | 'td-psola' | 'rubberband' | 'world'} type - 播放类型
   */
  /** 停止播放并撤销对应 Blob URL，避免重复试听积累资源。 */
  const stopPlayback = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const audio = audioElementRef.current;
    audioElementRef.current = null;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load?.(); }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setIsPlaying(false); setCurrentTime(0); setPlaybackType(null);
  }, []);

  /** 每次播放拥有独立元素，旧元素事件不能修改当前播放状态。 */
  const playAudio = useCallback((type) => {
    const blob = type === 'original' ? recordedBlob : processedBlobs[type];
    if (!blob) return;
    stopPlayback();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioElementRef.current = audio;
    setPlaybackType(type); setIsPlaying(true);
    audio.addEventListener('loadedmetadata', () => { if (audioElementRef.current === audio) setDuration(audio.duration); });
    audio.addEventListener('ended', () => { if (audioElementRef.current === audio) stopPlayback(); });
    const played = audio.play();
    played?.catch(() => {
      if (audioElementRef.current === audio) { stopPlayback(); setProcessingError('无法播放音频，请重新点击播放。'); }
    });
    const updateProgress = () => {
      if (audioElementRef.current !== audio) return;
      setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    updateProgress();
  }, [recordedBlob, processedBlobs, stopPlayback]);

  /** 卸载时中止 Worker、作废迟到结果，并释放本页音频资源。 */
  useEffect(() => () => {
    recordingGenerationRef.current++; operationRef.current++;
    abortProcessingRef.current?.abort();
    void closeDecodeRef.current?.();
    void closePitchDecodeRef.current?.();
    if (audioElementRef.current) audioElementRef.current.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  /** 修改变调量或参考基频后旧结果失效，同时停止旧参数的播放。 */
  const changePitch = value => {
    stopPlayback(); setPitchShift(value); setProcessedBlobs(emptyEffectResults());
  };

  /**
   * @zh 格式化时间显示
   * @param {number} seconds - 秒数
   * @returns {string} 格式化的时间字符串
   */
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * @zh 重新录音
   */
  const resetRecording = () => {
    recordingGenerationRef.current++;
    void closePitchDecodeRef.current?.();
    setReferenceF0(150); setIsDetectingPitch(false); setProcessingError(null);
    setRecordedBlob(null);
    setProcessedBlobs(emptyEffectResults());
    setDetectedF0(0);
    setProcessingProgress(0);
    stopPlayback();
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
      <div>
        {/* 标题区 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            VFS效果预览
          </h1>
          <p className="text-lg text-gray-600">
            体验声带手术后的音高变化效果
          </p>
        </div>

        {/* 原理说明与免责声明 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="space-y-4">
            <details className="group border-l-4 border-green-500 pl-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-1 focus-visible:outline-2 focus-visible:outline-purple-600 [&::-webkit-details-marker]:hidden">
                <h3 className="text-lg font-semibold text-gray-900">📌 提示</h3>
                <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="pt-3">
              <p className="text-gray-700">
                这个功能仍处于测试阶段，虽然我们尝试了几种不同的常用算法，但是效果仍然很难谈得上“完美”。
                特别是，我们无法直接预测您在VFS后的发声方式和共鸣特性的改变，我们也尚未就该功能的具体边界应该在哪里得出结论。（例如我们是否模拟共鸣特征的改变等）。
                也许我们未来有了很多用户的数据以后可以基于深度学习重做一个更加完善的预览，但现阶段，您只能使用这个功能直观感受一下VFS后的音高变化。
              </p></div>
            </details>

            <details className="group border-l-4 border-blue-500 pl-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-1 focus-visible:outline-2 focus-visible:outline-purple-600 [&::-webkit-details-marker]:hidden">
                <h3 className="text-lg font-semibold text-gray-900">💡 原理说明</h3>
                <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="pt-3">
              <p className="text-gray-700">
                VFS（嗓音女性化手术）主要改变声音的基础频率（音高），但不会直接地改变共鸣腔体、发声习惯等其他声学特征。
                本工具通过调整录音的音高来模拟VFS后的效果，让您预先感受不同程度的音高变化。
              </p></div>
            </details>

            <details className="group border-l-4 border-amber-500 pl-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-1 focus-visible:outline-2 focus-visible:outline-purple-600 [&::-webkit-details-marker]:hidden">
                <h3 className="text-lg font-semibold text-gray-900">⚠️ 免责声明</h3>
                <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="pt-3">
              <p className="text-gray-700">
                <strong>仅供参考：</strong>本工具使用经验公式进行模拟，实际VFS后的效果会因个体差异、手术方式、
                术后发声习惯的改变等因素而有所不同，这里的效果并不能等同于“一定会发生的真实效果。”。
              </p></div>
            </details>
          </div>
        </div>

        <div role="tablist" aria-label="试听模式" className="mb-6 grid grid-cols-2 rounded-xl bg-white p-1.5 shadow-sm">
          {[['recorded', '录音对比'], ['live', '实时试听']].map(([id, label]) => (
            <button key={id} id={`effect-tab-${id}`} type="button" role="tab" aria-selected={mode === id}
              aria-controls={`effect-panel-${id}`} tabIndex={mode === id ? 0 : -1} disabled={isProcessing || isRecordingTake}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 'recorded' : event.key === 'End' ? 'live' : mode === 'recorded' ? 'live' : 'recorded';
                stopPlayback(); setMode(next); document.getElementById(`effect-tab-${next}`)?.focus();
              }}
              onClick={() => { stopPlayback(); setMode(id); }}
              className={`rounded-lg px-4 py-3 font-medium transition-colors disabled:opacity-60 ${mode === id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-purple-50'}`}>{label}</button>
          ))}
        </div>

        {mode === 'live' && <div id="effect-panel-live" role="tabpanel" aria-labelledby="effect-tab-live" className="mb-6 rounded-xl bg-white p-5 shadow-lg sm:p-8">
          <LiveEffectPreview detectedF0={detectedF0} shiftHz={pitchShift} onShiftChange={changePitch} />
        </div>}

        {/* 主功能区 */}
        <div id="effect-panel-recorded" role="tabpanel" aria-labelledby="effect-tab-recorded" hidden={mode !== 'recorded'} className="bg-white rounded-xl shadow-lg p-5 sm:p-8 mb-6">
          {processingError && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{processingError}</div>}
          {/* 步骤1: 录音 */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold mr-3">
                1
              </span>
              录制您的声音
            </h2>

            {!recordedBlob ? (
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-600 mb-4">
                  请录制一段3-{PREVIEW_RECORDING_LIMIT_SECONDS}秒的声音。暂停时间不计入录音时长。建议使用平稳的发音，比如持续发"啊"音，或朗读一句话。
                </p>
                {mode === 'recorded' && <Recorder
                  onRecordingComplete={handleRecordingComplete}
                  maxDurationSec={PREVIEW_RECORDING_LIMIT_SECONDS}
                  onStartRecording={() => setIsRecordingTake(true)}
                  onDiscardRecording={() => setIsRecordingTake(false)}
                />}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-800 font-medium">录音完成</span>
                    {detectedF0 > 0 && (
                      <span className="ml-4 text-sm text-gray-600">
                        检测到的基频: <strong>{detectedF0} Hz</strong>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={resetRecording}
                    disabled={isProcessing}
                    className="px-4 py-2 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                  >
                    重新录制
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <button
                    onClick={() => playAudio('original')}
                    disabled={isPlaying && playbackType === 'original'}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isPlaying && playbackType === 'original' ? (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                        播放中...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        播放原始录音
                      </>
                    )}
                  </button>
                  {isPlaying && playbackType === 'original' && (
                    <>
                      <button
                        onClick={stopPlayback}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        停止
                      </button>
                      <span className="text-sm text-gray-600">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 步骤2: 选择变调程度 */}
          {recordedBlob && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold mr-3">
                  2
                </span>
                选择变调程度
              </h2>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="mb-4">
                  <label htmlFor="recorded-pitch-shift" className="block text-gray-700 font-medium mb-2">
                    音高变化量: <span className="text-purple-600 text-xl font-bold">+{pitchShift} Hz</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    id="recorded-pitch-shift"
                    disabled={isProcessing}
                    value={pitchShift}
                    onChange={event => changePitch(Number(event.target.value))}
                    className="w-full h-3 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>0 Hz (原调)</span>
                    <span>55 Hz (中等)</span>
                    <span>100 Hz (明显)</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                  <label className="block text-sm text-gray-700">参考基频（Hz）
                    <input aria-label="录音参考基频（Hz）" type="number" min="80" max="500" value={referenceF0}
                      disabled={isProcessing || isDetectingPitch} onChange={event => {
                        stopPlayback(); setReferenceF0(Number(event.target.value)); setProcessedBlobs(emptyEffectResults());
                      }} className="ml-3 w-28 rounded-lg border border-blue-200 bg-white p-2" />
                  </label>
                  <p className="text-sm text-gray-700">{isDetectingPitch ? '正在检测基频…' : detectedF0 > 0
                    ? `检测基频约 ${detectedF0} Hz，可手动修正参考值。`
                    : '未检测到可靠基频，当前参考值为 150 Hz，可手动修正。'}
                    {referenceF0 >= 80 && referenceF0 <= 500 && ` 所有算法按同一比例变调：${referenceF0} → 约 ${referenceF0 + pitchShift} Hz。`}
                  </p>
                </div>

                {/* 算法选择器 */}
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-3">
                    🎛️ 选择处理算法：
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {EFFECT_ALGORITHMS.map(algorithm => (
                      <button key={algorithm.id} type="button" onClick={() => setSelectedAlgorithm(algorithm.id)}
                        aria-pressed={selectedAlgorithm === algorithm.id}
                        disabled={isProcessing || (algorithm.id === 'world' && !isWorldJSLoaded)}
                        className={`rounded-lg border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedAlgorithm === algorithm.id ? 'border-purple-600 bg-purple-50 shadow-md' : 'border-gray-200 hover:border-purple-300'}`}>
                        <span className="font-semibold text-gray-900">{algorithm.name}</span>
                        {algorithm.live && <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">可实时试听</span>}
                        <p className="mt-1 text-sm text-gray-600">{algorithm.description}</p>
                        {algorithm.id === 'world' && !isWorldJSLoaded && <span className="text-xs text-orange-700">{worldLoadError ? '加载失败' : '加载中…'}</span>}
                        {processedBlobs[algorithm.id] && <span className="mt-2 inline-block text-xs text-green-700">✓ 已处理</span>}
                      </button>
                    ))}
                  </div>
                  {worldLoadError && (
                    <div role="alert" className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
                      WORLD 声码器加载失败。
                      <button type="button" onClick={retryWorldLoad} className="ml-2 font-semibold underline">重新加载</button>
                    </div>
                  )}
                </div>

                <button
                  onClick={processAudio}
                  disabled={isProcessing || isDetectingPitch || referenceF0 < 80 || referenceF0 > 500}
                  className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg flex flex-col items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>处理中...</span>
                      </div>
                      {processingProgress > 0 && (
                        <div className="w-full bg-purple-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-white h-full transition-all duration-300"
                            style={{ width: `${processingProgress * 100}%` }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>处理音频 ({
                        getEffectAlgorithm(selectedAlgorithm).name
                      })</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 步骤3: 播放处理后的音频 */}
          {hasAnyProcessedAudio && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold mr-3">
                  3
                </span>
                预览效果
              </h2>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-purple-900 font-medium">处理完成！您可以播放对比效果</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 原始录音 */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <h4 className="font-medium text-gray-900 mb-2">原始录音</h4>
                    <p className="text-sm text-gray-500 mb-3">
                      {detectedF0 > 0 && `约 ${detectedF0} Hz`}
                    </p>
                    <button
                      onClick={() => playAudio('original')}
                      disabled={isPlaying && playbackType === 'original'}
                      className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isPlaying && playbackType === 'original' ? (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          </svg>
                          播放中
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          播放
                        </>
                      )}
                    </button>
                  </div>

                  {EFFECT_ALGORITHMS.filter(algorithm => processedBlobs[algorithm.id]).map(algorithm => (
                    <div key={algorithm.id} className="rounded-lg border-2 border-purple-200 bg-white p-4 shadow">
                      <h4 className="mb-2 font-medium text-gray-900">{algorithm.name}</h4>
                      <p className="mb-3 text-sm text-gray-500">+{pitchShift} Hz · 参考 {referenceF0} → {referenceF0 + pitchShift} Hz</p>
                      <button type="button" aria-label={`播放 ${algorithm.name}`} onClick={() => playAudio(algorithm.id)}
                        disabled={isPlaying && playbackType === algorithm.id}
                        className="w-full rounded-lg bg-purple-600 px-4 py-3 text-white hover:bg-purple-700 disabled:bg-gray-400">
                        {isPlaying && playbackType === algorithm.id ? '播放中' : '播放'}
                      </button>
                    </div>
                  ))}
                </div>

                {isPlaying && (
                  <div className="mt-4">
                    <button
                      onClick={stopPlayback}
                      className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      停止播放
                    </button>
                    <div className="mt-2 text-center text-sm text-gray-600">
                      正在播放: {
                        playbackType === 'original' ? '原始录音' :
                        getEffectAlgorithm(playbackType).name
                      } - {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 对比提示 */}
                {Object.values(processedBlobs).filter(Boolean).length >= 2 && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      💡 <strong>对比建议：</strong>您已处理了多种算法的版本，可以分别播放，比较相同变调比例下的音质效果。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            💡 使用建议
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>建议在安静的环境中录音，以获得更清晰的效果预览</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>由于音频实现算法的复杂性，单纯通过时域简单改变频率很容易引入“花栗鼠效应”</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>不同算法对音色的影响不同；SoundTouch 不提供独立的共振峰保持功能</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>可以尝试不同的变调程度，感受不同的效果差异</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>本工具仅模拟音高变化，实际VFS效果受到共鸣、音色等多方面的改变的影响</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>虽然VFS并不是直接地改变共鸣和音色等因素，但是由于声带结构的变化，您有可能“不由自主地”发生一些相关的改变</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>如需了解更多关于VFS的信息，请咨询专业医生</span>
            </li>
          </ul>
        </div>

        <p className="mb-6 text-center text-xs text-gray-500">SoundTouch DSP · LGPL-2.1-or-later · <a href="/licenses/SoundTouch-LGPL-2.1.txt" className="underline">许可证</a> · <a href="/licenses/SoundTouch-source.zip" className="underline">对应源码</a></p>

        {/* 返回按钮 */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            返回首页
          </button>
        </div>
      </div>

      {/* 自定义滑块样式 */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          border: none;
          transition: transform 0.2s;
        }
        .slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};

export default VFSEffectPreview;
