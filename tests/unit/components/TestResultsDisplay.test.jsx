/**
 * 单元测试: src/components/TestResultsDisplay.jsx
 * 测试测试结果显示组件的渲染和数据展示
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestResultsDisplay from '../../../src/components/TestResultsDisplay.jsx';

// Mock resolveAttachmentUrl
vi.mock('../../../src/utils/attachments.js', () => ({
  resolveAttachmentUrl: vi.fn((url) => {
    // 模拟异步解析URL
    return Promise.resolve(url ? `resolved-${url}` : null);
  }),
}));

const { resolveAttachmentUrl } = await import('../../../src/utils/attachments.js');

describe('TestResultsDisplay 组件测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('无结果时显示错误提示', () => {
      render(<TestResultsDisplay results={null} />);
      expect(screen.getByText('无法加载结果。')).toBeInTheDocument();
    });

    it('无metrics时显示错误提示', () => {
      render(<TestResultsDisplay results={{}} />);
      expect(screen.getByText('无法加载结果。')).toBeInTheDocument();
    });

    it('文件加载时指标仍立即显示', () => {
      resolveAttachmentUrl.mockReturnValueOnce(new Promise(()=>{}));
      render(<TestResultsDisplay results={{metrics:{spontaneous:{f0_mean:180}},charts:{test:'key'}}}/>);
      expect(screen.getByText(/180.0/)).toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('正在获取');
    });

    it('加载完成后显示报告标题', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('您的嗓音分析报告')).toBeInTheDocument();
      });
    });
  });

  describe('主要声学指标', () => {
    it('正确显示所有主要指标', async () => {
      const results = {
        metrics: {
          spontaneous: {
            f0_mean: 220.5,
          },
          sustained: {
            mpt_s: 15.2,
            hnr_db: 12.5,
            jitter_local_percent: 0.45,
            shimmer_local_percent: 2.3,
          },
          vrp: {
            f0_min: 180,
            f0_max: 350,
            spl_min: 55.5,
            spl_max: 85.2,
          },
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('220.5')).toBeInTheDocument(); // f0_mean
        expect(screen.getByText('15.2')).toBeInTheDocument(); // mpt_s
        expect(screen.getByText('12.5')).toBeInTheDocument(); // hnr_db
        expect(screen.getByText('0.45')).toBeInTheDocument(); // jitter
        expect(screen.getByText('2.30')).toBeInTheDocument(); // shimmer
        expect(screen.getByText('180')).toBeInTheDocument(); // f0_min
        expect(screen.getByText('350')).toBeInTheDocument(); // f0_max
        expect(screen.getByText('55.5')).toBeInTheDocument(); // spl_min
        expect(screen.getByText('85.2')).toBeInTheDocument(); // spl_max
      });
    });

    it('指标缺失时显示N/A', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });

    it('正确显示单位', async () => {
      const results = {
        metrics: {
          spontaneous: { f0_mean: 220 },
          sustained: { mpt_s: 15 },
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('Hz')).toBeInTheDocument();
        expect(screen.getByText('s')).toBeInTheDocument();
      });
    });
  });

  describe('共振峰分析', () => {
    it('有共振峰数据时显示共振峰部分', async () => {
      const results = {
        metrics: {
          sustained: {
            formants_low: {
              F1: 500,
              F2: 1500,
              F3: 2500,
              spl_dbA_est: 60.5,
            },
            formants_high: {
              F1: 800,
              F2: 2000,
              F3: 3500,
              spl_dbA_est: 75.2,
            },
          },
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('共振峰分析')).toBeInTheDocument();
        expect(screen.getByText(/低音量发声/)).toBeInTheDocument();
        expect(screen.getByText(/高音量发声/)).toBeInTheDocument();
        expect(screen.getByText(/F1: 500 Hz/)).toBeInTheDocument();
        expect(screen.getByText(/F2: 1500 Hz/)).toBeInTheDocument();
        expect(screen.getByText(/F3: 2500 Hz/)).toBeInTheDocument();
        expect(screen.getByText(/SPL: 60.5 dB/)).toBeInTheDocument();
      });
    });

    it('只有formants_low时只显示低音量发声', async () => {
      const results = {
        metrics: {
          sustained: {
            formants_low: {
              F1: 500,
              F2: 1500,
              F3: 2500,
              spl_dbA_est: 60.5,
            },
          },
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText(/低音量发声/)).toBeInTheDocument();
        expect(screen.queryByText(/高音量发声/)).not.toBeInTheDocument();
      });
    });

    it('无共振峰数据时不显示该部分', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.queryByText('共振峰分析')).not.toBeInTheDocument();
      });
    });
  });

  describe('主观评估量表', () => {
    it('有问卷数据时显示量表部分', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
          questionnaires: {
            RBH: { R: 1, B: 2, H: 1 },
            'OVHS-9 Total': 18,
            'TVQ-G Total': 24,
            'TVQ-G Percent': '50%',
          },
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('主观评估量表')).toBeInTheDocument();
        expect(screen.getByText(/R:1 B:2 H:1/)).toBeInTheDocument();
        expect(screen.getByText('18')).toBeInTheDocument();
        expect(screen.getByText(/24 \/ 48 \(50%\)/)).toBeInTheDocument();
      });
    });

    it('无问卷数据时不显示该部分', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
          questionnaires: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.queryByText('主观评估量表')).not.toBeInTheDocument();
      });
    });

    it('部分问卷数据缺失时仍显示存在的问卷', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
          questionnaires: {
            RBH: { R: 1, B: 2, H: 1 },
          },
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('主观评估量表')).toBeInTheDocument();
        expect(screen.getByText(/R:1 B:2 H:1/)).toBeInTheDocument();
        expect(screen.queryByText('OVHS-9')).not.toBeInTheDocument();
      });
    });
  });

  describe('图表预览', () => {
    it('有图表时显示图表部分', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {
          'f0_contour': 'https://example.com/chart1.png',
          'vrp_chart': 'https://example.com/chart2.png',
        },
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('图表预览')).toBeInTheDocument();
        expect(screen.getByAltText('图表: f0_contour')).toBeInTheDocument();
        expect(screen.getByAltText('图表: vrp_chart')).toBeInTheDocument();
      });
    });

    it('图表URL正确解析', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {
          'test_chart': 'original-url.png',
        },
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        const img = screen.getByAltText('图表: test_chart');
        expect(img).toHaveAttribute('src', 'resolved-original-url.png');
      });
    });

    it('无图表时不显示该部分', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.queryByText('图表预览')).not.toBeInTheDocument();
      });
    });
  });

  describe('PDF报告下载', () => {
    it('有PDF时显示下载按钮', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
        reportPdf: 'report.pdf',
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        const downloadLink = screen.getByText('下载完整PDF报告');
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink).toHaveAttribute('href', 'resolved-report.pdf');
        expect(downloadLink).not.toHaveClass('cursor-not-allowed');
      });
    });

    it('无PDF时显示禁用状态', () => {
      render(<TestResultsDisplay results={{metrics:{},charts:{}}}/>);
      expect(screen.getByText('暂无PDF报告。')).toBeInTheDocument();expect(screen.queryByRole('link',{name:'下载完整PDF报告'})).not.toBeInTheDocument();
    });

    it('无PDF时点击不触发下载', () => {
      render(<TestResultsDisplay results={{metrics:{},charts:{}}}/>);
      expect(screen.getByText('暂无PDF报告。')).toBeInTheDocument();expect(screen.queryByRole('link',{name:'下载完整PDF报告'})).not.toBeInTheDocument();
    });
  });

  describe('URL解析错误处理', () => {
    it('URL解析失败时显示局部错误并允许重试', async () => {
      resolveAttachmentUrl.mockRejectedValueOnce(new Error('failed'));
      render(<TestResultsDisplay results={{metrics:{},charts:{test:'key'}}}/>);
      expect(await screen.findByRole('alert')).toHaveTextContent('无法打开');expect(screen.queryByRole('img')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button',{name:'重试文件链接'}));expect(await screen.findByRole('img')).toHaveAttribute('src','resolved-key');
    });

    it('resolveAttachmentUrl返回null时显示局部错误并允许重试', async () => {
      resolveAttachmentUrl.mockResolvedValueOnce(null);
      render(<TestResultsDisplay results={{metrics:{},charts:{test:'key'}}}/>);
      expect(await screen.findByRole('alert')).toHaveTextContent('无法打开');expect(screen.queryByRole('img')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button',{name:'重试文件链接'}));expect(await screen.findByRole('img')).toHaveAttribute('src','resolved-key');
    });
  });

  describe('MetricCard子组件', () => {
    it('显示标题和值', async () => {
      const results = {
        metrics: {
          sustained: { mpt_s: 15.5 },
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('最长发声时 (MPT)')).toBeInTheDocument();
        expect(screen.getByText('15.5')).toBeInTheDocument();
      });
    });

    it('值为null时不显示单位', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        // 获取所有N/A文本元素
        const naElements = screen.getAllByText(/^N\/A$/);
        expect(naElements.length).toBeGreaterThan(0);
        
        // 检查第一个N/A元素的父元素(应该是<p>标签)
        const firstNA = naElements[0];
        const p = firstNA.closest('p');
        
        // 确认<p>标签内没有单位<span>
        const spans = p?.querySelectorAll('span');
        expect(spans).toHaveLength(0);
      });
    });
  });

  describe('边界情况', () => {
    it('处理空的metrics对象', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('您的嗓音分析报告')).toBeInTheDocument();
      });
    });

    it('处理部分数据缺失', async () => {
      const results = {
        metrics: {
          sustained: { mpt_s: 15 },
          // spontaneous缺失
          vrp: { f0_min: 180 },
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('15.0')).toBeInTheDocument();
        expect(screen.getByText('180')).toBeInTheDocument();
      });
    });

    it('results变化时重新加载', async () => {
      const results1 = {
        metrics: {
          sustained: { mpt_s: 15 },
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      const { rerender } = render(<TestResultsDisplay results={results1} />);
      
      await waitFor(() => {
        expect(screen.getByText('15.0')).toBeInTheDocument();
      });

      const results2 = {
        metrics: {
          sustained: { mpt_s: 20 },
          spontaneous: {},
          vrp: {},
        },
        charts: {},
      };

      rerender(<TestResultsDisplay results={results2} />);
      
      await waitFor(() => {
        expect(screen.getByText('20.0')).toBeInTheDocument();
      });
    });

    it('处理非常长的问卷名称', async () => {
      const results = {
        metrics: {
          sustained: {},
          spontaneous: {},
          vrp: {},
          questionnaires: {
            'Very Long Questionnaire Name That Might Break Layout': 42,
          },
        },
        charts: {},
      };

      render(<TestResultsDisplay results={results} />);
      
      await waitFor(() => {
        expect(screen.getByText('主观评估量表')).toBeInTheDocument();
      });
    });
  });
});
