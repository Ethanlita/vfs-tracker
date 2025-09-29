import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addEvent } from '../api'; // 导入 addEvent API
import { PitchDetector } from 'pitchy'; // 导入 pitchy
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'; // 导入 recharts

// --- 辅助函数 ---

/**
 * @zh 将给定的频率（Hz）转换为最接近的音乐音名。
 * @param {number} frequency - 要转换的频率值。
 * @returns {string} 音乐音名，例如 "A4"。
 */
const frequencyToNoteName = (frequency) => {
  if (!frequency || frequency <= 0) return '--';
  const A4 = 440;
  const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
  const noteIndex = (halfStepsFromA4 + 57) % 12;
  const octave = Math.floor((halfStepsFromA4 + 57) / 12);
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

/**
 * @zh QuickF0Test 组件提供了一个用于快速测试基频(F0)的界面。
 * 用户可以录制自己的声音，查看实时的基频反馈，并选择将结果保存为一个新事件。
 */
const QuickF0Test = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- 状态管理 ---
  const [status, setStatus] = useState('idle'); // idle, recording, finished
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentF0, setCurrentF0] = useState(0);
  const [f0History, setF0History] = useState([]);
  const [averageF0, setAverageF0] = useState(null);

  // --- 音频处理相关引用 ---
  const audioContextRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const animationFrameRef = useRef(null);

  // --- 核心逻辑处理 ---

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
      setError('无法启动测试：请确认已授予麦克风权限。');
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

  /**
   * @zh 保存事件，确保数据结构与 EventForm 一致。
   */
  const handleSave = async () => {
    if (averageF0 === null || !user?.userId) {
      setError('无法保存，因为没有有效的测试结果或用户信息。');
      return;
    }
    setIsSaving(true);
    setError(null);

    // 构建与 EventForm 中 'self_test' 类型完全一致的事件对象
    const eventData = {
      type: 'self_test', // 1. 事件类型设置为 'self_test'
      date: new Date().toISOString(),
      details: {
        // 2. 按照 EventForm 的结构填充 details 对象
        appUsed: 'VFS Tracker Fast F0 Analysis Tool', // 要求的 App 名称
        fundamentalFrequency: averageF0,
        sound: ['其他'], // 满足必填项的默认值
        customSoundDetail: '通过快速基频测试自动记录', // 对'其他'的说明
        voicing: ['其他'], // 满足必填项的默认值
        customVoicingDetail: '通过快速基频测试自动记录', // 对'其他'的说明
        notes: `快速基频测试，平均F0: ${averageF0.toFixed(2)} Hz`, // 在备注中记录结果
      },
    };

    try {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

      if (isOnline) {
        await addEvent(eventData);
        alert('事件已成功保存！');
        navigate('/mypage');
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
          alert('已离线保存，网络恢复后可在“我的页面”同步。');
          navigate('/mypage');
        } catch (storageError) {
          console.error('离线保存失败:', storageError);
          setError('离线保存失败，请检查浏览器存储权限或稍后再试。');
        }
      }
    } catch (err) {
      console.error("保存事件失败:", err);
      setError(err.message || '保存事件时发生未知错误。');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 确保组件卸载时清理资源
  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  // 限制图表显示的数据点数量以提高性能
  const chartHistory = f0History.slice(-200); // 只显示最近200个数据点

  // --- UI 渲染 ---
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-center text-red-700">
          {error}
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
