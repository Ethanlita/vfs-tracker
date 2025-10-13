/**
 * 单元测试: src/components/SurveyRBH.jsx
 * 测试RBH量表组件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SurveyRBH from '../../../src/components/SurveyRBH.jsx';

describe('SurveyRBH 组件测试', () => {
  let mockOnChange;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = vi.fn();
  });

  describe('基础渲染', () => {
    it('显示量表标题', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText('RBH 量表')).toBeInTheDocument();
    });

    it('显示说明文字', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/请对您的声音进行0-3分的评价/)).toBeInTheDocument();
      expect(screen.getByText(/0=无, 1=轻度, 2=中度, 3=重度/)).toBeInTheDocument();
    });

    it('显示所有3个评分项', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/R \(粗糙度\)/)).toBeInTheDocument();
      expect(screen.getByText(/B \(气息感\)/)).toBeInTheDocument();
      expect(screen.getByText(/H \(嘶哑度\)/)).toBeInTheDocument();
    });

    it('每个评分项有下拉选择', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(3);
    });

    it('每个下拉框有5个选项 (请选择 + 0-3)', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const firstSelect = screen.getAllByRole('combobox')[0];
      const options = firstSelect.querySelectorAll('option');
      
      expect(options).toHaveLength(5);
      expect(options[0]).toHaveTextContent('请选择');
      expect(options[1]).toHaveTextContent('0 (无)');
      expect(options[2]).toHaveTextContent('1 (轻度)');
      expect(options[3]).toHaveTextContent('2 (中度)');
      expect(options[4]).toHaveTextContent('3 (重度)');
    });
  });

  describe('下拉选择功能', () => {
    it('选择选项触发onChange', async () => {
      const user = userEvent.setup();
      const values = { R: null, B: null, H: null };
      
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const rSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(rSelect, '2');

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith({ R: 2, B: null, H: null });
    });

    it('选中的选项显示在下拉框中', () => {
      const values = { R: 1, B: 2, H: 3 };
      
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('1');
      expect(selects[1]).toHaveValue('2');
      expect(selects[2]).toHaveValue('3');
    });

    it('可以修改已选择的值', async () => {
      const user = userEvent.setup();
      const values = { R: 1, B: 2, H: 0 };
      
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const hSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(hSelect, '3');

      expect(mockOnChange).toHaveBeenCalledWith({ R: 1, B: 2, H: 3 });
    });

    it('每个项目独立选择', async () => {
      const user = userEvent.setup();
      const values = { R: null, B: null, H: null };
      
      const { rerender } = render(<SurveyRBH values={values} onChange={mockOnChange} />);

      // 选择R
      const rSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(rSelect, '1');

      // 模拟values更新
      rerender(<SurveyRBH values={{ R: 1, B: null, H: null }} onChange={mockOnChange} />);

      // 选择B
      const bSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(bSelect, '2');

      expect(mockOnChange).toHaveBeenCalledTimes(2);
      expect(mockOnChange.mock.calls[0][0]).toEqual({ R: 1, B: null, H: null });
      expect(mockOnChange.mock.calls[1][0]).toEqual({ R: 1, B: 2, H: null });
    });
  });

  describe('分值范围', () => {
    it('支持所有4个分值 (0-3)', async () => {
      const user = userEvent.setup();
      const values = { R: null, B: null, H: null };
      
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const rSelect = screen.getAllByRole('combobox')[0];

      // 测试所有分值
      for (let score = 0; score <= 3; score++) {
        await user.selectOptions(rSelect, String(score));
        
        const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
        expect(lastCall.R).toBe(score);
      }

      expect(mockOnChange).toHaveBeenCalledTimes(4);
    });

    it('选择"请选择"设置为null', async () => {
      const user = userEvent.setup();
      const values = { R: 2, B: null, H: null };
      
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const rSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(rSelect, '');

      expect(mockOnChange).toHaveBeenCalledWith({ R: null, B: null, H: null });
    });
  });

  describe('样式', () => {
    it('容器使用max-w-md居中', () => {
      const values = { R: null, B: null, H: null };
      const { container } = render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('max-w-md', 'mx-auto');
    });

    it('评分项使用flex布局', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const firstItem = screen.getByText(/R \(粗糙度\)/).closest('.flex');
      expect(firstItem).toHaveClass('flex', 'items-center', 'justify-between');
    });

    it('下拉框有样式类', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const firstSelect = screen.getAllByRole('combobox')[0];
      expect(firstSelect).toHaveClass('p-2', 'border', 'rounded-md', 'shadow-sm');
      expect(firstSelect).toHaveClass('focus:ring-purple-500', 'focus:border-purple-500');
    });
  });

  describe('边界情况', () => {
    it('处理空values对象', () => {
      const values = {};
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      selects.forEach(select => {
        expect(select).toHaveValue('');
      });
    });

    it('处理部分填写的values', () => {
      const values = { R: 1, B: null, H: 2 };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('1');
      expect(selects[1]).toHaveValue('');
      expect(selects[2]).toHaveValue('2');
    });

    it('处理全部填写的values', () => {
      const values = { R: 0, B: 1, H: 3 };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('0');
      expect(selects[1]).toHaveValue('1');
      expect(selects[2]).toHaveValue('3');
    });

    it('values为空对象时显示默认值', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      selects.forEach(select => {
        expect(select).toHaveValue(''); // null显示为"请选择"
      });
    });

    it('values额外字段不影响显示', () => {
      const values = { R: 1, B: 2, H: 3, extraField: 999 };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(3); // 只显示R, B, H
    });
  });

  describe('可访问性', () => {
    it('每个评分项有label标签', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/R \(粗糙度\)/)).toBeInTheDocument();
      expect(screen.getByText(/B \(气息感\)/)).toBeInTheDocument();
      expect(screen.getByText(/H \(嘶哑度\)/)).toBeInTheDocument();
    });

    it('下拉框类型为combobox', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(3);
      
      selects.forEach(select => {
        expect(select.tagName).toBe('SELECT');
      });
    });

    it('选项值和文本正确对应', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      const firstSelect = screen.getAllByRole('combobox')[0];
      const options = firstSelect.querySelectorAll('option');
      
      expect(options[0]).toHaveValue('');
      expect(options[1]).toHaveValue('0');
      expect(options[2]).toHaveValue('1');
      expect(options[3]).toHaveValue('2');
      expect(options[4]).toHaveValue('3');
    });
  });

  describe('RBH含义', () => {
    it('R代表粗糙度 (Roughness)', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/R \(粗糙度\)/)).toBeInTheDocument();
    });

    it('B代表气息感 (Breathiness)', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/B \(气息感\)/)).toBeInTheDocument();
    });

    it('H代表嘶哑度 (Hoarseness)', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/H \(嘶哑度\)/)).toBeInTheDocument();
    });

    it('评分范围为0-3分', () => {
      const values = { R: null, B: null, H: null };
      render(<SurveyRBH values={values} onChange={mockOnChange} />);

      expect(screen.getByText(/0=无, 1=轻度, 2=中度, 3=重度/)).toBeInTheDocument();
    });
  });
});
