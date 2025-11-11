/**
 * 单元测试: src/components/SurveyOVHS9.jsx
 * 测试OVHS-9嗓音不便指数问卷组件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyOVHS9 from '../../../src/components/SurveyOVHS9.jsx';

describe('SurveyOVHS9 组件测试', () => {
  let mockOnChange;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = vi.fn();
  });

  describe('基础渲染', () => {
    it('显示问卷标题', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/OVHS-9 嗓音不便指数/)).toBeInTheDocument();
    });

    it('显示所有9个问题', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      // 功能 F
      expect(screen.getByText(/我在嘈杂环境下很难让别人清楚地听到我的声音/)).toBeInTheDocument();
      expect(screen.getByText(/我的声音问题影响了工作\/学习或社交效率/)).toBeInTheDocument();
      expect(screen.getByText(/我需要重复或提高音量才能被听清/)).toBeInTheDocument();
      
      // 情感 E
      expect(screen.getByText(/我的声音让我感到尴尬或不自在/)).toBeInTheDocument();
      expect(screen.getByText(/因为声音问题，我感到焦虑或担心被误解/)).toBeInTheDocument();
      expect(screen.getByText(/我因声音问题而回避打电话或当众发言/)).toBeInTheDocument();
      
      // 生理 P
      expect(screen.getByText(/说话一段时间后，我的喉咙会感到疲劳或疼痛/)).toBeInTheDocument();
      expect(screen.getByText(/我需要用很大力气才能发声或保持音量/)).toBeInTheDocument();
      expect(screen.getByText(/早晨或长时间不用声后，我的嗓音更差，需要热嗓才能正常说话/)).toBeInTheDocument();
    });

    it('每个问题显示5个选项 (0-4分)', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getAllByLabelText(/0 \(从不\)/)).toHaveLength(9);
      expect(screen.getAllByLabelText(/1 \(几乎不\)/)).toHaveLength(9);
      expect(screen.getAllByLabelText(/2 \(有时\)/)).toHaveLength(9);
      expect(screen.getAllByLabelText(/3 \(经常\)/)).toHaveLength(9);
      expect(screen.getAllByLabelText(/4 \(总是\)/)).toHaveLength(9);
    });

    it('问题使用编号显示', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/^1\./)).toBeInTheDocument();
      expect(screen.getByText(/^9\./)).toBeInTheDocument();
    });
  });

  describe('单选功能', () => {
    it('点击选项触发onChange', async () => {
      const user = userEvent.setup();
      const values = Array(9).fill(null);
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const firstOption = screen.getAllByLabelText(/0 \(从不\)/)[0];
      await user.click(firstOption);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[0]).toBe(0);
      expect(newValues.slice(1)).toEqual(Array(8).fill(null));
    });

    it('选中的选项显示选中状态', () => {
      const values = Array(9).fill(null);
      values[0] = 3; // 第一个问题选"经常"
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const selectedOption = screen.getAllByLabelText(/3 \(经常\)/)[0];
      expect(selectedOption).toBeChecked();
    });

    it('可以修改已选择的选项', async () => {
      const user = userEvent.setup();
      const values = Array(9).fill(null);
      values[0] = 2;
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const newOption = screen.getAllByLabelText(/4 \(总是\)/)[0];
      await user.click(newOption);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[0]).toBe(4);
    });

    it('每个问题独立选择', async () => {
      const user = userEvent.setup();
      const values = Array(9).fill(null);
      
      const { rerender } = render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      // 选择第一个问题
      const firstQuestion = screen.getAllByLabelText(/1 \(几乎不\)/)[0];
      await user.click(firstQuestion);

      // 模拟values更新
      const values2 = [...values];
      values2[0] = 1;
      rerender(<SurveyOVHS9 values={values2} onChange={mockOnChange} />);

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
      const values = Array(9).fill(null);
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      for (let score = 0; score <= 4; score++) {
        const option = screen.getAllByLabelText(new RegExp(`${score} \\(`))[0];
        await user.click(option);
        
        const newValues = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(newValues[0]).toBe(score);
      }

      expect(mockOnChange).toHaveBeenCalledTimes(5);
    });

    it('values数组长度为9', async () => {
      const user = userEvent.setup();
      const values = Array(9).fill(null);
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const option = screen.getAllByLabelText(/2 \(有时\)/)[4]; // 第5个问题
      await user.click(option);

      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues).toHaveLength(9);
      expect(newValues[4]).toBe(2);
    });
  });

  describe('样式', () => {
    it('问卷容器使用max-w-2xl居中', () => {
      const values = Array(9).fill(null);
      const { container } = render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('max-w-2xl', 'mx-auto');
    });

    it('问题卡片有边框和阴影', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const firstCard = screen.getByText(/我在嘈杂环境下/).closest('.border');
      expect(firstCard).toHaveClass('border', 'rounded-lg', 'shadow-sm', 'bg-gray-50');
    });

    it('选项标签有hover效果', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const firstLabel = screen.getAllByLabelText(/0 \(从不\)/)[0].closest('label');
      expect(firstLabel).toHaveClass('hover:bg-purple-100', 'cursor-pointer');
    });

    it('单选按钮使用紫色主题', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const firstRadio = screen.getAllByLabelText(/0 \(从不\)/)[0];
      expect(firstRadio).toHaveClass('text-purple-600', 'focus:ring-purple-500');
    });
  });

  describe('边界情况', () => {
    it('处理空values数组', () => {
      const values = [];
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/OVHS-9 嗓音不便指数/)).toBeInTheDocument();
    });

    it('处理部分填写的values', () => {
      const values = [0, 1, null, 3, null, null, 2, null, 4];
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getAllByLabelText(/0 \(从不\)/)[0]).toBeChecked();
      expect(screen.getAllByLabelText(/1 \(几乎不\)/)[1]).toBeChecked();
      expect(screen.getAllByLabelText(/3 \(经常\)/)[3]).toBeChecked();
      expect(screen.getAllByLabelText(/2 \(有时\)/)[6]).toBeChecked();
      expect(screen.getAllByLabelText(/4 \(总是\)/)[8]).toBeChecked();
    });

    it('处理全部填写的values', () => {
      const values = [0, 1, 2, 3, 4, 0, 1, 2, 3];
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const SCALE = [
        { value: 0, label: '0 \\(从不\\)' },
        { value: 1, label: '1 \\(几乎不\\)' },
        { value: 2, label: '2 \\(有时\\)' },
        { value: 3, label: '3 \\(经常\\)' },
        { value: 4, label: '4 \\(总是\\)' },
      ];

      values.forEach((value, index) => {
        const label = SCALE.find(s => s.value === value).label;
        const radio = screen.getAllByLabelText(new RegExp(label))[index];
        expect(radio).toBeChecked();
      });
    });

    it('所有问题默认未选中状态', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const allRadios = screen.getAllByRole('radio');
      allRadios.forEach(radio => {
        expect(radio).not.toBeChecked();
      });
    });

    it('values长度不足9时正常显示', async () => {
      const user = userEvent.setup();
      const values = [0, 1, 2]; // 只有3个值
      
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      // 前3个问题应该有选中状态
      expect(screen.getAllByLabelText(/0 \(从不\)/)[0]).toBeChecked();
      expect(screen.getAllByLabelText(/1 \(几乎不\)/)[1]).toBeChecked();
      expect(screen.getAllByLabelText(/2 \(有时\)/)[2]).toBeChecked();

      // 点击第4个问题
      const fourthOption = screen.getAllByLabelText(/3 \(经常\)/)[3];
      await user.click(fourthOption);

      const newValues = mockOnChange.mock.calls[0][0];
      expect(newValues[3]).toBe(3);
    });

    it('values超过9个只使用前9个', () => {
      const values = Array(15).fill(2); // 15个值
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      // 应该只显示9个问题
      const questions = screen.getAllByText(/^\d+\./);
      expect(questions).toHaveLength(9);
    });
  });

  describe('可访问性', () => {
    it('每个问题的单选按钮有唯一name属性', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      for (let i = 0; i < 9; i++) {
        const radios = screen.getAllByRole('radio', { name: new RegExp(`0 \\(从不\\)`) })[i];
        expect(radios).toHaveAttribute('name', `ovhs9-${i}`);
      }
    }, 20000); // 增加超时时间到20秒

    it('单选按钮类型为radio', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const allRadios = screen.getAllByRole('radio');
      expect(allRadios).toHaveLength(45); // 9问题 × 5选项
      
      allRadios.forEach(radio => {
        expect(radio).toHaveAttribute('type', 'radio');
      });
    });

    it('标签和输入正确关联', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const firstLabel = screen.getAllByText(/0 \(从不\)/)[0];
      const firstRadio = screen.getAllByLabelText(/0 \(从不\)/)[0];
      
      expect(firstLabel.closest('label')).toContainElement(firstRadio);
    });
  });

  describe('问卷内容分类', () => {
    it('包含功能类问题 (F1-F3)', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我在嘈杂环境下很难让别人清楚地听到我的声音/)).toBeInTheDocument();
      expect(screen.getByText(/我的声音问题影响了工作\/学习或社交效率/)).toBeInTheDocument();
      expect(screen.getByText(/我需要重复或提高音量才能被听清/)).toBeInTheDocument();
    });

    it('包含情感类问题 (E1-E3)', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/我的声音让我感到尴尬或不自在/)).toBeInTheDocument();
      expect(screen.getByText(/因为声音问题，我感到焦虑或担心被误解/)).toBeInTheDocument();
      expect(screen.getByText(/我因声音问题而回避打电话或当众发言/)).toBeInTheDocument();
    });

    it('包含生理类问题 (P1-P3)', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/说话一段时间后，我的喉咙会感到疲劳或疼痛/)).toBeInTheDocument();
      expect(screen.getByText(/我需要用很大力气才能发声或保持音量/)).toBeInTheDocument();
      expect(screen.getByText(/早晨或长时间不用声后，我的嗓音更差，需要热嗓才能正常说话/)).toBeInTheDocument();
    });

    it('总共3类问题共9个', () => {
      const values = Array(9).fill(null);
      render(<SurveyOVHS9 values={values} onChange={mockOnChange} />);

      const allQuestions = screen.getAllByText(/^\d+\./);
      expect(allQuestions).toHaveLength(9);
      // 功能3个 + 情感3个 + 生理3个 = 9个
    });
  });
});
