/** @file 实时试听界面：固定参考基频、可调整变调和音量，采集全程在本机处理。 */
import React, { useEffect, useState } from 'react';
import { useLiveEffect } from '../hooks/useLiveEffect.js';
import { EFFECT_ALGORITHMS } from '../audio/effectAlgorithms.js';
import { getPitchParameters } from '../audio/pitchParameters.js';

const PHASE_LABELS = { idle: '未开启', requesting: '等待麦克风授权…', calibrating: '请发出平稳的“啊”音，正在校准…',
  buffering: '正在缓冲…', playing: '实时试听中', reconfiguring: '正在应用新变调…', 'catching-up': '正在恢复播放…' };

/** 与录音模式互斥挂载；避免两个组件同时申请麦克风。 */
export default function LiveEffectPreview({ detectedF0 = 0, shiftHz, onShiftChange }) {
  const { controller, state } = useLiveEffect();
  const [algorithm, setAlgorithm] = useState('soundtouch');
  const [referenceMode, setReferenceMode] = useState(detectedF0 ? 'manual' : 'auto');
  const [referenceInput, setReferenceInput] = useState(String(detectedF0 || 150));
  const [volume, setVolume] = useState(50);
  const active = state.phase !== 'idle';
  const manualReference = Number(referenceInput);
  const validReference = Number.isFinite(manualReference) && manualReference >= 80 && manualReference <= 500;
  const reference = active ? state.referenceF0 : referenceMode === 'manual' ? (validReference ? manualReference : null) : state.referenceF0;
  const parameters = reference ? getPitchParameters(reference, shiftHz) : null;
  useEffect(() => controller.setShift(shiftHz), [controller, shiftHz]);

  return (
    <section aria-label="实时试听" className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">实时试听</h2>
        <p className="mt-2 text-sm text-gray-600">戴上耳机后开启，一边说话一边听变调效果。音频仅在本机处理。</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700">实时算法
          <select aria-label="实时算法" disabled={active} value={algorithm} onChange={event => setAlgorithm(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 disabled:bg-gray-100">
            {EFFECT_ALGORITHMS.filter(item => item.live).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">参考基频来源
          <select aria-label="参考基频来源" disabled={active} value={referenceMode} onChange={event => setReferenceMode(event.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 disabled:bg-gray-100">
            <option value="auto">开启时自动校准</option><option value="manual">填写参考基频</option>
          </select>
        </label>
      </div>
      {referenceMode === 'manual' && <label className="block text-sm font-medium text-gray-700">参考基频（Hz）
        <input aria-label="参考基频（Hz）" type="number" min="80" max="500" step="1" value={referenceInput} disabled={active}
          onChange={event => setReferenceInput(event.target.value)} className="ml-3 w-28 rounded-lg border border-gray-300 p-2" />
        {!validReference && <span className="ml-3 text-red-700">请输入 80–500 Hz</span>}
      </label>}
      <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">
        <label htmlFor="live-pitch-shift" className="flex flex-wrap items-center justify-between gap-2 font-medium text-gray-800">
          <span>音高变化量</span><span className="text-xl text-purple-700">+{shiftHz} Hz</span>
        </label>
        <input id="live-pitch-shift" type="range" min="0" max="100" step="5" value={shiftHz}
          onChange={event => onShiftChange(Number(event.target.value))} className="mt-4 w-full accent-purple-600" />
        <div className="mt-1 flex justify-between text-xs text-gray-500"><span>0 Hz · 原调</span><span>100 Hz</span></div>
        <p className="mt-3 text-sm text-gray-600">{parameters
          ? `参考 ${reference} Hz → 约 ${reference + shiftHz} Hz（${parameters.semitones.toFixed(2)} 半音）。`
          : '校准后将显示参考基频和变调比例。'}参考基频固定，保留说话时的音高起伏。</p>
      </div>
      <label htmlFor="live-volume" className="block text-sm font-medium text-gray-700">监听音量 · {volume}%
        <input id="live-volume" type="range" min="0" max="100" value={volume} onChange={event => {
          const next = Number(event.target.value); setVolume(next); controller.setVolume(next / 100);
        }} className="mt-3 w-full accent-purple-600" />
      </label>
      {state.error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{state.error}</div>}
      <div className="flex flex-wrap items-center gap-4">
        {active ? <button type="button" onClick={() => controller.stop()} className="rounded-lg bg-gray-700 px-6 py-3 font-medium text-white hover:bg-gray-800">
          {state.phase === 'requesting' ? '取消开启' : '停止试听'}
        </button> : <button type="button" disabled={referenceMode === 'manual' && !validReference}
          onClick={() => controller.start({ algorithm, shiftHz, referenceF0: referenceMode === 'auto' ? null : manualReference })}
          className="rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 disabled:bg-gray-400">开启实时试听</button>}
        <span role="status" className="text-sm text-gray-600">{PHASE_LABELS[state.phase] || state.phase}</span>
      </div>
      {state.stats && <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 sm:grid-cols-3">
        <div>播放缓冲 <strong className="block text-gray-900">{state.stats.queueMs.toFixed(0)} ms</strong></div>
        <div>采样率 <strong className="block text-gray-900">{state.sampleRate} Hz</strong></div>
        <div>播放中断 <strong className="block text-gray-900">{state.stats.underruns} 次</strong></div>
      </div>}
      <p className="text-xs leading-relaxed text-gray-500">调节变调后会短暂重新缓冲。播放缓冲量不等于麦克风到耳机的总延迟；蓝牙耳机还可能增加延迟。</p>
    </section>
  );
}
