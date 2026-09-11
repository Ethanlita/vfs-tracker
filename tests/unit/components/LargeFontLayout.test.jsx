/**
 * @file 窄屏大字号布局回归测试
 * @description 验证转换表单和频率图表使用可收缩、可换行的语义结构。
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NoteFrequencyTool from '../../../src/components/NoteFrequencyTool';
import VoiceFrequencyChart from '../../../src/components/VoiceFrequencyChart';

vi.mock('soundfont-player', () => ({
  default: { instrument: vi.fn(() => new Promise(() => {})) },
}));

describe('窄屏大字号布局', () => {
  beforeEach(() => {
    window.matchMedia.mockImplementation(query => ({
      matches: query === '(max-width: 640px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it('两个转换表单和输入允许收缩，钢琴保留独立键盘滚动区', () => {
    render(<NoteFrequencyTool />);

    const forms = screen.getAllByRole('button', { name: '立即转换' }).map(button => button.closest('form'));
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form).toHaveClass('min-w-0');
      expect(form.querySelector('input')).toHaveClass('w-full', 'min-w-0', 'max-w-full');
    }

    const pianoScroller = screen.getByRole('region', { name: '88 键钢琴横向滚动区' });
    expect(pianoScroller).toHaveClass('overflow-x-auto', 'max-w-full');
    expect(pianoScroller).toHaveAttribute('tabindex', '0');
  });

  it('指标和时间范围控制允许换行，全部范围仍可用键盘选择', () => {
    render(<VoiceFrequencyChart events={[]} />);

    const allRange = screen.getByRole('button', { name: '全部' });
    const rangeGroup = allRange.parentElement;
    expect(rangeGroup).toHaveClass('flex-wrap', 'w-full', 'min-w-0');
    expect(rangeGroup).not.toHaveClass('overflow-hidden');

    fireEvent.click(allRange);
    expect(allRange).toHaveClass('bg-pink-500');
    expect(screen.getByText('最新值')).toBeInTheDocument();
    expect(screen.getByText('平均值')).toBeInTheDocument();
  });
});
