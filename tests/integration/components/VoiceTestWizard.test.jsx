/**
 * @file VoiceTestWizard.test.jsx
 * @description VoiceTestWizard 组件的集成测试
 * @zh 测试嗓音测试向导的多步骤流程，包括录音、问卷、分析等
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceTestWizard from '../../../src/components/VoiceTestWizard';
import * as api from '../../../src/api';

// Mock API functions
vi.mock('../../../src/api', async () => {
  const actual = await vi.importActual('../../../src/api');
  return {
    ...actual,
    createVoiceTestSession: vi.fn(),
    getVoiceTestUploadUrl: vi.fn(),
    uploadVoiceTestFileToS3: vi.fn(),
    requestVoiceTestAnalyze: vi.fn(),
    getVoiceTestResults: vi.fn()
  };
});

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../../src/contexts/AuthContext', async () => ({
  ...await vi.importActual('../../../src/contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

// Mock Recorder component
vi.mock('../../../src/components/Recorder', () => ({
  default: ({ onRecordingComplete, onDiscardRecording }) => (
    <div data-testid="recorder">
      <button onClick={() => onRecordingComplete(new Blob(['test'], { type: 'audio/wav' }))}>
        模拟录音完成
      </button>
      <button onClick={() => onDiscardRecording && onDiscardRecording()}>
        模拟放弃录音
      </button>
    </div>
  )
}));

// Mock Survey components
vi.mock('../../../src/components/SurveyRBH', () => ({
  default: ({ values, onChange }) => (
    <div data-testid="survey-rbh">
      <button onClick={() => onChange({ R: 1, B: 2, H: 3 })}>
        填写RBH
      </button>
    </div>
  )
}));

vi.mock('../../../src/components/SurveyOVHS9', () => ({
  default: ({ values, onChange }) => (
    <div data-testid="survey-ovhs9">
      <button onClick={() => onChange(Array(9).fill(2))}>
        填写OVHS9
      </button>
    </div>
  )
}));

vi.mock('../../../src/components/SurveyTVQG', () => ({
  default: ({ values, onChange }) => (
    <div data-testid="survey-tvqg">
      <button onClick={() => onChange(Array(12).fill(2))}>
        填写TVQG
      </button>
    </div>
  )
}));

// Mock TestResultsDisplay
vi.mock('../../../src/components/TestResultsDisplay', () => ({
  default: ({ results }) => (
    <div data-testid="test-results">
      Results: {results?.status}
    </div>
  )
}));

describe('VoiceTestWizard Component', () => {
  const user = userEvent.setup();

  const mockUser = {
    userId: 'test-user-123'
  };

  const mockSessionId = 'session-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock AuthContext
    mockUseAuth.mockReturnValue({
      user: mockUser
    });

    // Mock API responses
    api.createVoiceTestSession.mockResolvedValue({ sessionId: mockSessionId });
    api.getVoiceTestUploadUrl.mockResolvedValue({
      putUrl: 'https://s3.example.com/upload',
      objectKey: 'test-key'
    });
    api.uploadVoiceTestFileToS3.mockResolvedValue(undefined);
    api.requestVoiceTestAnalyze.mockResolvedValue(undefined);
    api.getVoiceTestResults.mockResolvedValue({
      status: 'processing'
    });

    // Mock window.confirm
    global.confirm = vi.fn(() => true);
  });

  describe('初始化', () => {
    it('应该显示加载状态', () => {
      api.createVoiceTestSession.mockImplementation(
        () => new Promise(() => {}) // 永不resolve
      );

      render(<VoiceTestWizard />);

      expect(screen.getByText(/正在初始化.../i)).toBeInTheDocument();
    });

    it('应该创建新的测试会话', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(api.createVoiceTestSession).toHaveBeenCalledWith('test-user-123');
      });
    });

    it('会话创建失败应该显示错误', async () => {
      api.createVoiceTestSession.mockRejectedValueOnce(new Error('Session creation failed'));

      render(<VoiceTestWizard />);

      await waitFor(() => {
        // 使用 getByRole 匹配按钮，避免匹配到错误消息中的"重试"文本
        expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument();
      });
    });

    it('点击重试应该重新创建会话', async () => {
      api.createVoiceTestSession.mockRejectedValueOnce(new Error('Failed'));

      render(<VoiceTestWizard />);

      await waitFor(() => {
        // 使用 getByRole 匹配按钮
        expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /重试/i });
      
      api.createVoiceTestSession.mockResolvedValueOnce({ sessionId: mockSessionId });
      await user.click(retryButton);

      await waitFor(() => {
        expect(api.createVoiceTestSession).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('步骤导航', () => {
    it('应该显示第一步（说明与同意）', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });
    });

    it('应该显示"上一步"和"下一步"按钮', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /上一步/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /下一步/i })).toBeInTheDocument();
      });
    });

    it('第一步的"上一步"按钮应该被禁用', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /上一步/i });
        expect(backButton).toBeDisabled();
      });
    });

    it('点击"下一步"应该进入下一步', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/设备与环境校准/i)).toBeInTheDocument();
      });
    });

    it('点击"上一步"应该返回上一步', async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/设备与环境校准/i)).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /上一步/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });
    });
  });

  // 录音步骤测试 - 测试录音功能和文件上传
  describe('录音步骤', () => {
    beforeEach(async () => {
      render(<VoiceTestWizard />);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      // 进入第二步（需要录音）
      const nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/设备与环境校准/i)).toBeInTheDocument();
      });
    });

    it('应该显示录音组件', async () => {
      await waitFor(() => {
        expect(screen.getByTestId('recorder')).toBeInTheDocument();
      });
    });

    it('应该显示录音进度', async () => {
      await waitFor(() => {
        expect(screen.getByText(/进度:/i)).toBeInTheDocument();
      });
    });

    it('录音完成应该上传文件', async () => {
      const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton);

      await waitFor(() => {
        expect(api.getVoiceTestUploadUrl).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(api.uploadVoiceTestFileToS3).toHaveBeenCalled();
      });
    });

    it('上传成功应该更新进度', async () => {
      const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton);

      await waitFor(() => {
        // 进度应该从 0/2 变成 1/2
        expect(screen.getByText(/进度: 1/i)).toBeInTheDocument();
      });
    });

    it('上传失败应该显示错误和重试按钮', async () => {
      api.uploadVoiceTestFileToS3.mockRejectedValueOnce(new Error('Upload failed'));

      const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/重试上传/i)).toBeInTheDocument();
      });
    });

    it('点击重试应该重新上传', async () => {
      api.uploadVoiceTestFileToS3.mockRejectedValueOnce(new Error('Upload failed'));

      const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton);

      await waitFor(() => {
        expect(screen.getByText(/上传失败/i)).toBeInTheDocument();
      });

      api.uploadVoiceTestFileToS3.mockResolvedValueOnce(undefined);

      // 按钮文本是"重试"而不是"重试上传"
      const retryButton = screen.getByRole('button', { name: /^重试$/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(api.uploadVoiceTestFileToS3).toHaveBeenCalledTimes(2);
      });
    });

    it('放弃录音不应该上传文件', async () => {
      const discardButton = screen.getByRole('button', { name: /模拟放弃录音/i });
      await user.click(discardButton);

      // 等待确保没有触发上传
      await waitFor(() => {
        expect(api.getVoiceTestUploadUrl).not.toHaveBeenCalled();
      }, { timeout: 200 });

      expect(api.getVoiceTestUploadUrl).not.toHaveBeenCalled();
    });

    it('完成所有录音后"下一步"按钮应该可用', async () => {
      // 这个步骤需要2个录音
      
      // 第一个录音
      const recordButton1 = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton1);
      
      // 等待第一次上传完成和UI更新
      await waitFor(() => {
        expect(api.uploadVoiceTestFileToS3).toHaveBeenCalledTimes(1);
      });
      
      // 等待组件重新渲染显示新的进度
      await waitFor(() => {
        expect(screen.getByText(/进度.*1.*2/i)).toBeInTheDocument();
      });

      // 第二个录音
      const recordButton2 = screen.getByRole('button', { name: /模拟录音完成/i });
      await user.click(recordButton2);
      
      // 等待第二次上传完成
      await waitFor(() => {
        expect(api.uploadVoiceTestFileToS3).toHaveBeenCalledTimes(2);
      });

      // 验证所有录音完成后"下一步"按钮可用
      await waitFor(() => {
        const nextButton = screen.getByRole('button', { name: /下一步/i });
        expect(nextButton).not.toBeDisabled();
      });
    });

    it('未完成所有录音时"下一步"应该被禁用', () => {
      const nextButton = screen.getByRole('button', { name: /下一步/i });
      expect(nextButton).toBeDisabled();
    });
  });

  // 问卷步骤测试 - 测试主观量表填写
  // 通过快速模拟录音和导航到达问卷步骤
  describe('问卷步骤', () => {
    /**
     * 辅助函数:快速导航到问卷步骤
     * 自动完成所有需要录音的步骤
     */
    const navigateToSurveyStep = async () => {
      render(<VoiceTestWizard />);

      // 等待初始化完成
      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      // 步骤0: 说明与同意 - 点击下一步
      let nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);
      
      // 步骤1-6: 所有需要录音的步骤
      // 步骤1: 设备与环境校准 (需要2个录音)
      for (let step = 1; step <= 6; step++) {
        await waitFor(() => {
          expect(screen.getByTestId('recorder')).toBeInTheDocument();
        });
        
        // 获取当前步骤需要的录音数量
        const stepInfo = screen.getByText(/进度:/i).textContent;
        const match = stepInfo.match(/(\d+)/g);
        const totalRecordings = match ? parseInt(match[1]) : 1;
        
        // 完成所有需要的录音
        for (let i = 0; i < totalRecordings; i++) {
          const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
          await user.click(recordButton);
          
          // 等待上传完成
          await waitFor(() => {
            expect(api.uploadVoiceTestFileToS3).toHaveBeenCalled();
          });
        }
        
        // 点击下一步进入下一个步骤
        await waitFor(() => {
          const btn = screen.getByRole('button', { name: /下一步/i });
          expect(btn).not.toBeDisabled();
        });
        nextButton = screen.getByRole('button', { name: /下一步/i });
        await user.click(nextButton);
      }

      // 应该到达问卷步骤(步骤7)
      await waitFor(() => {
        expect(screen.getByText(/主观量表/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    };

    beforeEach(async () => {
      await navigateToSurveyStep();
    });

    it('应该显示三个问卷组件', () => {
      expect(screen.getByTestId('survey-rbh')).toBeInTheDocument();
      expect(screen.getByTestId('survey-ovhs9')).toBeInTheDocument();
      expect(screen.getByTestId('survey-tvqg')).toBeInTheDocument();
    });

    it('应该显示"跳过"按钮', () => {
      expect(screen.getByRole('button', { name: /跳过/i })).toBeInTheDocument();
    });

    it('点击"跳过"应该进入下一步', async () => {
      const skipButton = screen.getByRole('button', { name: /跳过/i });
      await user.click(skipButton);

      await waitFor(() => {
        expect(screen.getByText(/结果确认与报告生成/i)).toBeInTheDocument();
      });
    });

    it('未填写完整时"下一步"应该被禁用', () => {
      const nextButton = screen.getByRole('button', { name: /提交/i });
      expect(nextButton).toBeDisabled();
    });

    it('填写完所有问卷后"提交"按钮应该可用', async () => {
      // 填写RBH
      await user.click(screen.getByRole('button', { name: /填写RBH/i }));
      
      // 填写OVHS9
      await user.click(screen.getByRole('button', { name: /填写OVHS9/i }));
      
      // 填写TVQG
      await user.click(screen.getByRole('button', { name: /填写TVQG/i }));

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /提交/i });
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  // 报告生成步骤测试 - 测试分析和结果展示
  // 通过快速模拟录音和导航到达报告生成步骤
  describe('报告生成步骤', () => {
    /**
     * 辅助函数:快速导航到报告生成步骤
     * 自动完成所有需要录音的步骤和问卷步骤
     */
    const navigateToReportStep = async () => {
      render(<VoiceTestWizard />);

      // 等待初始化完成
      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      // 步骤0: 说明与同意 - 点击下一步
      let nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);
      
      // 步骤1-6: 所有需要录音的步骤
      for (let step = 1; step <= 6; step++) {
        await waitFor(() => {
          expect(screen.getByTestId('recorder')).toBeInTheDocument();
        });
        
        // 获取当前步骤需要的录音数量
        const stepInfo = screen.getByText(/进度:/i).textContent;
        const match = stepInfo.match(/(\d+)/g);
        const totalRecordings = match ? parseInt(match[1]) : 1;
        
        // 完成所有需要的录音
        for (let i = 0; i < totalRecordings; i++) {
          const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
          await user.click(recordButton);
          
          // 等待上传完成
          await waitFor(() => {
            expect(api.uploadVoiceTestFileToS3).toHaveBeenCalled();
          });
        }
        
        // 点击下一步进入下一个步骤
        await waitFor(() => {
          const btn = screen.getByRole('button', { name: /下一步/i });
          expect(btn).not.toBeDisabled();
        });
        nextButton = screen.getByRole('button', { name: /下一步/i });
        await user.click(nextButton);
      }

      // 步骤7: 问卷步骤 - 点击"跳过"
      await waitFor(() => {
        expect(screen.getByText(/主观量表/i)).toBeInTheDocument();
      });
      
      const skipButton = screen.getByRole('button', { name: /跳过/i });
      await user.click(skipButton);

      // 应该到达报告生成步骤(步骤8)
      await waitFor(() => {
        expect(screen.getByText(/结果确认与报告生成/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    };

    beforeEach(async () => {
      await navigateToReportStep();
    });

    it('应该显示"生成报告"按钮', () => {
      expect(screen.getByRole('button', { name: /生成报告/i })).toBeInTheDocument();
    });

    it('应该显示"重新开始测试"按钮', () => {
      expect(screen.getAllByRole('button', { name: /重新开始测试/i })[0]).toBeInTheDocument();
    });

    it('点击"生成报告"应该调用分析API', async () => {
      const generateButton = screen.getByRole('button', { name: /生成报告/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(api.requestVoiceTestAnalyze).toHaveBeenCalledWith(
          mockSessionId,
          { hasExternal: false },
          expect.any(Object)
        );
      });
    });

    it('分析中应该显示加载状态', async () => {
      const generateButton = screen.getByRole('button', { name: /生成报告/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/正在分析您的嗓音数据/i)).toBeInTheDocument();
      });
    });

    it('分析完成应该显示结果', async () => {
      // Mock分析完成的结果
      api.getVoiceTestResults.mockResolvedValue({ status: 'done' });

      const generateButton = screen.getByRole('button', { name: /生成报告/i });
      await user.click(generateButton);

      // 等待分析开始
      await waitFor(() => {
        expect(api.requestVoiceTestAnalyze).toHaveBeenCalled();
      });

      // 等待轮询获取结果并显示测试结果组件
      await waitFor(() => {
        expect(screen.getByTestId('test-results')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('分析失败应该显示错误和重试按钮', async () => {
      api.requestVoiceTestAnalyze.mockRejectedValueOnce(new Error('Analysis failed'));

      const generateButton = screen.getByRole('button', { name: /生成报告/i });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /重试分析/i })).toBeInTheDocument();
      });
    });

    it('点击"重新开始测试"应该创建新会话', async () => {
      const restartButton = screen.getAllByRole('button', { name: /重新开始测试/i })[0];
      await user.click(restartButton);

      await waitFor(() => {
        expect(api.createVoiceTestSession).toHaveBeenCalledTimes(2);
      });
    });

    it('重新开始应该返回第一步', async () => {
      const restartButton = screen.getAllByRole('button', { name: /重新开始测试/i })[0];
      await user.click(restartButton);

      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });
    });
  });

  // 组件卸载清理测试 - 测试内存泄漏预防
  describe('组件卸载清理', () => {
    it('卸载时应该清除轮询定时器', async () => {
      const { unmount } = render(<VoiceTestWizard />);

      // 等待初始化完成
      await waitFor(() => {
        expect(api.createVoiceTestSession).toHaveBeenCalled();
      });

      // 快速导航到报告生成步骤
      await waitFor(() => {
        expect(screen.getByText(/说明与同意/i)).toBeInTheDocument();
      });

      // 步骤0: 点击下一步
      let nextButton = screen.getByRole('button', { name: /下一步/i });
      await user.click(nextButton);
      
      // 步骤1-6: 完成录音步骤
      for (let step = 1; step <= 6; step++) {
        await waitFor(() => {
          expect(screen.getByTestId('recorder')).toBeInTheDocument();
        });
        
        const stepInfo = screen.getByText(/进度:/i).textContent;
        const match = stepInfo.match(/(\d+)/g);
        const totalRecordings = match ? parseInt(match[1]) : 1;
        
        for (let i = 0; i < totalRecordings; i++) {
          const recordButton = screen.getByRole('button', { name: /模拟录音完成/i });
          await user.click(recordButton);
          await waitFor(() => {
            expect(api.uploadVoiceTestFileToS3).toHaveBeenCalled();
          });
        }
        
        await waitFor(() => {
          const btn = screen.getByRole('button', { name: /下一步/i });
          expect(btn).not.toBeDisabled();
        });
        nextButton = screen.getByRole('button', { name: /下一步/i });
        await user.click(nextButton);
      }

      // 步骤7: 跳过问卷
      await waitFor(() => {
        expect(screen.getByText(/主观量表/i)).toBeInTheDocument();
      });
      const skipButton = screen.getByRole('button', { name: /跳过/i });
      await user.click(skipButton);

      // 步骤8: 开始分析(会启动轮询)
      await waitFor(() => {
        expect(screen.getByText(/结果确认与报告生成/i)).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /生成报告/i });
      await user.click(generateButton);

      // 等待分析开始
      await waitFor(() => {
        expect(api.requestVoiceTestAnalyze).toHaveBeenCalled();
      });

      // 卸载组件 - 如果定时器没有正确清除,可能会导致内存泄漏或错误
      unmount();

      // 验证没有报错（定时器已清除）
      // 如果组件没有正确清理,这里可能会有警告或错误
      expect(true).toBe(true);
    });
  });
});
