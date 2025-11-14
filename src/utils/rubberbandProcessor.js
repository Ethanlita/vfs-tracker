/**
 * RubberBand WASM 音高变换处理器
 * 使用 RubberBand Library 的 WebAssembly 版本进行高质量的音高变换
 * 
 * @module utils/rubberbandProcessor
 */

import { RubberBandInterface } from 'rubberband-wasm';

/**
 * RubberBand 处理器实例（单例模式）
 * @type {RubberBandInterface|null}
 */
let rbApi = null;

/**
 * 初始化状态标志
 * @type {boolean}
 */
let isInitialized = false;

/**
 * 初始化中的 Promise（防止重复初始化）
 * @type {Promise<void>|null}
 */
let initPromise = null;

/**
 * 初始化 RubberBand WASM 引擎
 * 采用单例模式，确保只初始化一次
 * 
 * @returns {Promise<RubberBandInterface>} RubberBand API 实例
 */
export async function initRubberBand() {
  // 如果已经初始化，直接返回
  if (isInitialized && rbApi) {
    return rbApi;
  }

  // 如果正在初始化，等待初始化完成
  if (initPromise) {
    await initPromise;
    return rbApi;
  }

  // 开始初始化
  console.log('[RubberBand] 开始初始化 WASM 引擎...');
  
  initPromise = (async () => {
    try {
      const startTime = performance.now();
      
      // 方法1: 尝试使用动态 import + ?url 获取 URL，然后 fetch
      try {
        console.log('[RubberBand] 尝试方法1: 使用 ?url 导入...');
        const wasmUrl = (await import('rubberband-wasm/dist/rubberband.wasm?url')).default;
        console.log('[RubberBand] WASM URL:', wasmUrl);
        
        const response = await fetch(wasmUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const wasmBytes = await response.arrayBuffer();
        console.log('[RubberBand] WASM 字节数:', wasmBytes.byteLength);
        
        const wasmModule = await WebAssembly.compile(wasmBytes);
        console.log('[RubberBand] WASM 模块编译成功');
        
        rbApi = await RubberBandInterface.initialize(wasmModule);
        console.log('[RubberBand] RubberBand API 初始化成功');
      } catch (method1Error) {
        console.warn('[RubberBand] 方法1 失败，尝试方法2:', method1Error.message);
        
        // 方法2: 尝试直接使用 ?init (可能返回已初始化的实例)
        const wasmModule = await import('rubberband-wasm/dist/rubberband.wasm?init');
        console.log('[RubberBand] ?init 导入结果:', wasmModule);
        console.log('[RubberBand] wasmModule.default 类型:', typeof wasmModule.default);
        console.log('[RubberBand] wasmModule.default:', wasmModule.default);
        
        // 检查 default 是什么类型
        if (wasmModule.default instanceof WebAssembly.Module) {
          rbApi = await RubberBandInterface.initialize(wasmModule.default);
        } else if (wasmModule.default instanceof WebAssembly.Instance) {
          throw new Error('导入返回了 Instance 而不是 Module，需要调整策略');
        } else {
          throw new Error(`未知的 WASM 类型: ${typeof wasmModule.default}`);
        }
      }
      
      isInitialized = true;
      const loadTime = (performance.now() - startTime).toFixed(2);
      console.log(`[RubberBand] ✅ WASM 引擎初始化成功，耗时: ${loadTime}ms`);
      
      return rbApi;
    } catch (error) {
      console.error('[RubberBand] ❌ WASM 引擎初始化失败:', error);
      console.error('[RubberBand] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      initPromise = null;
      throw new Error(`RubberBand 初始化失败: ${error.message}`);
    }
  })();

  await initPromise;
  return rbApi;
}

/**
 * 使用 RubberBand 算法进行音高变换
 * 
 * 工作流程:
 * 1. 初始化 RubberBand 引擎（如未初始化）
 * 2. 创建 RubberBand stretcher 实例
 * 3. 设置音高缩放比例
 * 4. 分阶段处理音频数据：
 *    - Study 阶段：分析音频特征
 *    - Process 阶段：执行音高变换
 * 5. 提取处理后的音频数据
 * 6. 返回新的 AudioBuffer
 * 
 * @param {AudioBuffer} audioBuffer - 输入的音频数据
 * @param {number} pitchShiftHz - 音高偏移量（Hz），正值升高，负值降低
 * @param {Function} [onProgress] - 可选的进度回调函数 (progress: 0-1)
 * @returns {Promise<AudioBuffer>} 处理后的音频数据
 * @throws {Error} 如果处理失败
 */
export async function processWithRubberBand(audioBuffer, pitchShiftHz, onProgress) {
  const startTime = performance.now();
  
  try {
    // 确保 RubberBand 已初始化
    const api = await initRubberBand();
    
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const inputLength = audioBuffer.length;
    
    console.log('[RubberBand] 开始处理音频:', {
      sampleRate,
      numChannels,
      inputLength,
      pitchShiftHz,
      duration: `${(inputLength / sampleRate).toFixed(2)}s`,
    });

    // 估算输入音频的平均基频（假设人声范围 80-300Hz）
    const estimatedF0 = 150; // Hz（人声中间值）
    
    // 计算音高比例：新频率 = 原频率 + pitchShiftHz
    // pitchScale = (f0 + shift) / f0
    const pitchScale = (estimatedF0 + pitchShiftHz) / estimatedF0;
    
    console.log('[RubberBand] 音高缩放比例:', {
      estimatedF0,
      pitchShiftHz,
      pitchScale: pitchScale.toFixed(4),
    });

    // 创建 RubberBand stretcher（使用实时模式，质量平衡）
    // 参数: sampleRate, channels, options, initialTimeRatio, initialPitchScale
    // options: 0 = RubberBandStretcher::OptionProcessRealTime
    const rbState = api.rubberband_new(sampleRate, numChannels, 0, 1.0, pitchScale);
    
    // 设置音高缩放（虽然在 new 时已设置，但再次确保）
    api.rubberband_set_pitch_scale(rbState, pitchScale);
    
    // 设置时间比例为 1.0（不改变时长）
    api.rubberband_set_time_ratio(rbState, 1.0);
    
    // 获取建议的处理块大小
    const samplesRequired = api.rubberband_get_samples_required(rbState);
    console.log('[RubberBand] 建议的处理块大小:', samplesRequired);

    // 准备输入/输出缓冲区
    const channelBuffers = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelBuffers.push(audioBuffer.getChannelData(ch));
    }

    // 估算输出长度（音高变换不改变时长）
    const outputLength = inputLength;
    const outputBuffers = [];
    for (let ch = 0; ch < numChannels; ch++) {
      outputBuffers.push(new Float32Array(outputLength));
    }

    // 分配 WASM 内存
    const channelArrayPtr = api.malloc(numChannels * 4); // 指针数组
    const channelDataPtrs = [];
    
    for (let ch = 0; ch < numChannels; ch++) {
      const bufferPtr = api.malloc(samplesRequired * 4); // Float32
      channelDataPtrs.push(bufferPtr);
      api.memWritePtr(channelArrayPtr + ch * 4, bufferPtr);
    }

    // 告知 RubberBand 输入音频的总长度
    api.rubberband_set_expected_input_duration(rbState, inputLength);

    // ============ Study 阶段 ============
    // 第一遍：分析音频特征
    console.log('[RubberBand] [1/3] Study 阶段开始...');
    let readPos = 0;
    let lastProgressReport = Date.now();
    
    while (readPos < inputLength) {
      // 报告进度（最多每 250ms 报告一次）
      if (onProgress && Date.now() - lastProgressReport > 250) {
        const progress = (readPos / inputLength) * 0.33; // Study 阶段占 33%
        onProgress(progress);
        lastProgressReport = Date.now();
      }

      const remaining = Math.min(samplesRequired, inputLength - readPos);
      const isFinal = (readPos + remaining >= inputLength);

      // 将数据写入 WASM 内存
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = channelBuffers[ch].subarray(readPos, readPos + remaining);
        api.memWrite(channelDataPtrs[ch], channelData);
      }

      // 调用 study 函数
      api.rubberband_study(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      
      readPos += remaining;
    }
    
    console.log('[RubberBand] Study 阶段完成');

    // ============ Process 阶段 ============
    // 第二遍：实际处理音频
    console.log('[RubberBand] [2/3] Process 阶段开始...');
    readPos = 0;
    let writePos = 0;
    lastProgressReport = Date.now();

    // 内部函数：从 RubberBand 提取处理后的数据
    const retrieveData = (final = false) => {
      while (true) {
        const available = api.rubberband_available(rbState);
        if (available < 1) break;
        
        // 在非最终阶段，等待累积足够的数据
        if (!final && available < samplesRequired) break;

        const toRetrieve = Math.min(samplesRequired, available);
        const retrieved = api.rubberband_retrieve(rbState, channelArrayPtr, toRetrieve);

        // 读取处理后的数据并写入输出缓冲区
        for (let ch = 0; ch < numChannels; ch++) {
          const processedData = api.memReadF32(channelDataPtrs[ch], retrieved);
          
          // 确保不会越界
          const copyLength = Math.min(retrieved, outputLength - writePos);
          if (copyLength > 0) {
            outputBuffers[ch].set(processedData.subarray(0, copyLength), writePos);
          }
        }

        writePos += retrieved;
      }
    };

    // 分块处理输入数据
    while (readPos < inputLength) {
      // 报告进度
      if (onProgress && Date.now() - lastProgressReport > 250) {
        const progress = 0.33 + (readPos / inputLength) * 0.60; // Process 阶段占 60%
        onProgress(progress);
        lastProgressReport = Date.now();
      }

      const remaining = Math.min(samplesRequired, inputLength - readPos);
      const isFinal = (readPos + remaining >= inputLength);

      // 写入数据到 WASM 内存
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = channelBuffers[ch].subarray(readPos, readPos + remaining);
        api.memWrite(channelDataPtrs[ch], channelData);
      }

      // 处理数据
      api.rubberband_process(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      
      // 提取处理后的数据
      retrieveData(false);
      
      readPos += remaining;
    }

    // 提取剩余的数据
    retrieveData(true);
    
    console.log('[RubberBand] Process 阶段完成, 输出长度:', writePos);

    // ============ 清理阶段 ============
    console.log('[RubberBand] [3/3] 清理资源...');
    
    // 释放 WASM 内存
    for (const ptr of channelDataPtrs) {
      api.free(ptr);
    }
    api.free(channelArrayPtr);
    api.rubberband_delete(rbState);

    // 创建新的 AudioBuffer
    const outputAudioBuffer = new AudioContext().createBuffer(
      numChannels,
      writePos, // 使用实际写入的长度
      sampleRate
    );

    // 复制数据到 AudioBuffer
    for (let ch = 0; ch < numChannels; ch++) {
      outputAudioBuffer.copyToChannel(outputBuffers[ch].subarray(0, writePos), ch);
    }

    const processingTime = (performance.now() - startTime).toFixed(2);
    console.log(`[RubberBand] ✅ 处理完成，耗时: ${processingTime}ms`);

    if (onProgress) {
      onProgress(1.0);
    }

    return outputAudioBuffer;

  } catch (error) {
    console.error('[RubberBand] ❌ 处理失败:', error);
    throw new Error(`RubberBand 处理失败: ${error.message}`);
  }
}

/**
 * 检查 RubberBand 是否已初始化
 * 
 * @returns {boolean} 是否已初始化
 */
export function isRubberBandReady() {
  return isInitialized && rbApi !== null;
}
