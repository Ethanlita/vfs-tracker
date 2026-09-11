/** @file 朗读稿件面板单元测试 */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ReadingPassagePanel from '../../../src/components/ReadingPassagePanel';

const passage = { passageId: 'p1', title: '春天来信', author: '测试作者', content: '第一行\n第二行' };

it('展示标题、作者、正文、正常语速提示和投稿入口', () => {
  render(<ReadingPassagePanel passage={passage} loading={false} canChange hasAlternatives onChange={() => {}} onRetry={() => {}} />);
  expect(screen.getByRole('heading', { name: '《春天来信》' })).toBeInTheDocument();
  expect(screen.getByText('作者：测试作者')).toBeInTheDocument();
  expect(screen.getByText(/说不完也没关系/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '联系和交流' })).toHaveAttribute('href', '/posts/联系和交流');
});

it('开始录音前可以换稿，开始后锁定稿件', () => {
  const onChange = vi.fn();
  const { rerender } = render(<ReadingPassagePanel passage={passage} loading={false} canChange hasAlternatives onChange={onChange} onRetry={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '换一篇' }));
  expect(onChange).toHaveBeenCalledOnce();
  rerender(<ReadingPassagePanel passage={passage} loading={false} canChange={false} hasAlternatives onChange={onChange} onRetry={() => {}} />);
  expect(screen.getByRole('button', { name: '换一篇' })).toBeDisabled();
  expect(screen.getByText(/稿件与录音一致/)).toBeInTheDocument();
});

it('加载失败提供可操作的重试入口', () => {
  const onRetry = vi.fn();
  render(<ReadingPassagePanel loading={false} error={new Error('offline')} canChange={false} hasAlternatives={false} onChange={() => {}} onRetry={onRetry} />);
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
  expect(onRetry).toHaveBeenCalledOnce();
});
