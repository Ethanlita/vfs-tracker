/**
 * 单元测试: src/components/SurveyTVQG.jsx
 * 测试TVQ-G通用嗓音问卷组件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyTVQG from '../../../src/components/SurveyTVQG.jsx';

describe('SurveyTVQG 组件测试', () => {
  let mockOnChange;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = vi.fn();
  });

  describe('基础渲染', () => {
    it('显示问卷标题', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/TVQ-G 通用嗓音问卷/)).toBeInTheDocument();
    });

    it('显示所有12个问题', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我需要比别人更费力才能把话说清楚/)).toBeInTheDocument();
      expect(screen.getByText(/长时间说话后，我不得不暂停或喝水才能继续/)).toBeInTheDocument();
      expect(screen.getByText(/说话后，我的嗓音会变得嘶哑或沙哑/)).toBeInTheDocument();
      expect(screen.getByText(/在打电话或线上会议中，我常被要求重复/)).toBeInTheDocument();
      expect(screen.getByText(/我因为嗓音而减少社交或公开发言/)).toBeInTheDocument();
      expect(screen.getByText(/我担心自己的声音让别人误以为我生病或情绪不好/)).toBeInTheDocument();
      expect(screen.getByText(/嗓音问题影响了我的自信心/)).toBeInTheDocument();
      expect(screen.getByText(/我在需要提高音量（如户外）时感到吃力/)).toBeInTheDocument();
      expect(screen.getByText(/我经常清嗓或咳嗽以获得更清晰的声音/)).toBeInTheDocument();
      expect(screen.getByText(/早晨或久不说话后，声音明显更差/)).toBeInTheDocument();
      expect(screen.getByText(/我说话时出现破音、断裂或不稳定/)).toBeInTheDocument();
      expect(screen.getByText(/即使休息后，我的声音也很难完全恢复/)).toBeInTheDocument();
    });

    it('每个问题显示5个选项 (0-4分)', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 检查第一个问题的5个选项
      expect(screen.getAllByLabelText(/0 \(从不\)/)).toHaveLength(12);
      expect(screen.getAllByLabelText(/1 \(很少\)/)).toHaveLength(12);
      expect(screen.getAllByLabelText(/2 \(有时\)/)).toHaveLength(12);
      expect(screen.getAllByLabelText(/3 \(经常\)/)).toHaveLength(12);
      expect(screen.getAllByLabelText(/4 \(总是\)/)).toHaveLength(12);
    });

    it('问题使用编号显示', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/^1\./)).toBeInTheDocument();
      expect(screen.getByText(/^12\./)).toBeInTheDocument();
    });
  });

  describe('单选功能', () => {
    it('点击选项触发onChange', async () => {
      const user = userEvent.setup();
      const values = Array(12).fill(null);
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 点击第一个问题的第一个选项
      const firstOption = screen.getAllByLabelText(/0 \(从不\)/)[0];
      await user.click(firstOption);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[0]).toBe(0);
      expect(newValues.slice(1)).toEqual(Array(11).fill(null));
    });

    it('选中的选项显示选中状态', () => {
      const values = Array(12).fill(null);
      values[0] = 2; // 第一个问题选"有时"
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const selectedOption = screen.getAllByLabelText(/2 \(有时\)/)[0];
      expect(selectedOption).toBeChecked();
    });

    it('可以修改已选择的选项', async () => {
      const user = userEvent.setup();
      const values = Array(12).fill(null);
      values[0] = 2;
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 点击第一个问题的另一个选项
      const newOption = screen.getAllByLabelText(/4 \(总是\)/)[0];
      await user.click(newOption);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[0]).toBe(4);
    });

    it('每个问题独立选择', async () => {
      const user = userEvent.setup();
      const values = Array(12).fill(null);
      
      const { rerender } = render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 选择第一个问题
      const firstQuestion = screen.getAllByLabelText(/1 \(很少\)/)[0];
      await user.click(firstQuestion);

      // 模拟values更新
      const values2 = [...values];
      values2[0] = 1;
      rerender(<SurveyTVQG values={values2} onChange={mockOnChange} />);

      // 选择第二个问题
      const secondQuestion = screen.getAllByLabelText(/3 \(经常\)/)[1];
      await user.click(secondQuestion);

      expect(mockOnChange).toHaveBeenCalledTimes(2);
      const latestCall = mockOnChange.mock.calls[1][0];
      expect(latestCall[0]).toBe(1); // 第一个问题保持
      expect(latestCall[1]).toBe(3); // 第二个问题更新
    });
  });

  describe('分值范围', () => {
    it('支持所有5个分值 (0-4)', async () => {
      const user = userEvent.setup();
      const values = Array(12).fill(null);
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 测试所有分值
      for (let score = 0; score <= 4; score++) {
        const option = screen.getAllByLabelText(new RegExp(`${score} \\(`))[0];
        await user.click(option);
        
        const newValues = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(newValues[0]).toBe(score);
      }

      expect(mockOnChange).toHaveBeenCalledTimes(5);
    });

    it('values数组长度为12', async () => {
      const user = userEvent.setup();
      const values = Array(12).fill(null);
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const option = screen.getAllByLabelText(/2 \(有时\)/)[5]; // 第6个问题
      await user.click(option);

      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues).toHaveLength(12);
      expect(newValues[5]).toBe(2);
    });
  });

  describe('样式', () => {
    it('问卷容器使用max-w-2xl居中', () => {
      const values = Array(12).fill(null);
      const { container } = render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('max-w-2xl', 'mx-auto');
    });

    it('问题卡片有边框和阴影', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 检查第一个问题卡片
      const firstCard = screen.getByText(/我需要比别人更费力/).closest('.border');
      expect(firstCard).toHaveClass('border', 'rounded-lg', 'shadow-sm', 'bg-gray-50');
    });

    it('选项标签有hover效果', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const firstLabel = screen.getAllByLabelText(/0 \(从不\)/)[0].closest('label');
      expect(firstLabel).toHaveClass('hover:bg-purple-100', 'cursor-pointer');
    });

    it('单选按钮使用紫色主题', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const firstRadio = screen.getAllByLabelText(/0 \(从不\)/)[0];
      expect(firstRadio).toHaveClass('text-purple-600', 'focus:ring-purple-500');
    });
  });

  describe('边界情况', () => {
    it('处理空values数组', () => {
      const values = [];
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/TVQ-G 通用嗓音问卷/)).toBeInTheDocument();
    });

    it('处理部分填写的values', () => {
      const values = [0, 1, null, 3, null, null, 2, null, null, null, 4, null];
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getAllByLabelText(/0 \(从不\)/)[0]).toBeChecked();
      expect(screen.getAllByLabelText(/1 \(很少\)/)[1]).toBeChecked();
      expect(screen.getAllByLabelText(/3 \(经常\)/)[3]).toBeChecked();
      expect(screen.getAllByLabelText(/2 \(有时\)/)[6]).toBeChecked();
      expect(screen.getAllByLabelText(/4 \(总是\)/)[10]).toBeChecked();
    });

    it('处理全部填写的values', () => {
      const values = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1];
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 检查所有问题都有选中项
      values.forEach((value, index) => {
        const label = SCALE.find(s => s.value === value).label;
        const radio = screen.getAllByLabelText(new RegExp(label))[index];
        expect(radio).toBeChecked();
      });
    });

    const SCALE = [
      { value: 0, label: '0 \\(从不\\)' },
      { value: 1, label: '1 \\(很少\\)' },
      { value: 2, label: '2 \\(有时\\)' },
      { value: 3, label: '3 \\(经常\\)' },
      { value: 4, label: '4 \\(总是\\)' },
    ];

    it('所有问题默认未选中状态', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 所有单选按钮都不应该被选中
      const allRadios = screen.getAllByRole('radio');
      allRadios.forEach(radio => {
        expect(radio).not.toBeChecked();
      });
    });

    it('values长度不足12时正常显示', async () => {
      const user = userEvent.setup();
      const values = [0, 1, 2]; // 只有3个值
      
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 前3个问题应该有选中状态
      expect(screen.getAllByLabelText(/0 \(从不\)/)[0]).toBeChecked();
      expect(screen.getAllByLabelText(/1 \(很少\)/)[1]).toBeChecked();
      expect(screen.getAllByLabelText(/2 \(有时\)/)[2]).toBeChecked();

      // 点击第4个问题
      const fourthOption = screen.getAllByLabelText(/3 \(经常\)/)[3];
      await user.click(fourthOption);

      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[3]).toBe(3);
    });

    it('values超过12个只使用前12个', () => {
      const values = Array(20).fill(2); // 20个值
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 应该只显示12个问题
      const questions = screen.getAllByText(/^\d+\./);
      expect(questions).toHaveLength(12);
    });
  });

  describe('可访问性', () => {
    it('每个问题的单选按钮有唯一name属性', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 检查每个问题的name属性
      for (let i = 0; i < 12; i++) {
        const radios = screen.getAllByRole('radio', { name: new RegExp(`0 \\(从不\\)`) })[i];
        expect(radios).toHaveAttribute('name', `tvqg-${i}`);
      }
    }, 30000); // coverage模式下需要更长超时 (v8插桩导致5-10倍慢)

    it('单选按钮类型为radio', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      const allRadios = screen.getAllByRole('radio');
      expect(allRadios).toHaveLength(60); // 12问题 × 5选项
      
      allRadios.forEach(radio => {
        expect(radio).toHaveAttribute('type', 'radio');
      });
    });

    it('标签和输入正确关联', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      // 点击标签文字应该选中对应的单选按钮
      const firstLabel = screen.getAllByText(/0 \(从不\)/)[0];
      const firstRadio = screen.getAllByLabelText(/0 \(从不\)/)[0];
      
      // label包含radio,点击label会选中radio
      expect(firstLabel.closest('label')).toContainElement(firstRadio);
    });
  });

  describe('问卷内容', () => {
    it('包含沟通与负担类问题 (C1-C4)', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我需要比别人更费力才能把话说清楚/)).toBeInTheDocument();
      expect(screen.getByText(/长时间说话后，我不得不暂停或喝水才能继续/)).toBeInTheDocument();
      expect(screen.getByText(/说话后，我的嗓音会变得嘶哑或沙哑/)).toBeInTheDocument();
      expect(screen.getByText(/在打电话或线上会议中，我常被要求重复/)).toBeInTheDocument();
    });

    it('包含社交与情绪类问题 (S1-S4)', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我因为嗓音而减少社交或公开发言/)).toBeInTheDocument();
      expect(screen.getByText(/我担心自己的声音让别人误以为我生病或情绪不好/)).toBeInTheDocument();
      expect(screen.getByText(/嗓音问题影响了我的自信心/)).toBeInTheDocument();
      expect(screen.getByText(/我在需要提高音量（如户外）时感到吃力/)).toBeInTheDocument();
    });

    it('包含症状与自我管理类问题 (P1-P4)', () => {
      const values = Array(12).fill(null);
      render(<SurveyTVQG values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我经常清嗓或咳嗽以获得更清晰的声音/)).toBeInTheDocument();
      expect(screen.getByText(/早晨或久不说话后，声音明显更差/)).toBeInTheDocument();
      expect(screen.getByText(/我说话时出现破音、断裂或不稳定/)).toBeInTheDocument();
      expect(screen.getByText(/即使休息后，我的声音也很难完全恢复/)).toBeInTheDocument();
    });
  });
});
