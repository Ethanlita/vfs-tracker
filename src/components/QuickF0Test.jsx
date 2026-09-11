import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addEvent } from '../api';
import { PitchDetector } from 'pitchy';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ensureAppError, PermissionError, StorageError, ValidationError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { enqueuePendingEvent } from '../utils/pendingEvents.js';
import { usePwaUpdateBlocker } from '../hooks/usePwaUpdateBlocker.js';

/**
 * @en Convert frequency in Hz to the nearest equal-tempered note name.
 * @zh 将频率（Hz）转换为最接近的十二平均律音名。
 *
 * Single-path formula:
 * midi = round(69 + 12 * log2(f / 440))
 *
 * @param {number} frequency - Frequency in Hz.
 * @returns {string} Note name (e.g. A4). Returns '--' for invalid input.
 */
export const frequencyToNoteName = (frequency) => {
  if (!frequency || frequency <= 0) return '--';

  const A4 = 440;
  // 使用 C 系索引，避免 A 系数组与 MIDI 偏移常量混用导致错位。
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(frequency / A4));
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  return `${noteNames[noteIndex]}${octave}`;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded-md text-sm">
        {`F0: ${payload[0].value.toFixed(1)} Hz`}
      </div>
    );
  }
  return null;
};

const QuickF0Test = () => {
  // 设置页面 meta 标签
  useDocumentMeta({
    title: '快速基频测试',
    description: '实时测量您的基频（F0），通过可视化图表了解您的嗓音稳定性和音高范围。'
  });

  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveStateRef = useRef('idle');
  const navigationTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const [currentF0, setCurrentF0] = useState(0);
  const [f0History, setF0History] = useState([]);
  const [averageF0, setAverageF0] = useState(null);

  // 测量、结果确认和保存阶段都依赖当前页面内存中的采样结果。
  usePwaUpdateBlocker(status !== 'idle' || averageF0 !== null || isSaving, '快速基频测试');

  const audioContextRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioGenerationRef = useRef(0);

  /** 使待授权请求失效，并释放当前测量持有的全部音频资源。 */
  const cleanupAudio = useCallback(() => {
    audioGenerationRef.current += 1;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    analyserNodeRef.current = null;
  }, []);

  const pitchLoop = useCallback((detector, generation) => {
    // 已取消的一轮不能读取或覆盖新一轮的分析器。
    if (generation !== audioGenerationRef.current || !mountedRef.current) return;
    const input = new Float32Array(detector.inputLength);
    analyserNodeRef.current.getFloatTimeDomainData(input);
    const [pitch, clarity] = detector.findPitch(input, audioContextRef.current.sampleRate);

    if (clarity > 0.95 && pitch > 50 && pitch < 1000) {
      const f0Value = parseFloat(pitch.toFixed(1));
      setCurrentF0(f0Value);
      setF0History(prev => [...prev, { f0: f0Value }]);
    } else {
      setCurrentF0(0);
    }

    animationFrameRef.current = requestAnimationFrame(() => pitchLoop(detector, generation));
  }, []);

  /** 启动独立测量；迟到的授权结果只能释放自身资源，不能接管新测量。 */
  const handleStart = useCallback(async () => {
    cleanupAudio();
    const generation = audioGenerationRef.current;
    // 新一轮测量有独立的保存状态，不受上轮成功后的延迟跳转影响。
    clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = null;
    saveStateRef.current = 'idle';
    setSaved(false);
    setStatus('recording');
    setError(null);
    setSuccessMessage('');
    setF0History([]);
    setAverageF0(null);
    setCurrentF0(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== audioGenerationRef.current || !mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserNodeRef.current = analyser;
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      pitchLoop(detector, generation);
    } catch (err) {
      if (generation !== audioGenerationRef.current || !mountedRef.current) return;

      setError(new PermissionError('无法启动测试，请确认已授予麦克风权限。', { cause: err }));
      setStatus('idle');
      cleanupAudio();
    }
  }, [cleanupAudio, pitchLoop]);

  const handleStop = useCallback(() => {
    cleanupAudio();
    setStatus('finished');
    const validF0s = f0History.map(h => h.f0).filter(f0 => Number.isFinite(f0) && f0 > 0);
    if (validF0s.length > 0) {
      const sum = validF0s.reduce((a, b) => a + b, 0);
      setAverageF0(sum / validF0s.length);
    } else {
      // 静音或低置信度不构成一次有效测量，不能伪造为0Hz事件。
      setAverageF0(null);
      setError(new ValidationError('未检测到有效基频，请在安静环境中持续发声后重新测试。'));
    }
  }, [f0History, cleanupAudio]);

  /**
   * 保存当前测量；同步引用阻止重复进入，失败允许重试，成功保持锁定直到重新测试。
   * @returns {Promise<void>} 完成一次在线保存或离线入队。
   */
  const handleSave = async () => {
    if (saveStateRef.current !== 'idle') return;
    if (!Number.isFinite(averageF0) || averageF0 <= 0 || !user?.userId) {
      setError(new ValidationError('无法保存，因为没有有效的测试结果或用户信息。'));
      return;
    }
    setIsSaving(true);
    saveStateRef.current = 'saving';
    setError(null);
    setSuccessMessage('');

    const eventData = {
      type: 'self_test',
      date: new Date().toISOString(),
      details: {
        appUsed: 'VFS Tracker Fast F0 Analysis Tool',
        fundamentalFrequency: averageF0,
        sound: ['其他'],
        customSoundDetail: '通过快速基频测试自动记录',
        voicing: ['其他'],
        customVoicingDetail: '通过快速基频测试自动记录',
        notes: `快速基频测试，平均F0: ${averageF0.toFixed(2)} Hz`,
      },
    };

    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (isOnline) {
        await addEvent(eventData, { expectedUserId: user.userId });
        if (!mountedRef.current) return;
        saveStateRef.current = 'saved';
        setSaved(true);
        setSuccessMessage('事件已成功保存！2秒后将返回“我的”页面。');
        navigationTimerRef.current = setTimeout(() => navigate('/mypage'), 2000);
      } else {
        try {
          if (typeof localStorage === 'undefined') {
            throw new Error('当前环境不支持离线存储');
          }
          // 追加和同步清理共用跨标签页锁，不能覆盖同期新增的记录。
          await enqueuePendingEvent(eventData, user.userId);
          if (!mountedRef.current) return;
          saveStateRef.current = 'saved';
          setSaved(true);
          // 离线时保留测量页，避免跳入依赖身份恢复的个人页面。
          setSuccessMessage('已离线保存到当前账号，联网并登录该账号后可在“我的页面”同步。');
        } catch (storageError) {
          setError(new StorageError('离线保存失败，请检查浏览器存储权限或稍后再试。', { cause: storageError }));
        }
      }
    } catch (err) {

      setError(ensureAppError(err, {
        message: '保存事件时发生未知错误。',
        requestMethod: 'POST',
        requestPath: '/events'
      }));
    } finally {
      if (saveStateRef.current === 'saving') saveStateRef.current = 'idle';
      if (mountedRef.current) setIsSaving(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(navigationTimerRef.current);
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const chartHistory = f0History.slice(-200);
  const hasValidResult = Number.isFinite(averageF0) && averageF0 > 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
      {/* 窄屏按正常文档流排列返回按钮和标题，避免绝对定位互相遮挡。 */}
      <div className="mb-8 flex flex-col gap-4 text-center sm:flex-row sm:items-center">
        <button
          onClick={() => navigate(user?.userId && navigator.onLine ? '/mypage' : '/')}
          className="self-start shrink-0 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors duration-300"
        >
          &larr; 返回
        </button>
        <h1 className="text-3xl sm:text-4xl font-bold text-teal-600 sm:flex-1">快速基频测试</h1>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8 flex flex-col items-center">
        <div className="w-full text-center mb-6">
          <p className="text-lg text-gray-600">当前基频</p>
          <p className="text-7xl font-bold text-teal-500 my-2">
            {status === 'recording' && currentF0 > 0 ? currentF0.toFixed(1) : '--'} <span className="text-3xl">Hz</span>
          </p>
          <p className="text-2xl text-gray-500 font-mono">
            {frequencyToNoteName(currentF0)}
          </p>
        </div>

        <div className="w-full h-48 rounded-lg flex items-center justify-center text-gray-500">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorF0" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.7}/>
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis hide={true} />
              <YAxis domain={[60, 350]} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="f0" stroke="#0D9488" strokeWidth={2} fill="url(#colorF0)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {status === 'finished' && hasValidResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-center">
          <h3 className="text-xl font-semibold text-blue-800">测试完成</h3>
          <p className="text-4xl font-bold text-blue-600 my-2">
            {averageF0 !== null ? averageF0.toFixed(2) : 'N/A'} <span className="text-2xl">Hz</span>
          </p>
          <p className="text-lg text-gray-700">平均基频</p>
        </div>
      )}

      {(successMessage || error) && (
        <div className="w-full mb-8">
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-center">
              {successMessage}
            </div>
          )}
          {error && (
            <ApiErrorNotice
              error={error}
              onRetry={status === 'finished' && hasValidResult && user?.userId && !isSaving ? handleSave : undefined}
              retryLabel={status === 'finished' && hasValidResult ? '重试保存' : undefined}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={handleStart}
          disabled={status === 'recording' || isSaving}
          className="w-40 bg-gradient-to-r from-green-500 to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'finished' ? '重新测试' : '开始测试'}
        </button>
        <button
          onClick={handleStop}
          disabled={status !== 'recording' || isSaving}
          className="w-40 bg-gradient-to-r from-red-500 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-red-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          停止测试
        </button>
        <button
          onClick={handleSave}
          disabled={status !== 'finished' || !hasValidResult || !user?.userId || isSaving || saved}
          className="w-40 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : saved ? '已保存' : '保存结果'}
        </button>
      </div>
      {!user?.userId && (
        <p className="mt-4 text-center text-sm text-gray-600" role="status">
          可直接进行本地测试。当前未登录，结果仅保留在本页；保存到账号需联网登录后重新测试。
        </p>
      )}
    </div>
  );
};

export default QuickF0Test;
