import React, { useState, useRef } from 'react';
import { PermissionError } from '../utils/apiError.js';

/**
 * @en A reusable audio recorder component that uses the MediaRecorder API.
 * It provides UI for starting, stopping, pausing, and resuming recording.
 * @zh 一个使用 MediaRecorder API 的可重用录音组件。
 * 它提供了开始、停止、暂停和恢复录音的用户界面。
 * @param {object} props - The component props.
 * @param {function(Blob): void} props.onRecordingComplete - Callback function that is executed when recording stops, returning the recorded audio as a Blob.
 * @param {function(): void} [props.onStartRecording] - Optional callback for when recording starts.
 * @param {function(): void} [props.onStopRecording] - Optional callback for when recording stops.
 * @param {function(): void} [props.onDiscardRecording] - Optional callback when user chooses to stop and discard the current take (不会上传/回调 Blob)。
 * @param {function(Error): void} [props.onError] - Optional callback for when an error occurs (e.g., permission denied).
 * @param {boolean} [props.isRecording] - Prop to externally control the recording state (e.g., disable the button).
 * @param {number} [props.maxDurationSec] - Optional maximum duration for recording in seconds. Default is 60 seconds.
 * @returns {JSX.Element} The rendered recorder component.
 */
const Recorder = ({ onRecordingComplete, onStartRecording, onStopRecording, onDiscardRecording, onError, isRecording: propIsRecording, maxDurationSec = 60 }) => {
  const [isRecording, setIsRecording] = useState(false); // 内部真实录音状态，仅由 start/stop 控制
  const [isPaused, setIsPaused] = useState(false);
  const [levelDb, setLevelDb] = useState(null);
  const [peakDb, setPeakDb] = useState(null); // 新增：峰值
  const [isClipping, setIsClipping] = useState(false); // 新增：过载指示
  const [elapsedSec, setElapsedSec] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const stopModeRef = useRef('continue'); // 'continue' | 'discard' 用于 onstop 行为分流

  const pickSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      '' // 让浏览器自己决定
    ];
    for (const mime of candidates) {
      try {
        if (!mime) return undefined; // 使用默认
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      } catch { /* ignore */ }
    }
    return undefined;
  };

  const encodeWav = async (blob) => {
    // 将任意音频 Blob 转换为 16-bit PCM 单声道 48kHz WAV
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const sampleRate = 48000; // 统一重采样到 48kHz
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
      const src = offline.createBufferSource();
      // 混合到单声道
      const monoBuffer = offline.createBuffer(1, decoded.length, decoded.sampleRate);
      const tmp = new Float32Array(decoded.length);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const channelData = decoded.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          tmp[i] += channelData[i] / decoded.numberOfChannels;
        }
      }
      monoBuffer.copyToChannel(tmp, 0);
      src.buffer = monoBuffer;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();
      const pcm = rendered.getChannelData(0);
      // 写 WAV 头
      const bytesPerSample = 2;
      const blockAlign = bytesPerSample;
      const buffer = new ArrayBuffer(44 + pcm.length * bytesPerSample);
      const view = new DataView(buffer);
      const writeString = (off, str) => { for (let i=0;i<str.length;i++) view.setUint8(off+i, str.charCodeAt(i)); };
      let offset = 0;
      writeString(offset, 'RIFF'); offset += 4;
      view.setUint32(offset, 36 + pcm.length * bytesPerSample, true); offset += 4;
      writeString(offset, 'WAVE'); offset += 4;
      writeString(offset, 'fmt '); offset += 4;
      view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
      view.setUint16(offset, 1, true); offset += 2;   // format PCM
      view.setUint16(offset, 1, true); offset += 2;   // channels
      view.setUint32(offset, sampleRate, true); offset += 4; // sample rate
      view.setUint32(offset, sampleRate * blockAlign, true); offset += 4; // byte rate
      view.setUint16(offset, blockAlign, true); offset += 2; // block align
      view.setUint16(offset, bytesPerSample * 8, true); offset += 2; // bits per sample
      writeString(offset, 'data'); offset += 4;
      view.setUint32(offset, pcm.length * bytesPerSample, true); /* 最后一次写入后不再递增 offset 以避免 ESLint 警告 */
      // PCM samples
      let idx = 0;
      for (let i = 0; i < pcm.length; i++, idx += 2) {
        let s = Math.max(-1, Math.min(1, pcm[i]));
        view.setInt16(44 + idx, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      return new Blob([buffer], { type: 'audio/wav' });
    } catch (e) {
      console.error('[Recorder] WAV 转码失败，回退原始 Blob:', e);
      return blob; // 回退原 blob
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // 建立实时电平分析
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      levelLoop();

      const mime = pickSupportedMimeType();
      const options = mime ? { mimeType: mime, audioBitsPerSecond: 192000 } : { audioBitsPerSecond: 192000 };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      console.log('[Recorder] 使用 mimeType =', mediaRecorderRef.current.mimeType);

      audioChunksRef.current = [];
      stopModeRef.current = 'continue'; // 每次开始录音时重置停止模式
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (stopModeRef.current === 'discard') {
            // 放弃本段：不做转码也不回调 blob，仅清理资源与通知可选回调
            audioChunksRef.current = [];
            onDiscardRecording && onDiscardRecording();
          } else {
            const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/webm' });
            let finalBlob = rawBlob;
            if (!/^audio\/wav$/i.test(rawBlob.type)) {
              finalBlob = await encodeWav(rawBlob);
            }
            onRecordingComplete(finalBlob);
            audioChunksRef.current = [];
          }
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          cleanupAudio();
        }
      };

      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      intervalRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setElapsedSec(elapsed);
        if (elapsed >= maxDurationSec) {
          console.log('[Recorder] 达到最大录音时长，自动停止');
          // 达到上限默认视为“继续”（保留本段）
          stopModeRef.current = 'continue';
          stopRecording();
        }
      }, 200);

      setIsRecording(true);
      setIsPaused(false);
      onStartRecording && onStartRecording();
      console.log('录音开始...');
    } catch (err) {
      console.error('无法获取麦克风权限或启动录音:', err);
      cleanupAudio(); // Ensure resources are released
      let error;
      if (err.name === 'NotAllowedError') {
        error = new PermissionError('您已拒绝麦克风权限，无法开始录音。请在浏览器设置中允许访问麦克风。', {
          permissionName: 'microphone',
          cause: err
        });
      } else {
        error = new PermissionError('无法访问麦克风。可能是设备未连接，或浏览器不支持此功能。', {
          permissionName: 'microphone',
          cause: err
        });
      }
      if (onError) {
        onError(error);
      } else {
        // Fallback for components that don't provide an onError handler
        alert(error.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      onStopRecording && onStopRecording();
      console.log('录音停止。');
      stopLevelLoop();
    }
  };

  // 停止并保留当前段（继续流程）
  const stopAndContinue = () => {
    stopModeRef.current = 'continue';
    stopRecording();
  };

  // 停止并放弃当前段（回到开始本段前状态）
  const stopAndDiscard = () => {
    if (!confirm('确定放弃当前这段录音吗？本段将不会被保存或上传。')) return;
    stopModeRef.current = 'discard';
    stopRecording();
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log('录音暂停。');
      stopLevelLoop();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      levelLoop();
      console.log('录音恢复。');
    }
  };

  const levelLoop = () => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    if (!buffer.length) {
      rafRef.current = requestAnimationFrame(levelLoop);
      return;
    }
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i] - 128) / 128; // -1..1
      sum += v * v;
      const av = Math.abs(v);
      if (av > peak) peak = av;
    }
    const rms = Math.sqrt(sum / buffer.length) + 1e-9;
    const db = 20 * Math.log10(rms);
    const peakDbVal = 20 * Math.log10(peak + 1e-9); // 避免 -Infinity
    setLevelDb(db.toFixed(1));
    setPeakDb(peakDbVal.toFixed(1));
    const clipping = peak >= 0.985; // 阈值
    setIsClipping(clipping);
    rafRef.current = requestAnimationFrame(levelLoop);
  };

  const stopLevelLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const cleanupAudio = () => {
    stopLevelLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(e => console.error('[Recorder] 关闭 AudioContext 失败:', e));
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setLevelDb(null);
    setPeakDb(null);
    setIsClipping(false);
    setElapsedSec(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const remaining = Math.max(0, maxDurationSec - elapsedSec);
  const progressPct = Math.min(100, (elapsedSec / maxDurationSec) * 100);

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      {/* 进度与倒计时 */}
      {isRecording || isPaused ? (
        <div className="w-full max-w-sm">
          <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>已录制 {elapsedSec.toFixed(1)}s</span>
            <span>剩余 {remaining.toFixed(1)}s</span>
          </div>
        </div>
      ) : null}

      {/* 实时电平 */}
      {(isRecording && levelDb !== null) && (
        <div className="w-full max-w-sm space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>平均电平</span>
              <span>{levelDb} dBFS</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (parseFloat(levelDb) + 60) / 60 * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>峰值</span>
              <span>{peakDb ?? '--'} dBFS</span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div className={`h-full ${isClipping ? 'bg-red-600' : 'bg-orange-400'} transition-all`} style={{ width: peakDb ? `${Math.min(100, (parseFloat(peakDb) + 60) / 60 * 100)}%` : '0%' }} />
            </div>
            {isClipping && <p className="mt-1 text-xs text-red-600">⚠️ 过载：请降低音量或远离麦克风</p>}
          </div>
        </div>
      )}

      {!isRecording && !isPaused && (
        <button
          onClick={startRecording}
          disabled={propIsRecording} // Disable if controlled externally
          className="px-6 py-3 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          开始录音
        </button>
      )}

      {isRecording && !isPaused && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={stopAndContinue}
            className="px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200"
          >
            停止录音且继续
          </button>
          <button
            onClick={pauseRecording}
            className="px-6 py-3 bg-yellow-500 text-white rounded-full shadow-lg hover:bg-yellow-600 transition-colors duration-200"
          >
            暂停
          </button>
          <button
            onClick={stopAndDiscard}
            className="px-6 py-3 bg-white text-red-600 border border-red-300 rounded-full shadow hover:bg-red-50 transition-colors duration-200"
          >
            停止录音且放弃
          </button>
        </div>
      )}

      {isPaused && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={resumeRecording}
            className="px-6 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors duration-200"
          >
            继续录音
          </button>
          <button
            onClick={stopAndContinue}
            className="px-6 py-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors duration-200"
          >
            停止录音且继续
          </button>
          <button
            onClick={stopAndDiscard}
            className="px-6 py-3 bg-white text-red-600 border border-red-300 rounded-full shadow hover:bg-red-50 transition-colors duration-200"
          >
            停止录音且放弃
          </button>
        </div>
      )}

      {isRecording && <p className="text-gray-600">正在录音...</p>}
      {isPaused && <p className="text-gray-600">录音已暂停。</p>}
    </div>
  );
};

export default Recorder;
