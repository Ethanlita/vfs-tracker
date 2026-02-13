import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addEvent } from '../api';
import { PitchDetector } from 'pitchy';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ensureAppError, PermissionError, StorageError, ValidationError } from '../utils/apiError.js';
import { ApiErrorNotice } from './ApiErrorNotice.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

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

const OFFLINE_QUEUE_KEY = 'pendingEvents:v1';

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
  const [currentF0, setCurrentF0] = useState(0);
  const [f0History, setF0History] = useState([]);
  const [averageF0, setAverageF0] = useState(null);

  const audioContextRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);

  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error('[QuickF0Test] 关闭 AudioContext 失败:', e));
      audioContextRef.current = null;
    }
  }, []);

  const pitchLoop = useCallback((detector) => {
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

    animationFrameRef.current = requestAnimationFrame(() => pitchLoop(detector));
  }, []);

  const handleStart = useCallback(async () => {
    setStatus('recording');
    setError(null);
    setSuccessMessage('');
    setF0History([]);
    setAverageF0(null);
    setCurrentF0(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserNodeRef.current = analyser;
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      pitchLoop(detector);
    } catch (err) {
      console.error('无法获取麦克风权限或启动音频分析:', err);
      setError(new PermissionError('无法启动测试，请确认已授予麦克风权限。', { cause: err }));
      setStatus('idle');
      cleanupAudio();
    }
  }, [cleanupAudio, pitchLoop]);

  const handleStop = useCallback(() => {
    cleanupAudio();
    setStatus('finished');
    const validF0s = f0History.map(h => h.f0).filter(f0 => f0 > 0);
    if (validF0s.length > 0) {
      const sum = validF0s.reduce((a, b) => a + b, 0);
      setAverageF0(sum / validF0s.length);
    } else {
      setAverageF0(0);
    }
  }, [f0History, cleanupAudio]);

  const handleSave = async () => {
    if (averageF0 === null || !user?.userId) {
      setError(new ValidationError('无法保存，因为没有有效的测试结果或用户信息。'));
      return;
    }
    setIsSaving(true);
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
        await addEvent(eventData);
        setSuccessMessage('事件已成功保存！2秒后将返回“我的”页面。');
        setTimeout(() => navigate('/mypage'), 2000);
      } else {
        try {
          if (typeof localStorage === 'undefined') {
            throw new Error('当前环境不支持离线存储');
          }
          const existing = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
          existing.push({ when: Date.now(), eventData });
          localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(existing));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('pending-events-updated'));
          }
          setSuccessMessage('已离线保存，网络恢复后可在“我的页面”同步。2秒后将返回。');
          setTimeout(() => navigate('/mypage'), 2000);
        } catch (storageError) {
          setError(new StorageError('离线保存失败，请检查浏览器存储权限或稍后再试。', { cause: storageError }));
        }
      }
    } catch (err) {
      console.error("保存事件失败:", err);
      setError(ensureAppError(err, {
        message: '保存事件时发生未知错误。',
        requestMethod: 'POST',
        requestPath: '/events'
      }));
    } finally {
      setIsSaving(false);
    }
  };
  
  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  const chartHistory = f0History.slice(-200);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl">
      <div className="relative mb-8 text-center">
        <button
          onClick={() => navigate('/mypage')}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors duration-300"
        >
          &larr; 返回
        </button>
        <h1 className="text-4xl font-bold text-teal-600">快速基频测试</h1>
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

      {status === 'finished' && (
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
              onRetry={() => {
                if (status === 'finished' && !isSaving) {
                  handleSave();
                } else {
                  setError(null);
                }
              }}
              retryLabel={status === 'finished' ? '重试保存' : undefined}
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
          disabled={status !== 'finished' || isSaving}
          className="w-40 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '保存结果'}
        </button>
      </div>
    </div>
  );
};

export default QuickF0Test;