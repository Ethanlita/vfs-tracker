/**
 * @file Recorder.test.jsx
 * @description Recorder 组件的集成测试
 * @zh 测试音频录制组件的所有功能，包括开始、停止、暂停、恢复录音等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Recorder from '../../../src/components/Recorder';

describe('Recorder Component', () => {
  const user = userEvent.setup();
  let mockMediaStream;
  let mockMediaRecorder;
  let mockAudioContext;
  let mockAnalyser;
  let onRecordingCompleteMock;
  let onStartRecordingMock;
  let onStopRecordingMock;
  let onDiscardRecordingMock;

  // 保存原始全局对象
  let originalAudioContext;
  let originalWebkitAudioContext;
  let originalOfflineAudioContext;
  let originalMediaRecorder;
  let originalGetUserMedia;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let originalConfirm;
  let originalAlert;

  beforeAll(() => {
    // 保存原始全局对象引用
    originalAudioContext = global.AudioContext;
    originalWebkitAudioContext = global.webkitAudioContext;
    originalOfflineAudioContext = global.OfflineAudioContext;
    originalMediaRecorder = global.MediaRecorder;
    originalGetUserMedia = global.navigator?.mediaDevices?.getUserMedia;
    originalRequestAnimationFrame = global.requestAnimationFrame;
    originalCancelAnimationFrame = global.cancelAnimationFrame;
    originalCreateObjectURL = global.URL?.createObjectURL;
    originalRevokeObjectURL = global.URL?.revokeObjectURL;
    originalConfirm = global.confirm;
    originalAlert = global.alert;
  });

  beforeEach(() => {
    // 重置所有mock
    onRecordingCompleteMock = vi.fn();
    onStartRecordingMock = vi.fn();
    onStopRecordingMock = vi.fn();
    onDiscardRecordingMock = vi.fn();

    // Mock MediaStream - 创建持久的track对象以便可以验证stop调用
    const mockTrack = { stop: vi.fn(), kind: 'audio' };
    mockMediaStream = {
      getTracks: vi.fn(() => [mockTrack]),
      active: true,
      _mockTrack: mockTrack // 保存引用以便测试访问
    };

    // Mock MediaRecorder
    mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
      mimeType: 'audio/webm;codecs=opus'
    };

    // Mock AudioContext
    mockAnalyser = {
      fftSize: 2048,
      getByteTimeDomainData: vi.fn((buffer) => {
        // 模拟音频数据
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 128 + Math.random() * 20;
        }
      })
    };

    mockAudioContext = {
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn()
      })),
      createAnalyser: vi.fn(() => mockAnalyser),
      close: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue({
        duration: 5,
        numberOfChannels: 2,
        length: 48000 * 5,
        sampleRate: 48000,
        getChannelData: vi.fn((ch) => new Float32Array(48000 * 5).fill(0.1))
      })
    };

    // Mock OfflineAudioContext
    global.OfflineAudioContext = vi.fn().mockImplementation(() => ({
      createBuffer: vi.fn(() => ({
        copyToChannel: vi.fn()
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn()
      })),
      destination: {},
      startRendering: vi.fn().mockResolvedValue({
        getChannelData: vi.fn(() => new Float32Array(48000 * 5).fill(0.1))
      })
    }));

    // Mock window APIs
    global.AudioContext = vi.fn(() => mockAudioContext);
    global.webkitAudioContext = vi.fn(() => mockAudioContext);
    
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
    };

    global.MediaRecorder = vi.fn(() => mockMediaRecorder);
    global.MediaRecorder.isTypeSupported = vi.fn(() => true);

    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
    global.cancelAnimationFrame = vi.fn();

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock window.confirm
    global.confirm = vi.fn(() => true);

    // Mock window.alert
    global.alert = vi.fn();
  });

  afterEach(() => {
    cleanup(); // 清理之前渲染的组件
    vi.clearAllMocks();

    // 恢复原始全局对象
    if (originalAudioContext !== undefined) {
      global.AudioContext = originalAudioContext;
    }
    if (originalWebkitAudioContext !== undefined) {
      global.webkitAudioContext = originalWebkitAudioContext;
    }
    if (originalOfflineAudioContext !== undefined) {
      global.OfflineAudioContext = originalOfflineAudioContext;
    }
    if (originalMediaRecorder !== undefined) {
      global.MediaRecorder = originalMediaRecorder;
    }
    if (originalGetUserMedia !== undefined && global.navigator?.mediaDevices) {
      global.navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    }
    if (originalRequestAnimationFrame !== undefined) {
      global.requestAnimationFrame = originalRequestAnimationFrame;
    }
    if (originalCancelAnimationFrame !== undefined) {
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    }
    if (originalCreateObjectURL !== undefined && global.URL) {
      global.URL.createObjectURL = originalCreateObjectURL;
    }
    if (originalRevokeObjectURL !== undefined && global.URL) {
      global.URL.revokeObjectURL = originalRevokeObjectURL;
    }
    if (originalConfirm !== undefined) {
      global.confirm = originalConfirm;
    }
    if (originalAlert !== undefined) {
      global.alert = originalAlert;
    }
    vi.clearAllTimers();
  });

  describe('基础渲染', () => {
    it('应该渲染"开始录音"按钮', () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      expect(screen.getByRole('button', { name: /开始录音/i })).toBeInTheDocument();
    });

    it('应该接受onRecordingComplete回调', () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      expect(onRecordingCompleteMock).not.toHaveBeenCalled();
    });

    it('应该接受可选的回调props', () => {
      render(
        <Recorder
          onRecordingComplete={onRecordingCompleteMock}
          onStartRecording={onStartRecordingMock}
          onStopRecording={onStopRecordingMock}
          onDiscardRecording={onDiscardRecordingMock}
        />
      );

      expect(screen.getByRole('button', { name: /开始录音/i })).toBeInTheDocument();
    });
  });

  describe('开始录音', () => {
    it('点击"开始录音"应该请求麦克风权限', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      });
    });

    it('开始录音应该调用onStartRecording回调', async () => {
      render(
        <Recorder
          onRecordingComplete={onRecordingCompleteMock}
          onStartRecording={onStartRecordingMock}
        />
      );

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(onStartRecordingMock).toHaveBeenCalled();
      });
    });

    it('开始录音后应该显示"停止录音且继续"按钮', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且继续/i })).toBeInTheDocument();
      });
    });

    it('开始录音后应该显示"暂停"按钮', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });
    });

    it('开始录音后应该显示"停止录音且放弃"按钮', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且放弃/i })).toBeInTheDocument();
      });
    });

    it('开始录音后应该显示"正在录音..."文本', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/正在录音.../i)).toBeInTheDocument();
      });
    });

    it('开始录音应该创建MediaRecorder实例', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(global.MediaRecorder).toHaveBeenCalled();
      });
    });

    it('无法获取麦克风权限应该显示错误alert', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          expect.stringContaining('无法启动录音')
        );
      });
    });
  });

  describe('停止录音', () => {
    beforeEach(async () => {
      // Helper: 开始录音
      const startRecording = async () => {
        render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);
        const startButton = screen.getByRole('button', { name: /开始录音/i });
        await user.click(startButton);
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /停止录音且继续/i })).toBeInTheDocument();
        });
      };
      await startRecording();
    });

    it('点击"停止录音且继续"应该停止录音', async () => {
      const stopButton = screen.getByRole('button', { name: /停止录音且继续/i });
      
      mockMediaRecorder.state = 'recording';
      await user.click(stopButton);

      await waitFor(() => {
        expect(mockMediaRecorder.stop).toHaveBeenCalled();
      });
    });

    it('停止录音应该调用onStopRecording回调', async () => {
      const { container } = render(
        <Recorder
          onRecordingComplete={onRecordingCompleteMock}
          onStopRecording={onStopRecordingMock}
        />
      );

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(container.querySelector('button')).toBeTruthy();
      });

      // 使用 getAllByRole 获取第一个匹配的按钮（避免重复元素问题）
      const stopButtons = screen.getAllByRole('button', { name: /停止录音且继续/i });
      const stopButton = stopButtons[stopButtons.length - 1]; // 获取最后一个（最新渲染的）
      mockMediaRecorder.state = 'recording';
      await user.click(stopButton);

      await waitFor(() => {
        expect(onStopRecordingMock).toHaveBeenCalled();
      });
    });

    it('停止录音应该调用onRecordingComplete并传递Blob', async () => {
      const { container } = render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(container.querySelector('button')).toBeTruthy();
      });

      // 模拟数据可用
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob });
        }
      });

      // 使用 getAllByRole 避免重复元素问题
      const stopButtons = screen.getAllByRole('button', { name: /停止录音且继续/i });
      const stopButton = stopButtons[stopButtons.length - 1];
      mockMediaRecorder.state = 'recording';
      
      await user.click(stopButton);

      // 触发onstop
      await act(async () => {
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop();
        }
      });

      await waitFor(() => {
        expect(onRecordingCompleteMock).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('放弃录音', () => {
    it('点击"停止录音且放弃"应该显示确认对话框', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且放弃/i })).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /停止录音且放弃/i });
      await user.click(discardButton);

      expect(global.confirm).toHaveBeenCalled();
    });

    it('确认放弃应该调用onDiscardRecording回调', async () => {
      global.confirm.mockReturnValueOnce(true);

      render(
        <Recorder
          onRecordingComplete={onRecordingCompleteMock}
          onDiscardRecording={onDiscardRecordingMock}
        />
      );

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且放弃/i })).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /停止录音且放弃/i });
      mockMediaRecorder.state = 'recording';
      await user.click(discardButton);

      // 触发onstop
      await act(async () => {
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop();
        }
      });

      await waitFor(() => {
        expect(onDiscardRecordingMock).toHaveBeenCalled();
      });
    });

    it('取消放弃应该不调用onDiscardRecording', async () => {
      global.confirm.mockReturnValueOnce(false);

      render(
        <Recorder
          onRecordingComplete={onRecordingCompleteMock}
          onDiscardRecording={onDiscardRecordingMock}
        />
      );

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且放弃/i })).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /停止录音且放弃/i });
      await user.click(discardButton);

      expect(onDiscardRecordingMock).not.toHaveBeenCalled();
    });

    it('放弃录音应该不调用onRecordingComplete', async () => {
      global.confirm.mockReturnValueOnce(true);

      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且放弃/i })).toBeInTheDocument();
      });

      const discardButton = screen.getByRole('button', { name: /停止录音且放弃/i });
      mockMediaRecorder.state = 'recording';
      await user.click(discardButton);

      // 触发onstop
      await act(async () => {
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop();
        }
      });

      await waitFor(() => {
        expect(onDiscardRecordingMock).not.toHaveBeenCalled();
      });

      // onRecordingComplete不应该被调用
      expect(onRecordingCompleteMock).not.toHaveBeenCalled();
    });
  });

  describe('暂停和恢复', () => {
    it('点击"暂停"应该暂停录音', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /^暂停$/i });
      mockMediaRecorder.state = 'recording';
      await user.click(pauseButton);

      expect(mockMediaRecorder.pause).toHaveBeenCalled();
    });

    it('暂停后应该显示"录音已暂停"文本', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /^暂停$/i });
      mockMediaRecorder.state = 'recording';
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByText(/录音已暂停/i)).toBeInTheDocument();
      });
    });

    it('暂停后应该显示"继续录音"按钮', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /^暂停$/i });
      mockMediaRecorder.state = 'recording';
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /继续录音/i })).toBeInTheDocument();
      });
    });

    it('点击"继续录音"应该恢复录音', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /^暂停$/i });
      mockMediaRecorder.state = 'recording';
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /继续录音/i })).toBeInTheDocument();
      });

      const resumeButton = screen.getByRole('button', { name: /继续录音/i });
      mockMediaRecorder.state = 'paused';
      await user.click(resumeButton);

      expect(mockMediaRecorder.resume).toHaveBeenCalled();
    });

    it('暂停状态下也可以停止录音', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^暂停$/i })).toBeInTheDocument();
      });

      const pauseButton = screen.getByRole('button', { name: /^暂停$/i });
      mockMediaRecorder.state = 'recording';
      await user.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /停止录音且继续/i })).toBeInTheDocument();
      });

      const stopButtons = screen.getAllByRole('button', { name: /停止录音且继续/i });
      const stopButton = stopButtons[0];
      mockMediaRecorder.state = 'paused';
      await user.click(stopButton);

      expect(mockMediaRecorder.stop).toHaveBeenCalled();
    });
  });

  describe('进度显示', () => {
    it('录音时应该显示进度条', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} maxDurationSec={60} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/已录制.*s/i)).toBeInTheDocument();
      });
    });

    it('应该显示剩余时间', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} maxDurationSec={60} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/剩余.*s/i)).toBeInTheDocument();
      });
    });

    it('应该接受自定义最大时长', () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} maxDurationSec={120} />);

      expect(screen.getByRole('button', { name: /开始录音/i })).toBeInTheDocument();
    });
  });

  describe('电平显示', () => {
    it('录音时应该显示平均电平', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      // 等待音频分析开始
      await new Promise(resolve => setTimeout(resolve, 100));

      await waitFor(() => {
        expect(screen.getByText(/平均电平/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('录音时应该显示峰值', async () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      // 等待音频分析开始
      await new Promise(resolve => setTimeout(resolve, 100));

      await waitFor(() => {
        expect(screen.getByText(/峰值/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('外部控制', () => {
    it('isRecording prop为true时应该禁用开始按钮', () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} isRecording={true} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      expect(startButton).toBeDisabled();
    });

    it('isRecording prop为false时开始按钮应该可用', () => {
      render(<Recorder onRecordingComplete={onRecordingCompleteMock} isRecording={false} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      expect(startButton).not.toBeDisabled();
    });
  });

  describe('清理资源', () => {
    it('停止录音应该停止所有音轨', async () => {
      const { container } = render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      // 等待MediaRecorder启动
      await waitFor(() => {
        expect(mockMediaRecorder.start).toHaveBeenCalled();
      });

      // 使用getAllByRole避免重复元素
      const stopButtons = screen.getAllByRole('button', { name: /停止录音且继续/i });
      const stopButton = stopButtons[stopButtons.length - 1];
      mockMediaRecorder.state = 'recording';
      await user.click(stopButton);

      // 先触发 ondataavailable，然后触发 onstop
      await act(async () => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({
            data: new Blob(['test'], { type: 'audio/webm' })
          });
        }
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop();
        }
      });

      await waitFor(() => {
        // 验证保存的track引用的stop方法被调用
        expect(mockMediaStream._mockTrack.stop).toHaveBeenCalled();
      });
    });

    it('停止录音应该关闭AudioContext', async () => {
      const { container } = render(<Recorder onRecordingComplete={onRecordingCompleteMock} />);

      const startButton = screen.getByRole('button', { name: /开始录音/i });
      await user.click(startButton);

      // 等待MediaRecorder启动
      await waitFor(() => {
        expect(mockMediaRecorder.start).toHaveBeenCalled();
      });

      // 使用getAllByRole避免重复元素
      const stopButtons = screen.getAllByRole('button', { name: /停止录音且继续/i });
      const stopButton = stopButtons[stopButtons.length - 1];
      mockMediaRecorder.state = 'recording';
      await user.click(stopButton);

      // 先触发 ondataavailable，然后触发 onstop
      await act(async () => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({
            data: new Blob(['test'], { type: 'audio/webm' })
          });
        }
        if (mockMediaRecorder.onstop) {
          await mockMediaRecorder.onstop();
        }
      });

      await waitFor(() => {
        expect(mockAudioContext.close).toHaveBeenCalled();
      });
    });
  });
});
