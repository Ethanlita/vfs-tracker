import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addEvent } from '../api';
import { PitchDetector } from 'pitchy';

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

/**
 * @zh ScalePractice 组件实现爬音阶指导与音域测定。
 * 流程：权限与耳机检测 → 演示 → 爬升练习 → 下降练习 → 结果展示。
 * 为保持示例简单，音高判定采用 pitchy 的实时 F0 估计，判定条件较为宽松。
 */
const ScalePractice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // --- 向导步骤状态 ---
  const [step, setStep] = useState('intro');
  const [message, setMessage] = useState('');
  const [syllable, setSyllable] = useState('a');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- 练习结果 ---
  const [highestHz, setHighestHz] = useState(0);
  const [lowestHz, setLowestHz] = useState(0);

  // --- 音频与分析相关引用 ---
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const detectorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);
  const currentCycleF0s = useRef([]);

  // 当前实时 F0，用于 UI 显示
  const [currentF0, setCurrentF0] = useState(0);

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
  }, []);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const pitchLoop = useCallback(() => {
    if (!detectorRef.current || !analyserRef.current || !audioCtxRef.current) return;
    const input = new Float32Array(detectorRef.current.inputLength);
    analyserRef.current.getFloatTimeDomainData(input);
    const [pitch, clarity] = detectorRef.current.findPitch(input, audioCtxRef.current.sampleRate);
    if (clarity > 0.95 && pitch > 50 && pitch < 1200) {
      currentCycleF0s.current.push(pitch);
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
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;
    detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
    pitchLoop();
  }, [pitchLoop]);

  // --- 工具函数：播放一个音 ---
  const playTone = (freq, duration = 700) => {
    return new Promise(resolve => {
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        resolve();
      }, duration);
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

  // --- Step0: 开始并进行耳机检测 ---
  const handleStart = async () => {
    try {
      await initAudio();
      setStep('headphone');
      setMessage('请保持安静，我们正在检测环境噪音...');
      const baseline = await measureRms(800);
      setMessage('现在播放一段参考音，请确认不会被麦克风录到');
      await playTone(440, 1000);
      const test = await measureRms(800);
      if (test - baseline < 0.02) {
        setMessage('耳机检测通过！');
        setStep('demo');
      } else {
        setMessage('似乎未佩戴耳机，建议佩戴耳机以获得更佳效果。');
      }
    } catch (err) {
      console.error(err);
      setError('无法获取麦克风权限');
    }
  };

  // --- 演示播放一次 ---
  const handlePlayDemo = async () => {
    const base = 261.63; // C4
    const semitone = Math.pow(2, 1 / 12);
    const sequence = [0, 2, 4, 2, 0];
    for (const offset of sequence) {
      await playTone(base * Math.pow(semitone, offset), 600);
      await new Promise(r => setTimeout(r, 100));
    }
  };

  // --- 爬升/下降练习核心逻辑 ---
  const semitoneRatio = Math.pow(2, 1 / 12);
  const rootIndexRef = useRef(0); // 记录当前循环的起始音相对C4的半音数
  const descendingIndexRef = useRef(0);

  const runAscendingCycle = async () => {
    setStep('ascending');
    const baseFreq = 261.63 * Math.pow(semitoneRatio, rootIndexRef.current);
    const targetHigh = baseFreq * Math.pow(semitoneRatio, 4);
    const sequence = [0, 2, 4, 2, 0];
    currentCycleF0s.current = [];
    for (const offset of sequence) {
      await playTone(baseFreq * Math.pow(semitoneRatio, offset), 600);
      await new Promise(r => setTimeout(r, 80));
    }
    const maxF0 = Math.max(...currentCycleF0s.current, 0);
    if (maxF0 >= targetHigh * Math.pow(2, -50 / 1200)) {
      setHighestHz(Math.max(highestHz, maxF0));
      rootIndexRef.current += 1; // 下一循环半音
      setMessage('很好，继续上升半音');
      setTimeout(runAscendingCycle, 800);
    } else {
      setMessage('未达到目标音，是否重试？');
      setStep('ascendFail');
    }
  };

  const handleRetryAscend = () => {
    setMessage('再试一次');
    runAscendingCycle();
  };

  const handleStartDescending = () => {
    descendingIndexRef.current = rootIndexRef.current - 1; // 从已达到的最高音开始
    setTimeout(runDescendingCycle, 500);
  };

  const runDescendingCycle = async () => {
    setStep('descending');
    const baseFreq = 261.63 * Math.pow(semitoneRatio, descendingIndexRef.current);
    const targetLow = baseFreq * Math.pow(semitoneRatio, -4);
    const sequence = [0, -2, -4, -2, 0];
    currentCycleF0s.current = [];
    for (const offset of sequence) {
      await playTone(baseFreq * Math.pow(semitoneRatio, offset), 600);
      await new Promise(r => setTimeout(r, 80));
    }
    const minF0 = Math.min(...currentCycleF0s.current.filter(f => f > 0), Infinity);
    if (minF0 <= targetLow * Math.pow(2, 50 / 1200)) {
      setLowestHz(lowestHz === 0 ? minF0 : Math.min(lowestHz, minF0));
      descendingIndexRef.current -= 1;
      setMessage('下降成功，继续下降半音');
      setTimeout(runDescendingCycle, 800);
    } else {
      setMessage('下降练习结束');
      setStep('result');
      cleanupAudio();
    }
  };

  // --- 保存事件 ---
  const handleSave = async () => {
    if (!user?.userId) return;
    setIsSaving(true);
    const eventData = {
      type: 'self_test',
      date: new Date().toISOString(),
      details: {
        appUsed: 'VFS Tracker Scale Practice',
        pitch: { max: highestHz, min: lowestHz },
        sound: ['其他'],
        customSoundDetail: `音阶练习使用音节 ${syllable}`,
        voicing: ['其他'],
        customVoicingDetail: '通过音阶练习自动记录',
        notes: `音阶练习，最高 ${frequencyToNoteName(highestHz)} (${highestHz.toFixed(1)} Hz)，最低 ${frequencyToNoteName(lowestHz)} (${lowestHz.toFixed(1)} Hz)`
      }
    };
    try {
      await addEvent(eventData);
      alert('事件已保存');
      navigate('/mypage');
    } catch (e) {
      console.error(e);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
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

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
      )}

      {step === 'intro' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <p className="mb-4 text-gray-700">请佩戴耳机，并确保周围环境安静。点击下方按钮开始。</p>
          <button
            onClick={handleStart}
            className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            开始
          </button>
        </div>
      )}

      {step === 'headphone' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="text-gray-700 mb-2">{message}</p>
          <p className="text-sm text-gray-500">当前F0: {currentF0 > 0 ? currentF0.toFixed(1) : '--'} Hz</p>
        </div>
      )}

      {step === 'demo' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">选择一个练习音节，然后可以试听演示或直接开始练习。</p>
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
          <div className="flex gap-4 justify-center">
            <button
              onClick={handlePlayDemo}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              播放演示
            </button>
            <button
              onClick={runAscendingCycle}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              开始练习
            </button>
          </div>
        </div>
      )}

      {step === 'ascending' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-2 text-gray-700">请跟随音阶上行</p>
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

      {step === 'descending' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-2 text-gray-700">请跟随音阶下行</p>
          <p className="text-sm text-gray-500">当前F0: {currentF0 > 0 ? currentF0.toFixed(1) : '--'} Hz</p>
        </div>
      )}

      {step === 'result' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">练习结果</h2>
          <p className="mb-2 text-gray-700">最高音：{frequencyToNoteName(highestHz)} ({highestHz.toFixed(1)} Hz)</p>
          <p className="mb-4 text-gray-700">最低音：{frequencyToNoteName(lowestHz)} ({lowestHz.toFixed(1)} Hz)</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存事件'}
            </button>
            <button
              onClick={() => navigate('/mypage')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              返回
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScalePractice;
