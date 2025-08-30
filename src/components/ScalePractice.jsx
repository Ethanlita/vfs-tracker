import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const halfStepsFromA4 = Math.round(12 * Math.log2(frequency / A4));
  const midi = 69 + halfStepsFromA4; // MIDI 69 对应 A4
  const note = noteNames[(midi + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
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

  // --- 向导步骤状态 ---
  // 初始即进入权限请求页面
  const [step, setStep] = useState('permission');
  const [message, setMessage] = useState('');
  const [syllable, setSyllable] = useState('a');
  const [error, setError] = useState(null);
  const [permissionMsg, setPermissionMsg] = useState('');
  const [startOffset, setStartOffset] = useState(0); // 起始音相对C4的半音数
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
  // 增大默认增益，使钢琴声音更清晰
  const playTone = (freq, duration = 700, usePiano = true, gainValue = 4) => {
    return new Promise(resolve => {
      if (usePiano && pianoRef.current) {
        // soundfont-player 需要音名或 MIDI 号，这里将频率转换为最近的音名
        const note = frequencyToNoteName(freq);
        pianoRef.current.play(note, audioCtxRef.current.currentTime, {
          duration: duration / 1000,
          gain: gainValue
        });
        setTimeout(resolve, duration);
      } else {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = gainValue;
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

  // --- 测量指定频率处的能量（dB） ---
  const measureFreqDb = (freq, duration = 800) => {
    return new Promise(resolve => {
      const analyser = analyserRef.current;
      const buffer = new Float32Array(analyser.frequencyBinCount);
      const index = Math.round((freq / audioCtxRef.current.sampleRate) * analyser.fftSize);
      const samples = [];
      const end = performance.now() + duration;
      const collect = () => {
        analyser.getFloatFrequencyData(buffer);
        samples.push(buffer[index]);
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
    const baselineRms = await measureRms(800);
    baselineRmsRef.current = baselineRms;
    const baselineDb = await measureFreqDb(1000, 800);
    setMessage('现在播放1kHz标准音，请确认不会被麦克风录到');
    const testPromise = measureFreqDb(1000, 800);
    await playTone(1000, 800, false, 1);
    const testDb = await testPromise;
    if (testDb > baselineDb + 3) {
      setMessage('似乎未佩戴耳机，建议佩戴耳机以获得更佳效果。');
      setStep('headphoneFail');
    } else {
      setMessage('耳机检测通过！');
      setTimeout(() => setStep('calibration'), 500);
    }
  };

  // --- 校准：获取舒适音高并推荐起始音 ---
  const handleCalibrationStart = async () => {
    setStep('calibrating');
    setMessage('正在录音，请在听到嘀声后以舒适的音高发 /a/ 音');
    currentFramesRef.current = [];
    await playTone(1000, 300, false, 1);
    collectingRef.current = true;
    await new Promise(r => setTimeout(r, 3000));
    collectingRef.current = false;
    const valid = currentFramesRef.current.filter(f => f.pitch > 50 && f.pitch < 1200);
    const f0s = valid.map(f => f.pitch);
    const sff = median(f0s);
    let idx = Math.round(12 * Math.log2(sff / 261.63)) - 2;
    if (idx > 12) idx = 12;
    if (idx < -12) idx = -12;
    setStartOffset(idx);
    setStep('setup');
  };

  // --- 节拍循环与练习逻辑 ---
  const runCycle = async (direction, isDemo = false) => {
    const baseIndex = direction === 'ascending' ? rootIndexRef.current : descendingIndexRef.current;
    const baseFreq = 261.63 * Math.pow(semitoneRatio, baseIndex);
    const offsets = [0, 2, 4, 2, 0];
    const targetFreq = baseFreq * Math.pow(semitoneRatio, 4);
    setIndicatorRange({ min: Math.min(baseFreq, targetFreq), max: Math.max(baseFreq, targetFreq) });
    setStep(isDemo ? 'demoLoop' : direction);
    setLadderNotes([
      baseFreq,
      baseFreq * Math.pow(semitoneRatio, direction === 'ascending' ? 2 : -2),
      targetFreq
    ]);
    const beatDur = 600;
    const beatData = [];
    for (let i = 1; i <= 8; i++) {
      currentFramesRef.current = [];
      collectingRef.current = true;
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
      collectingRef.current = false;
      beatData.push([...currentFramesRef.current]);
    }

    const gateFrames = (frames) => frames.filter(f =>
      f.pitch > 50 &&
      f.pitch < 1200 &&
      gateByEnergy(f.rms, baselineRmsRef.current, deltaDb) &&
      gateByStability(f.clarity, clarityTheta)
    );

    if (isDemo) {
      let resultMsg = '演示结束，做得很好！';
      const early = gateFrames(beatData[0]).length || gateFrames(beatData[1]).length;
      if (early) {
        resultMsg = '切入太早，应该和系统播放的目标音同时切入';
      } else {
        for (let j = 0; j < offsets.length; j++) {
          const expected = baseFreq * Math.pow(semitoneRatio, offsets[j]);
          const frames = gateFrames(beatData[j + 2]);
          if (!frames.length) {
            resultMsg = `第${j + 1}个音${frequencyToNoteName(expected)}未检测到`;
            break;
          }
          const pitch = median(frames.map(f => f.pitch));
          const cents = 1200 * Math.log2(pitch / expected);
          if (cents < -tolerance) {
            resultMsg = `第${j + 1}个音${frequencyToNoteName(expected)}不够高`;
            break;
          } else if (cents > tolerance) {
            resultMsg = `第${j + 1}个音${frequencyToNoteName(expected)}不够低`;
            break;
          }
        }
      }
      setMessage(resultMsg);
      setStep('demoEnd');
      return;
    }

    const frames = beatData.flat();
    const valid = gateFrames(frames);

    // 辅助函数：找出失败的音符序号
    const findFailedNote = () => {
      for (let j = 0; j < offsets.length; j++) {
        const expected = baseFreq * Math.pow(semitoneRatio, offsets[j]);
        const frames = gateFrames(beatData[j + 2]);
        if (!frames.length) {
          return { idx: j + 1, freq: expected, type: 'low' };
        }
        const pitch = median(frames.map(f => f.pitch));
        const cents = 1200 * Math.log2(pitch / expected);
        if (cents < -tolerance) {
          return { idx: j + 1, freq: expected, type: 'low' };
        }
        if (cents > tolerance) {
          return { idx: j + 1, freq: expected, type: 'high' };
        }
      }
      return null;
    };

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
        const failed = findFailedNote();
        const failMsg = failed
          ? `第${failed.idx}个音${frequencyToNoteName(failed.freq)}不够${failed.type === 'low' ? '高' : '低'}`
          : '未达到目标音，是否重试？';
        setMessage(failMsg);
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
        const failed = findFailedNote();
        const failMsg = failed
          ? `第${failed.idx}个音${frequencyToNoteName(failed.freq)}不够${failed.type === 'low' ? '高' : '低'}`
          : '未达到目标音，是否重试？';
        setMessage(failMsg);
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
    // 根据上行练习达到的最高音确定下降练习起始音
    if (highestHz > 0) {
      const highestIndex = Math.round(12 * Math.log2(highestHz / 261.63));
      descendingIndexRef.current = highestIndex - 4;
    } else {
      descendingIndexRef.current = startOffset;
    }
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

  // 绘制钢琴键盘并标注声域范围
  const renderRangeKeyboard = () => {
    if (!highestHz || !lowestHz) return null;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
    const lowMidi = Math.floor(freqToMidi(lowestHz));
    const highMidi = Math.ceil(freqToMidi(highestHz));
    const startMidi = Math.floor(lowMidi / 12) * 12;
    const endMidi = Math.ceil(highMidi / 12) * 12 + 12;
    const whiteWidth = 20;
    const whiteHeight = 80;
    const blackWidth = whiteWidth * 0.6;
    const blackHeight = whiteHeight * 0.6;
    let whiteCount = 0;
    const whites = [];
    const blacks = [];
    for (let m = startMidi; m < endMidi; m++) {
      const note = noteNames[m % 12];
      const isBlack = note.includes('#');
      if (!isBlack) {
        const x = whiteCount * whiteWidth;
        const inRange = m >= lowMidi && m <= highMidi;
        whites.push(
          <rect key={`w${m}`} x={x} y={0} width={whiteWidth} height={whiteHeight}
            fill={inRange ? '#fbcfe8' : '#fff'} stroke="#000" />
        );
        whiteCount++;
      } else {
        const x = whiteCount * whiteWidth - blackWidth / 2;
        const inRange = m >= lowMidi && m <= highMidi;
        blacks.push(
          <rect key={`b${m}`} x={x} y={0} width={blackWidth} height={blackHeight}
            fill={inRange ? '#f472b6' : '#000'} />
        );
      }
    }
    const svgWidth = whiteCount * whiteWidth;
    return (
      <svg width={svgWidth} height={whiteHeight} className="mx-auto mb-4">
        {whites}
        {blacks}
      </svg>
    );
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
              onClick={() => setStep('calibration')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold"
            >
              继续
            </button>
          </div>
        </div>
      )}

      {step === 'calibration' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">
            点击开始录音后你将会听到嘀声，请在听到后以最舒适的音高发 /a/ 音。
          </p>
          <button
            onClick={handleCalibrationStart}
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold"
          >
            开始录音
          </button>
        </div>
      )}

      {step === 'calibrating' && (
        <div className="bg-white p-6 rounded-xl shadow-md mb-6 text-center">
          <p className="mb-4 text-gray-700">正在录音...</p>
        </div>
      )}

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
            <p className="text-gray-700 mb-2">起始音：{frequencyToNoteName(261.63 * Math.pow(semitoneRatio, startOffset))}（可调整）</p>
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
          {step === 'demoLoop' && (
            <p className="mb-4 text-gray-700">
              演示说明：全过程共 8 拍，第 1 拍为音高示例无需出声，第 2、8 拍为空拍，第 3-7 拍需与系统同时出声。
            </p>
          )}
          <div className="relative h-48 bg-gray-100 rounded mb-4">
            {ladderNotes.map((f, idx) => {
              const lower = freqToPercent(f * Math.pow(2, -tolerance / 1200), indicatorRange) * 100;
              const upper = freqToPercent(f * Math.pow(2, tolerance / 1200), indicatorRange) * 100;
              const center = freqToPercent(f, indicatorRange) * 100;
              return (
                <React.Fragment key={idx}>
                  <div
                    className="absolute w-full bg-pink-200 opacity-40"
                    style={{ bottom: `${lower}%`, height: `${upper - lower}%` }}
                  ></div>
                  <div
                    className="absolute w-full h-px bg-pink-500"
                    style={{ bottom: `${center}%` }}
                  ></div>
                </React.Fragment>
              );
            })}
            <div
              className="absolute w-3 h-3 bg-pink-500 rounded-full"
              style={{ left: `${dotX}%`, bottom: `${freqToPercent(currentF0, indicatorRange) * 100}%` }}
            ></div>
          </div>
          <div className="flex flex-col items-center mb-2">
            <div className="flex justify-center mb-2">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="flex flex-col items-center mx-1">
                  <span className="text-xs text-gray-500 mb-1">{idx + 1}</span>
                  <div
                    className={`w-3 h-3 rounded-full ${beat === idx + 1 ? 'bg-pink-500' : 'bg-gray-300'}`}
                  ></div>
                </div>
              ))}
            </div>
            <p className="text-gray-700">第{beat}/8拍 {beatLabel}</p>
          </div>
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
          {renderRangeKeyboard()}
          <div className="flex justify-center">
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
