/** @file 页面折叠、算法对比、统一参数及实时模式的交互回归。 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { process, live } = vi.hoisted(() => ({ process: vi.fn(), live: vi.fn() }));
vi.mock('../../../src/audio/processRecordedEffect.js', () => ({ processRecordedEffect: process }));
vi.mock('../../../src/utils/worldJsLoader.js', () => ({ loadWorldJs: () => Promise.resolve({ Dio_JS() {} }) }));
vi.mock('../../../src/hooks/usePwaUpdateBlocker.js', () => ({ usePwaUpdateBlocker() {} }));
vi.mock('../../../src/components/Recorder.jsx', () => ({ default: ({ onRecordingComplete }) => <button onClick={() => onRecordingComplete({ arrayBuffer: async () => new ArrayBuffer(8) })}>测试录音完成</button> }));
vi.mock('../../../src/components/LiveEffectPreview.jsx', () => ({ default: props => { live(props); return <div>实时控制已挂载</div>; } }));
import VFSEffectPreview from '../../../src/components/VFSEffectPreview.jsx';

const input = Float32Array.from({ length: 12000 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 200 * i / 48000));
const audio = { sampleRate: 48000, numberOfChannels: 1, length: input.length, getChannelData: () => input };
const outputBuffer = () => {
  const data = new Float32Array(input.length);
  return { sampleRate: 48000, numberOfChannels: 1, length: data.length, getChannelData: () => data, copyToChannel: channel => data.set(channel) };
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    decodeAudioData = async () => audio;
    createBuffer = () => outputBuffer();
    close = async () => { this.state = 'closed'; };
  });
  process.mockResolvedValue([input.slice()]);
});

const mount = () => render(<MemoryRouter><VFSEffectPreview /></MemoryRouter>);
afterEach(() => vi.unstubAllGlobals());
const completeRecording = async () => {
  fireEvent.click(screen.getByRole('button', { name: '测试录音完成' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /处理音频/ })).toBeEnabled());
};

describe('效果预览流程', () => {
  it('三块说明独立默认收折，只显示各自的标题与箭头', async () => {
    const view = mount();
    await act(async () => {});
    const details = [...view.container.querySelectorAll('details')];
    expect(details).toHaveLength(3);
    expect(details.every(item => !item.open)).toBe(true);
    expect(details.every(item => item.querySelector('summary h3') && item.querySelector('summary svg'))).toBe(true);
  });
  it('SoundTouch 和 RubberBand 以相同检测基频和比例处理，并显示独立结果', async () => {
    mount(); await completeRecording();
    fireEvent.click(screen.getByRole('button', { name: /^SoundTouch/ }));
    fireEvent.click(screen.getByRole('button', { name: /处理音频/ }));
    await screen.findByRole('button', { name: '播放 SoundTouch' });
    expect(process.mock.calls[0][1]).toBe('soundtouch');
    expect(process.mock.calls[0][2].ratio).toBe(1.25);
    const createObjectURL = vi.fn(blob => {
      expect(blob).toBeInstanceOf(Blob);
      return 'blob:test-audio';
    });
    const NativeURL = globalThis.URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    });
    vi.stubGlobal('Audio', class {
      addEventListener = vi.fn();
      play = vi.fn().mockResolvedValue();
      pause = vi.fn();
      removeAttribute = vi.fn();
      load = vi.fn();
    });
    fireEvent.click(screen.getByRole('button', { name: '播放 SoundTouch' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /^RubberBand/ }));
    fireEvent.click(screen.getByRole('button', { name: /处理音频/ }));
    await screen.findByRole('button', { name: '播放 RubberBand' });
    expect(process.mock.calls[1][2]).toEqual(process.mock.calls[0][2]);
    expect(screen.getByRole('button', { name: '播放 SoundTouch' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '60' } });
    expect(screen.queryByRole('button', { name: '播放 SoundTouch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '播放 RubberBand' })).not.toBeInTheDocument();
  });
  it('切换实时模式卸载录音组件，并传入同一变调量', async () => {
    mount();
    await act(async () => {});
    fireEvent.click(screen.getByRole('tab', { name: '实时试听' }));
    expect(screen.queryByRole('button', { name: '测试录音完成' })).not.toBeInTheDocument();
    expect(screen.getByText('实时控制已挂载')).toBeInTheDocument();
    expect(live.mock.calls.at(-1)[0].shiftHz).toBe(50);
    fireEvent.click(screen.getByRole('tab', { name: '录音对比' }));
    expect(screen.queryByText('实时控制已挂载')).not.toBeInTheDocument();
  });
  it('卸载时取消未完成的处理，不能写回迟到结果', async () => {
    process.mockImplementation(() => new Promise(() => {}));
    const view = mount(); await completeRecording();
    fireEvent.click(screen.getByRole('button', { name: /^SoundTouch/ }));
    fireEvent.click(screen.getByRole('button', { name: /处理音频/ }));
    await waitFor(() => expect(process).toHaveBeenCalled());
    const signal = process.mock.calls[0][3].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
