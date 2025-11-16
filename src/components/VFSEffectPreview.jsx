import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Recorder from './Recorder';
import { processWithRubberBand } from '../utils/rubberbandProcessor';
import { createTemporaryAudioContext } from '../utils/audioContextManager';

/**
 * @zh VFS效果预览组件
 * 
 * 基于VFS的原理，对用户语音进行变调处理，让用户通过录音-处理-播放来感受不同变调程度的效果。
 * 
 * 功能特点：
 * - 用户可以录制自己的声音
 * - 选择变调的程度（10-100Hz）
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
  const navigate = useNavigate();
  
  // 状态管理
  const [recordedBlob, setRecordedBlob] = useState(null); // 原始录音
  const [pitchShift, setPitchShift] = useState(50); // 变调量（Hz），默认50Hz
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('rubberband'); // 'td-psola' | 'rubberband' | 'world'
  const [isProcessing, setIsProcessing] = useState(false); // 处理中状态
  const [processingProgress, setProcessingProgress] = useState(0); // 处理进度 (0-1)
  const [isWorldJSLoaded, setIsWorldJSLoaded] = useState(false); // World.JS 加载状态
  
  // 多版本处理结果
  const [processedBlobs, setProcessedBlobs] = useState(() => ({
    'td-psola': null,
    'rubberband': null,
    'world': null,
    ...(initialProcessedBlobs || {})
  }));
  
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态
  const [playbackType, setPlaybackType] = useState(null); // 'original' | 'td-psola' | 'rubberband' | 'world'
  const [currentTime, setCurrentTime] = useState(0); // 播放进度
  const [duration, setDuration] = useState(0); // 音频总时长
  const [detectedF0, setDetectedF0] = useState(0); // 检测到的基频
  
  // 引用
  const audioElementRef = useRef(null);
  const animationFrameRef = useRef(null);

  /**
   * @zh 检查 World.JS 是否已加载
   */
  useEffect(() => {
    const checkWorldJS = () => {
      if (typeof window.Module !== 'undefined' && window.Module.Dio_JS) {
        setIsWorldJSLoaded(true);
        console.log('[World.JS] 模块加载成功');
      } else {
        console.warn('[World.JS] 模块未加载，WORLD 算法将不可用');
      }
    };

    // 立即检查
    checkWorldJS();

    // 如果未加载，等待一段时间后再检查（script 可能还在加载）
    const timer = setTimeout(checkWorldJS, 2000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * @zh 录音完成回调
   * @param {Blob} blob - 录制的音频Blob
   */
  const handleRecordingComplete = useCallback((blob) => {
    setRecordedBlob(blob);
    setProcessedBlobs({ 'td-psola': null, 'rubberband': null, 'world': null });
    setDetectedF0(0);
    setProcessingProgress(0);
    // 尝试检测基频
    detectPitch(blob);
  }, []);

  /**
   * @zh 检测音频的基频（F0）
   * 使用改进的自相关法（Autocorrelation Function）
   * @param {Blob} blob - 音频Blob
   */
  const detectPitch = async (blob) => {
    // 创建临时 AudioContext 用于解码
    const { context: audioContext, close: closeContext } = createTemporaryAudioContext();
    let detectionResult = null;
    let detectionFailureReason = null;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 获取音频数据
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // 使用更大的窗口以包含更多周期，提高低频检测精度
      const bufferSize = Math.min(8192, channelData.length);

      // 从音频中间部分取样，避免开始和结束的静音或瞬态
      const startOffset = Math.floor((channelData.length - bufferSize) / 2);
      const buffer = channelData.slice(startOffset, startOffset + bufferSize);

      // 计算信号能量，用于判断是否为有效语音
      let energy = 0;
      for (let i = 0; i < buffer.length; i++) {
        energy += buffer[i] * buffer[i];
      }
      energy = energy / buffer.length;

      // 能量阈值：如果信号太弱，认为是静音
      const energyThreshold = 0.001;
      if (energy < energyThreshold) {
        detectionFailureReason = 'low-energy';
      } else {
        // 中心削波：减少共振峰的影响
        const clippingLevel = Math.sqrt(energy) * 0.3;
        const clippedBuffer = buffer.map(sample => {
          if (Math.abs(sample) < clippingLevel) return 0;
          return sample > 0 ? sample - clippingLevel : sample + clippingLevel;
        });

        // 归一化自相关
        const minLag = Math.floor(sampleRate / 500); // 最高500Hz
        const maxLag = Math.floor(sampleRate / 80);  // 最低80Hz

        const correlations = [];

        // 计算lag=0的自相关（用于归一化）
        let r0 = 0;
        for (let i = 0; i < bufferSize; i++) {
          r0 += clippedBuffer[i] * clippedBuffer[i];
        }

        // 计算各个lag的归一化自相关
        for (let lag = minLag; lag <= maxLag; lag++) {
          let sum = 0;
          let rLag = 0;

          for (let i = 0; i < bufferSize - lag; i++) {
            sum += clippedBuffer[i] * clippedBuffer[i + lag];
          }

          // 计算lag位置的自相关能量
          for (let i = 0; i < bufferSize - lag; i++) {
            rLag += clippedBuffer[i + lag] * clippedBuffer[i + lag];
          }

          // 归一化：ACF(lag) / sqrt(ACF(0) * ACF_lag(0))
          const normalizedCorrelation = sum / Math.sqrt(r0 * rLag);

          correlations.push({
            lag,
            correlation: normalizedCorrelation
          });
        }

        // 寻找第一个显著峰值（而不是全局最大值）
        // 峰值必须：1) 大于阈值  2) 大于相邻点
        const threshold = 0.3; // 相关性阈值
        let maxPeak = { lag: 0, correlation: -1 };

        for (let i = 1; i < correlations.length - 1; i++) {
          const prev = correlations[i - 1].correlation;
          const curr = correlations[i].correlation;
          const next = correlations[i + 1].correlation;

          // 检查是否为局部峰值
          if (curr > prev && curr > next && curr > threshold) {
            // 找到第一个显著峰值后即返回
            if (curr > maxPeak.correlation) {
              maxPeak = correlations[i];
              // 找到第一个强峰值就可以了
              if (curr > 0.7) {
                break;
              }
            }
          }
        }

        if (maxPeak.correlation < threshold) {
          detectionFailureReason = 'no-peak';
        } else {
          // 抛物线插值以提高精度
          const lagIndex = correlations.findIndex(c => c.lag === maxPeak.lag);
          let refinedLag = maxPeak.lag;

          if (lagIndex > 0 && lagIndex < correlations.length - 1) {
            const y1 = correlations[lagIndex - 1].correlation;
            const y2 = correlations[lagIndex].correlation;
            const y3 = correlations[lagIndex + 1].correlation;

            // 抛物线插值公式
            const delta = 0.5 * (y1 - y3) / (y1 - 2 * y2 + y3);
            refinedLag = maxPeak.lag + delta;
          }

          detectionResult = sampleRate / refinedLag;
          console.log(`基频检测结果: ${detectionResult.toFixed(1)} Hz (相关性: ${maxPeak.correlation.toFixed(3)})`);

          if (!(detectionResult >= 80 && detectionResult <= 500)) {
            detectionFailureReason = 'out-of-range';
          } else {
            setDetectedF0(Math.round(detectionResult));
          }
        }
      }

      if (detectionFailureReason === 'low-energy') {
        console.log('信号能量太低，可能是静音');
      } else if (detectionFailureReason === 'no-peak') {
        console.log('未找到显著的周期性峰值，可能不是纯音或语音');
      } else if (detectionFailureReason === 'out-of-range' && detectionResult) {
        console.log(`检测到的基频 ${detectionResult.toFixed(1)} Hz 超出合理范围`);
      }
    } catch (error) {
      console.error('检测基频失败:', error);
    } finally {
      // 确保 AudioContext 被关闭，避免资源泄漏
      await closeContext();
    }

    return detectionResult;
  };

  const hasAnyProcessedAudio = useMemo(() => (
    ['td-psola', 'rubberband', 'world'].some(key => Boolean(processedBlobs[key]))
  ), [processedBlobs]);

  /**
   * @zh 处理音频变调
   * 根据选择的算法使用不同的处理方法：
   * - TD-PSOLA: 我们自己实现的时域音高同步重叠相加算法
   * - RubberBand: 成熟的 RubberBand Library WASM 版本
   * - WORLD: WORLD Vocoder 算法，高质量语音分析合成
   */
  const processAudio = async () => {
    if (!recordedBlob) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    // 创建临时 AudioContext 用于解码
    const { context: audioContext, close: closeContext } = createTemporaryAudioContext();
    
    try {
      // 读取原始音频
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const sourceBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 计算音高参数
      const estimatedOriginalF0 = detectedF0 || 150;
      const targetF0 = estimatedOriginalF0 + pitchShift;
      
      console.log(`[${selectedAlgorithm.toUpperCase()}] 开始处理: ${estimatedOriginalF0} Hz → ${targetF0} Hz (+${pitchShift} Hz)`);

      let processedBuffer;
      
      if (selectedAlgorithm === 'rubberband') {
        // 使用 RubberBand 处理
        processedBuffer = await processWithRubberBand(
          sourceBuffer, 
          pitchShift, 
          (progress) => setProcessingProgress(progress)
        );
      } else if (selectedAlgorithm === 'world') {
        // 使用 World.JS WORLD Vocoder 处理
        processedBuffer = await processAudioWithWorld(
          sourceBuffer,
          pitchShift,
          estimatedOriginalF0
        );
      } else {
        // 使用 TD-PSOLA 处理
        const pitchRatio = targetF0 / estimatedOriginalF0;
        processedBuffer = await processAudioWithTDPSOLA(sourceBuffer, pitchRatio, estimatedOriginalF0);
        setProcessingProgress(1.0);
      }

      // 将处理后的音频转换为Blob
      const wavBlob = await audioBufferToWav(processedBuffer);
      
      // 保存到对应算法的结果中
      setProcessedBlobs(prev => ({
        ...prev,
        [selectedAlgorithm]: wavBlob
      }));
      
      console.log(`[${selectedAlgorithm.toUpperCase()}] 处理完成: 原始 ${sourceBuffer.duration.toFixed(2)}s → 输出 ${processedBuffer.duration.toFixed(2)}s`);
    } catch (error) {
      console.error(`[${selectedAlgorithm.toUpperCase()}] 处理失败:`, error);
      alert(`音频处理失败: ${error.message}`);
    } finally {
      // 确保 AudioContext 被关闭，避免资源泄漏
      await closeContext();
      setIsProcessing(false);
      setProcessingProgress(0);
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
    
    console.log(`[TD-PSOLA] 开始处理: 采样率=${sampleRate}Hz, 长度=${channelData.length}, F0=${estimatedF0}Hz, 比例=${pitchRatio.toFixed(3)}`);
    
    // 步骤1: 检测基频标记点（返回包含浊音信息的标记点）
    const pitchMarks = detectPitchMarks(channelData, sampleRate, estimatedF0);
    
    if (pitchMarks.length < 2) {
      throw new Error('基频标记点太少（< 2），无法进行 PSOLA 处理。可能是信号太短或太弱。');
    }
    
    const voicedCount = pitchMarks.filter(m => m.isVoiced).length;
    console.log(`[TD-PSOLA] 浊音标记: ${voicedCount}/${pitchMarks.length}`);
    
    // 步骤2: 提取分析帧（保留原始信号）
    const analysisFrames = extractAnalysisFrames(channelData, pitchMarks, sampleRate);
    console.log(`[TD-PSOLA] 提取了 ${analysisFrames.length} 个分析帧`);
    
    // 步骤3: 计算合成位置（智能处理浊音/无浊音）
    const synthesisPositions = calculateSynthesisPositions(pitchMarks, pitchRatio);
    console.log(`[TD-PSOLA] 计算了 ${synthesisPositions.length} 个合成位置`);
    
    // 步骤4: 重叠相加合成（在合成时应用窗函数）
    const synthesizedData = overlapAddSynthesis(
      analysisFrames,
      synthesisPositions,
      channelData.length,
      pitchMarks
    );
    console.log(`[TD-PSOLA] 合成完成，输出长度=${synthesizedData.length}`);
    
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
        
        // 检查标记点是否在预期范围内
        if (marks.length === 0 || 
            (preciseMark > marks[marks.length - 1].position + periodInfo.period * 0.4 &&
             preciseMark < marks[marks.length - 1].position + periodInfo.period * 2.0)) {
          
          marks.push({
            position: preciseMark,
            period: periodInfo.period,
            isVoiced: true,
            energy: energy,
            confidence: periodInfo.confidence
          });
          
          expectedNextMark = preciseMark + periodInfo.period;
          position = Math.floor(preciseMark + periodInfo.period * 0.6);
        } else {
          position += hopSize;
        }
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
    
    const voicedCount = marks.filter(m => m.isVoiced).length;
    console.log(`[TD-PSOLA] 检测: ${marks.length} 个标记点 (浊音: ${voicedCount}, 无浊音: ${marks.length - voicedCount})`);
    
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
    let bestLag = 0;
    
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
        
        if (normalizedCorrelation > maxCorrelation) {
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
    
    console.log(`[TD-PSOLA] 提取了 ${frames.length} 个有效帧（跳过了 ${pitchMarks.length - frames.length} 个边界帧）`);
    
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
   * @param {Array} originalMarks - 原始标记点信息
   * @returns {Float32Array} 合成的音频数据
   */
  const overlapAddSynthesis = (analysisFrames, synthesisPositions, outputLength, originalMarks) => {
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
    
    // 计算原始和输出的能量比，进行能量匹配
    let originalEnergy = 0;
    for (let i = 0; i < analysisFrames.length; i++) {
      const frameData = analysisFrames[i].data;
      for (let j = 0; j < frameData.length; j++) {
        originalEnergy += frameData[j] * frameData[j];
      }
    }
    originalEnergy /= analysisFrames.length;
    
    let outputEnergy = 0;
    let validSamples = 0;
    for (let i = 0; i < finalLength; i++) {
      if (windowSum[i] > 0.1) {
        outputEnergy += output[i] * output[i];
        validSamples++;
      }
    }
    outputEnergy /= Math.max(1, validSamples);
    
    // 应用能量匹配（如果输出能量明显低于输入）
    if (outputEnergy > 0 && originalEnergy / outputEnergy > 1.2) {
      const energyScale = Math.sqrt(originalEnergy / outputEnergy) * 0.9; // 保守的缩放
      for (let i = 0; i < finalLength; i++) {
        output[i] *= energyScale;
      }
      console.log(`[TD-PSOLA] 能量匹配，缩放因子: ${energyScale.toFixed(3)}`);
    }
    
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
      console.log(`[TD-PSOLA] 检测到削波风险，峰值: ${peakValue.toFixed(3)}`);
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
   * @param {number} pitchShiftHz - 音高变化量（Hz）
   * @param {number} estimatedF0 - 估计的基频（Hz）
   * @returns {Promise<AudioBuffer>} 处理后的音频缓冲区
   */
  const processAudioWithWorld = async (sourceBuffer, pitchShiftHz, estimatedF0) => {
    // 确保 WorldJS Module 已加载
    if (!isWorldJSLoaded || typeof window.Module === 'undefined' || !window.Module.Dio_JS) {
      throw new Error('World.JS 模块未加载。请刷新页面或稍后重试。');
    }
    
    const Module = window.Module;

    const sampleRate = sourceBuffer.sampleRate;
    const channelData = sourceBuffer.getChannelData(0);
    const length = channelData.length;

    console.log(`[WORLD] 开始处理: 采样率=${sampleRate}Hz, 长度=${length}, F0=${estimatedF0}Hz, 变换=${pitchShiftHz}Hz`);

    try {
      // 步骤1: 转换为 Float64Array（World.JS 需要）
      const x = new Float64Array(channelData);
      const frame_period = 5.0; // 帧周期 (ms)

      // 步骤2: 使用 DIO 算法估计基频（F0）
      setProcessingProgress(0.2);
      console.log('[WORLD] 步骤 1/4: 使用 DIO 算法估计基频...');
      const dioResult = Module.Dio_JS(x, sampleRate, frame_period);
      
      console.log('[WORLD] DIO 返回结果:', dioResult);
      console.log('[WORLD] dioResult.f0 类型:', dioResult.f0?.constructor?.name);
      
      // 保持为 emscripten::val，不要转换为 Float64Array
      const f0 = dioResult.f0;
      const time_axis = dioResult.time_axis;
      
      // 获取长度（如果是 TypedArray）
      const f0_length = f0.length || f0.size();
      
      console.log(`[WORLD] DIO 完成: 检测到 ${f0_length} 帧`);

      // 步骤3: 计算频谱包络（CheapTrick）
      setProcessingProgress(0.4);
      console.log('[WORLD] 步骤 2/4: 计算频谱包络 (CheapTrick)...');
      console.log('[WORLD] CheapTrick 输入参数:');
      console.log('  - x:', x?.constructor?.name, 'length:', x?.length);
      console.log('  - f0:', f0?.constructor?.name);
      console.log('  - time_axis:', time_axis?.constructor?.name);
      console.log('  - sampleRate:', sampleRate);
      
      const cheapTrickResult = Module.CheapTrick_JS(x, f0, time_axis, sampleRate);
      
      console.log('[WORLD] CheapTrick 返回结果:', cheapTrickResult);
      
      // 注意：spectral 是 emscripten::val 对象，不要转换为 Float64Array
      // 保持原始的 val 对象以便传递给 Synthesis_JS
      const spectral = cheapTrickResult.spectral;
      const fft_size = cheapTrickResult.fft_size;
      
      console.log(`[WORLD] CheapTrick 完成: FFT 大小 = ${fft_size}`);
      console.log('[WORLD] spectral 类型:', spectral?.constructor?.name);

      // 步骤4: 计算非周期性指标（D4C）
      setProcessingProgress(0.6);
      console.log('[WORLD] 步骤 3/4: 计算非周期性指标 (D4C)...');
      console.log('[WORLD] D4C 输入参数:');
      console.log('  - x:', x?.constructor?.name);
      console.log('  - f0:', f0?.constructor?.name);
      console.log('  - time_axis:', time_axis?.constructor?.name);
      console.log('  - fft_size:', fft_size);
      console.log('  - sampleRate:', sampleRate);
      
      const d4cResult = Module.D4C_JS(x, f0, time_axis, fft_size, sampleRate);
      
      console.log('[WORLD] D4C 返回结果:', d4cResult);
      
      // 同样保持 aperiodicity 为 emscripten::val 对象
      const aperiodicity = d4cResult.aperiodicity;
      
      console.log(`[WORLD] D4C 完成`);
      console.log('[WORLD] aperiodicity 类型:', aperiodicity?.constructor?.name);

      // 步骤5: 修改 F0（音高变换）
      const pitchRatio = (estimatedF0 + pitchShiftHz) / estimatedF0;
      
      console.log('[WORLD] 原始 f0 类型:', f0?.constructor?.name);
      console.log('[WORLD] 原始 f0 长度:', f0_length);
      
      // 创建修改后的 F0 数组
      // 关键：需要先将 emscripten::val 转换为 JavaScript 数组，再修改
      let f0Array;
      if (f0 instanceof Float64Array) {
        f0Array = Array.from(f0);
      } else {
        // 如果是 emscripten::val，尝试转换
        try {
          f0Array = [];
          for (let i = 0; i < f0_length; i++) {
            f0Array.push(f0.get ? f0.get(i) : f0[i]);
          }
        } catch (e) {
          console.error('[WORLD] 无法读取 f0 数组:', e);
          throw e;
        }
      }
      
      console.log('[WORLD] f0Array 样本 (前5个):', f0Array.slice(0, 5));
      
      // 修改音高
      const modifiedF0Array = f0Array.map(f0Val => {
        if (f0Val > 0) {
          return f0Val * pitchRatio;
        }
        return 0;
      });
      
      // 转换回 Float64Array
      const modifiedF0 = new Float64Array(modifiedF0Array);
      
      console.log(`[WORLD] F0 修改: 比例 = ${pitchRatio.toFixed(3)}, 修改后样本:`, modifiedF0.slice(0, 5));

      // 步骤6: 合成音频（Synthesis）
      setProcessingProgress(0.8);
      console.log('[WORLD] 步骤 4/4: 合成音频 (Synthesis)...');
      
      console.log('[WORLD] Synthesis 参数:');
      console.log('  - modifiedF0:', modifiedF0?.constructor?.name, 'length:', modifiedF0?.length);
      console.log('  - spectral:', spectral?.constructor?.name);
      console.log('  - aperiodicity:', aperiodicity?.constructor?.name);
      console.log('  - fft_size:', fft_size);
      console.log('  - sampleRate:', sampleRate);
      console.log('  - frame_period:', frame_period);
      
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
      
      console.log('[WORLD] Synthesis 返回结果:', synthesisResult);
      console.log('[WORLD] synthesisResult 类型:', synthesisResult?.constructor?.name);
      
      // synthesisResult 可能直接就是 Float64Array，或者是 emscripten::val
      let y;
      if (synthesisResult instanceof Float64Array) {
        y = synthesisResult;
      } else if (synthesisResult.length !== undefined) {
        y = new Float64Array(synthesisResult);
      } else {
        // 可能是 emscripten::val，尝试转换
        console.log('[WORLD] 尝试从 emscripten::val 提取数据...');
        const yLength = synthesisResult.size ? synthesisResult.size() : synthesisResult.length;
        y = new Float64Array(yLength);
        for (let i = 0; i < yLength; i++) {
          y[i] = synthesisResult.get ? synthesisResult.get(i) : synthesisResult[i];
        }
      }
      
      console.log(`[WORLD] 合成完成: 输出长度 = ${y.length}, 样本:`, y.slice(0, 5));

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
        console.log(`[WORLD] 处理完成: ${(y.length / sampleRate).toFixed(2)}s`);
        
        return outputBuffer;
      } finally {
        // 确保关闭 AudioContext
        await closeContext();
      }

    } catch (error) {
      console.error('[WORLD] 处理错误:', error);
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
  const playAudio = useCallback((type) => {
    let blob;
    if (type === 'original') {
      blob = recordedBlob;
    } else {
      blob = processedBlobs[type];
    }
    
    if (!blob) return;
    
    // 停止当前播放
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    
    // 创建新的音频元素
    const audio = new Audio(URL.createObjectURL(blob));
    audioElementRef.current = audio;
    setPlaybackType(type);
    setIsPlaying(true);
    
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });
    
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setPlaybackType(null);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    });
    
    audio.play();
    
    // 更新播放进度
    const updateProgress = () => {
      if (audioElementRef.current) {
        setCurrentTime(audioElementRef.current.currentTime);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    updateProgress();
  }, [recordedBlob, processedBlobs]);

  /**
   * @zh 停止播放
   */
  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackType(null);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  /**
   * @zh 清理音频资源
   */
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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
    setRecordedBlob(null);
    setProcessedBlobs({ 'td-psola': null, 'rubberband': null, 'world': null });
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
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  📌 提示
              </h3>
              <p className="text-gray-700">
                这个功能仍处于测试阶段，虽然我们尝试了几种不同的常用算法，但是效果仍然很难谈得上“完美”。
                特别是，我们无法直接预测您在VFS后的发声方式和共鸣特性的改变，我们也尚未就该功能的具体边界应该在哪里得出结论。（例如我们是否模拟共鸣特征的改变等）。
                也许我们未来有了很多用户的数据以后可以基于深度学习重做一个更加完善的预览，但现阶段，您只能使用这个功能直观感受一下VFS后的音高变化。
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                💡 原理说明
              </h3>
              <p className="text-gray-700">
                VFS（嗓音女性化手术）主要改变声音的基础频率（音高），但不会直接地改变共鸣腔体、发声习惯等其他声学特征。
                本工具通过调整录音的音高来模拟VFS后的效果，让您预先感受不同程度的音高变化。
              </p>
            </div>
            
            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ⚠️ 免责声明
              </h3>
              <p className="text-gray-700">
                <strong>仅供参考：</strong>本工具使用经验公式进行模拟，实际VFS后的效果会因个体差异、手术方式、
                术后发声习惯的改变等因素而有所不同，这里的效果并不能等同于“一定会发生的真实效果。”。
              </p>
            </div>
          </div>
        </div>

        {/* 主功能区 */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
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
                  请录制一段3-60秒的声音。建议使用平稳的发音，比如持续发"啊"音，或朗读一句话。
                </p>
                <Recorder
                  onRecordingComplete={handleRecordingComplete}
                  maxDurationSec={15}
                />
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
                  <label className="block text-gray-700 font-medium mb-2">
                    音高变化量: <span className="text-purple-600 text-xl font-bold">+{pitchShift} Hz</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={pitchShift}
                    onChange={(e) => {
                      setPitchShift(Number(e.target.value));
                      setProcessedBlobs({ 'td-psola': null, 'rubberband': null, 'world': null }); // 清除之前的处理结果
                    }}
                    className="w-full h-3 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-2">
                    <span>10 Hz (轻微)</span>
                    <span>55 Hz (中等)</span>
                    <span>100 Hz (明显)</span>
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700">
                    <strong>说明：</strong>
                    {detectedF0 > 0 ? (
                      <>
                        您的原始基频约为 <strong>{detectedF0} Hz</strong>，
                        增加 <strong>{pitchShift} Hz</strong> 后将变为约 <strong>{detectedF0 + pitchShift} Hz</strong>。
                      </>
                    ) : (
                      <>
                        音高将提高约 <strong>{pitchShift} Hz</strong>。
                        一般来说，10-30Hz为轻微变化，30-60Hz为中等变化，60Hz以上为明显变化。
                      </>
                    )}
                  </p>
                </div>

                {/* 算法选择器 */}
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-3">
                    🎛️ 选择处理算法：
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAlgorithm('rubberband')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedAlgorithm === 'rubberband'
                          ? 'border-purple-600 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">RubberBand</span>
                        {selectedAlgorithm === 'rubberband' && (
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">专业级库，音质优秀（推荐）</p>
                      {processedBlobs['rubberband'] && (
                        <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          ✓ 已处理
                        </span>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setSelectedAlgorithm('td-psola')}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedAlgorithm === 'td-psola'
                          ? 'border-purple-600 bg-purple-50 shadow-md'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">TD-PSOLA</span>
                        {selectedAlgorithm === 'td-psola' && (
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Naive算法，效果不太好</p>
                      {processedBlobs['td-psola'] && (
                        <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          ✓ 已处理
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAlgorithm('world')}
                      disabled={!isWorldJSLoaded}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        selectedAlgorithm === 'world'
                          ? 'border-purple-600 bg-purple-50 shadow-md'
                          : isWorldJSLoaded 
                            ? 'border-gray-200 hover:border-purple-300'
                            : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">WORLD Vocoder</span>
                        {selectedAlgorithm === 'world' && (
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        高保真声码器算法
                        {!isWorldJSLoaded && (
                          <span className="text-orange-600 block mt-1">（加载中...）</span>
                        )}
                      </p>
                      {processedBlobs['world'] && (
                        <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          ✓ 已处理
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={processAudio}
                  disabled={isProcessing}
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
                        selectedAlgorithm === 'rubberband' ? 'RubberBand' : 
                        selectedAlgorithm === 'world' ? 'WORLD' : 
                        'TD-PSOLA'
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
                  
                  {/* RubberBand 处理结果 */}
                  {processedBlobs['rubberband'] && (
                    <div className="bg-white rounded-lg p-4 shadow border-2 border-purple-300">
                      <h4 className="font-medium text-gray-900 mb-2">RubberBand</h4>
                      <p className="text-sm text-gray-500 mb-3">
                        +{pitchShift} Hz {detectedF0 > 0 && `(→ ${detectedF0 + pitchShift} Hz)`}
                      </p>
                      <button
                        onClick={() => playAudio('rubberband')}
                        disabled={isPlaying && playbackType === 'rubberband'}
                        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isPlaying && playbackType === 'rubberband' ? (
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
                  )}
                  
                  {/* TD-PSOLA 处理结果 */}
                  {processedBlobs['td-psola'] && (
                    <div className="bg-white rounded-lg p-4 shadow border-2 border-indigo-300">
                      <h4 className="font-medium text-gray-900 mb-2">TD-PSOLA</h4>
                      <p className="text-sm text-gray-500 mb-3">
                        +{pitchShift} Hz {detectedF0 > 0 && `(→ ${detectedF0 + pitchShift} Hz)`}
                      </p>
                      <button
                        onClick={() => playAudio('td-psola')}
                        disabled={isPlaying && playbackType === 'td-psola'}
                        className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isPlaying && playbackType === 'td-psola' ? (
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
                  )}

                  {/* WORLD Vocoder 处理结果 */}
                  {processedBlobs['world'] && (
                    <div className="bg-white rounded-lg p-4 shadow border-2 border-teal-300">
                      <h4 className="font-medium text-gray-900 mb-2">WORLD Vocoder</h4>
                      <p className="text-sm text-gray-500 mb-3">
                        +{pitchShift} Hz {detectedF0 > 0 && `(→ ${detectedF0 + pitchShift} Hz)`}
                      </p>
                      <button
                        onClick={() => playAudio('world')}
                        disabled={isPlaying && playbackType === 'world'}
                        className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {isPlaying && playbackType === 'world' ? (
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
                  )}
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
                        playbackType === 'rubberband' ? 'RubberBand' : 
                        playbackType === 'world' ? 'WORLD' : 
                        'TD-PSOLA'
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
                {processedBlobs['rubberband'] && processedBlobs['td-psola'] && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      💡 <strong>对比建议：</strong>您已处理了两种算法的版本，可以分别播放对比音质效果。
                      RubberBand 是专业级库，TD-PSOLA 是我们自研的轻量级实现。
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
              <span>我们实现了几种“保留共鸣特征”的算法，在听感上略有差异</span>
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
