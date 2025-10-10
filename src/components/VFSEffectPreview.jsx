import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Recorder from './Recorder';

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
const VFSEffectPreview = () => {
  const navigate = useNavigate();
  
  // 状态管理
  const [recordedBlob, setRecordedBlob] = useState(null); // 原始录音
  const [pitchShift, setPitchShift] = useState(50); // 变调量（Hz），默认50Hz
  const [isProcessing, setIsProcessing] = useState(false); // 处理中状态
  const [processedBlob, setProcessedBlob] = useState(null); // 处理后的音频
  const [isPlaying, setIsPlaying] = useState(false); // 播放状态
  const [playbackType, setPlaybackType] = useState(null); // 'original' | 'processed'
  const [currentTime, setCurrentTime] = useState(0); // 播放进度
  const [duration, setDuration] = useState(0); // 音频总时长
  const [detectedF0, setDetectedF0] = useState(0); // 检测到的基频
  
  // 引用
  const audioElementRef = useRef(null);
  const animationFrameRef = useRef(null);

  /**
   * @zh 录音完成回调
   * @param {Blob} blob - 录制的音频Blob
   */
  const handleRecordingComplete = useCallback((blob) => {
    setRecordedBlob(blob);
    setProcessedBlob(null);
    setDetectedF0(0);
    // 尝试检测基频
    detectPitch(blob);
  }, []);

  /**
   * @zh 检测音频的基频（F0）
   * 这是一个简化的实现，用于给用户提供参考
   * @param {Blob} blob - 音频Blob
   */
  const detectPitch = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 获取音频数据
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // 简单的自相关法估计基频
      const bufferSize = Math.min(4096, channelData.length);
      const buffer = channelData.slice(0, bufferSize);
      
      // 自相关
      const correlations = [];
      const minLag = Math.floor(sampleRate / 500); // 最高500Hz
      const maxLag = Math.floor(sampleRate / 80);  // 最低80Hz
      
      for (let lag = minLag; lag < maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < bufferSize - lag; i++) {
          sum += buffer[i] * buffer[i + lag];
        }
        correlations.push({ lag, correlation: sum });
      }
      
      // 找到最大相关性
      const maxCorr = correlations.reduce((max, curr) => 
        curr.correlation > max.correlation ? curr : max
      );
      
      const estimatedF0 = sampleRate / maxCorr.lag;
      
      // 只有在合理范围内才显示
      if (estimatedF0 >= 80 && estimatedF0 <= 500) {
        setDetectedF0(Math.round(estimatedF0));
      }
      
      audioContext.close();
    } catch (error) {
      console.error('检测基频失败:', error);
    }
  };

  /**
   * @zh 处理音频变调
   * 使用 Web Audio API 的离线处理功能来改变音高
   */
  const processAudio = async () => {
    if (!recordedBlob) return;
    
    setIsProcessing(true);
    
    try {
      // 读取原始音频
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 计算音高偏移比例
      // 假设用户的原始基频在 100-250Hz 范围内
      // pitchShift 是要增加的 Hz 数
      const estimatedOriginalF0 = detectedF0 || 150; // 如果未检测到，使用默认值
      const targetF0 = estimatedOriginalF0 + pitchShift;
      const pitchRatio = targetF0 / estimatedOriginalF0;
      
      // 创建离线音频上下文用于处理
      // 调整持续时间以补偿变调
      const newDuration = sourceBuffer.duration / pitchRatio;
      const offlineContext = new OfflineAudioContext(
        sourceBuffer.numberOfChannels,
        Math.ceil(newDuration * sourceBuffer.sampleRate),
        sourceBuffer.sampleRate
      );
      
      // 创建音频源
      const source = offlineContext.createBufferSource();
      source.buffer = sourceBuffer;
      source.playbackRate.value = pitchRatio; // 改变播放速率实现变调
      source.connect(offlineContext.destination);
      source.start(0);
      
      // 渲染处理后的音频
      const renderedBuffer = await offlineContext.startRendering();
      
      // 将处理后的音频转换为Blob
      const wavBlob = await audioBufferToWav(renderedBuffer);
      setProcessedBlob(wavBlob);
      
      audioContext.close();
    } catch (error) {
      console.error('音频处理失败:', error);
      alert('音频处理失败，请重试');
    } finally {
      setIsProcessing(false);
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
   * @param {'original' | 'processed'} type - 播放类型
   */
  const playAudio = useCallback((type) => {
    const blob = type === 'original' ? recordedBlob : processedBlob;
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
  }, [recordedBlob, processedBlob]);

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
    setProcessedBlob(null);
    setDetectedF0(0);
    stopPlayback();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
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
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                💡 原理说明
              </h3>
              <p className="text-gray-700">
                VFS（声带手术）主要改变声音的基础频率（音高），但不会改变共鸣腔体、发声习惯等其他声学特征。
                本工具通过调整录音的音高来模拟VFS后的效果，让您预先感受不同程度的音高变化。
              </p>
            </div>
            
            <div className="border-l-4 border-amber-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ⚠️ 免责声明
              </h3>
              <p className="text-gray-700">
                <strong>仅供参考：</strong>本工具使用经验公式进行模拟，实际VFS后的效果会因个体差异、手术方式、
                术后发声习惯的改变等因素而有所不同。请以专业医生的评估为准。
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
                  请录制一段3-10秒的声音。建议使用平稳的发音，比如持续发"啊"音，或朗读一句话。
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
                      setProcessedBlob(null); // 清除之前的处理结果
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

                <button
                  onClick={processAudio}
                  disabled={isProcessing}
                  className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      处理中...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      开始处理
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 步骤3: 播放处理后的音频 */}
          {processedBlob && (
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 shadow">
                    <h4 className="font-medium text-gray-900 mb-3">原始录音</h4>
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
                  
                  <div className="bg-white rounded-lg p-4 shadow border-2 border-purple-300">
                    <h4 className="font-medium text-gray-900 mb-3">
                      处理后 (+{pitchShift} Hz)
                    </h4>
                    <button
                      onClick={() => playAudio('processed')}
                      disabled={isPlaying && playbackType === 'processed'}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isPlaying && playbackType === 'processed' ? (
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
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>
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
              <span>可以尝试不同的变调程度，感受不同的效果差异</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-600 mr-2">•</span>
              <span>本工具仅模拟音高变化，实际VFS效果还会涉及共鸣、音色等多方面的改变</span>
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
