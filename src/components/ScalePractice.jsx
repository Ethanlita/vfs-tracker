import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { addEvent } from '../api';
import { PitchDetector } from 'pitchy';
import Soundfont from 'soundfont-player';
import {
  accumulateStableWindow,
  gateByEnergy,
  gateByStability
} from '../utils/pitchEval.js';

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

// 将频率映射为指示器的垂直百分比位置
const freqToPercent = (f, range) => {
  if (!range.max || !range.min || f <= 0) return 0;
  const { min, max } = range;
  const ratio = Math.log2(f / min) / Math.log2(max / min);
  return Math.min(1, Math.max(0, ratio));
};

// 中位数计算
const median = (arr) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
  // 初始即进入权限请求页面
  const [step, setStep] = useState('permission');
  const [message, setMessage] = useState('');
  const [syllable, setSyllable] = useState('a');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionMsg, setPermissionMsg] = useState('');
  const [startOffset, setStartOffset] = useState(0); // 起始音相对C4的半音数
  const [showRecommend, setShowRecommend] = useState(false);
  const [recommendIdx, setRecommendIdx] = useState(null);
  const [beat, setBeat] = useState(0);
  const [beatLabel, setBeatLabel] = useState('');
  const [dotX, setDotX] = useState(0);
  const [indicatorRange, setIndicatorRange] = useState({ min: 0, max: 0 });
  const [ladderNotes, setLadderNotes] = useState([]);

  // --- 练习结果 ---
  const [highestHz, setHighestHz] = useState(0);
  const [lowestHz, setLowestHz] = useState(0);

  // --- 音频与分析相关引用 ---
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const detectorRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafRef = useRef(null);
  const pianoRef = useRef(null); // 采样钢琴音色

  // --- 练习参数与缓存 ---
  const baselineRmsRef = useRef(0);
  const tolerance = 50; // 允许的音差（cents）
  const stableWindowMs = 300; // 判定所需的稳定时间
  const clarityTheta = 0.6;
  const deltaDb = 12;
  const currentFramesRef = useRef([]);
  const collectingRef = useRef(false);
  const frameDurationRef = useRef(0);
  const semitoneRatio = Math.pow(2, 1 / 12);
  const rootIndexRef = useRef(0); // 起始音相对C4的半音数
  const descendingIndexRef = useRef(0);

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
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    const [pitch, clarity] = detectorRef.current.findPitch(input, audioCtxRef.current.sampleRate);
    if (collectingRef.current) {
      currentFramesRef.current.push({ pitch, clarity, rms });
    }
    if (clarity > 0.95 && pitch > 50 && pitch < 1200) {
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
    // 加载钢琴音色
    pianoRef.current = await Soundfont.instrument(ctx, 'acoustic_grand_piano');
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;
    detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize);
    frameDurationRef.current = (detectorRef.current.inputLength / ctx.sampleRate) * 1000;
    pitchLoop();
  }, [pitchLoop]);

  // --- 工具函数：播放一个音 ---
  const playTone = (freq, duration = 700) => {
    return new Promise(resolve => {
      if (pianoRef.current) {
        // soundfont-player 需要音名或 MIDI 号，这里将频率转换为最近的音名
        const note = frequencyToNoteName(freq);
        pianoRef.current.play(note, audioCtxRef.current.currentTime, {
          duration: duration / 1000,
          gain: 1
        });
        setTimeout(resolve, duration);
      } else {
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
      }
    });
  };

  // --- 自动推荐起始音 ---
  const handleAutoRecommend = async () => {
    currentFramesRef.current = [];
    collectingRef.current = true;
    await new Promise(r => setTimeout(r, 3000));
    collectingRef.current = false;
    const valid = currentFramesRef.current.filter(f => f.pitch > 50 && f.pitch < 1200);
    const f0s = valid.map(f => f.pitch);
    const sff = median(f0s);
    let idx = Math.round(12 * Math.log2(sff / 261.63)) - 2;
    if (idx > 12) idx = 12; if (idx < -12) idx = -12;
    setRecommendIdx(idx);
  };

  const handleUseRecommend = () => {
    if (recommendIdx !== null) {
      setStartOffset(recommendIdx);
    }
    setShowRecommend(false);
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

  // --- Step0: 申请权限 ---
  const requestPermission = useCallback(async () => {
    setPermissionMsg('正在申请麦克风权限...');
    try {
      await initAudio();
      setPermissionMsg('已成功获取麦克风权限，请戴上耳机');
    } catch (err) {
      console.error(err);
      setError('无法获取麦克风权限');
    }
  }, [initAudio]);

  // 页面加载即请求权限
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // --- Step1: 耳机检测 ---
  const handleHeadphoneCheck = async () => {
    setStep('headphone');
    setMessage('请保持安静，我们正在检测环境噪音...');
    const baseline = await measureRms(800);
    baselineRmsRef.current = baseline;
    setMessage('现在播放一段参考音，请确认不会被麦克风录到');
    await playTone(440, 1000);
    const test = await measureRms(800);
    // 若参考音通过麦克风，被测 RMS 会显著提升
    if (test <= baseline * 1.1) {
      setMessage('耳机检测通过！');
      setTimeout(() => setStep('setup'), 500);
    } else {
      setMessage('似乎未佩戴耳机，建议佩戴耳机以获得更佳效果。');
      setStep('headphoneFail');
    }
  };

  // --- 节拍循环与练习逻辑 ---
  const runCycle = async (direction, isDemo = false) => {
    const baseIndex = direction === 'ascending' ? rootIndexRef.current : descendingIndexRef.current;
    const baseFreq = 261.63 * Math.pow(semitoneRatio, baseIndex);
    const offsets = direction === 'ascending' ? [0, 2, 4, 2, 0] : [0, -2, -4, -2, 0];
    const targetFreq = baseFreq * Math.pow(semitoneRatio, direction === 'ascending' ? 4 : -4);
    setIndicatorRange({ min: Math.min(baseFreq, targetFreq), max: Math.max(baseFreq, targetFreq) });
    setStep(isDemo ? 'demoLoop' : direction);
    setLadderNotes([
      baseFreq,
      baseFreq * Math.pow(semitoneRatio, direction === 'ascending' ? 2 : -2),
      targetFreq
    ]);
    const beatDur = 600;
    currentFramesRef.current = [];
    collectingRef.current = true;
    for (let i = 1; i <= 8; i++) {
      setBeat(i);
      setDotX(((i - 1) / 7) * 100);
      let freq = null;
      if (i === 1) {
        freq = baseFreq;
        setBeatLabel(`演示 ${frequencyToNoteName(freq)}`);
      } else if (i === 2 || i === 8) {
        setBeatLabel('空拍');
      } else {
        const offset = offsets[i - 3];
        freq = baseFreq * Math.pow(semitoneRatio, offset);
        setBeatLabel(`${isDemo ? '演示' : '练习'} ${frequencyToNoteName(freq)}`);
      }
      if (freq) {
        await playTone(freq, beatDur);
      } else {
        await new Promise(r => setTimeout(r, beatDur));
      }
      if (i === 8) collectingRef.current = false;
    }
    if (isDemo) {
      setStep('demoEnd');
      setMessage('演示结束');
      return;
    }
    const frames = currentFramesRef.current;
    const valid = frames.filter(f =>
      f.pitch > 50 &&
      f.pitch < 1200 &&
      gateByEnergy(f.rms, baselineRmsRef.current, deltaDb) &&
      gateByStability(f.clarity, clarityTheta)
    );
    if (direction === 'ascending') {
      setStep('ascending');
      const maxF0 = valid.length ? Math.max(...valid.map(f => f.pitch)) : 0;
      const stable = accumulateStableWindow(
        frames,
        targetFreq,
        tolerance,
        baselineRmsRef.current,
        deltaDb,
        clarityTheta,
        frameDurationRef.current
      );
      if (stable >= stableWindowMs) {
        setHighestHz(Math.max(highestHz, maxF0));
        rootIndexRef.current += 1;
        setTimeout(() => runCycle('ascending'), 800);
      } else {
        setMessage('未达到目标音，是否重试？');
        setStep('ascendFail');
      }
    } else {
      setStep('descending');
      const minF0 = valid.length ? Math.min(...valid.map(f => f.pitch)) : Infinity;
      const stable = accumulateStableWindow(
        frames,
        targetFreq,
        tolerance,
        baselineRmsRef.current,
        deltaDb,
        clarityTheta,
        frameDurationRef.current
      );
      if (stable >= stableWindowMs) {
        setLowestHz(lowestHz === 0 ? minF0 : Math.min(lowestHz, minF0));
        descendingIndexRef.current -= 1;
        setTimeout(() => runCycle('descending'), 800);
      } else {
        setMessage('未达到目标音，是否重试？');
        setStep('descendFail');
      }
    }
  };

  const handleDemoStart = () => {
    rootIndexRef.current = startOffset;
    runCycle('ascending', true);
  };

  const handlePracticeStart = () => {
    rootIndexRef.current = startOffset;
    runCycle('ascending');
  };

  const handleRetryAscend = () => {
    setMessage('再试一次');
    runCycle('ascending');
  };

  const handleStartDescending = () => {
    descendingIndexRef.current = rootIndexRef.current - 1;
    runCycle('descending');
  };

  const handleRetryDescend = () => {
    setMessage('再试一次');
    runCycle('descending');
  };

  const handleFinishPractice = () => {
    cleanupAudio();
    setStep('result');
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

      {step === 'permission' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <div className="text-6xl mb-4 animate-bounce">🎧</div>
          <p className="text-gray-700 mb-4">{permissionMsg}</p>
          {permissionMsg.includes('成功') && (
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
              onClick={() => setStep('setup')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              继续
            </button>
          </div>
        </div>
      )}

      {/* 校准步骤已移除，默认从 C4 开始 */}

      {step === 'setup' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">
            请选择练习音节。不同音节可以练习不同的共鸣位置，例如 a 偏喉部、i 更靠前。
          </p>
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
            <p className="text-gray-700 mb-2">起始音：{frequencyToNoteName(261.63 * Math.pow(semitoneRatio, startOffset))}</p>
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
              <button
                onClick={() => { setRecommendIdx(null); setShowRecommend(true); handleAutoRecommend(); }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
              >
                自动推荐
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

      {showRecommend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-md text-center max-w-sm w-full">
            <p className="mb-4 text-gray-700">请以最舒适的音高发 "a" 音，我们将推荐起始音。</p>
            {recommendIdx === null ? (
              <p className="text-gray-500">采集中...</p>
            ) : (
              <p className="text-gray-700 mb-4">推荐起始音：{frequencyToNoteName(261.63 * Math.pow(semitoneRatio, recommendIdx))}</p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleUseRecommend}
                className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
              >
                使用推荐起始音
              </button>
              <button
                onClick={() => setShowRecommend(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
              >
                取消
              </button>
            </div>
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
          <div className="relative h-48 bg-gray-100 rounded mb-4">
            {ladderNotes.map((f, idx) => (
              <div
                key={idx}
                className="absolute w-full h-px bg-gray-300"
                style={{ bottom: `${freqToPercent(f, indicatorRange) * 100}%` }}
              ></div>
            ))}
            <div
              className="absolute w-3 h-3 bg-pink-500 rounded-full"
              style={{ left: `${dotX}%`, bottom: `${freqToPercent(currentF0, indicatorRange) * 100}%` }}
            ></div>
          </div>
          <p className="mb-2 text-gray-700">第{beat}/8拍 {beatLabel}</p>
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

      {step === 'descendFail' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">{message}</p>
          <div className="flex gap-4 justify-center">
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
          </div>
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
