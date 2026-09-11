/** @file 嗓音测试进度的语义与边界测试。 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VoiceTestProgress from '../../../src/components/voice-test/VoiceTestProgress.jsx';

describe('VoiceTestProgress', () => {
  it('首步提供原生进度语义和百分比', () => {
    render(<VoiceTestProgress currentStep={0} />);
    expect(screen.getByText('步骤 1 / 9')).toBeInTheDocument();
    expect(screen.getByText('11%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '9');
  });

  it('报告页显示完成状态', () => {
    render(<VoiceTestProgress currentStep={8} />);
    expect(screen.getByText('步骤 9 / 9')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
